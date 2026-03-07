import { MessagePrimitive, useAssistantState } from '@assistant-ui/react'
import { getEventPresentation } from '@/chat/presentation'
import { OUTER_DISCLOSURE_ITEM_CLASS } from '@/components/Disclosure'
import type { HappyChatMessageMetadata } from '@/lib/assistant-runtime'
import { useTranslation } from '@/lib/use-translation'

export function HappySystemMessageInline() {
    const { t } = useTranslation()
    const role = useAssistantState(({ message }) => message.role)
    const fallbackText = useAssistantState(({ message }) => {
        if (message.role !== 'system') return ''
        return message.content[0]?.type === 'text' ? message.content[0].text : ''
    })
    const event = useAssistantState(({ message }) => {
        if (message.role !== 'system') return undefined
        const custom = message.metadata.custom as Partial<HappyChatMessageMetadata> | undefined
        return custom?.kind === 'event' ? custom.event : undefined
    })

    if (role !== 'system') return null

    const presentation = event ? getEventPresentation(event, t) : null
    const text = presentation?.text ?? fallbackText

    return (
        <div className={OUTER_DISCLOSURE_ITEM_CLASS}>
            <div className="w-fit min-w-0 max-w-full rounded-md bg-[var(--app-subtle-bg)] px-[3px] py-1">
                <div className="flex min-w-0 items-center gap-0 text-[var(--app-hint)]">
                    <span className="shrink-0 flex h-4 w-4 items-center justify-center leading-none">
                        <span className="h-4 w-0.5 bg-[var(--app-border-on-subtle)]" />
                    </span>
                    <span className="min-w-0 break-words text-sm leading-tight text-[var(--app-hint)] opacity-80">
                        {text}
                    </span>
                    <span className="shrink-0 flex h-4 w-4 items-center justify-center leading-none">
                        <span className="h-4 w-0.5 bg-[var(--app-border-on-subtle)]" />
                    </span>
                </div>
            </div>
        </div>
    )
}

export function HappySystemMessage() {
    return (
        <MessagePrimitive.Root className="px-1 min-w-0 max-w-full overflow-x-hidden">
            <HappySystemMessageInline />
        </MessagePrimitive.Root>
    )
}
