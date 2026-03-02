const SUPPORTED_REASONING_EFFORTS = new Set([
    'none',
    'minimal',
    'low',
    'medium',
    'high',
    'xhigh'
])

type SessionRuntimeMetadata = {
    model?: string | null
    reasoningEffort?: string | null
}

function normalizeModelLabel(value: string | null | undefined): string {
    if (typeof value !== 'string') {
        return ''
    }
    const trimmed = value.trim()
    if (!trimmed) {
        return ''
    }
    if (trimmed === 'default') {
        return 'auto'
    }
    return trimmed
}

export function formatSessionModelLabel(
    metadata: SessionRuntimeMetadata | null | undefined,
    options?: { fallbackModel?: string | null }
): string | null {
    const model = normalizeModelLabel(metadata?.model) || normalizeModelLabel(options?.fallbackModel)
    if (!model) {
        return null
    }

    const reasoningEffort = typeof metadata?.reasoningEffort === 'string'
        ? metadata.reasoningEffort.trim().toLowerCase()
        : ''

    if (!reasoningEffort || !SUPPORTED_REASONING_EFFORTS.has(reasoningEffort)) {
        return model
    }

    return `${model}/${reasoningEffort}`
}

export function ReasoningIcon(props: { className?: string }) {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.9"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={props.className}
            aria-hidden="true"
        >
            <path d="M12 5a3 3 0 1 0-5.997.125 4 4 0 0 0-2.526 5.77 4 4 0 0 0 .556 6.588A4 4 0 1 0 12 18Z" />
            <path d="M12 5a3 3 0 1 1 5.997.125 4 4 0 0 1 2.526 5.77 4 4 0 0 1-.556 6.588A4 4 0 1 1 12 18Z" />
            <path d="M15 13a4.5 4.5 0 0 1-3-4 4.5 4.5 0 0 1-3 4" />
        </svg>
    )
}
