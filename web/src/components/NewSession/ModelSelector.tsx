import type { CodexReasoningEffort } from '@/types/api'
import type { AgentType, ModelOption } from './types'
import { useTranslation } from '@/lib/use-translation'
import { CLAUDE_CUSTOM_MODEL_OPTION_VALUE } from '@/lib/claudeModels'

type ReasoningOption = {
    value: CodexReasoningEffort
}

function getReasoningLabel(value: CodexReasoningEffort, t: (key: string) => string): string {
    switch (value) {
        case 'none':
            return t('newSession.reasoning.none')
        case 'minimal':
            return t('newSession.reasoning.minimal')
        case 'low':
            return t('newSession.reasoning.low')
        case 'medium':
            return t('newSession.reasoning.medium')
        case 'high':
            return t('newSession.reasoning.high')
        case 'xhigh':
            return t('newSession.reasoning.xhigh')
        default:
            return value
    }
}

export function ModelSelector(props: {
    agent: AgentType
    model: string
    modelOptions: ModelOption[]
    claudeCustomModelInput: string
    reasoningEffort: CodexReasoningEffort | 'auto'
    reasoningOptions: ReasoningOption[]
    isDisabled: boolean
    onModelChange: (value: string) => void
    onClaudeCustomModelInputChange: (value: string) => void
    onReasoningEffortChange: (value: CodexReasoningEffort | 'auto') => void
}) {
    const { t } = useTranslation()
    if (props.modelOptions.length === 0) {
        return null
    }

    const showReasoningSelector = props.agent === 'codex' && props.model !== 'auto' && props.reasoningOptions.length > 0

    return (
        <div className="flex flex-col gap-3 px-3 py-3">
            <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-[var(--app-hint)]">
                    {t('newSession.model')}{' '}
                    <span className="font-normal">({t('newSession.model.optional')})</span>
                </label>
                <select
                    value={props.model}
                    onChange={(e) => props.onModelChange(e.target.value)}
                    disabled={props.isDisabled}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-[var(--app-divider)] bg-[var(--app-bg)] text-[var(--app-text)] focus:outline-none focus:ring-2 focus:ring-[var(--app-link)] disabled:opacity-50"
                >
                    {props.modelOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                            {option.label}
                        </option>
                    ))}
                </select>
            </div>

            {props.agent === 'claude' && props.model === CLAUDE_CUSTOM_MODEL_OPTION_VALUE ? (
                <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-medium text-[var(--app-hint)]">
                        {t('newSession.model.custom')}
                    </label>
                    <input
                        type="text"
                        value={props.claudeCustomModelInput}
                        onChange={(e) => props.onClaudeCustomModelInputChange(e.target.value)}
                        disabled={props.isDisabled}
                        placeholder={t('newSession.model.custom.placeholder')}
                        className="w-full px-3 py-2 text-sm rounded-lg border border-[var(--app-divider)] bg-[var(--app-bg)] text-[var(--app-text)] focus:outline-none focus:ring-2 focus:ring-[var(--app-link)] disabled:opacity-50"
                    />
                </div>
            ) : null}

            {showReasoningSelector ? (
                <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-medium text-[var(--app-hint)]">
                        {t('newSession.reasoning')}
                    </label>
                    <select
                        value={props.reasoningEffort}
                        onChange={(e) => props.onReasoningEffortChange(e.target.value as CodexReasoningEffort | 'auto')}
                        disabled={props.isDisabled}
                        className="w-full px-3 py-2 text-sm rounded-lg border border-[var(--app-divider)] bg-[var(--app-bg)] text-[var(--app-text)] focus:outline-none focus:ring-2 focus:ring-[var(--app-link)] disabled:opacity-50"
                    >
                        <option value="auto">{t('newSession.reasoning.auto')}</option>
                        {props.reasoningOptions.map((option) => (
                            <option key={option.value} value={option.value}>
                                {getReasoningLabel(option.value, t)}
                            </option>
                        ))}
                    </select>
                </div>
            ) : null}
        </div>
    )
}
