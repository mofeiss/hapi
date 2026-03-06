export type ClaudeModelOption = {
    value: string
    label: string
}

export const CLAUDE_CUSTOM_MODEL_OPTION_VALUE = 'custom'
const CLAUDE_CUSTOM_MODEL_VALUE_STORAGE_KEY = 'hapi:claude:customModelValue'

const CLAUDE_BASE_MODEL_OPTIONS: ClaudeModelOption[] = [
    { value: 'auto', label: 'Default' },
    { value: 'opus', label: 'Opus' },
    { value: 'sonnet', label: 'Sonnet' }
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

export function getClaudeNewSessionModelOptions(): ClaudeModelOption[] {
    return [
        ...CLAUDE_BASE_MODEL_OPTIONS,
        { value: CLAUDE_CUSTOM_MODEL_OPTION_VALUE, label: 'Custom' }
    ]
}

export function buildClaudeComposerModelOptions(
    customModelValue?: string | null
): ClaudeModelOption[] {
    const options: ClaudeModelOption[] = [...CLAUDE_BASE_MODEL_OPTIONS]
    const normalized = normalizeClaudeModelValue(customModelValue)
    if (!normalized) {
        return options
    }

    if (normalized.toLowerCase() === 'auto' || isClaudePresetModel(normalized)) {
        return options
    }

    options.push({
        value: normalized,
        label: normalized
    })
    return options
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
