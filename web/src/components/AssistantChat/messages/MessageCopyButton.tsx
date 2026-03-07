import { CheckIcon, CopyAllIcon, CopyIcon } from '@/components/icons'
import { useCopyToClipboard } from '@/hooks/useCopyToClipboard'
import { useTranslation } from '@/lib/use-translation'

export function MessageCopyButton(props: {
    text: string
    align?: 'left' | 'right'
    className?: string
    label?: string
    icon?: 'copy' | 'copy-all'
    visibleLabel?: string
}) {
    const { t } = useTranslation()
    const { copied, copy } = useCopyToClipboard()
    const text = props.text.trim()

    if (!text) return null

    const alignClass = props.align === 'right' ? 'self-end' : 'self-start'
    const label = props.label ?? t('button.copy')
    const IdleIcon = props.icon === 'copy-all' ? CopyAllIcon : CopyIcon
    const hasVisibleLabel = Boolean(props.visibleLabel && props.visibleLabel.trim().length > 0)
    const buttonClass = hasVisibleLabel
        ? `inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] font-medium text-[var(--app-hint)] hover:bg-[var(--app-subtle-bg)] hover:text-[var(--app-fg)] transition-colors ${alignClass} ${props.className ?? ''}`
        : `rounded p-1 text-[var(--app-hint)] hover:bg-[var(--app-subtle-bg)] hover:text-[var(--app-fg)] transition-colors ${alignClass} ${props.className ?? ''}`

    return (
        <button
            type="button"
            onClick={() => copy(text)}
            title={label}
            aria-label={label}
            className={buttonClass}
        >
            {copied ? <CheckIcon className="h-3.5 w-3.5" /> : <IdleIcon className="h-3.5 w-3.5" />}
            {hasVisibleLabel ? (
                <span className="leading-none">{props.visibleLabel}</span>
            ) : null}
        </button>
    )
}
