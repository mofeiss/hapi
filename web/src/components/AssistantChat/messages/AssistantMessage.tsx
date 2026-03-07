import { MessagePrimitive, useAssistantApi, useAssistantState } from '@assistant-ui/react'
import { MarkdownText } from '@/components/assistant-ui/markdown-text'
import { Reasoning, ReasoningGroup } from '@/components/assistant-ui/reasoning'
import { HappyToolMessage } from '@/components/AssistantChat/messages/ToolMessage'
import { CliOutputBlock } from '@/components/CliOutputBlock'
import { MessageCopyButton } from '@/components/AssistantChat/messages/MessageCopyButton'
import { useHappyChatContext } from '@/components/AssistantChat/context'
import { ApiErrorNotice, isApiErrorText } from '@/components/AssistantChat/messages/ApiErrorNotice'
import { buildAssistantCopyText, type AssistantCopyPart } from '@/components/AssistantChat/messages/messageCopy'
import { buildLoadedTranscriptCopyText } from '@/components/AssistantChat/messages/messageTranscriptCopy'
import type { HappyChatMessageMetadata } from '@/lib/assistant-runtime'
import { useTranslation } from '@/lib/use-translation'

const TOOL_COMPONENTS = {
    Fallback: HappyToolMessage
} as const

const MESSAGE_PART_COMPONENTS = {
    Text: MarkdownText,
    Reasoning: Reasoning,
    ReasoningGroup: ReasoningGroup,
    tools: TOOL_COMPONENTS
} as const

export function HappyAssistantMessage() {
    const assistantApi = useAssistantApi()
    const ctx = useHappyChatContext()
    const { locale, t } = useTranslation()
    const isCliOutput = useAssistantState(({ message }) => {
        const custom = message.metadata.custom as Partial<HappyChatMessageMetadata> | undefined
        return custom?.kind === 'cli-output'
    })
    const cliText = useAssistantState(({ message }) => {
        const custom = message.metadata.custom as Partial<HappyChatMessageMetadata> | undefined
        if (custom?.kind !== 'cli-output') return ''
        return message.content.find((part) => part.type === 'text')?.text ?? ''
    })
    const assistantContent = useAssistantState(({ message }) => (
        message.role === 'assistant' ? message.content : []
    ))
    const threadMessagesLength = useAssistantState(({ thread }) => thread.messages.length)
    const currentMessageIndex = useAssistantState(({ message }) => {
        const idx = (message as { index?: number }).index
        return typeof idx === 'number' ? idx : -1
    })
    const transcriptMessages = currentMessageIndex >= 0 && threadMessagesLength > 0
        ? assistantApi.thread().getState().messages.slice(0, currentMessageIndex + 1)
        : []
    const toolOnly = assistantContent.length > 0 && assistantContent.every((part) => part.type === 'tool-call')
    const apiErrorText = (() => {
        if (assistantContent.length !== 1) return null
        const first = assistantContent[0]
        if (first.type !== 'text') return null
        const candidate = first.text.trim()
        return isApiErrorText(candidate) ? candidate : null
    })()
    const copyText = buildAssistantCopyText(
        assistantContent as readonly AssistantCopyPart[],
        {
            metadata: ctx.metadata,
            locale
        }
    )
    const allCopyText = buildLoadedTranscriptCopyText(
        transcriptMessages as Parameters<typeof buildLoadedTranscriptCopyText>[0],
        {
            metadata: ctx.metadata,
            locale,
            t,
            editedMessageTextById: ctx.editedMessageTextById
        }
    )
    const rootClass = toolOnly
        ? 'py-1 min-w-0 max-w-full overflow-x-hidden'
        : 'px-1 min-w-0 max-w-full overflow-x-hidden'
    const actionsClass = 'ml-1 mt-0.5 flex w-fit items-center gap-1'

    if (isCliOutput) {
        return (
            <div className="flex min-w-0 max-w-full flex-col gap-1">
                <MessagePrimitive.Root className="px-1 min-w-0 max-w-full overflow-x-hidden">
                    <CliOutputBlock text={cliText} />
                </MessagePrimitive.Root>
                <div className={actionsClass}>
                    <MessageCopyButton text={cliText} />
                    <MessageCopyButton text={allCopyText} label={t('button.copyAll')} visibleLabel="Copy ALL" />
                </div>
            </div>
        )
    }

    if (apiErrorText) {
        return (
            <div className="flex min-w-0 max-w-full flex-col gap-1">
                <MessagePrimitive.Root className="px-1 min-w-0 max-w-full overflow-x-hidden">
                    <ApiErrorNotice text={apiErrorText} />
                </MessagePrimitive.Root>
                <div className={actionsClass}>
                    <MessageCopyButton text={apiErrorText} />
                    <MessageCopyButton text={allCopyText} label={t('button.copyAll')} visibleLabel="Copy ALL" />
                </div>
            </div>
        )
    }

    return (
        <div className="flex min-w-0 max-w-full flex-col gap-1">
            <MessagePrimitive.Root className={rootClass}>
                <MessagePrimitive.Content components={MESSAGE_PART_COMPONENTS} />
            </MessagePrimitive.Root>
            <div className={actionsClass}>
                <MessageCopyButton text={copyText} />
                <MessageCopyButton text={allCopyText} label={t('button.copyAll')} visibleLabel="Copy ALL" />
            </div>
        </div>
    )
}
