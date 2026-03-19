import { Hono } from 'hono'
import { z } from 'zod'
import type { ScheduledTask, ScheduledTaskRun } from '@hapi/protocol'

import type { WebAppEnv } from '../middleware/auth'
import type { SyncEngine } from '../../sync/syncEngine'
import { requireMachine, requireSyncEngine } from './guards'

const archiveBodySchema = z.object({
    taskId: z.string().min(1)
})

const updateBodySchema = z.object({
    taskId: z.string().min(1),
    title: z.string().min(1).optional(),
    prompt: z.string().min(1).optional(),
    agentFlavor: z.enum(['claude', 'codex']).optional(),
    targetDirectory: z.string().min(1).optional(),
    permissionMode: z.string().optional(),
    basePermissionMode: z.string().optional(),
    model: z.string().optional(),
    reasoningEffort: z.union([z.enum(['none', 'minimal', 'low', 'medium', 'high', 'xhigh']), z.null()]).optional(),
    scheduleType: z.enum(['once', 'cron']).optional(),
    runAt: z.number().optional(),
    delay: z.object({
        years: z.number().int().nonnegative().optional(),
        months: z.number().int().nonnegative().optional(),
        days: z.number().int().nonnegative().optional(),
        hours: z.number().int().nonnegative().optional(),
        minutes: z.number().int().nonnegative().optional(),
        seconds: z.number().int().nonnegative().optional()
    }).refine((value) => Object.values(value).some((entry) => typeof entry === 'number' && entry > 0), {
        message: 'at least one delay unit must be greater than zero'
    }).optional(),
    cron: z.string().optional(),
    timezone: z.string().optional(),
    phase: z.enum(['enabled', 'paused', 'archived']).optional(),
    allowOverlap: z.boolean().optional(),
    catchUpPolicy: z.enum(['once_within_window', 'skip']).optional(),
    maxSkewMs: z.number().int().nonnegative().optional()
})

const deleteBodySchema = z.object({
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
        const detail = await response.text().catch(() => '')
        if (detail) {
            throw new Error(detail)
        }
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

    app.post('/scheduled-tasks/archive', async (c) => {
        const engine = requireSyncEngine(c, getSyncEngine)
        if (engine instanceof Response) {
            return engine
        }

        const body = await c.req.json().catch(() => null)
        const parsed = archiveBodySchema.safeParse(body)
        if (!parsed.success) {
            return c.json({ error: 'Invalid body' }, 400)
        }

        try {
            const result = await runnerPost<{ task: unknown | null }>('/scheduler/tasks/archive', parsed.data)
            return c.json(result)
        } catch (error) {
            const message = error instanceof Error && error.message ? error.message : 'Runner request failed'
            try {
                const parsed = JSON.parse(message) as { error?: string; code?: string }
                return c.json({ error: parsed.error ?? message, code: parsed.code }, 500)
            } catch {
                return c.json({ error: message }, 500)
            }
        }
    })

    app.post('/scheduled-tasks/update', async (c) => {
        const engine = requireSyncEngine(c, getSyncEngine)
        if (engine instanceof Response) {
            return engine
        }

        const body = await c.req.json().catch(() => null)
        const parsed = updateBodySchema.safeParse(body)
        if (!parsed.success) {
            return c.json({ error: 'Invalid body' }, 400)
        }

        try {
            const result = await runnerPost<{ task: unknown | null }>('/scheduler/tasks/update', parsed.data)
            return c.json(result)
        } catch (error) {
            const message = error instanceof Error && error.message ? error.message : 'Runner request failed'
            try {
                const parsed = JSON.parse(message) as { error?: string; code?: string }
                return c.json({ error: parsed.error ?? message, code: parsed.code }, 500)
            } catch {
                return c.json({ error: message }, 500)
            }
        }
    })

    app.post('/scheduled-tasks/delete', async (c) => {
        const engine = requireSyncEngine(c, getSyncEngine)
        if (engine instanceof Response) {
            return engine
        }

        const body = await c.req.json().catch(() => null)
        const parsed = deleteBodySchema.safeParse(body)
        if (!parsed.success) {
            return c.json({ error: 'Invalid body' }, 400)
        }

        try {
            const result = await runnerPost<{ deleted: unknown | null }>('/scheduler/tasks/delete', parsed.data)
            return c.json(result)
        } catch (error) {
            const message = error instanceof Error && error.message ? error.message : 'Runner request failed'
            try {
                const parsed = JSON.parse(message) as { error?: string; code?: string }
                return c.json({ error: parsed.error ?? message, code: parsed.code }, 500)
            } catch {
                return c.json({ error: message }, 500)
            }
        }
    })

    return app
}
