import { useMemo } from 'react'
import { getBasePermissionModeOptionsForFlavor, supportsPlanToggle } from '@hapi/protocol'
import type { PermissionMode } from '@/types/api'
import { useTranslation } from '@/lib/use-translation'

export function PermissionSelector(props: {
    agentFlavor: string
    basePermissionMode: PermissionMode
    onBasePermissionModeChange: (mode: PermissionMode) => void
    isPlanActive: boolean
    onPlanToggle: (active: boolean) => void
    disabled?: boolean
}) {
    const { t } = useTranslation()
    const showPlan = useMemo(() => supportsPlanToggle(props.agentFlavor), [props.agentFlavor])
    const baseOptions = useMemo(() => getBasePermissionModeOptionsForFlavor(props.agentFlavor), [props.agentFlavor])

    if (baseOptions.length === 0 && !showPlan) {
        return null
    }

    return (
        <div className="flex flex-col gap-1.5 px-3 py-3">
            <label className="text-xs font-medium text-[var(--app-hint)]">
                {t('newSession.basePermission')}
            </label>
            <div className="flex flex-col gap-4 mt-1">
                <div className="flex gap-4 flex-wrap">
                    {baseOptions.map((opt) => (
                        <label
                            key={opt.mode}
                            className="flex items-center gap-1.5 cursor-pointer"
                        >
                            <input
                                type="radio"
                                name="basePermissionMode"
                                value={opt.mode}
                                checked={props.basePermissionMode === opt.mode}
                                onChange={() => props.onBasePermissionModeChange(opt.mode as PermissionMode)}
                                disabled={props.disabled}
                                className="accent-[var(--app-link)]"
                            />
                            <span className="text-sm">{t(`permission.mode.${opt.mode}` as any) || opt.label}</span>
                        </label>
                    ))}
                </div>

                {showPlan && (
                    <div className="flex items-center justify-between gap-3 pt-1">
                        <div className="flex flex-col">
                            <span className="text-sm text-[var(--app-fg)]">
                                {t('newSession.planMode.title')}
                            </span>
                            <span className="text-xs text-[var(--app-hint)]">
                                {t('newSession.planMode.desc')}
                            </span>
                        </div>
                        <label className="relative inline-flex h-5 w-9 items-center shrink-0">
                            <input
                                type="checkbox"
                                checked={props.isPlanActive}
                                onChange={(e) => props.onPlanToggle(e.target.checked)}
                                disabled={props.disabled}
                                className="peer sr-only"
                            />
                            <span className="absolute inset-0 rounded-full bg-[var(--app-border)] transition-colors peer-checked:bg-[var(--app-badge-warning-text)] peer-disabled:opacity-50" />
                            <span className="absolute left-0.5 h-4 w-4 rounded-full bg-[var(--app-bg)] transition-transform peer-checked:translate-x-4 peer-disabled:opacity-50" />
                        </label>
                    </div>
                )}
            </div>
        </div>
    )
}
