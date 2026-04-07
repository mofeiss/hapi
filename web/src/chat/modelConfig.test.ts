import { describe, expect, it } from 'vitest'
import { getContextBudgetTokens } from '@/chat/modelConfig'

describe('getContextBudgetTokens', () => {
    it('uses 258k context window for gpt-5.4 codex sessions', () => {
        expect(getContextBudgetTokens({
            agentFlavor: 'codex',
            model: 'gpt-5.4'
        })).toBe(248_000)
    })

    it('uses 200k context window for non-gpt-5.4 codex sessions', () => {
        expect(getContextBudgetTokens({
            agentFlavor: 'codex',
            model: 'gpt-5.3-codex'
        })).toBe(190_000)
    })

    it('keeps Claude model-mode fallback behavior', () => {
        expect(getContextBudgetTokens({
            modelMode: 'sonnet'
        })).toBe(190_000)
    })
})
