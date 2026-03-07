import { MessagePrimitive, useAssistantState } from '@assistant-ui/react'
import { MarkdownText } from '@/components/assistant-ui/markdown-text'
import { Reasoning, ReasoningGroup } from '@/components/assistant-ui/reasoning'
import { HappyToolMessage } from '@/components/AssistantChat/messages/ToolMessage'
import { CliOutputBlock } from '@/components/CliOutputBlock'
import { MessageCopyButton } from '@/components/AssistantChat/messages/MessageCopyButton'
import { useHappyChatContext } from '@/components/AssistantChat/context'
import { ApiErrorNotice, isApiErrorText } from '@/components/AssistantChat/messages/ApiErrorNotice'
import { buildAssistantCopyText, type AssistantCopyPart } from '@/components/AssistantChat/messages/messageCopy'
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
    const ctx = useHappyChatContext()
    const { locale } = useTranslation()
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
    const rootClass = toolOnly
        ? 'py-1 min-w-0 max-w-full overflow-x-hidden'
        : 'px-1 min-w-0 max-w-full overflow-x-hidden'

    if (isCliOutput) {
        return (
            <div className="flex min-w-0 max-w-full flex-col gap-1">
                <MessagePrimitive.Root className="px-1 min-w-0 max-w-full overflow-x-hidden">
                    <CliOutputBlock text={cliText} />
                </MessagePrimitive.Root>
                <MessageCopyButton text={cliText} className="ml-1" />
            </div>
        )
    }

    if (apiErrorText) {
        return (
            <div className="flex min-w-0 max-w-full flex-col gap-1">
                <MessagePrimitive.Root className="px-1 min-w-0 max-w-full overflow-x-hidden">
                    <ApiErrorNotice text={apiErrorText} />
                </MessagePrimitive.Root>
                <MessageCopyButton text={apiErrorText} className="ml-1" />
            </div>
        )
    }

    return (
        <div className="flex min-w-0 max-w-full flex-col gap-1">
            <MessagePrimitive.Root className={rootClass}>
                <MessagePrimitive.Content components={MESSAGE_PART_COMPONENTS} />
            </MessagePrimitive.Root>
            <MessageCopyButton text={copyText} className="ml-1" />
        </div>
    )
}
