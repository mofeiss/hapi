import { useAssistantState } from '@assistant-ui/react'
import { getEventPresentation } from '@/chat/presentation'
import type { HappyChatMessageMetadata } from '@/lib/assistant-runtime'
import { useTranslation } from '@/lib/use-translation'

export function HappySystemMessage() {
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
        <div className="py-1">
            <div className="max-w-[92%] px-1 text-xs text-[var(--app-hint)] opacity-80">
                <span className="inline-flex items-center border-l-2 border-[var(--app-border)] pl-1.5">
                    <span>{text}</span>
                </span>
            </div>
        </div>
    )
}
