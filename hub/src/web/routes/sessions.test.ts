import { describe, expect, it } from 'bun:test'

import { createSessionsRoutes } from './sessions'

describe('sessions routes', () => {
    it('filters scheduled-triggered sessions from the session list', async () => {
        const app = createSessionsRoutes(() => ({
            getSessionsByNamespace: () => [
                {
                    id: 'manual-session',
                    namespace: 'ns-1',
                    seq: 1,
                    createdAt: 1,
                    updatedAt: 10,
                    active: true,
                    activeAt: 10,
                    metadata: {
                        path: '/tmp/manual',
                        host: 'host-1',
                        name: 'Manual session',
                        flavor: 'claude'
                    },
                    metadataVersion: 1,
                    agentState: null,
                    agentStateVersion: 1,
                    thinking: false,
                    thinkingAt: 0,
                    todos: undefined,
                    permissionMode: undefined,
                    basePermissionMode: undefined,
                    modelMode: undefined
                },
                {
                    id: 'scheduled-session',
                    namespace: 'ns-1',
                    seq: 2,
                    createdAt: 2,
                    updatedAt: 20,
                    active: true,
                    activeAt: 20,
                    metadata: {
                        path: '/tmp/scheduled',
                        host: 'host-1',
                        name: 'Scheduled session',
                        flavor: 'claude',
                        trigger: {
                            type: 'scheduled-task',
                            taskId: 'task-1',
                            runId: 'run-1'
                        }
                    },
                    metadataVersion: 1,
                    agentState: null,
                    agentStateVersion: 1,
                    thinking: false,
                    thinkingAt: 0,
                    todos: undefined,
                    permissionMode: undefined,
                    basePermissionMode: undefined,
                    modelMode: undefined
                }
            ]
        }) as any)

        const response = await app.request('http://localhost/sessions', {
            headers: {
                'x-namespace': 'ns-1'
            }
        }, {
            namespace: 'ns-1'
        } as any)

        expect(response.status).toBe(200)

        const body = await response.json() as { sessions: Array<{ id: string }> }
        expect(body.sessions.map((session) => session.id)).toEqual(['manual-session'])
    })
})
