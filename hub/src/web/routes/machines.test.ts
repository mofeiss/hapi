import { describe, expect, it } from 'bun:test'
import { Hono } from 'hono'

import { createMachinesRoutes } from './machines'
import type { WebAppEnv } from '../middleware/auth'

function withNamespace(routes: ReturnType<typeof createMachinesRoutes>): Hono<WebAppEnv> {
    const app = new Hono<WebAppEnv>()
    app.use('*', async (c, next) => {
        c.set('namespace', 'ns-1')
        await next()
    })
    app.route('/', routes)
    return app
}

describe('machines routes', () => {
    it('renames a machine display name by machine id', async () => {
        const calls: Array<{ machineId: string; displayName: string | null; namespace: string }> = []
        const app = withNamespace(createMachinesRoutes(() => ({
            getMachine: (machineId: string) => machineId === 'machine-1'
                ? {
                    id: 'machine-1',
                    namespace: 'ns-1',
                    active: true,
                    updatedAt: 1,
                    metadata: {
                        host: 'MacBook-Pro',
                        platform: 'darwin',
                        happyCliVersion: '0.1.0',
                        displayName: 'MacBook-Pro'
                    }
                }
                : undefined,
            renameMachine: async (machineId: string, displayName: string | null, namespace: string) => {
                calls.push({ machineId, displayName, namespace })
            }
        }) as any))

        const response = await app.request('http://localhost/machines/machine-1/name', {
            method: 'PATCH',
            headers: {
                'content-type': 'application/json',
                'x-namespace': 'ns-1'
            },
            body: JSON.stringify({ displayName: 'Desk Mini' })
        }, {
            namespace: 'ns-1'
        } as any)

        expect(response.status).toBe(200)
        expect(await response.json()).toEqual({ ok: true })
        expect(calls).toEqual([{ machineId: 'machine-1', displayName: 'Desk Mini', namespace: 'ns-1' }])
    })

    it('clears a machine display name with null', async () => {
        const calls: Array<{ machineId: string; displayName: string | null; namespace: string }> = []
        const app = withNamespace(createMachinesRoutes(() => ({
            getMachine: () => ({
                id: 'machine-1',
                namespace: 'ns-1',
                active: true,
                updatedAt: 1,
                metadata: {
                    host: 'MacBook-Pro',
                    platform: 'darwin',
                    happyCliVersion: '0.1.0',
                    displayName: 'Desk Mini'
                }
            }),
            renameMachine: async (machineId: string, displayName: string | null, namespace: string) => {
                calls.push({ machineId, displayName, namespace })
            }
        }) as any))

        const response = await app.request('http://localhost/machines/machine-1/name', {
            method: 'PATCH',
            headers: {
                'content-type': 'application/json',
                'x-namespace': 'ns-1'
            },
            body: JSON.stringify({ displayName: null })
        }, {
            namespace: 'ns-1'
        } as any)

        expect(response.status).toBe(200)
        expect(calls).toEqual([{ machineId: 'machine-1', displayName: null, namespace: 'ns-1' }])
    })
})
