import { ThreadPrimitive, useAssistantApi, useAssistantState } from '@assistant-ui/react'
import { MessageCopyButton } from '@/components/AssistantChat/messages/MessageCopyButton'
import { HappyAssistantMessageInline, MessageTurnDurationBadge } from '@/components/AssistantChat/messages/AssistantMessage'
import { HappySystemMessageInline } from '@/components/AssistantChat/messages/SystemMessage'
import { useHappyChatContext } from '@/components/AssistantChat/context'
import { buildLoadedTranscriptCopyText } from '@/components/AssistantChat/messages/messageTranscriptCopy'
import { getAssistantTurnDurationInfo } from '@/components/AssistantChat/messages/messageDuration'
import { useTranslation } from '@/lib/use-translation'

const TURN_MESSAGE_COMPONENTS = {
    UserMessage: () => null,
    AssistantMessage: HappyAssistantMessageInline,
    SystemMessage: HappySystemMessageInline
} as const

type TurnTranscriptMessage = Parameters<typeof buildLoadedTranscriptCopyText>[0][number]

export function HappyAgentTurnGroup(props: { indices: number[] }) {
    const assistantApi = useAssistantApi()
    const ctx = useHappyChatContext()
    const { locale, t } = useTranslation()
    const threadIsRunning = useAssistantState(({ thread }) => thread.isRunning)
    const threadMessagesLength = useAssistantState(({ thread }) => thread.messages.length)
    const allThreadMessages = threadMessagesLength > 0
        ? assistantApi.thread().getState().messages
        : []
    const endIndex = props.indices[props.indices.length - 1] ?? -1
    const lastAssistantIndex = [...props.indices]
        .reverse()
        .find((index) => allThreadMessages[index]?.role === 'assistant') ?? -1
    const turnMessages = props.indices
        .map((index) => allThreadMessages[index])
        .filter(Boolean) as TurnTranscriptMessage[]
    const transcriptMessages = endIndex >= 0
        ? (allThreadMessages.slice(0, endIndex + 1) as TurnTranscriptMessage[])
        : []
    const turnDurationInfo = lastAssistantIndex >= 0
        ? getAssistantTurnDurationInfo(
            allThreadMessages as Parameters<typeof getAssistantTurnDurationInfo>[0],
            lastAssistantIndex
        )
        : null
    const isCurrentTurnTailVisible = turnDurationInfo !== null
        && turnDurationInfo.turnEndIndex === threadMessagesLength - 1
    const turnCopyText = buildLoadedTranscriptCopyText(turnMessages, {
        metadata: ctx.metadata,
        locale,
        t,
        editedMessageTextById: ctx.editedMessageTextById
    })
    const allCopyText = buildLoadedTranscriptCopyText(transcriptMessages, {
        metadata: ctx.metadata,
        locale,
        t,
        editedMessageTextById: ctx.editedMessageTextById
    })
    const shouldShowTurnActions = lastAssistantIndex >= 0 && turnDurationInfo !== null

    return (
        <div className="flex min-w-0 max-w-full flex-col gap-1">
            <div className="px-1 min-w-0 max-w-full overflow-x-hidden">
                {props.indices.map((index) => (
                    <ThreadPrimitive.MessageByIndex
                        key={`turn-message:${index}`}
                        index={index}
                        components={TURN_MESSAGE_COMPONENTS}
                    />
                ))}
            </div>
            {shouldShowTurnActions ? (
                <div className="ml-1 mt-0.5 flex w-fit items-center gap-1">
                    <MessageCopyButton text={turnCopyText} hideWhenEmpty={false} />
                    <MessageCopyButton text={allCopyText} label={t('button.copyAll')} visibleLabel="Copy ALL" />
                    <MessageTurnDurationBadge
                        startAt={turnDurationInfo.startAt}
                        fallbackEndAt={turnDurationInfo.fallbackEndAt}
                        finalEndAt={turnDurationInfo.finalEndAt}
                        isLive={threadIsRunning && isCurrentTurnTailVisible}
                        turnKey={`${turnDurationInfo.startAt}:${turnDurationInfo.turnEndIndex}`}
                    />
                </div>
            ) : null}
        </div>
    )
}
