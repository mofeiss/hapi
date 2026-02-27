import type { QueuedMessage } from '@/hooks/useMessageQueue'
import { Spinner } from '@/components/Spinner'
import { useTranslation } from '@/lib/use-translation'

type QueuedMessagesProps = {
    messages: QueuedMessage[]
}

export function QueuedMessages(props: QueuedMessagesProps) {
    const { t } = useTranslation()

    if (props.messages.length === 0) return null

    return (
        <div className="flex flex-col gap-3">
            {props.messages.map((msg) => (
                <div
                    key={msg.timestamp}
                    className="w-fit min-w-0 max-w-[92%] ml-auto rounded-xl bg-[var(--app-secondary-bg)] px-3 py-2 shadow-sm opacity-55"
                >
                    <div className="flex items-center gap-1.5 mb-1">
                        <Spinner size="sm" label={null} className="text-[var(--app-hint)]" />
                        <span className="text-[10px] font-medium text-[var(--app-hint)] bg-[var(--app-fg)]/[0.06] px-1.5 py-0.5 rounded-full">
                            {t('queue.tag')}
                        </span>
                    </div>
                    <span className="whitespace-pre-wrap text-[var(--app-fg)]">{msg.text}</span>
                </div>
            ))}
        </div>
    )
}
