import type { AttachmentMetadata } from '@/types/api'
import { ResendIcon } from '@/components/icons'
import { useTranslation } from '@/lib/use-translation'

export function MessageResendButton(props: {
    text: string
    attachments?: AttachmentMetadata[]
    align?: 'left' | 'right'
    className?: string
    disabled?: boolean
    onResend?: (text: string, attachments?: AttachmentMetadata[]) => void
}) {
    const { t } = useTranslation()
    const text = props.text.trim()
    const attachments = props.attachments ?? []
    const canResend = Boolean(props.onResend) && (text.length > 0 || attachments.length > 0)

    if (!canResend) return null

    const alignClass = props.align === 'right' ? 'self-end' : 'self-start'

    return (
        <button
            type="button"
            onClick={() => props.onResend?.(text, attachments.length > 0 ? attachments : undefined)}
            title={t('button.resend')}
            aria-label={t('button.resend')}
            disabled={props.disabled}
            className={`inline-flex items-center justify-center rounded p-1 text-[var(--app-hint)] hover:bg-[var(--app-subtle-bg)] hover:text-[var(--app-fg)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${alignClass} ${props.className ?? ''}`}
        >
            <ResendIcon className="block h-3.5 w-3.5" />
        </button>
    )
}
