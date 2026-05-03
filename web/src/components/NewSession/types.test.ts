import { describe, expect, it } from 'vitest'

import type { AgentModel } from '@/types/api'
import { buildCodexModelOptions } from './types'

function codexModel(model: string, isDefault = false): AgentModel {
    return {
        id: model,
        model,
        displayName: model.toUpperCase(),
        description: `${model} from app-server`,
        hidden: false,
        isDefault,
        defaultReasoningEffort: 'medium',
        supportedReasoningEfforts: [
            { reasoningEffort: 'medium', description: 'Balanced reasoning' }
        ]
    }
}

describe('buildCodexModelOptions', () => {
    it('keeps all visible dynamic Codex models returned by the runner', () => {
        const options = buildCodexModelOptions([
            codexModel('gpt-5.4', true),
            codexModel('gpt-5.5-codex'),
            codexModel('gpt-5.5-codex-mini')
        ])

        expect(options.map((option) => option.value)).toEqual([
            'gpt-5.5-codex-mini',
            'gpt-5.5-codex',
            'gpt-5.4'
        ])
    })

    it('sorts Codex models from highest display label to lowest without pinning app defaults first', () => {
        const options = buildCodexModelOptions([
            codexModel('gpt-5.4', true),
            codexModel('gpt-5.5'),
            codexModel('gpt-5.3')
        ])

        expect(options.map((option) => option.value)).toEqual([
            'gpt-5.5',
            'gpt-5.4',
            'gpt-5.3'
        ])
    })

    it('keeps GPT labels stable when dynamic Codex models use lowercase display names', () => {
        const dynamicModel = codexModel('gpt-5.4', true)
        dynamicModel.displayName = 'gpt-5.4'

        const options = buildCodexModelOptions([dynamicModel])

        expect(options[0]?.label).toBe('GPT-5.4')
    })
})
