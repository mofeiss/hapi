import { useEffect, useState } from 'react'
import { MessagePrimitive, useAssistantState } from '@assistant-ui/react'
import { useHappyChatContext } from '@/components/AssistantChat/context'
import type { HappyChatMessageMetadata } from '@/lib/assistant-runtime'
import { MessageStatusIndicator } from '@/components/AssistantChat/messages/MessageStatusIndicator'
import { MessageAttachments } from '@/components/AssistantChat/messages/MessageAttachments'
import { MessageCopyButton } from '@/components/AssistantChat/messages/MessageCopyButton'
import { MessageEditButton } from '@/components/AssistantChat/messages/MessageEditButton'
import { MessageResendButton } from '@/components/AssistantChat/messages/MessageResendButton'
import { CliOutputBlock } from '@/components/CliOutputBlock'
import { ChevronDownIcon } from '@/components/icons'
import { useTranslation } from '@/lib/use-translation'
import { Button } from '@/components/ui/button'

const MAX_COLLAPSED_PROMPT_CHARS = 1000

function formatTimeGap(ms: number): string | null {
    const normalizedMs = Math.max(0, ms)
    const seconds = Math.floor(normalizedMs / 1000)
    const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto', style: 'long' })
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
    const { t } = useTranslation()
    const [isEditing, setIsEditing] = useState(false)
    const [isPreparingEdit, setIsPreparingEdit] = useState(false)
    const [isPromptExpanded, setIsPromptExpanded] = useState(false)
    const [draft, setDraft] = useState('')
    const role = useAssistantState(({ message }) => message.role)
    const threadMessageId = useAssistantState(({ message }) => message.id)
    const text = useAssistantState(({ message }) => {
        if (message.role !== 'user') return ''
        return message.content
            .filter((part) => part.type === 'text')
            .map((part) => part.text)
            .join('\n\n')
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
    const isLastUserMessage = useAssistantState(({ message, thread }) => {
        if (message.role !== 'user') return false
        const idx = (message as { index?: number }).index
        if (idx == null || idx < 0) return false
        for (let i = idx + 1; i < thread.messages.length; i += 1) {
            if (thread.messages[i]?.role === 'user') {
                return false
            }
        }
        return true
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
    const messageId = threadMessageId.startsWith('user:') ? threadMessageId.slice(5) : threadMessageId
    const effectiveText = ctx.editedMessageTextById?.[messageId] ?? text
    const shouldCollapsePrompt = effectiveText.length > MAX_COLLAPSED_PROMPT_CHARS
    const visibleText = shouldCollapsePrompt && !isPromptExpanded
        ? effectiveText.slice(0, MAX_COLLAPSED_PROMPT_CHARS)
        : effectiveText
    const isEdited = Boolean(ctx.editedMessageTextById?.[messageId])
    const canEdit = !isCliOutput
        && isLastUserMessage
        && Boolean(ctx.onStartEditMessage)
        && Boolean(ctx.onCommitEditMessage)
        && !ctx.disabled

    const userBubbleClass = 'w-fit min-w-0 max-w-full rounded-xl bg-[var(--app-secondary-bg)] px-3 py-2 text-[var(--app-fg)]'
    const editComposerClass = 'w-full min-w-0 max-w-full overflow-hidden rounded-[20px] bg-[var(--app-secondary-bg)] text-[var(--app-fg)] shadow-sm'
    const rootClass = isEditing ? editComposerClass : userBubbleClass
    const containerClass = isEditing
        ? 'ml-auto flex w-full min-w-0 max-w-[92%] flex-col items-end gap-1'
        : 'ml-auto flex w-fit min-w-0 max-w-[92%] flex-col items-end gap-1'

    useEffect(() => {
        setIsPromptExpanded(false)
    }, [messageId])

    const beginEdit = async () => {
        if (!canEdit || !ctx.onStartEditMessage) return
        setIsPreparingEdit(true)
        try {
            await ctx.onStartEditMessage(messageId)
            setDraft(effectiveText)
            setIsEditing(true)
        } catch (error) {
            console.error('Failed to start edit mode:', error)
        } finally {
            setIsPreparingEdit(false)
        }
    }

    const cancelEdit = () => {
        setIsEditing(false)
        setDraft(effectiveText)
    }

    const submitEdit = () => {
        if (!ctx.onCommitEditMessage) return
        const nextText = draft
        if (!nextText.trim() && (!attachments || attachments.length === 0)) {
            return
        }
        ctx.onCommitEditMessage({
            messageId,
            text: nextText,
            attachments
        })
        setIsEditing(false)
    }

    if (isCliOutput) {
        return (
            <>
                {!isFirstMessage && <TurnSeparator timeGap={timeGap} />}
                <MessagePrimitive.Root className="px-1 min-w-0 max-w-full overflow-x-hidden">
                    <div className="ml-auto w-full max-w-[92%]">
                        <CliOutputBlock text={cliText} />
                    </div>
                </MessagePrimitive.Root>
                <div className="ml-auto mr-2 mt-1 flex w-fit items-center gap-1">
                    <MessageCopyButton text={cliText} align="right" className="p-1" />
                    <MessageResendButton
                        text={cliText}
                        align="right"
                        className="p-1"
                        disabled={ctx.disabled}
                        onResend={ctx.onResendMessage}
                    />
                </div>
            </>
        )
    }

    const hasText = effectiveText.length > 0
    const hasAttachments = attachments && attachments.length > 0

    return (
        <>
            {!isFirstMessage && <TurnSeparator timeGap={timeGap} />}
            <div className={containerClass}>
                <MessagePrimitive.Root className={rootClass}>
                    <div className="flex items-end gap-2">
                        <div className="flex-1 min-w-0">
                            {isEditing ? (
                                <>
                                    <div className="flex items-center px-4 py-2">
                                        <textarea
                                            value={draft}
                                            onChange={(event) => setDraft(event.target.value)}
                                            rows={Math.max(1, Math.min(8, draft.split('\n').length))}
                                            className="w-full resize-none bg-transparent text-base leading-snug text-[var(--app-fg)] placeholder-[var(--app-hint)] outline-none"
                                        />
                                    </div>

                                    {hasAttachments ? (
                                        <div className="px-4 pb-2">
                                            <MessageAttachments attachments={attachments} />
                                        </div>
                                    ) : null}

                                    <div className="flex items-center justify-end gap-1.5 px-2 pb-1.5">
                                        <Button
                                            type="button"
                                            variant="secondary"
                                            size="sm"
                                            onClick={cancelEdit}
                                            className="h-8 rounded-full bg-[var(--app-fg)]/[0.04] px-3 text-[var(--app-hint)] hover:bg-[var(--app-bg)] hover:text-[var(--app-fg)]"
                                        >
                                            {t('button.cancel')}
                                        </Button>
                                        <Button
                                            type="button"
                                            size="sm"
                                            onClick={submitEdit}
                                            disabled={!draft.trim() && !hasAttachments}
                                            className="h-8 rounded-full px-3"
                                        >
                                            {t('composer.send')}
                                        </Button>
                                    </div>
                                </>
                            ) : (
                                <>
                                    {hasText && (
                                        <>
                                            <span className="whitespace-pre-wrap">{visibleText}</span>
                                            {shouldCollapsePrompt && !isPromptExpanded ? (
                                                <div className="mt-1 inline-flex items-center gap-1 text-xs text-[var(--app-hint)]">
                                                    <span className="select-none">...</span>
                                                    <button
                                                        type="button"
                                                        title={t('chat.prompt.expand')}
                                                        aria-label={t('chat.prompt.expand')}
                                                        onClick={() => setIsPromptExpanded(true)}
                                                        className="relative -top-px inline-flex items-center rounded p-0.5 text-[var(--app-hint)] transition-colors hover:bg-[var(--app-subtle-bg)] hover:text-[var(--app-fg)]"
                                                    >
                                                        <ChevronDownIcon className="h-5 w-5" />
                                                    </button>
                                                </div>
                                            ) : null}
                                        </>
                                    )}
                                    {hasAttachments && <MessageAttachments attachments={attachments} />}
                                </>
                            )}
                        </div>
                        {status && !isEditing ? (
                            <div className="shrink-0 self-end pb-0.5">
                                <MessageStatusIndicator status={status} onRetry={onRetry} />
                            </div>
                        ) : null}
                    </div>
                </MessagePrimitive.Root>
                {!isEditing ? (
                    <div className="flex items-center gap-1.5">
                        <MessageCopyButton text={effectiveText} align="right" className="p-1" />
                        <MessageResendButton
                            text={effectiveText}
                            attachments={attachments}
                            align="right"
                            className="p-1"
                            disabled={ctx.disabled}
                            onResend={ctx.onResendMessage}
                        />
                        <MessageEditButton
                            align="right"
                            className="p-1"
                            disabled={ctx.disabled || isPreparingEdit || isEditing}
                            onEdit={canEdit ? beginEdit : undefined}
                        />
                        {isEdited ? (
                            <div className="pointer-events-none select-none inline-flex items-center border-l-2 border-[var(--app-border)] pl-1.5 text-[11px] text-[var(--app-hint)] opacity-80">
                                {t('chat.edited.badge')}
                            </div>
                        ) : null}
                    </div>
                ) : null}
            </div>
        </>
    )
}
