import type { AppendMessage, ThreadMessage } from '@assistant-ui/react'
import { type MutableRefObject, useCallback } from 'react'

import { getHermesConfigRecord, transcribeAudio } from '@/hermes'
import {
  appendTextPart,
  assistantTextPart,
  branchGroupForUser,
  type ChatMessage,
  chatMessageText,
  textPart
} from '@/lib/chat-messages'
import { resolveAssistantDisplayName } from '@/lib/chat-speakers'
import {
  attachmentDisplayText,
  INTERRUPTED_MARKER,
  parseCommandDispatch,
  parseSlashCommand,
  pathLabel,
  SLASH_COMMAND_RE
} from '@/lib/chat-runtime'
import {
  type CommandsCatalogLike,
  desktopSlashUnavailableMessage,
  filterDesktopCommandsCatalog,
  isDesktopSlashCommand
} from '@/lib/desktop-slash-commands'
import { triggerHaptic } from '@/lib/haptics'
import { buildLocalChatRequest, resolveLocalChatTarget } from '@/lib/local-model-fast-lane'
import { isProviderSetupErrorMessage } from '@/lib/provider-setup-errors'
import {
  $composerAttachments,
  addComposerAttachment,
  clearComposerAttachments,
  type ComposerAttachment,
  terminalContextBlocksFromDraft
} from '@/store/composer'
import { clearNotifications, notify, notifyError } from '@/store/notifications'
import { requestDesktopOnboarding } from '@/store/onboarding'
import { $activeGatewayProfile } from '@/store/profile'
import {
  $busy,
  $currentCwd,
  $currentModel,
  $currentProvider,
  $messages,
  setAwaitingResponse,
  setBusy,
  setMessages,
  setSessions
} from '@/store/session'
import type { SessionInfo } from '@/types/hermes'

import type { ClientSessionState, ImageAttachResponse, SessionSteerResponse, SessionTitleResponse, SlashExecResponse } from '../../types'

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()

    reader.addEventListener('load', () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result)
      } else {
        reject(new Error('Could not read recorded audio'))
      }
    })
    reader.addEventListener('error', () => reject(reader.error || new Error('Could not read recorded audio')))
    reader.readAsDataURL(blob)
  })
}

function isProviderSetupError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error)

  return isProviderSetupErrorMessage(message)
}

function inlineErrorMessage(error: unknown, fallback: string): string {
  const raw = error instanceof Error ? error.message : typeof error === 'string' ? error : fallback

  return (raw.match(/Error invoking remote method '[^']+': Error: (.+)$/)?.[1] ?? raw).replace(/^Error:\s*/, '').trim()
}

function isTransientSessionBusyError(error: unknown): boolean {
  const message = inlineErrorMessage(error, '')

  return /^session busy\b/i.test(message)
}

async function waitForSessionBusySettle(delayMs: number): Promise<void> {
  await new Promise(resolve => window.setTimeout(resolve, delayMs))
}

async function requestPromptSubmitWithRetry<T>(
  requestGateway: <R>(method: string, params?: Record<string, unknown>) => Promise<R>,
  params: Record<string, unknown>,
  retries = 2,
  delayMs = 120
): Promise<T> {
  let lastError: unknown

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await requestGateway<T>('prompt.submit', params)
    } catch (error) {
      lastError = error

      if (!isTransientSessionBusyError(error) || attempt === retries) {
        throw error
      }

      await waitForSessionBusySettle(delayMs)
    }
  }

  throw lastError
}

interface PromptActionsOptions {
  activeSessionId: string | null
  activeSessionIdRef: MutableRefObject<string | null>
  busyRef: MutableRefObject<boolean>
  branchCurrentSession: () => Promise<boolean>
  createBackendSessionForSend: (preview?: string | null) => Promise<string | null>
  handleSkinCommand: (arg: string) => string
  refreshSessions: () => Promise<void>
  requestGateway: <T>(method: string, params?: Record<string, unknown>) => Promise<T>
  selectedStoredSessionIdRef: MutableRefObject<string | null>
  startFreshSessionDraft: () => void
  sttEnabled: boolean
  updateSessionState: (
    sessionId: string,
    updater: (state: ClientSessionState) => ClientSessionState,
    storedSessionId?: string | null
  ) => ClientSessionState
}

interface SubmitTextOptions {
  attachments?: ComposerAttachment[]
  fromQueue?: boolean
}

function renderCommandsCatalog(catalog: CommandsCatalogLike): string {
  const desktopCatalog = filterDesktopCommandsCatalog(catalog)

  const sections = desktopCatalog.categories?.length
    ? desktopCatalog.categories
    : [{ name: 'Desktop commands', pairs: desktopCatalog.pairs ?? [] }]

  const body = sections
    .filter(section => section.pairs.length > 0)
    .map(section => {
      const rows = section.pairs.map(([cmd, desc]) => `${cmd.padEnd(18)} ${desc}`)

      return [`${section.name}:`, ...rows].join('\n')
    })
    .join('\n\n')

  const tail = [
    desktopCatalog.skill_count ? `${desktopCatalog.skill_count} skill commands available.` : '',
    desktopCatalog.warning ? `warning: ${desktopCatalog.warning}` : ''
  ]
    .filter(Boolean)
    .join('\n')

  return [body || 'No desktop commands available.', tail].filter(Boolean).join('\n\n')
}

function slashStatusText(command: string, output: string): string {
  return [`slash:${command}`, output.trim()].filter(Boolean).join('\n')
}

function appendText(message: AppendMessage): string {
  return message.content
    .map(part => ('text' in part ? part.text : ''))
    .join('')
    .trim()
}

function visibleUserOrdinal(messages: readonly ChatMessage[], end: number): number {
  return messages.slice(0, end).filter(m => m.role === 'user' && !m.hidden).length
}

function nextVisibleTurnAssistant(messages: readonly ChatMessage[], sourceIndex: number): ChatMessage | null {
  for (let index = sourceIndex + 1; index < messages.length; index++) {
    const message = messages[index]

    if (message.hidden) {
      continue
    }

    if (message.role === 'user') {
      return null
    }

    if (message.role === 'assistant') {
      return message
    }
  }

  return null
}

function syncLocalFastLaneSessionRow(sessionId: string, text: string, model: string) {
  const now = Date.now() / 1000
  const preview = text.trim()

  setSessions(current => {
    const index = current.findIndex(session => session.id === sessionId)

    if (index >= 0) {
      return current.map(session =>
        session.id === sessionId
          ? {
              ...session,
              is_active: true,
              last_active: now,
              message_count: Math.max(session.message_count + 2, 2),
              model: model || session.model,
              preview,
              title: session.title || preview
            }
          : session
      )
    }

    const freshSession: SessionInfo = {
      archived: false,
      cwd: $currentCwd.get().trim() || null,
      ended_at: null,
      id: sessionId,
      input_tokens: 0,
      is_active: true,
      last_active: now,
      message_count: 2,
      model: model || null,
      output_tokens: 0,
      preview,
      profile: $activeGatewayProfile.get(),
      source: 'local',
      started_at: now,
      title: preview,
      tool_call_count: 0
    }

    return [freshSession, ...current]
  })
}

export function usePromptActions({
  activeSessionId,
  activeSessionIdRef,
  busyRef,
  branchCurrentSession,
  createBackendSessionForSend,
  handleSkinCommand,
  refreshSessions,
  requestGateway,
  selectedStoredSessionIdRef,
  startFreshSessionDraft,
  sttEnabled,
  updateSessionState
}: PromptActionsOptions) {
  const appendSessionTextMessage = useCallback(
    (sessionId: string, role: ChatMessage['role'], text: string) => {
      const body = text.trim()

      if (!body) {
        return
      }

      updateSessionState(
        sessionId,
        state => ({
          ...state,
          messages: [
            ...state.messages,
            {
              id: `${role}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
              role,
              parts: [textPart(body)]
            }
          ]
        }),
        selectedStoredSessionIdRef.current
      )
    },
    [selectedStoredSessionIdRef, updateSessionState]
  )

  const syncImageAttachmentsForSubmit = useCallback(
    async (
      sessionId: string,
      attachments: ComposerAttachment[],
      options: { updateComposerAttachments?: boolean } = {}
    ) => {
      const updateComposerAttachments = options.updateComposerAttachments ?? true
      const images = attachments.filter(attachment => attachment.kind === 'image' && attachment.path)

      for (const attachment of images) {
        if (attachment.attachedSessionId === sessionId) {
          continue
        }

        const result = await requestGateway<ImageAttachResponse>('image.attach', {
          session_id: sessionId,
          path: attachment.path
        })

        if (!result.attached) {
          const label = attachment.label || (attachment.path ? pathLabel(attachment.path) : 'image')
          throw new Error(result.message || `Could not attach ${label}`)
        }

        const attachedPath = result.path || attachment.path

        if (updateComposerAttachments) {
          addComposerAttachment({
            ...attachment,
            id: attachment.id,
            label: attachedPath ? pathLabel(attachedPath) : attachment.label,
            path: attachedPath,
            attachedSessionId: sessionId
          })
        }
      }
    },
    [requestGateway]
  )

  const submitPromptText = useCallback(
    async (rawText: string, options?: SubmitTextOptions) => {
      const visibleText = rawText.trim()
      const usingComposerAttachments = !options?.attachments
      const attachments = options?.attachments ?? $composerAttachments.get()

      const contextRefs = attachments
        .map(a => a.refText)
        .filter(Boolean)
        .join('\n')

      const terminalContextBlocks = terminalContextBlocksFromDraft(rawText).join('\n\n')
      const hasImage = attachments.some(a => a.kind === 'image')
      const attachmentRefs = attachments.map(attachmentDisplayText).filter((r): r is string => Boolean(r))

      const text =
        [contextRefs, terminalContextBlocks, visibleText].filter(Boolean).join('\n\n') ||
        (hasImage ? 'What do you see in this image?' : '')

      if (!text || (!options?.fromQueue && busyRef.current)) {
        return false
      }

      const optimisticId = `user-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

      const userMessage: ChatMessage = {
        id: optimisticId,
        role: 'user',
        parts: [textPart(visibleText || (attachmentRefs.length ? '' : attachments.map(a => a.label).join(', ')))],
        attachmentRefs
      }

      const releaseBusy = () => {
        busyRef.current = false
        setBusy(false)
        setAwaitingResponse(false)
      }

      const canUseLocalFastLane =
        attachments.length === 0 && terminalContextBlocks.length === 0 && !hasImage && Boolean(visibleText)

      // Idempotent optimistic insert — re-running with the resolved sessionId
      // after createBackendSessionForSend just overwrites with the same id.
      const seedOptimistic = (sid: string) =>
        updateSessionState(
          sid,
          state => ({
            ...state,
            messages: state.messages.some(m => m.id === optimisticId)
              ? state.messages
              : [...state.messages, userMessage],
            busy: true,
            awaitingResponse: true,
            pendingBranchGroup: null,
            sawAssistantPayload: false,
            interrupted: false
          }),
          selectedStoredSessionIdRef.current
        )

      const dropOptimistic = (sid: null | string) => {
        if (!sid) {
          setMessages(current => current.filter(m => m.id !== optimisticId))

          return
        }

        updateSessionState(
          sid,
          state => ({
            ...state,
            messages: state.messages.filter(m => m.id !== optimisticId),
            busy: false,
            awaitingResponse: false,
            pendingBranchGroup: null
          }),
          selectedStoredSessionIdRef.current
        )
      }

      busyRef.current = true
      setBusy(true)
      setAwaitingResponse(true)
      clearNotifications()

      let sessionId: null | string = activeSessionId

      if (sessionId) {
        seedOptimistic(sessionId)
      } else {
        setMessages(current => [...current, userMessage])
      }

      if (!sessionId) {
        try {
          sessionId = await createBackendSessionForSend(visibleText)
        } catch (err) {
          dropOptimistic(null)
          releaseBusy()
          notifyError(err, 'Session unavailable')

          return false
        }

        if (!sessionId) {
          dropOptimistic(null)
          releaseBusy()
          notify({ kind: 'error', title: 'Session unavailable', message: 'Could not create a new session' })

          return false
        }

        seedOptimistic(sessionId)
      }

      try {
        await syncImageAttachmentsForSubmit(sessionId, attachments, {
          updateComposerAttachments: usingComposerAttachments
        })

        if (canUseLocalFastLane && window.hermesDesktop?.localChat) {
          try {
            const config = await getHermesConfigRecord()
            const provider = $currentProvider.get()
            const model = $currentModel.get()
            const target = resolveLocalChatTarget({ config, provider, model })

            if (target) {
              const request = buildLocalChatRequest({
                history: $messages.get(),
                target,
                text
              })
              const streamLocalChat = window.hermesDesktop.localChatStream

              if (streamLocalChat) {
                const assistantId = `assistant-local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
                let streamedText = ''
                let pendingStreamText = ''
                let streamFlushTimer: ReturnType<typeof window.setTimeout> | null = null

                const flushStreamText = () => {
                  if (streamFlushTimer) {
                    window.clearTimeout(streamFlushTimer)
                    streamFlushTimer = null
                  }

                  if (!pendingStreamText) {
                    return
                  }

                  streamedText += pendingStreamText
                  pendingStreamText = ''
                  updateSessionState(
                    sessionId,
                    state => {
                      const assistantIndex = state.messages.findIndex(message => message.id === assistantId)
                      const assistantMessage: ChatMessage = {
                        id: assistantId,
                        role: 'assistant',
                        assistantName: state.assistantName || resolveAssistantDisplayName($activeGatewayProfile.get()),
                        parts: [assistantTextPart(streamedText)],
                        branchGroupId: state.pendingBranchGroup ?? undefined
                      }

                      return {
                        ...state,
                        messages:
                          assistantIndex >= 0
                            ? state.messages.map((message, index) => (index === assistantIndex ? assistantMessage : message))
                            : [...state.messages, assistantMessage],
                        sawAssistantPayload: true
                      }
                    },
                    selectedStoredSessionIdRef.current
                  )
                }

                try {
                  const response = await streamLocalChat(request, delta => {
                    const chunk = delta

                    if (!chunk) {
                      return
                    }

                    pendingStreamText += chunk

                    if (!streamFlushTimer) {
                      streamFlushTimer = window.setTimeout(flushStreamText, 33)
                    }
                  })

                  flushStreamText()
                  const answer = (streamedText || response.text).trim()

                  if (answer) {
                    syncLocalFastLaneSessionRow(sessionId, visibleText, model)
                    releaseBusy()
                    updateSessionState(
                      sessionId,
                      state => ({
                        ...state,
                        messages: state.messages.some(message => message.id === assistantId)
                          ? state.messages.map(message =>
                              message.id === assistantId
                                ? {
                                    ...message,
                                    parts: [assistantTextPart(answer)]
                                  }
                                : message
                            )
                          : [
                              ...state.messages,
                              {
                                id: assistantId,
                                role: 'assistant',
                                assistantName:
                                  state.assistantName || resolveAssistantDisplayName($activeGatewayProfile.get()),
                                parts: [assistantTextPart(answer)],
                                branchGroupId: state.pendingBranchGroup ?? undefined
                              }
                            ],
                        busy: false,
                        awaitingResponse: false,
                        pendingBranchGroup: null,
                        sawAssistantPayload: true,
                        streamId: null
                      }),
                      selectedStoredSessionIdRef.current
                    )

                    if (usingComposerAttachments) {
                      clearComposerAttachments()
                    }

                    return true
                  }
                } catch {
                  if (streamFlushTimer) {
                    window.clearTimeout(streamFlushTimer)
                    streamFlushTimer = null
                  }

                  if (streamedText || pendingStreamText) {
                    updateSessionState(
                      sessionId,
                      state => ({
                        ...state,
                        messages: state.messages.filter(message => message.id !== assistantId),
                        sawAssistantPayload: state.messages.some(
                          message => message.id !== assistantId && message.role === 'assistant'
                        )
                      }),
                      selectedStoredSessionIdRef.current
                    )
                  }
                  // Fall back to the non-streaming local fast lane below.
                }
              }

              const response = await window.hermesDesktop.localChat(request)
              const answer = response.text.trim()

              if (answer) {
                syncLocalFastLaneSessionRow(sessionId, visibleText, model)
                releaseBusy()
                updateSessionState(
                  sessionId,
                  state => ({
                    ...state,
                    messages: [
                      ...state.messages,
                      {
                        id: `assistant-local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
                        role: 'assistant',
                        assistantName:
                          state.assistantName || resolveAssistantDisplayName($activeGatewayProfile.get()),
                        parts: [assistantTextPart(answer)],
                        branchGroupId: state.pendingBranchGroup ?? undefined
                      }
                    ],
                    busy: false,
                    awaitingResponse: false,
                    pendingBranchGroup: null,
                    sawAssistantPayload: true,
                    streamId: null
                  }),
                  selectedStoredSessionIdRef.current
                )

                if (usingComposerAttachments) {
                  clearComposerAttachments()
                }

                return true
              }
            }
          } catch {
            // Local fast lane is opportunistic. If a local service is down or
            // not quite compatible, keep the official Hermes Agent path.
          }
        }

        await requestPromptSubmitWithRetry(requestGateway, { session_id: sessionId, text })

        if (usingComposerAttachments) {
          clearComposerAttachments()
        }

        return true
      } catch (err) {
        const message = inlineErrorMessage(err, 'Prompt failed')

        releaseBusy()
        updateSessionState(sessionId, state => ({
          ...state,
          messages: [
            ...state.messages,
            {
              id: `assistant-error-${Date.now()}`,
              role: 'assistant',
              assistantName: state.assistantName || resolveAssistantDisplayName($activeGatewayProfile.get()),
              parts: [],
              error: message || 'Prompt failed',
              branchGroupId: state.pendingBranchGroup ?? undefined
            }
          ],
          busy: false,
          awaitingResponse: false,
          pendingBranchGroup: null,
          sawAssistantPayload: true
        }))

        if (isProviderSetupError(err)) {
          requestDesktopOnboarding('Add a provider credential before sending your first message.')

          return false
        }

        notifyError(err, 'Prompt failed')

        return false
      }
    },
    [
      activeSessionId,
      busyRef,
      createBackendSessionForSend,
      requestGateway,
      selectedStoredSessionIdRef,
      syncImageAttachmentsForSubmit,
      updateSessionState
    ]
  )

  const executeSlashCommand = useCallback(
    async (rawCommand: string, options?: { sessionId?: string; recordInput?: boolean }) => {
      const runSlash = async (commandText: string, sessionHint?: string, recordInput = true): Promise<void> => {
        const command = commandText.trim()
        const { name, arg } = parseSlashCommand(command)
        const normalizedName = name.toLowerCase()

        if (!name) {
          const sessionId = sessionHint || activeSessionIdRef.current || (await createBackendSessionForSend())

          if (sessionId) {
            appendSessionTextMessage(sessionId, 'system', 'empty slash command')
          }

          return
        }

        if (normalizedName === 'new' || normalizedName === 'reset') {
          startFreshSessionDraft()

          return
        }

        if (normalizedName === 'branch' || normalizedName === 'fork') {
          await branchCurrentSession()

          return
        }

        if (normalizedName === 'skin' && !sessionHint && !activeSessionIdRef.current) {
          notify({ kind: 'success', message: handleSkinCommand(arg) })

          return
        }

        const sessionId = sessionHint || activeSessionIdRef.current || (await createBackendSessionForSend())

        if (!sessionId) {
          notify({
            kind: 'error',
            title: 'Session unavailable',
            message: 'Could not create a new session'
          })

          return
        }

        const renderSlashOutput = (text: string) =>
          appendSessionTextMessage(sessionId, 'system', recordInput ? slashStatusText(command, text) : text)

        if (normalizedName === 'skin') {
          renderSlashOutput(handleSkinCommand(arg))

          return
        }

        if (name === 'help' || name === 'commands') {
          try {
            const catalog = await requestGateway<CommandsCatalogLike>('commands.catalog', { session_id: sessionId })

            renderSlashOutput(renderCommandsCatalog(catalog))
          } catch (err) {
            renderSlashOutput(`error: ${err instanceof Error ? err.message : String(err)}`)
          }

          return
        }

        if (normalizedName === 'title' && arg) {
          try {
            const result = await requestGateway<SessionTitleResponse>('session.title', {
              session_id: sessionId,
              title: arg
            })
            const finalTitle = (result?.title || arg).trim()

            setSessions(prev => prev.map(session => (session.id === sessionId ? { ...session, title: finalTitle || null } : session)))
            await refreshSessions()
            renderSlashOutput(result?.pending ? `title queued: ${finalTitle}` : `title: ${finalTitle}`)
          } catch (err) {
            renderSlashOutput(`error: ${err instanceof Error ? err.message : String(err)}`)
          }

          return
        }

        if (!isDesktopSlashCommand(name)) {
          renderSlashOutput(desktopSlashUnavailableMessage(name) || `/${name} is not available in the desktop app.`)

          return
        }

        try {
          const result = await requestGateway<SlashExecResponse>('slash.exec', {
            session_id: sessionId,
            command: command.replace(/^\/+/, '')
          })

          const body = result?.output || `/${name}: no output`
          renderSlashOutput(result?.warning ? `warning: ${result.warning}\n${body}` : body)

          return
        } catch {
          // Fall back to command.dispatch for skill/send/alias directives.
        }

        try {
          const dispatch = parseCommandDispatch(
            await requestGateway<unknown>('command.dispatch', {
              session_id: sessionId,
              name,
              arg
            })
          )

          if (!dispatch) {
            renderSlashOutput('error: invalid response: command.dispatch')

            return
          }

          if (dispatch.type === 'exec' || dispatch.type === 'plugin') {
            renderSlashOutput(dispatch.output ?? '(no output)')

            return
          }

          if (dispatch.type === 'alias') {
            await runSlash(`/${dispatch.target}${arg ? ` ${arg}` : ''}`, sessionId, false)

            return
          }

          const message = ('message' in dispatch ? dispatch.message : '')?.trim() ?? ''

          if (!message) {
            renderSlashOutput(
              `/${name}: ${dispatch.type === 'skill' ? 'skill payload missing message' : 'empty message'}`
            )

            return
          }

          if (dispatch.type === 'skill') {
            renderSlashOutput(`⚡ loading skill: ${dispatch.name}`)
          }

          if (busyRef.current) {
            renderSlashOutput('session busy — /interrupt the current turn before sending this command')

            return
          }

          await submitPromptText(message)
        } catch (err) {
          renderSlashOutput(`error: ${err instanceof Error ? err.message : String(err)}`)
        }
      }

      await runSlash(rawCommand, options?.sessionId, options?.recordInput ?? true)
    },
    [
      activeSessionIdRef,
      appendSessionTextMessage,
      branchCurrentSession,
      busyRef,
      createBackendSessionForSend,
      handleSkinCommand,
      refreshSessions,
      requestGateway,
      startFreshSessionDraft,
      submitPromptText
    ]
  )

  const submitText = useCallback(
    async (rawText: string, options?: SubmitTextOptions) => {
      const visibleText = rawText.trim()
      const attachments = options?.attachments ?? $composerAttachments.get()

      if (!attachments.length && SLASH_COMMAND_RE.test(visibleText)) {
        triggerHaptic('selection')
        await executeSlashCommand(visibleText)

        return true
      }

      return await submitPromptText(rawText, options)
    },
    [executeSlashCommand, submitPromptText]
  )

  const transcribeVoiceAudio = useCallback(
    async (audio: Blob) => {
      if (!sttEnabled) {
        throw new Error('Speech-to-text is disabled in settings.')
      }

      const dataUrl = await blobToDataUrl(audio)
      const result = await transcribeAudio(dataUrl, audio.type)

      return result.transcript
    },
    [sttEnabled]
  )

  const steerPrompt = useCallback(
    async (rawText: string): Promise<boolean> => {
      const text = rawText.trim()
      const sessionId = activeSessionId || activeSessionIdRef.current

      if (!text || !sessionId) {
        return false
      }

      try {
        const result = await requestGateway<SessionSteerResponse>('session.steer', { session_id: sessionId, text })

        if (result?.status === 'queued') {
          triggerHaptic('submit')

          return true
        }
      } catch {
        // Steer is opportunistic. The caller can queue the text as a normal turn.
      }

      return false
    },
    [activeSessionId, activeSessionIdRef, requestGateway]
  )

  const cancelRun = useCallback(async () => {
    const sessionId = activeSessionId || activeSessionIdRef.current

    busyRef.current = false
    setBusy(false)
    setAwaitingResponse(false)

    const finalizeMessages = (messages: ChatMessage[]) =>
      messages.map(message =>
        message.pending
          ? {
              ...message,
              parts: chatMessageText(message).trim()
                ? appendTextPart(message.parts, INTERRUPTED_MARKER)
                : [...message.parts, textPart(INTERRUPTED_MARKER.trim())],
              pending: false
            }
          : message
      )

    if (!sessionId) {
      setMessages(finalizeMessages($messages.get()))

      return
    }

    updateSessionState(sessionId, state => {
      const streamId = state.streamId

      const messages = streamId
        ? state.messages.map(message =>
            message.id === streamId
              ? {
                  ...message,
                  parts: chatMessageText(message).trim()
                    ? appendTextPart(message.parts, INTERRUPTED_MARKER)
                    : [...message.parts, textPart(INTERRUPTED_MARKER.trim())],
                  pending: false
                }
              : message
          )
        : finalizeMessages(state.messages)

      return {
        ...state,
        messages,
        busy: false,
        awaitingResponse: false,
        streamId: null,
        pendingBranchGroup: null,
        interrupted: true
      }
    })

    try {
      await requestGateway('session.interrupt', { session_id: sessionId })
    } catch (err) {
      notifyError(err, 'Stop failed')
    }
  }, [activeSessionId, activeSessionIdRef, busyRef, requestGateway, updateSessionState])

  const reloadFromMessage = useCallback(
    async (parentId: string | null) => {
      if (!activeSessionId || $busy.get()) {
        return
      }

      const messages = $messages.get()
      const parentIndex = parentId ? messages.findIndex(message => message.id === parentId) : messages.length - 1

      const userIndex =
        parentIndex >= 0
          ? [...messages.slice(0, parentIndex + 1)].reverse().findIndex(message => message.role === 'user')
          : -1

      if (userIndex < 0) {
        return
      }

      const absoluteUserIndex = parentIndex - userIndex
      const userMessage = messages[absoluteUserIndex]
      const userText = userMessage ? chatMessageText(userMessage).trim() : ''

      if (!userText) {
        return
      }

      const targetAssistant =
        parentId && messages[parentIndex]?.role === 'assistant'
          ? messages[parentIndex]
          : messages.slice(absoluteUserIndex + 1).find(message => message.role === 'assistant')

      const branchGroupId = targetAssistant?.branchGroupId ?? branchGroupForUser(userMessage)
      const truncateBeforeUserOrdinal = visibleUserOrdinal(messages, absoluteUserIndex)

      clearNotifications()
      updateSessionState(activeSessionId, state => {
        const nextUserIndex = state.messages.findIndex(
          (message, index) => index > absoluteUserIndex && message.role === 'user'
        )

        const end = nextUserIndex < 0 ? state.messages.length : nextUserIndex

        return {
          ...state,
          busy: true,
          awaitingResponse: true,
          pendingBranchGroup: branchGroupId,
          sawAssistantPayload: false,
          interrupted: false,
          messages: [
            ...state.messages.slice(0, absoluteUserIndex + 1),
            ...state.messages
              .slice(absoluteUserIndex + 1, end)
              .map(message => (message.role === 'assistant' ? { ...message, branchGroupId, hidden: true } : message))
          ]
        }
      })

      try {
        await requestPromptSubmitWithRetry(requestGateway, {
          session_id: activeSessionId,
          text: userText,
          truncate_before_user_ordinal: truncateBeforeUserOrdinal
        })
      } catch (err) {
        updateSessionState(activeSessionId, state => ({
          ...state,
          busy: false,
          awaitingResponse: false
        }))
        notifyError(err, 'Regenerate failed')
      }
    },
    [activeSessionId, requestGateway, updateSessionState]
  )

  const editMessage = useCallback(
    async (edited: AppendMessage) => {
      const sessionId = activeSessionId || activeSessionIdRef.current
      const sourceId = edited.sourceId || edited.parentId
      const text = appendText(edited)

      if (!sessionId || !sourceId || !text || edited.role !== 'user' || $busy.get()) {
        return
      }

      const messages = $messages.get()
      const sourceIndex = messages.findIndex(m => m.id === sourceId)
      const source = messages[sourceIndex]

      if (!source || source.role !== 'user' || source.hidden || chatMessageText(source).trim() === text) {
        return
      }

      // Failed turn: optimistic user msg never reached the gateway, so truncating
      // by ordinal would 422. Submit as a plain resend instead.
      const nextAssistant = nextVisibleTurnAssistant(messages, sourceIndex)
      const isFailedTurn = Boolean(nextAssistant?.error)

      if (nextAssistant && !isFailedTurn) {
        return
      }

      const editedMessage: ChatMessage = { ...source, parts: [textPart(text)] }

      clearNotifications()
      busyRef.current = true
      setBusy(true)
      setAwaitingResponse(true)
      updateSessionState(sessionId, state => ({
        ...state,
        busy: true,
        awaitingResponse: true,
        pendingBranchGroup: null,
        sawAssistantPayload: false,
        interrupted: false,
        messages: [...state.messages.slice(0, sourceIndex), editedMessage]
      }))

      const submit = (truncateOrdinal?: number) =>
        requestPromptSubmitWithRetry(requestGateway, {
          session_id: sessionId,
          text,
          ...(truncateOrdinal !== undefined && { truncate_before_user_ordinal: truncateOrdinal })
        })

      const isStaleTargetError = (err: unknown) =>
        /no longer in session history|not in session history/i.test(err instanceof Error ? err.message : String(err))

      try {
        await submit(isFailedTurn ? undefined : visibleUserOrdinal(messages, sourceIndex))
      } catch (err) {
        let surfaced = err

        if (!isFailedTurn && isStaleTargetError(err)) {
          try {
            await submit()

            return
          } catch (retryErr) {
            surfaced = retryErr
          }
        }

        busyRef.current = false
        setBusy(false)
        setAwaitingResponse(false)
        updateSessionState(sessionId, state => ({ ...state, busy: false, awaitingResponse: false }))
        notifyError(surfaced, 'Edit failed')
      }
    },
    [activeSessionId, activeSessionIdRef, busyRef, requestGateway, updateSessionState]
  )

  const handleThreadMessagesChange = useCallback(
    (nextMessages: readonly ThreadMessage[]) => {
      const visibleIds = new Set(nextMessages.map(m => m.id))
      const sessionId = activeSessionIdRef.current

      if (!sessionId) {
        return
      }

      updateSessionState(sessionId, state => {
        let changed = false

        const messages = state.messages.map(message => {
          if (message.role !== 'assistant' || !message.branchGroupId) {
            return message
          }

          const hidden = !visibleIds.has(message.id)

          if (message.hidden === hidden) {
            return message
          }

          changed = true

          return { ...message, hidden }
        })

        return changed ? { ...state, messages } : state
      })
    },
    [activeSessionIdRef, updateSessionState]
  )

  return {
    cancelRun,
    editMessage,
    handleThreadMessagesChange,
    reloadFromMessage,
    steerPrompt,
    submitText,
    transcribeVoiceAudio
  }
}
