import { describe, expect, it, vi } from 'vitest'
import { CodexPermissionHandler } from './permissionHandler'

function createClient() {
    const state = { completedRequests: {} as Record<string, unknown> }
    return {
        state,
        client: {
            rpcHandlerManager: {
                registerHandler: vi.fn()
            },
            updateAgentState: vi.fn((updater: (current: typeof state) => typeof state) => {
                const next = updater(state)
                Object.assign(state, next)
            })
        }
    }
}

describe('CodexPermissionHandler', () => {
    it('auto-approves all tools in yolo mode without creating pending requests', async () => {
        const { client, state } = createClient()
        const onComplete = vi.fn()
        const handler = new CodexPermissionHandler(client as any, {
            getPermissionMode: () => 'yolo',
            onComplete
        })

        const result = await handler.handleToolCall('call-1', 'CodexPermission', { message: 'approve' })

        expect(result).toEqual({ decision: 'approved_for_session' })
        expect(Object.keys((handler as any).pendingRequests)).toBeDefined()
        expect((handler as any).pendingRequests.size).toBe(0)
        expect(state.completedRequests['call-1']).toMatchObject({
            tool: 'CodexPermission',
            status: 'approved',
            decision: 'approved_for_session'
        })
        expect(onComplete).toHaveBeenCalledWith({
            id: 'call-1',
            toolName: 'CodexPermission',
            input: { message: 'approve' },
            approved: true,
            decision: 'approved_for_session'
        })
    })

    it('auto-approves change_title hints even in default mode', async () => {
        const { client, state } = createClient()
        const handler = new CodexPermissionHandler(client as any, {
            getPermissionMode: () => 'default'
        })

        const result = await handler.handleToolCall('call-change-title', 'mcp__hapi__change_title', { title: 'demo' })

        expect(result).toEqual({ decision: 'approved' })
        expect((handler as any).pendingRequests.size).toBe(0)
        expect(state.completedRequests['call-change-title']).toMatchObject({
            tool: 'mcp__hapi__change_title',
            status: 'approved',
            decision: 'approved'
        })
    })
})
