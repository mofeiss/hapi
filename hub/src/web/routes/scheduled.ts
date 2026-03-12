import { Hono } from 'hono'
import { z } from 'zod'

import type { WebAppEnv } from '../middleware/auth'
import type { SyncEngine } from '../../sync/syncEngine'
import { requireMachine, requireSyncEngine } from './guards'

const cancelBodySchema = z.object({
    taskId: z.string().min(1)
})

async function runnerPost<T>(path: string, body: unknown): Promise<T> {
    const runnerStatePath = `${process.env.HAPI_HOME?.replace(/^~/, process.env.HOME || '') || `${process.env.HOME || ''}/.hapi`}/runner.state.json`
    const stateFile = Bun.file(runnerStatePath)
    if (!(await stateFile.exists())) {
        throw new Error('Runner is not running')
    }

    const state = await stateFile.json() as { httpPort?: number }
    if (!state.httpPort) {
        throw new Error('Runner HTTP port unavailable')
    }

    const response = await fetch(`http://127.0.0.1:${state.httpPort}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body ?? {})
    })

    if (!response.ok) {
        throw new Error(`Runner request failed: HTTP ${response.status}`)
    }

    return await response.json() as T
}

function filterScheduledPayloadByMachine<T extends { machineId: string }>(items: T[], machineIds: Set<string>): T[] {
    return items.filter((item) => machineIds.has(item.machineId))
}

export function createScheduledRoutes(getSyncEngine: () => SyncEngine | null): Hono<WebAppEnv> {
    const app = new Hono<WebAppEnv>()

    app.get('/scheduled-tasks', async (c) => {
        const engine = requireSyncEngine(c, getSyncEngine)
        if (engine instanceof Response) {
            return engine
        }

        const namespace = c.get('namespace')
        const machines = engine.getOnlineMachinesByNamespace(namespace)
        if (machines.length === 0) {
            return c.json({ tasks: [], runs: [] })
        }

        const machineIds = new Set(machines.map((machine) => machine.id))

        const { tasks } = await runnerPost<{ tasks: Array<{ machineId: string }> }>('/scheduler/tasks/list', {})
        const { runs } = await runnerPost<{ runs: Array<{ machineId: string }> }>('/scheduler/runs/list', {})
        return c.json({
            tasks: filterScheduledPayloadByMachine(tasks, machineIds),
            runs: filterScheduledPayloadByMachine(runs, machineIds)
        })
    })

    app.get('/machines/:id/scheduled-tasks', async (c) => {
        const engine = requireSyncEngine(c, getSyncEngine)
        if (engine instanceof Response) {
            return engine
        }

        const machineId = c.req.param('id')
        const machine = requireMachine(c, engine, machineId)
        if (machine instanceof Response) {
            return machine
        }

        const { tasks } = await runnerPost<{ tasks: Array<{ machineId: string }> }>('/scheduler/tasks/list', {})
        const { runs } = await runnerPost<{ runs: Array<{ machineId: string }> }>('/scheduler/runs/list', {})
        return c.json({
            tasks: filterScheduledPayloadByMachine(tasks, new Set([machine.id])),
            runs: filterScheduledPayloadByMachine(runs, new Set([machine.id]))
        })
    })

    app.post('/scheduled-tasks/cancel', async (c) => {
        const engine = requireSyncEngine(c, getSyncEngine)
        if (engine instanceof Response) {
            return engine
        }

        const body = await c.req.json().catch(() => null)
        const parsed = cancelBodySchema.safeParse(body)
        if (!parsed.success) {
            return c.json({ error: 'Invalid body' }, 400)
        }

        const result = await runnerPost<{ task: unknown | null }>('/scheduler/tasks/cancel', parsed.data)
        return c.json(result)
    })

    return app
}
