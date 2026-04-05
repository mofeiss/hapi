import { describe, expect, it } from 'vitest'
import type { Session, SessionSummary } from '@/types/api'
import { mergeSessionData, mergeSessionSummaryData } from './useSSE'

function createSession(): Session {
    return {
        id: 'session-1',
        namespace: 'default',
        seq: 1,
        createdAt: 1,
        updatedAt: 2,
        active: true,
        activeAt: 2,
        metadata: {
            path: '/tmp/project',
            host: 'Murphy-Mac',
            flavor: 'codex'
        },
        metadataVersion: 1,
        agentState: null,
        agentStateVersion: 1,
        thinking: true,
        thinkingAt: 2,
        todos: undefined,
        permissionMode: 'default',
        basePermissionMode: 'default'
    }
}

function createSummary(): SessionSummary {
    return {
        id: 'session-1',
        createdAt: 1,
        active: true,
        thinking: true,
        activeAt: 2,
        updatedAt: 2,
        metadata: {
            path: '/tmp/project',
            host: 'Murphy-Mac',
            flavor: 'codex'
        },
        todoProgress: null,
        pendingRequestsCount: 0,
        modelMode: undefined
    }
}

describe('useSSE cache merge helpers', () => {
    it('ignores thin session update payloads without mutating cached sessions', () => {
        const session = createSession()
        const summary = createSummary()

        const mergedSession = mergeSessionData(session, { sid: session.id })
        const mergedSummary = mergeSessionSummaryData(summary, { sid: summary.id })

        expect(mergedSession.changed).toBe(false)
        expect(mergedSession.session).toBe(session)
        expect(mergedSummary.changed).toBe(false)
        expect(mergedSummary.session).toBe(summary)
    })

    it('derives pending request counts from agentState patches and clears them when agentState is removed', () => {
        const summary = createSummary()

        const added = mergeSessionSummaryData(summary, {
            agentState: {
                requests: {
                    reqA: { tool: 'exec_command', arguments: {}, createdAt: 10 },
                    reqB: { tool: 'exec_command', arguments: {}, createdAt: 11 }
                }
            }
        })

        expect(added.changed).toBe(true)
        expect(added.session.pendingRequestsCount).toBe(2)

        const cleared = mergeSessionSummaryData(
            { ...summary, pendingRequestsCount: 2 },
            { agentState: null }
        )

        expect(cleared.changed).toBe(true)
        expect(cleared.session.pendingRequestsCount).toBe(0)
    })
})
