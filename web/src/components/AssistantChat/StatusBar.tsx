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
            color: 'text-emerald-600',
            dotColor: 'bg-emerald-600',
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
            color: 'text-emerald-600',
            dotColor: 'bg-emerald-600',
            isPulsing: true
        }
    }

    if (thinking) {
        return {
            text: t('misc.executing'),
            color: 'text-emerald-600',
            dotColor: 'bg-emerald-600',
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

function getContextWarning(contextSize: number, maxContextSize: number, t: (key: string, params?: Record<string, string | number>) => string): { text: string; color: string } | null {
    const percentageUsed = (contextSize / maxContextSize) * 100
    const percentageRemaining = Math.max(0, 100 - percentageUsed)

    const percent = Math.round(percentageRemaining)
    if (percentageRemaining <= 5) {
        return { text: t('misc.percentLeft', { percent }), color: 'text-red-500' }
    } else if (percentageRemaining <= 10) {
        return { text: t('misc.percentLeft', { percent }), color: 'text-amber-500' }
    } else {
        return { text: t('misc.percentLeft', { percent }), color: 'text-[var(--app-hint)]' }
    }
}

export function StatusBar(props: {
    active: boolean
    thinking: boolean
    agentState: AgentState | null | undefined
    contextSize?: number
    modelMode?: ModelMode
    voiceStatus?: ConversationStatus
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
        <div className="flex items-center justify-between px-2 pb-1 min-h-6">
            <div className="flex items-baseline gap-3">
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
                    <span className={`text-[10px] ${contextWarning.color}`}>
                        {contextWarning.text}
                    </span>
                ) : null}
            </div>
        </div>
    )
}
