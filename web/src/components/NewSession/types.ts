import type { AgentModel, CodexReasoningEffort } from '@/types/api'

export type AgentType = 'claude' | 'codex'
export type SessionType = 'simple' | 'worktree'

export type ModelOption = { value: string; label: string }

export type CodexModelOption = ModelOption & {
    description: string
    isDefault: boolean
    defaultReasoningEffort: CodexReasoningEffort
    supportedReasoningEfforts: CodexReasoningEffort[]
}

export const MODEL_OPTIONS: Record<Exclude<AgentType, 'codex'>, ModelOption[]> = {
    claude: [
        { value: 'opus', label: 'Opus' },
        { value: 'sonnet', label: 'Sonnet' },
        { value: 'custom', label: 'Custom' },
    ]
}

export const DEPRECATED_GEMINI_MODEL_OPTIONS: ModelOption[] = [
    { value: 'auto', label: 'Auto' },
    { value: 'gemini-3-pro-preview', label: 'Gemini 3 Pro Preview' },
    { value: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro' },
    { value: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash' },
]

export const FALLBACK_CODEX_MODELS: CodexModelOption[] = [
    {
        value: 'gpt-5.4',
        label: 'GPT-5.4',
        description: 'Current default codex model for new scheduled and manual sessions.',
        isDefault: true,
        defaultReasoningEffort: 'xhigh',
        supportedReasoningEfforts: ['xhigh']
    }
]

function formatCodexModelLabel(label: string): string {
    return label.replace(/^gpt(?=-)/i, 'GPT')
}

export function buildCodexModelOptions(models: AgentModel[] | undefined): CodexModelOption[] {
    if (!models || models.length === 0) {
        return FALLBACK_CODEX_MODELS
    }

    const visible = models
        .filter((model) => !model.hidden)
        .map((model) => ({
            value: model.model,
            label: formatCodexModelLabel(model.displayName || model.model),
            description: model.description,
            isDefault: model.isDefault,
            defaultReasoningEffort: model.defaultReasoningEffort,
            supportedReasoningEfforts: model.supportedReasoningEfforts.map((option) => option.reasoningEffort)
        }))

    if (visible.length === 0) {
        return FALLBACK_CODEX_MODELS
    }

    visible.sort((left, right) => {
        if (left.isDefault !== right.isDefault) {
            return left.isDefault ? -1 : 1
        }
        return left.label.localeCompare(right.label)
    })
    return visible
}

const REASONING_EFFORT_PRIORITY: CodexReasoningEffort[] = ['none', 'minimal', 'low', 'medium', 'high', 'xhigh']

export function getHighestCodexReasoningEffort(efforts: CodexReasoningEffort[]): CodexReasoningEffort {
    return efforts
        .slice()
        .sort((left, right) => REASONING_EFFORT_PRIORITY.indexOf(right) - REASONING_EFFORT_PRIORITY.indexOf(left))[0] ?? 'xhigh'
}
