import { cn } from '@/lib/utils'

const API_ERROR_PREFIX = /^api error:\s*/i

export function isApiErrorText(text: string): boolean {
    return API_ERROR_PREFIX.test(text.trim())
}

function normalizeApiErrorDetail(text: string): string {
    const trimmed = text.trim()
    return trimmed.replace(API_ERROR_PREFIX, '').trim()
}

export function ApiErrorNotice(props: {
    text: string
    className?: string
}) {
    const normalizedText = props.text.trim()
    const detail = normalizeApiErrorDetail(normalizedText)

    return (
        <div
            className={cn(
                'w-full max-w-[92%] rounded-md border border-[var(--app-badge-error-border)] bg-[var(--app-badge-error-bg)] px-2 py-1.5 shadow-sm',
                props.className
            )}
        >
            <div className="font-mono text-xs leading-4 text-[var(--app-badge-error-text)] break-words">
                <span className="inline-flex items-center rounded-sm bg-[var(--app-bg)]/70 px-1 text-[10px] font-semibold uppercase tracking-[0.06em] text-[var(--app-badge-error-text)]">
                    API ERROR
                </span>
                <span className="ml-2 whitespace-pre-wrap break-words align-middle">
                    {detail.length > 0 ? detail : normalizedText}
                </span>
            </div>
        </div>
    )
}
