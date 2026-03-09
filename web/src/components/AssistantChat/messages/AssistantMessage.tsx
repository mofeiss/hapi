import { useEffect, useRef, useState } from 'react'
import { MessagePrimitive, useAssistantApi, useAssistantState } from '@assistant-ui/react'
import { MarkdownText } from '@/components/assistant-ui/markdown-text'
import { Reasoning, ReasoningGroup } from '@/components/assistant-ui/reasoning'
import { HappyToolMessage } from '@/components/AssistantChat/messages/ToolMessage'
import { CliOutputBlock } from '@/components/CliOutputBlock'
import { MessageCopyButton } from '@/components/AssistantChat/messages/MessageCopyButton'
import { useHappyChatContext } from '@/components/AssistantChat/context'
import { ApiErrorNotice, isApiErrorText } from '@/components/AssistantChat/messages/ApiErrorNotice'
import { buildAssistantCopyText, type AssistantCopyPart } from '@/components/AssistantChat/messages/messageCopy'
import { formatTurnDurationCompact, getAssistantTurnDurationInfo } from '@/components/AssistantChat/messages/messageDuration'
import { buildLoadedTranscriptCopyText } from '@/components/AssistantChat/messages/messageTranscriptCopy'
import { ClockIcon } from '@/components/icons'
import type { HappyChatMessageMetadata } from '@/lib/assistant-runtime'
import { useTranslation } from '@/lib/use-translation'

const TOOL_COMPONENTS = {
    Fallback: HappyToolMessage
} as const

export const MESSAGE_PART_COMPONENTS = {
    Text: MarkdownText,
    Reasoning: Reasoning,
    ReasoningGroup: ReasoningGroup,
    tools: TOOL_COMPONENTS
} as const

export function MessageTurnDurationBadge(props: {
    startAt: number | null
    fallbackEndAt: number | null
    finalEndAt: number | null
    isLive: boolean
    turnKey: string
}) {
    const { t } = useTranslation()
    const [liveNow, setLiveNow] = useState(() => Date.now())
    const [frozenEndAt, setFrozenEndAt] = useState<number | null>(props.finalEndAt)
    const previousIsLiveRef = useRef(props.isLive)

    useEffect(() => {
        setFrozenEndAt(props.finalEndAt)
        previousIsLiveRef.current = props.isLive
    }, [props.turnKey])

    useEffect(() => {
        if (!props.isLive) return
        setLiveNow(Date.now())
        const timer = window.setInterval(() => {
            setLiveNow(Date.now())
        }, 1000)
        return () => window.clearInterval(timer)
    }, [props.isLive])

    useEffect(() => {
        if (props.finalEndAt !== null) {
            setFrozenEndAt(props.finalEndAt)
        } else if (!props.isLive && previousIsLiveRef.current) {
            setFrozenEndAt(Date.now())
        } else if (props.isLive) {
            setFrozenEndAt(null)
        }
        previousIsLiveRef.current = props.isLive
    }, [props.finalEndAt, props.isLive])

    if (props.startAt === null || props.fallbackEndAt === null) return null

    const endAt = props.isLive
        ? liveNow
        : (props.finalEndAt ?? frozenEndAt ?? props.fallbackEndAt)
    const durationMs = Math.max(0, endAt - props.startAt)
    const label = formatTurnDurationCompact(durationMs)

    return (
        <span
            className="inline-flex items-center gap-1 text-[11px] font-medium text-[var(--app-hint)] select-none"
            title={t('event.turnDuration', { duration: label })}
            aria-label={t('event.turnDuration', { duration: label })}
        >
            <ClockIcon className="h-3.5 w-3.5" />
            <span className="leading-none">{label}</span>
        </span>
    )
}

function useAssistantMessageViewModel() {
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
    const apiErrorText = (() => {
        if (assistantContent.length !== 1) return null
        const first = assistantContent[0]
        if (first.type !== 'text') return null
        const candidate = first.text.trim()
        return isApiErrorText(candidate) ? candidate : null
    })()

    return {
        isCliOutput,
        cliText,
        assistantContent,
        apiErrorText
    }
}

export function HappyAssistantMessageInline() {
    const { isCliOutput, cliText, assistantContent, apiErrorText } = useAssistantMessageViewModel()

    if (isCliOutput) {
        return <CliOutputBlock text={cliText} />
    }

    if (apiErrorText) {
        return <ApiErrorNotice text={apiErrorText} />
    }

    return <MessagePrimitive.Content components={MESSAGE_PART_COMPONENTS} />
}

export function HappyAssistantMessage() {
    const assistantApi = useAssistantApi()
    const ctx = useHappyChatContext()
    const { locale, t } = useTranslation()
    const threadIsRunning = useAssistantState(({ thread }) => thread.isRunning)
    const threadMessagesLength = useAssistantState(({ thread }) => thread.messages.length)
    const currentMessageIndex = useAssistantState(({ message }) => {
        const idx = (message as { index?: number }).index
        return typeof idx === 'number' ? idx : -1
    })
    const { isCliOutput, cliText, assistantContent, apiErrorText } = useAssistantMessageViewModel()
    const allThreadMessages = threadMessagesLength > 0
        ? assistantApi.thread().getState().messages
        : []
    const transcriptMessages = currentMessageIndex >= 0 && allThreadMessages.length > 0
        ? allThreadMessages.slice(0, currentMessageIndex + 1)
        : []
    const turnDurationInfo = currentMessageIndex >= 0
        ? getAssistantTurnDurationInfo(
            allThreadMessages as Parameters<typeof getAssistantTurnDurationInfo>[0],
            currentMessageIndex
        )
        : null
    const isCurrentTurnTailVisible = turnDurationInfo !== null
        && turnDurationInfo.turnEndIndex === threadMessagesLength - 1
    const shouldShowTurnActions = turnDurationInfo !== null
        && turnDurationInfo.lastAssistantOutputIndex === currentMessageIndex
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
    const rootClass = 'px-1 min-w-0 max-w-full overflow-x-hidden'
    const actionsClass = 'ml-1 mt-0.5 flex w-fit items-center gap-1'
    const durationBadge = (
        <MessageTurnDurationBadge
            startAt={turnDurationInfo?.startAt ?? null}
            fallbackEndAt={turnDurationInfo?.fallbackEndAt ?? null}
            finalEndAt={turnDurationInfo?.finalEndAt ?? null}
            isLive={threadIsRunning && isCurrentTurnTailVisible}
            turnKey={turnDurationInfo ? `${turnDurationInfo.startAt}:${turnDurationInfo.turnEndIndex}` : 'none'}
        />
    )

    if (isCliOutput) {
        return (
            <div className="flex min-w-0 max-w-full flex-col gap-1">
                <MessagePrimitive.Root className="px-1 min-w-0 max-w-full overflow-x-hidden">
                    <HappyAssistantMessageInline />
                </MessagePrimitive.Root>
                {shouldShowTurnActions ? (
                    <div className={actionsClass}>
                        <MessageCopyButton text={cliText} hideWhenEmpty={false} />
                        <MessageCopyButton text={allCopyText} label={t('button.copyAll')} visibleLabel="Copy ALL" />
                        {durationBadge}
                    </div>
                ) : null}
            </div>
        )
    }

    if (apiErrorText) {
        return (
            <div className="flex min-w-0 max-w-full flex-col gap-1">
                <MessagePrimitive.Root className="px-1 min-w-0 max-w-full overflow-x-hidden">
                    <HappyAssistantMessageInline />
                </MessagePrimitive.Root>
                {shouldShowTurnActions ? (
                    <div className={actionsClass}>
                        <MessageCopyButton text={apiErrorText} hideWhenEmpty={false} />
                        <MessageCopyButton text={allCopyText} label={t('button.copyAll')} visibleLabel="Copy ALL" />
                        {durationBadge}
                    </div>
                ) : null}
            </div>
        )
    }

    return (
        <div className="flex min-w-0 max-w-full flex-col gap-1">
            <MessagePrimitive.Root className={rootClass}>
                <HappyAssistantMessageInline />
            </MessagePrimitive.Root>
            {shouldShowTurnActions ? (
                <div className={actionsClass}>
                    <MessageCopyButton text={copyText} hideWhenEmpty={false} />
                    <MessageCopyButton text={allCopyText} label={t('button.copyAll')} visibleLabel="Copy ALL" />
                    {durationBadge}
                </div>
            ) : null}
        </div>
    )
}
