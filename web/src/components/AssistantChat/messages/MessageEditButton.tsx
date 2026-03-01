import { EditIcon } from '@/components/icons'
import { useTranslation } from '@/lib/use-translation'

export function MessageEditButton(props: {
    align?: 'left' | 'right'
    className?: string
    disabled?: boolean
    onEdit?: () => void
}) {
    const { t } = useTranslation()

    if (!props.onEdit) return null

    const alignClass = props.align === 'right' ? 'self-end' : 'self-start'

    return (
        <button
            type="button"
            onClick={props.onEdit}
            title={t('button.edit')}
            aria-label={t('button.edit')}
            disabled={props.disabled}
            className={`rounded p-1 text-[var(--app-hint)] hover:bg-[var(--app-subtle-bg)] hover:text-[var(--app-fg)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${alignClass} ${props.className ?? ''}`}
        >
            <EditIcon className="h-3.5 w-3.5" />
        </button>
    )
}
