import { CheckIcon, CopyIcon } from '@/components/icons'
import { useCopyToClipboard } from '@/hooks/useCopyToClipboard'
import { useTranslation } from '@/lib/use-translation'

export function MessageCopyButton(props: {
    text: string
    align?: 'left' | 'right'
    className?: string
}) {
    const { t } = useTranslation()
    const { copied, copy } = useCopyToClipboard()
    const text = props.text.trim()

    if (!text) return null

    const alignClass = props.align === 'right' ? 'self-end' : 'self-start'

    return (
        <button
            type="button"
            onClick={() => copy(text)}
            title={t('button.copy')}
            aria-label={t('button.copy')}
            className={`rounded p-1 text-[var(--app-hint)] hover:bg-[var(--app-subtle-bg)] hover:text-[var(--app-fg)] transition-colors ${alignClass} ${props.className ?? ''}`}
        >
            {copied ? <CheckIcon className="h-3.5 w-3.5" /> : <CopyIcon className="h-3.5 w-3.5" />}
        </button>
    )
}
