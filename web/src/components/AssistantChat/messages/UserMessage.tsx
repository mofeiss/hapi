import { MessagePrimitive, useAssistantState } from '@assistant-ui/react'
import { LazyRainbowText } from '@/components/LazyRainbowText'
import { useHappyChatContext } from '@/components/AssistantChat/context'
import type { HappyChatMessageMetadata } from '@/lib/assistant-runtime'
import { MessageStatusIndicator } from '@/components/AssistantChat/messages/MessageStatusIndicator'
import { MessageAttachments } from '@/components/AssistantChat/messages/MessageAttachments'
import { CliOutputBlock } from '@/components/CliOutputBlock'

function formatTimeGap(ms: number): string | null {
    if (ms < 10_000) return null
    const seconds = Math.floor(ms / 1000)
    const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: 'always', style: 'long' })
    if (seconds < 60) return rtf.format(-seconds, 'second')
    const minutes = Math.floor(seconds / 60)
    if (minutes < 60) return rtf.format(-minutes, 'minute')
    const hours = Math.floor(minutes / 60)
    if (hours < 24) return rtf.format(-hours, 'hour')
    const days = Math.floor(hours / 24)
    return rtf.format(-days, 'day')
}

function TurnSeparator({ timeGap }: { timeGap: number | null }) {
    const label = timeGap != null ? formatTimeGap(timeGap) : null
    return (
        <div className="mt-4 mb-4">
            <div className="flex items-center gap-3">
                <div className="flex-1 border-t border-[var(--app-border)]" />
                {label && (
                    <span className="shrink-0 text-[11px] text-[var(--app-hint)] select-none">{label}</span>
                )}
                <div className="flex-1 border-t border-[var(--app-border)]" />
            </div>
        </div>
    )
}

export function HappyUserMessage() {
    const ctx = useHappyChatContext()
    const role = useAssistantState(({ message }) => message.role)
    const text = useAssistantState(({ message }) => {
        if (message.role !== 'user') return ''
        return message.content.find((part) => part.type === 'text')?.text ?? ''
    })
    const status = useAssistantState(({ message }) => {
        if (message.role !== 'user') return undefined
        const custom = message.metadata.custom as Partial<HappyChatMessageMetadata> | undefined
        return custom?.status
    })
    const localId = useAssistantState(({ message }) => {
        if (message.role !== 'user') return null
        const custom = message.metadata.custom as Partial<HappyChatMessageMetadata> | undefined
        return custom?.localId ?? null
    })
    const attachments = useAssistantState(({ message }) => {
        if (message.role !== 'user') return undefined
        const custom = message.metadata.custom as Partial<HappyChatMessageMetadata> | undefined
        return custom?.attachments
    })
    const isCliOutput = useAssistantState(({ message }) => {
        const custom = message.metadata.custom as Partial<HappyChatMessageMetadata> | undefined
        return custom?.kind === 'cli-output'
    })
    const cliText = useAssistantState(({ message }) => {
        const custom = message.metadata.custom as Partial<HappyChatMessageMetadata> | undefined
        if (custom?.kind !== 'cli-output') return ''
        return message.content.find((part) => part.type === 'text')?.text ?? ''
    })
    const isFirstMessage = useAssistantState(({ message }) => {
        const idx = (message as { index?: number }).index
        return idx == null || idx <= 0
    })
    const timeGap = useAssistantState(({ message, thread }) => {
        if (message.role !== 'user') return null
        const idx = (message as { index?: number }).index
        if (idx == null || idx <= 0) return null
        const prev = thread.messages[idx - 1]
        if (!prev?.createdAt || !message.createdAt) return null
        return message.createdAt.getTime() - prev.createdAt.getTime()
    })

    if (role !== 'user') return null
    const canRetry = status === 'failed' && typeof localId === 'string' && Boolean(ctx.onRetryMessage)
    const onRetry = canRetry ? () => ctx.onRetryMessage!(localId) : undefined

    const userBubbleClass = 'w-fit min-w-0 max-w-[92%] ml-auto rounded-xl bg-[var(--app-user-bubble-bg)] px-3 py-2 text-[var(--app-fg)]'

    if (isCliOutput) {
        return (
            <>
                {!isFirstMessage && <TurnSeparator timeGap={timeGap} />}
                <MessagePrimitive.Root className="px-1 min-w-0 max-w-full overflow-x-hidden">
                    <div className="ml-auto w-full max-w-[92%]">
                        <CliOutputBlock text={cliText} />
                    </div>
                </MessagePrimitive.Root>
            </>
        )
    }

    const hasText = text.length > 0
    const hasAttachments = attachments && attachments.length > 0

    return (
        <>
            {!isFirstMessage && <TurnSeparator timeGap={timeGap} />}
            <MessagePrimitive.Root className={userBubbleClass}>
                <div className="flex items-end gap-2">
                    <div className="flex-1 min-w-0">
                        {hasText && <span className="whitespace-pre-wrap">{text}</span>}
                        {hasAttachments && <MessageAttachments attachments={attachments} />}
                    </div>
                    {status ? (
                        <div className="shrink-0 self-end pb-0.5">
                            <MessageStatusIndicator status={status} onRetry={onRetry} />
                        </div>
                    ) : null}
                </div>
            </MessagePrimitive.Root>
        </>
    )
}
