import { describe, expect, it, vi } from 'vitest'

import type { AgentModel } from '@/modules/common/rpcTypes'
import {
    fetchClaudeCliModelCatalog,
    listRunnerAgentModels,
    parseClaudeCliModelAliases
} from './agentModels'

const codexModel: AgentModel = {
    id: 'gpt-5.99-codex',
    model: 'gpt-5.99-codex',
    displayName: 'GPT-5.99 Codex',
    description: 'Dynamic Codex model returned by app-server.',
    hidden: false,
    isDefault: true,
    defaultReasoningEffort: 'high',
    supportedReasoningEfforts: [
        { reasoningEffort: 'medium', description: 'Balanced reasoning' },
        { reasoningEffort: 'high', description: 'Deeper reasoning' }
    ]
}

describe('listRunnerAgentModels', () => {
    it('returns the dynamic Codex catalog without replacing it with fallback models', async () => {
        const result = await listRunnerAgentModels('codex', {
            fetchCodexModels: vi.fn().mockResolvedValue([codexModel])
        })

        expect(result).toEqual({
            success: true,
            source: 'codex-app-server',
            models: [codexModel]
        })
    })

    it('returns Claude Code public model aliases through the same model catalog RPC', async () => {
        const result = await listRunnerAgentModels('claude', {
            fetchCodexModels: vi.fn(),
            fetchClaudeHelp: vi.fn().mockResolvedValue("--model <model>  Model for the current session. Provide an alias for the latest model (e.g. 'sonnet' or 'opus') or a model's full name (e.g. 'claude-sonnet-4-6').")
        })

        expect(result.success).toBe(true)
        expect(result.source).toBe('claude-cli')
        expect(result.models?.map((model) => model.model)).toEqual([
            'default',
            'sonnet',
            'opus'
        ])
    })

    it('parses Claude aliases from the current CLI help text', () => {
        expect(parseClaudeCliModelAliases(
            "--model <model>  Provide an alias for the latest model (e.g. 'sonnet' or 'opus') or a model's full name (e.g. 'claude-sonnet-4-6')."
        )).toEqual(['sonnet', 'opus'])
    })

    it('falls back to minimal Claude aliases when help has no parseable aliases', async () => {
        const models = await fetchClaudeCliModelCatalog({
            fetchClaudeHelp: vi.fn().mockResolvedValue('--model <model> Model for the current session.')
        })

        expect(models.map((model) => model.model)).toEqual([
            'default',
            'sonnet',
            'opus'
        ])
    })
})
