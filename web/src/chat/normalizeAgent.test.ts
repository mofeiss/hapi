import { describe, expect, it } from 'vitest'
import { normalizeAgentRecord } from '@/chat/normalizeAgent'

describe('normalizeAgentRecord codex reasoning alignment', () => {
    it('drops CodexReasoning tool call placeholder to avoid duplicate reasoning entries', () => {
        const normalized = normalizeAgentRecord('m1', null, 1, {
            type: 'codex',
            data: {
                type: 'tool-call',
                id: 'codex-reasoning-tool',
                callId: 'call-1',
                name: 'CodexReasoning',
                input: { title: 'Inspecting workspace state' }
            }
        })

        expect(normalized).toBeNull()
    })

    it('maps CodexReasoning tool result into agent reasoning block', () => {
        const normalized = normalizeAgentRecord('m2', null, 2, {
            type: 'codex',
            data: {
                type: 'tool-call-result',
                id: 'codex-reasoning-result',
                callId: 'call-1',
                output: {
                    content: 'Check the current branch and recent changes.',
                    status: 'completed'
                }
            }
        })

        expect(normalized?.role).toBe('agent')
        if (!normalized || normalized.role !== 'agent') return
        expect(normalized.content).toEqual([
            {
                type: 'reasoning',
                text: 'Check the current branch and recent changes.',
                uuid: 'codex-reasoning-result',
                parentUUID: null
            }
        ])
    })

    it('preserves CodexReasoning title inside the single reasoning block when provided', () => {
        const normalized = normalizeAgentRecord('m2b', null, 2, {
            type: 'codex',
            data: {
                type: 'tool-call-result',
                id: 'codex-reasoning-result-with-title',
                callId: 'call-1',
                output: {
                    title: 'Evaluating task strategy',
                    content: 'Check the current branch and recent changes.',
                    status: 'completed'
                }
            }
        })

        expect(normalized?.role).toBe('agent')
        if (!normalized || normalized.role !== 'agent') return
        expect(normalized.content).toEqual([
            {
                type: 'reasoning',
                text: '**Evaluating task strategy**\n\nCheck the current branch and recent changes.',
                uuid: 'codex-reasoning-result-with-title',
                parentUUID: null
            }
        ])
    })

    it('drops canceled CodexReasoning tool result to avoid empty tool card remnants', () => {
        const normalized = normalizeAgentRecord('m3', null, 3, {
            type: 'codex',
            data: {
                type: 'tool-call-result',
                id: 'codex-reasoning-canceled',
                callId: 'call-1',
                output: {
                    content: '',
                    status: 'canceled'
                }
            }
        })

        expect(normalized).toBeNull()
    })

    it('preserves Codex tool result error state for generic fallback cards', () => {
        const normalized = normalizeAgentRecord('m4', null, 4, {
            type: 'codex',
            data: {
                type: 'tool-call-result',
                id: 'codex-generic-error',
                callId: 'call-generic-1',
                is_error: true,
                output: {
                    error: 'permission denied'
                }
            }
        })

        expect(normalized?.role).toBe('agent')
        if (!normalized || normalized.role !== 'agent') return
        expect(normalized.content).toEqual([
            {
                type: 'tool-result',
                tool_use_id: 'call-generic-1',
                content: {
                    error: 'permission denied'
                },
                is_error: true,
                uuid: 'codex-generic-error',
                parentUUID: null
            }
        ])
    })

    it('maps Codex token_count event into usage-only message for context tracking', () => {
        const normalized = normalizeAgentRecord('m5', null, 5, {
            type: 'codex',
            data: {
                type: 'token_count',
                info: {
                    total: {
                        totalTokens: 12345
                    },
                    modelContextWindow: 258400
                }
            }
        })

        expect(normalized?.role).toBe('agent')
        if (!normalized || normalized.role !== 'agent') return
        expect(normalized.content).toEqual([])
        expect(normalized.usage).toEqual({
            input_tokens: 12345,
            output_tokens: 0,
            context_tokens: 12345,
            context_window_tokens: 258400
        })
    })

    it('keeps compatibility with legacy token_count shape', () => {
        const normalized = normalizeAgentRecord('m6', null, 6, {
            type: 'codex',
            data: {
                type: 'token_count',
                info: {
                    total_token_usage: {
                        total_tokens: 54321
                    }
                }
            }
        })

        expect(normalized?.usage).toEqual({
            input_tokens: 54321,
            output_tokens: 0,
            context_tokens: 54321,
            context_window_tokens: undefined
        })
    })
})
