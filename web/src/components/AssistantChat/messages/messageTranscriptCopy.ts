import { getEventPresentation } from '@/chat/presentation'
import { buildAssistantCopyText, type AssistantCopyPart } from '@/components/AssistantChat/messages/messageCopy'
import type { HappyChatMessageMetadata } from '@/lib/assistant-runtime'
import type { Locale } from '@/lib/i18n-context'
import type { SessionMetadataSummary } from '@/types/api'

type TranscriptMessage = {
    id: string
    role: 'user' | 'assistant' | 'system'
    content: readonly AssistantCopyPart[]
    metadata?: {
        custom?: Partial<HappyChatMessageMetadata>
    }
}

type TranslationFn = (key: string, params?: Record<string, string | number>) => string

function getCustomMetadata(message: TranscriptMessage): Partial<HappyChatMessageMetadata> | undefined {
    return message.metadata?.custom
}

function getJoinedText(parts: readonly AssistantCopyPart[]): string {
    return parts
        .filter((part): part is AssistantCopyPart & { type: 'text'; text: string } => (
            part.type === 'text' && typeof part.text === 'string'
        ))
        .map((part) => part.text)
        .join('\n\n')
        .trim()
}

function formatUserPrompt(text: string): string {
    const trimmed = text.trim()
    if (!trimmed) return ''
    return [
        '<UserPrompt>',
        trimmed,
        '</UserPrompt>'
    ].join('\n')
}

function formatEvent(text: string): string {
    const trimmed = text.trim()
    if (!trimmed) return ''
    return [
        '<Event>',
        trimmed,
        '</Event>'
    ].join('\n')
}

function resolveVisibleUserText(
    message: TranscriptMessage,
    editedMessageTextById?: Record<string, string>
): string {
    const messageId = message.id.startsWith('user:') ? message.id.slice(5) : message.id
    const edited = editedMessageTextById?.[messageId]
    return (edited ?? getJoinedText(message.content)).trim()
}

function formatTranscriptMessage(
    message: TranscriptMessage,
    options: {
        metadata: SessionMetadataSummary | null
        locale: Locale
        t: TranslationFn
        editedMessageTextById?: Record<string, string>
    }
): string {
    const custom = getCustomMetadata(message)

    if (message.role === 'user') {
        if (custom?.kind === 'cli-output') {
            return getJoinedText(message.content)
        }
        return formatUserPrompt(resolveVisibleUserText(message, options.editedMessageTextById))
    }

    if (message.role === 'assistant') {
        if (custom?.kind === 'cli-output') {
            return getJoinedText(message.content)
        }
        return buildAssistantCopyText(message.content, {
            metadata: options.metadata,
            locale: options.locale,
            includeToolJson: true
        })
    }

    if (custom?.kind === 'event' && custom.event) {
        return formatEvent(getEventPresentation(custom.event, options.t).text)
    }

    return getJoinedText(message.content)
}

function isUserPromptMessage(message: TranscriptMessage): boolean {
    return message.role === 'user' && getCustomMetadata(message)?.kind !== 'cli-output'
}

export function buildLoadedTranscriptCopyText(
    messages: readonly TranscriptMessage[],
    options: {
        metadata: SessionMetadataSummary | null
        locale: Locale
        t: TranslationFn
        editedMessageTextById?: Record<string, string>
    }
): string {
    const firstUserPromptIndex = messages.findIndex(isUserPromptMessage)
    const visibleMessages = firstUserPromptIndex >= 0
        ? messages.slice(firstUserPromptIndex)
        : messages

    const sections = visibleMessages
        .map((message) => formatTranscriptMessage(message, options))
        .filter((text) => text.trim().length > 0)

    return sections.join('\n\n').trim()
}
