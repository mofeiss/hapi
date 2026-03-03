import type { AgentModel, CodexReasoningEffort } from '@/types/api'

export type AgentType = 'claude' | 'codex' | 'gemini' | 'opencode'
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
        { value: 'auto', label: 'Auto' },
        { value: 'opus', label: 'Opus' },
        { value: 'sonnet', label: 'Sonnet' },
        { value: 'codex', label: 'codex' },
        { value: 'opus4.6', label: 'opus4.6' },
        { value: 'opus4.5', label: 'opus4.5' },
        { value: 'custom', label: 'Custom' },
    ],
    gemini: [
        { value: 'auto', label: 'Auto' },
        { value: 'gemini-3-pro-preview', label: 'Gemini 3 Pro Preview' },
        { value: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro' },
        { value: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash' },
    ],
    opencode: [],
}

export const FALLBACK_CODEX_MODELS: CodexModelOption[] = [
    {
        value: 'gpt-5.3-codex',
        label: 'GPT-5.3 Codex',
        description: 'Latest frontier agentic coding model.',
        isDefault: true,
        defaultReasoningEffort: 'medium',
        supportedReasoningEfforts: ['low', 'medium', 'high', 'xhigh']
    },
    {
        value: 'gpt-5.2-codex',
        label: 'GPT-5.2 Codex',
        description: 'Frontier agentic coding model.',
        isDefault: false,
        defaultReasoningEffort: 'medium',
        supportedReasoningEfforts: ['low', 'medium', 'high', 'xhigh']
    },
    {
        value: 'gpt-5.1-codex-max',
        label: 'GPT-5.1 Codex Max',
        description: 'Codex-optimized flagship for deep and fast reasoning.',
        isDefault: false,
        defaultReasoningEffort: 'medium',
        supportedReasoningEfforts: ['low', 'medium', 'high', 'xhigh']
    },
    {
        value: 'gpt-5.2',
        label: 'GPT-5.2',
        description: 'Latest frontier model with improvements across knowledge, reasoning and coding.',
        isDefault: false,
        defaultReasoningEffort: 'medium',
        supportedReasoningEfforts: ['low', 'medium', 'high', 'xhigh']
    },
    {
        value: 'gpt-5.1-codex-mini',
        label: 'GPT-5.1 Codex Mini',
        description: 'Optimized for codex. Cheaper, faster, but less capable.',
        isDefault: false,
        defaultReasoningEffort: 'medium',
        supportedReasoningEfforts: ['medium', 'high']
    }
]

export function buildCodexModelOptions(models: AgentModel[] | undefined): CodexModelOption[] {
    if (!models || models.length === 0) {
        return FALLBACK_CODEX_MODELS
    }

    const visible = models
        .filter((model) => !model.hidden)
        .map((model) => ({
            value: model.model,
            label: model.displayName || model.model,
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
