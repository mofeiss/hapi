import { useMemo } from 'react'
import type { AgentState, ModelMode } from '@/types/api'
import type { ConversationStatus } from '@/realtime/types'
import { getContextBudgetTokens } from '@/chat/modelConfig'
import { useTranslation } from '@/lib/use-translation'

function getConnectionStatus(
    active: boolean,
    thinking: boolean,
    agentState: AgentState | null | undefined,
    voiceStatus: ConversationStatus | undefined,
    t: (key: string) => string
): { text: string; color: string; dotColor: string; isPulsing: boolean } {
    const hasPermissions = agentState?.requests && Object.keys(agentState.requests).length > 0

    // Voice connecting takes priority
    if (voiceStatus === 'connecting') {
        return {
            text: t('misc.executing'),
            color: 'text-amber-500',
            dotColor: 'bg-amber-500',
            isPulsing: true
        }
    }

    if (!active) {
        return {
            text: t('misc.offline'),
            color: 'text-[#999]',
            dotColor: 'bg-[#999]',
            isPulsing: false
        }
    }

    if (hasPermissions) {
        return {
            text: t('misc.permissionRequired'),
            color: 'text-[var(--app-orange-base)]',
            dotColor: 'bg-[var(--app-orange-base)]',
            isPulsing: true
        }
    }

    if (thinking) {
        return {
            text: t('misc.executing'),
            color: 'text-amber-500',
            dotColor: 'bg-amber-500',
            isPulsing: true
        }
    }

    return {
        text: t('misc.idle'),
        color: 'text-emerald-600',
        dotColor: 'bg-emerald-600',
        isPulsing: false
    }
}

function getContextWarning(
    contextSize: number,
    maxContextSize: number,
    t: (key: string, params?: Record<string, string | number>) => string
): { text: string; color: string; usedPercentage: number } | null {
    const percentageUsed = Math.min(100, Math.max(0, (contextSize / maxContextSize) * 100))
    const percentageRemaining = Math.max(0, 100 - percentageUsed)

    const percent = Math.round(percentageRemaining)
    if (percentageRemaining <= 5) {
        return { text: t('misc.percentLeft', { percent }), color: 'text-red-500', usedPercentage: percentageUsed }
    } else if (percentageRemaining <= 10) {
        return { text: t('misc.percentLeft', { percent }), color: 'text-amber-500', usedPercentage: percentageUsed }
    } else {
        return { text: t('misc.percentLeft', { percent }), color: 'text-[var(--app-hint)]', usedPercentage: percentageUsed }
    }
}

function ContextUsageRing(props: {
    usedPercentage: number
    className?: string
}) {
    const clampedUsedPercentage = Math.min(100, Math.max(0, props.usedPercentage))
    const radius = 4.25
    const circumference = 2 * Math.PI * radius
    const dashOffset = circumference * (1 - clampedUsedPercentage / 100)

    return (
        <svg
            className={props.className}
            viewBox="0 0 16 16"
            fill="none"
            aria-hidden="true"
        >
            <circle
                cx="8"
                cy="8"
                r={radius}
                stroke="var(--app-border)"
                strokeWidth="1.75"
                opacity="0.7"
            />
            <circle
                cx="8"
                cy="8"
                r={radius}
                stroke="currentColor"
                strokeWidth="1.75"
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={dashOffset}
                transform="rotate(-90 8 8)"
            />
        </svg>
    )
}

export function StatusBar(props: {
    active: boolean
    thinking: boolean
    agentState: AgentState | null | undefined
    contextSize?: number
    modelMode?: ModelMode
    voiceStatus?: ConversationStatus
    className?: string
}) {
    const { t } = useTranslation()
    const connectionStatus = useMemo(
        () => getConnectionStatus(props.active, props.thinking, props.agentState, props.voiceStatus, t),
        [props.active, props.thinking, props.agentState, props.voiceStatus, t]
    )

    const contextWarning = useMemo(
        () => {
            if (props.contextSize === undefined) return null
            const maxContextSize = getContextBudgetTokens(props.modelMode)
            if (!maxContextSize) return null
            return getContextWarning(props.contextSize, maxContextSize, t)
        },
        [props.contextSize, props.modelMode, t]
    )

    return (
        <div className={`flex min-h-5 items-center justify-between px-1 pb-1 ${props.className ?? ''}`}>
            <div className="flex items-center gap-3">
                <div className={`flex items-center gap-1.5 ${connectionStatus.isPulsing ? 'animate-[snowflake-pulse_1.5s_ease-in-out_infinite]' : ''}`}>
                    {connectionStatus.isPulsing ? (
                        <span className={`inline-block text-xs leading-none ${connectionStatus.color} animate-[spin_3s_linear_infinite]`}>✻</span>
                    ) : (
                        <span className={`text-xs leading-none ${connectionStatus.color}`}>✻</span>
                    )}
                    <span className={`text-xs ${connectionStatus.color}`}>
                        {connectionStatus.text}
                    </span>
                </div>
                {contextWarning ? (
                    <span className={`inline-flex items-center gap-1.5 text-[10px] leading-none ${contextWarning.color}`}>
                        <ContextUsageRing
                            usedPercentage={contextWarning.usedPercentage}
                            className="h-3.5 w-3.5 shrink-0"
                        />
                        <span>{contextWarning.text}</span>
                    </span>
                ) : null}
            </div>
        </div>
    )
}
