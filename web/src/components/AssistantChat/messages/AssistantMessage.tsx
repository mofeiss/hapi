import { MessagePrimitive, useAssistantState } from '@assistant-ui/react'
import { MarkdownText } from '@/components/assistant-ui/markdown-text'
import { Reasoning, ReasoningGroup } from '@/components/assistant-ui/reasoning'
import { HappyToolMessage } from '@/components/AssistantChat/messages/ToolMessage'
import { CliOutputBlock } from '@/components/CliOutputBlock'
import { MessageCopyButton } from '@/components/AssistantChat/messages/MessageCopyButton'
import type { HappyChatMessageMetadata } from '@/lib/assistant-runtime'

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
    const isCliOutput = useAssistantState(({ message }) => {
        const custom = message.metadata.custom as Partial<HappyChatMessageMetadata> | undefined
        return custom?.kind === 'cli-output'
    })
    const cliText = useAssistantState(({ message }) => {
        const custom = message.metadata.custom as Partial<HappyChatMessageMetadata> | undefined
        if (custom?.kind !== 'cli-output') return ''
        return message.content.find((part) => part.type === 'text')?.text ?? ''
    })
    const text = useAssistantState(({ message }) => {
        if (message.role !== 'assistant') return ''
        return message.content
            .filter((part) => part.type === 'text')
            .map((part) => part.text)
            .join('\n\n')
    })
    const toolOnly = useAssistantState(({ message }) => {
        if (message.role !== 'assistant') return false
        const parts = message.content
        return parts.length > 0 && parts.every((part) => part.type === 'tool-call')
    })
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

    return (
        <div className="flex min-w-0 max-w-full flex-col gap-1">
            <MessagePrimitive.Root className={rootClass}>
                <MessagePrimitive.Content components={MESSAGE_PART_COMPONENTS} />
            </MessagePrimitive.Root>
            <MessageCopyButton text={text} className="ml-1" />
        </div>
    )
}
