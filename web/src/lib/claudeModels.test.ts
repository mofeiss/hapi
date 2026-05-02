import { beforeEach, describe, expect, it } from 'vitest'
import {
    CLAUDE_CUSTOM_MODEL_OPTION_VALUE,
    buildClaudeModelOptions,
    buildClaudeComposerModelOptions,
    isClaudeKnownModelOption,
    loadClaudeCustomModelValue,
    saveClaudeCustomModelValue
} from './claudeModels'

describe('claudeModels', () => {
    beforeEach(() => {
        localStorage.clear()
    })

    it('builds Claude options from runner-provided model aliases and keeps custom entry', () => {
        const options = buildClaudeModelOptions([
            {
                id: 'default',
                model: 'default',
                displayName: 'Default',
                description: 'Claude Code default model.',
                hidden: false,
                isDefault: true,
                defaultReasoningEffort: 'medium',
                supportedReasoningEfforts: []
            },
            {
                id: 'sonnet[1m]',
                model: 'sonnet[1m]',
                displayName: 'Sonnet 1M',
                description: 'Claude Code long-context alias.',
                hidden: false,
                isDefault: false,
                defaultReasoningEffort: 'medium',
                supportedReasoningEfforts: []
            }
        ])

        expect(options.map((entry) => entry.value)).toEqual([
            'default',
            'sonnet[1m]',
            CLAUDE_CUSTOM_MODEL_OPTION_VALUE
        ])
    })

    it('returns composer options from runner models with custom model value as visible label', () => {
        const options = buildClaudeComposerModelOptions([
            {
                id: 'default',
                model: 'default',
                displayName: 'Default',
                description: 'Claude Code default model.',
                hidden: false,
                isDefault: true,
                defaultReasoningEffort: 'medium',
                supportedReasoningEfforts: []
            }
        ], 'my-model')

        expect(options.map((entry) => entry.value)).toEqual(['default', 'my-model'])
        expect(options[options.length - 1]).toEqual({
            value: 'my-model',
            label: 'my-model'
        })
    })

    it('falls back to minimal Claude CLI aliases when runner models are unavailable', () => {
        expect(buildClaudeModelOptions(undefined).map((entry) => entry.value)).toEqual([
            'default',
            'sonnet',
            'opus',
            CLAUDE_CUSTOM_MODEL_OPTION_VALUE
        ])
    })

    it('recognizes known Claude options from the current option list', () => {
        const options = buildClaudeComposerModelOptions(undefined, 'claude-sonnet-4-6')

        expect(isClaudeKnownModelOption('sonnet', options)).toBe(true)
        expect(isClaudeKnownModelOption('claude-sonnet-4-6', options)).toBe(true)
        expect(isClaudeKnownModelOption('missing-model', options)).toBe(false)
    })

    it('persists and reloads custom model value', () => {
        saveClaudeCustomModelValue('  codex-custom  ')
        expect(loadClaudeCustomModelValue()).toBe('codex-custom')

        saveClaudeCustomModelValue('')
        expect(loadClaudeCustomModelValue()).toBe('')
    })
})
