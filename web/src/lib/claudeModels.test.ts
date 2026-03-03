import { beforeEach, describe, expect, it } from 'vitest'
import {
    CLAUDE_CUSTOM_MODEL_OPTION_VALUE,
    buildClaudeComposerModelOptions,
    getClaudeNewSessionModelOptions,
    loadClaudeCustomModelValue,
    saveClaudeCustomModelValue
} from './claudeModels'

describe('claudeModels', () => {
    beforeEach(() => {
        localStorage.clear()
    })

    it('returns new-session options with a single custom entry', () => {
        const options = getClaudeNewSessionModelOptions()
        expect(options.map((entry) => entry.value)).toEqual([
            'auto',
            'opus',
            'sonnet',
            'codex',
            'opus4.6',
            'opus4.5',
            CLAUDE_CUSTOM_MODEL_OPTION_VALUE
        ])
    })

    it('returns composer options with custom model value as visible label', () => {
        const options = buildClaudeComposerModelOptions('my-model')
        expect(options[options.length - 1]).toEqual({
            value: 'my-model',
            label: 'my-model'
        })
    })

    it('persists and reloads custom model value', () => {
        saveClaudeCustomModelValue('  codex-custom  ')
        expect(loadClaudeCustomModelValue()).toBe('codex-custom')

        saveClaudeCustomModelValue('')
        expect(loadClaudeCustomModelValue()).toBe('')
    })
})
