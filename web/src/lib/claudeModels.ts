import type { AgentModel } from '@/types/api'

export type ClaudeModelOption = {
    value: string
    label: string
}

export const CLAUDE_CUSTOM_MODEL_OPTION_VALUE = 'custom'
export const CLAUDE_DEFAULT_MODEL_OPTION_VALUE = 'default'
const CLAUDE_CUSTOM_MODEL_VALUE_STORAGE_KEY = 'hapi:claude:customModelValue'

const CLAUDE_BASE_MODEL_OPTIONS: ClaudeModelOption[] = [
    { value: CLAUDE_DEFAULT_MODEL_OPTION_VALUE, label: 'Default' },
    { value: 'sonnet', label: 'Sonnet' },
    { value: 'opus', label: 'Opus' }
]

const CLAUDE_BASE_MODEL_KEYS = new Set(
    CLAUDE_BASE_MODEL_OPTIONS.map((entry) => entry.value.toLowerCase())
)

export function normalizeClaudeModelValue(value: unknown): string | null {
    if (typeof value !== 'string') {
        return null
    }

    const trimmed = value.trim()
    if (!trimmed) {
        return null
    }

    return trimmed
}

export function isClaudePresetModel(value: string): boolean {
    return CLAUDE_BASE_MODEL_KEYS.has(value.trim().toLowerCase())
}

export function buildClaudeModelOptions(
    models: AgentModel[] | undefined,
    customModelValue?: string | null
): ClaudeModelOption[] {
    const visible = (models ?? [])
        .filter((model) => !model.hidden)
        .map((model) => ({
            value: model.model,
            label: model.displayName || model.model
        }))

    const options = [...(visible.length > 0 ? visible : CLAUDE_BASE_MODEL_OPTIONS)]
    const normalized = normalizeClaudeModelValue(customModelValue)
    if (normalized && !options.some((entry) => entry.value.toLowerCase() === normalized.toLowerCase())) {
        options.push({
            value: normalized,
            label: normalized
        })
    }

    options.push({ value: CLAUDE_CUSTOM_MODEL_OPTION_VALUE, label: 'Custom' })
    return options
}

export function buildClaudeComposerModelOptions(
    models: AgentModel[] | undefined,
    customModelValue?: string | null
): ClaudeModelOption[] {
    const visible = (models ?? [])
        .filter((model) => !model.hidden)
        .map((model) => ({
            value: model.model,
            label: model.displayName || model.model
        }))

    const options = [...(visible.length > 0 ? visible : CLAUDE_BASE_MODEL_OPTIONS)]
    const normalized = normalizeClaudeModelValue(customModelValue)
    if (normalized && !options.some((entry) => entry.value.toLowerCase() === normalized.toLowerCase())) {
        options.push({
            value: normalized,
            label: normalized
        })
    }

    return options
}

export function isClaudeKnownModelOption(
    value: string,
    options: ClaudeModelOption[]
): boolean {
    const normalized = normalizeClaudeModelValue(value)
    return Boolean(normalized && options.some((option) => option.value.toLowerCase() === normalized.toLowerCase()))
}

export function loadClaudeCustomModelValue(): string {
    try {
        const stored = localStorage.getItem(CLAUDE_CUSTOM_MODEL_VALUE_STORAGE_KEY)
        const normalized = normalizeClaudeModelValue(stored)
        return normalized ?? ''
    } catch {
        return ''
    }
}

export function saveClaudeCustomModelValue(value: string): void {
    const normalized = normalizeClaudeModelValue(value)

    try {
        if (!normalized) {
            localStorage.removeItem(CLAUDE_CUSTOM_MODEL_VALUE_STORAGE_KEY)
            return
        }
        localStorage.setItem(CLAUDE_CUSTOM_MODEL_VALUE_STORAGE_KEY, normalized)
    } catch {
        // Ignore storage errors
    }
}
