import { describe, expect, it } from 'vitest'
import { normalizeAgentRecord } from '@/chat/normalizeAgent'

describe('normalizeAgentRecord codex reasoning alignment', () => {
    it('maps CodexReasoning tool call into agent reasoning block', () => {
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

        expect(normalized?.role).toBe('agent')
        if (!normalized || normalized.role !== 'agent') return
        expect(normalized.content).toEqual([
            {
                type: 'reasoning',
                text: 'Inspecting workspace state',
                uuid: 'codex-reasoning-tool',
                parentUUID: null
            }
        ])
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
})
