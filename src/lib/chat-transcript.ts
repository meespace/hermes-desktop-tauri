import type { ChatMessage } from '@/lib/chat-messages'
import { chatMessageText } from '@/lib/chat-messages'
import { resolveAssistantDisplayName, resolveChatSpeakerLabels, type ChatSpeakerLabels } from '@/lib/chat-speakers'

export type TranscriptFormat = 'text' | 'markdown'

function transcriptContent(message: ChatMessage): string {
  const body = chatMessageText(message).trim()
  const refs = (message.attachmentRefs ?? []).map(value => value.trim()).filter(Boolean)

  if (!refs.length) {
    return body
  }

  return [refs.join('\n'), body].filter(Boolean).join('\n\n')
}

export function buildChatTranscript(
  messages: readonly ChatMessage[],
  format: TranscriptFormat,
  labels?: ChatSpeakerLabels
): string {
  const { assistantDisplayName, userDisplayName } = resolveChatSpeakerLabels(labels)

  return messages
    .filter(message => !message.hidden && (message.role === 'user' || message.role === 'assistant'))
    .map(message => {
      const speaker =
        message.role === 'user'
          ? userDisplayName
          : resolveAssistantDisplayName(message.assistantName || assistantDisplayName)
      const content = transcriptContent(message)

      if (!content) {
        return ''
      }

      return format === 'markdown' ? `**${speaker}:**\n\n${content}` : `${speaker}: ${content}`
    })
    .filter(Boolean)
    .join('\n\n')
}
