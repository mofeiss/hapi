import { getPermissionModeLabel, getPermissionModeTone, isPermissionModeAllowedForFlavor } from '@hapi/protocol'
import type { PermissionModeTone } from '@hapi/protocol'
import { useMemo } from 'react'
import type { AgentState, ModelMode, PermissionMode } from '@/types/api'
import type { ConversationStatus } from '@/realtime/types'
import { getContextBudgetTokens } from '@/chat/modelConfig'
import { useTranslation } from '@/lib/use-translation'

const PERMISSION_TONE_CLASSES: Record<PermissionModeTone, string> = {
    neutral: 'text-[var(--app-hint)]',
    info: 'text-[var(--app-badge-warning-text)]',
    warning: 'text-emerald-600',
    danger: 'text-red-500'
}

const PERMISSION_TONE_BORDER_CLASSES: Record<PermissionModeTone, string> = {
    neutral: 'border-[var(--app-border)]',
    info: 'border-[var(--app-badge-warning-text)]/30',
    warning: 'border-emerald-600/30',
    danger: 'border-red-500/30'
}

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
            color: 'text-[var(--app-badge-warning-text)]',
            dotColor: 'bg-[var(--app-badge-warning-text)]',
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
            color: 'text-[var(--app-badge-warning-text)]',
            dotColor: 'bg-[var(--app-badge-warning-text)]',
            isPulsing: true
        }
    }

    if (thinking) {
        return {
            text: t('misc.executing'),
            color: 'text-[var(--app-badge-warning-text)]',
            dotColor: 'bg-[var(--app-badge-warning-text)]',
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
    permissionMode?: PermissionMode
    agentFlavor?: string | null
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

    const permissionMode = props.permissionMode
    const displayPermissionMode = permissionMode
        && permissionMode !== 'default'
        && isPermissionModeAllowedForFlavor(permissionMode, props.agentFlavor)
        ? permissionMode
        : null

    const permissionModeLabel = displayPermissionMode ? getPermissionModeLabel(displayPermissionMode) : null
    const permissionModeTone = displayPermissionMode ? getPermissionModeTone(displayPermissionMode) : null
    const permissionModeColor = permissionModeTone ? PERMISSION_TONE_CLASSES[permissionModeTone] : 'text-[var(--app-hint)]'
    const permissionModeBorderColor = permissionModeTone ? PERMISSION_TONE_BORDER_CLASSES[permissionModeTone] : 'border-[var(--app-border)]'

    return (
        <div className="flex items-center justify-between px-2 pb-1 min-h-6">
            <div className="flex items-baseline gap-3">
                <div className="flex items-center gap-1.5">
                    {connectionStatus.isPulsing ? (
                        <span className={`text-xs leading-none ${connectionStatus.color} animate-[snowflake-pulse_1.5s_ease-in-out_infinite]`}>✻</span>
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

            {displayPermissionMode ? (
                <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full border ${permissionModeColor} ${permissionModeBorderColor}`}>
                    {permissionModeLabel}
                </span>
            ) : null}
        </div>
    )
}
