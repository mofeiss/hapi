import { useQueryClient } from '@tanstack/react-query'
import { useTransition } from 'react'
import type { ApiClient } from '@/api/client'
import { queryKeys } from '@/lib/query-keys'
import { useTranslation } from '@/lib/use-translation'
import { useRuntimeConfig } from '@/hooks/queries/useRuntimeConfig'

function DebugIcon(props: { active: boolean }) {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="block"
        >
            <rect x="4.5" y="5.5" width="15" height="13" rx="3" />
            <path d="M9 2.5h6" />
            <path d="M12 5.5v-3" />
            <path d="M2.5 10h2" />
            <path d="M2.5 14h2" />
            <path d="M19.5 10h2" />
            <path d="M19.5 14h2" />
            <path d="m7.5 5.5-1.5-2" />
            <path d="m16.5 5.5 1.5-2" />
            <path d="M9 10h6" />
            <path d="M9 14h4" />
            {props.active ? <circle cx="15.5" cy="14" r="1.6" fill="currentColor" stroke="none" /> : null}
        </svg>
    )
}

export function DiagnosticLoggingToggle(props: {
    api: ApiClient | null
    buttonClassName: string
}) {
    const { t } = useTranslation()
    const queryClient = useQueryClient()
    const [isPending, startTransition] = useTransition()
    const { diagnosticLogging } = useRuntimeConfig(props.api, Boolean(props.api))

    const handleToggle = () => {
        if (!props.api || isPending) {
            return
        }

        const nextEnabled = !diagnosticLogging.enabled
        startTransition(() => {
            void props.api?.setDiagnosticLogging(nextEnabled).then((response) => {
                queryClient.setQueryData(queryKeys.runtimeConfig, response)
                void queryClient.invalidateQueries({ queryKey: queryKeys.machines })
            })
        })
    }

    const title = diagnosticLogging.enabled
        ? t('debug.disableDiagnosticLogging')
        : t('debug.enableDiagnosticLogging')
    const diagnosticButtonClassName = props.buttonClassName
        .replace('hover:text-[var(--app-fg)]', '')
        .trim()

    return (
        <button
            type="button"
            onClick={handleToggle}
            disabled={!props.api || isPending}
            className={`${diagnosticButtonClassName} ${diagnosticLogging.enabled ? 'bg-[var(--app-secondary-bg)] text-[var(--app-orange-base)] hover:text-[var(--app-orange-base)]' : 'hover:text-[var(--app-orange-base)]'} ${isPending ? 'opacity-60' : ''}`}
            title={title}
            aria-label={title}
        >
            <span className="flex h-full w-full translate-y-px items-center justify-center">
                <DebugIcon active={diagnosticLogging.enabled} />
            </span>
        </button>
    )
}
