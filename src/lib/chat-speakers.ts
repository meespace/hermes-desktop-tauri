export const DEFAULT_ASSISTANT_DISPLAY_NAME = 'Hermes'
export const DEFAULT_USER_DISPLAY_NAME = 'You'

export interface ChatSpeakerLabels {
  assistantDisplayName?: null | string
  userDisplayName?: null | string
}

export function resolveAssistantDisplayName(value: null | string | undefined): string {
  const trimmed = value?.trim() || ''

  return !trimmed || trimmed.toLowerCase() === 'default' ? DEFAULT_ASSISTANT_DISPLAY_NAME : trimmed
}

export function resolveChatSpeakerLabels(labels?: ChatSpeakerLabels): Required<ChatSpeakerLabels> {
  const userDisplayName = labels?.userDisplayName?.trim() || DEFAULT_USER_DISPLAY_NAME

  return {
    assistantDisplayName: resolveAssistantDisplayName(labels?.assistantDisplayName),
    userDisplayName
  }
}
