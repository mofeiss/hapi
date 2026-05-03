import { Hono } from 'hono'
import { z } from 'zod'
import type { SyncEngine } from '../../sync/syncEngine'
import type { WebAppEnv } from '../middleware/auth'
import { requireMachine } from './guards'

const spawnBodySchema = z.object({
    directory: z.string().min(1),
    agent: z.enum(['claude', 'codex', 'gemini', 'opencode']).optional(),
    model: z.string().optional(),
    reasoningEffort: z.enum(['none', 'minimal', 'low', 'medium', 'high', 'xhigh']).optional(),
    permissionMode: z.string().optional(),
    basePermissionMode: z.string().optional(),
    sessionType: z.enum(['simple', 'worktree']).optional(),
    worktreeName: z.string().optional()
})

const agentModelsQuerySchema = z.object({
    agent: z.enum(['claude', 'codex', 'gemini', 'opencode']).default('codex')
})

const pathsExistsSchema = z.object({
    paths: z.array(z.string().min(1)).max(1000)
})

const machineNameSchema = z.object({
    displayName: z.string().trim().min(1).max(255).nullable()
})

const diagnosticLoggingSchema = z.object({
    enabled: z.boolean()
})

export function createMachinesRoutes(getSyncEngine: () => SyncEngine | null): Hono<WebAppEnv> {
    const app = new Hono<WebAppEnv>()

    app.get('/machines', (c) => {
        const engine = getSyncEngine()
        if (!engine) {
            return c.json({ error: 'Not connected' }, 503)
        }

        const namespace = c.get('namespace')
        const machines = engine.getMachinesByNamespace(namespace)
        return c.json({ machines })
    })

    app.get('/runtime-config', (c) => {
        const engine = getSyncEngine()
        if (!engine) {
            return c.json({ error: 'Not connected' }, 503)
        }

        return c.json({ diagnosticLogging: engine.getDiagnosticLoggingConfig() })
    })

    app.post('/runtime-config/diagnostic-logging', async (c) => {
        const engine = getSyncEngine()
        if (!engine) {
            return c.json({ error: 'Not connected' }, 503)
        }

        const body = await c.req.json().catch(() => null)
        const parsed = diagnosticLoggingSchema.safeParse(body)
        if (!parsed.success) {
            return c.json({ error: 'Invalid body' }, 400)
        }

        await engine.setDiagnosticLoggingConfig(parsed.data.enabled)
        return c.json({ diagnosticLogging: engine.getDiagnosticLoggingConfig() })
    })

    app.post('/machines/:id/spawn', async (c) => {
        const engine = getSyncEngine()
        if (!engine) {
            return c.json({ error: 'Not connected' }, 503)
        }

        const machineId = c.req.param('id')
        const machine = requireMachine(c, engine, machineId)
        if (machine instanceof Response) {
            return machine
        }

        const body = await c.req.json().catch(() => null)
        const parsed = spawnBodySchema.safeParse(body)
        if (!parsed.success) {
            return c.json({ error: 'Invalid body' }, 400)
        }

        const result = await engine.spawnSession(
            machineId,
            parsed.data.directory,
            parsed.data.agent,
            parsed.data.model,
            parsed.data.reasoningEffort,
            parsed.data.permissionMode,
            parsed.data.basePermissionMode,
            parsed.data.sessionType,
            parsed.data.worktreeName
        )
        return c.json(result)
    })

    app.get('/machines/:id/agent-models', async (c) => {
        const engine = getSyncEngine()
        if (!engine) {
            return c.json({ error: 'Not connected' }, 503)
        }

        const machineId = c.req.param('id')
        const machine = requireMachine(c, engine, machineId)
        if (machine instanceof Response) {
            return machine
        }

        const parsed = agentModelsQuerySchema.safeParse(c.req.query())
        if (!parsed.success) {
            return c.json({ error: 'Invalid query' }, 400)
        }

        const result = await engine.listAgentModels(machineId, parsed.data.agent)
        const status = result.success ? 200 : 502
        return c.json(result, status)
    })

    app.patch('/machines/:id/name', async (c) => {
        const engine = getSyncEngine()
        if (!engine) {
            return c.json({ error: 'Not connected' }, 503)
        }

        const machineId = c.req.param('id')
        const machine = requireMachine(c, engine, machineId)
        if (machine instanceof Response) {
            return machine
        }

        const body = await c.req.json().catch(() => null)
        const parsed = machineNameSchema.safeParse(body)
        if (!parsed.success) {
            return c.json({ error: 'Invalid body' }, 400)
        }

        const namespace = c.get('namespace')
        try {
            await engine.renameMachine(machineId, parsed.data.displayName, namespace)
            return c.json({ ok: true })
        } catch (error) {
            return c.json({ error: error instanceof Error ? error.message : 'Failed to rename machine' }, 409)
        }
    })

    app.post('/machines/:id/paths/exists', async (c) => {
        const engine = getSyncEngine()
        if (!engine) {
            return c.json({ error: 'Not connected' }, 503)
        }

        const machineId = c.req.param('id')
        const machine = requireMachine(c, engine, machineId)
        if (machine instanceof Response) {
            return machine
        }

        const body = await c.req.json().catch(() => null)
        const parsed = pathsExistsSchema.safeParse(body)
        if (!parsed.success) {
            return c.json({ error: 'Invalid body' }, 400)
        }

        const uniquePaths = Array.from(new Set(parsed.data.paths.map((path) => path.trim()).filter(Boolean)))
        if (uniquePaths.length === 0) {
            return c.json({ exists: {} })
        }

        try {
            const exists = await engine.checkPathsExist(machineId, uniquePaths)
            return c.json({ exists })
        } catch (error) {
            return c.json({ error: error instanceof Error ? error.message : 'Failed to check paths' }, 500)
        }
    })

    return app
}
