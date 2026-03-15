/**
 * HTTP control server for runner management
 * Provides endpoints for listing sessions, stopping sessions, and runner shutdown
 */

import fastify, { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { serializerCompiler, validatorCompiler, ZodTypeProvider } from 'fastify-type-provider-zod';
import { logger } from '@/ui/logger';
import { Metadata } from '@/api/types';
import { TrackedSession } from './types';
import { SpawnSessionOptions, SpawnSessionResult } from '@/modules/common/rpcTypes';
import type { CreateScheduledTaskInput, UpdateScheduledTaskInput } from './scheduler/types';
import type { ScheduledTask, ScheduledTaskRun } from '@hapi/protocol';

export function startRunnerControlServer({
  getChildren,
  stopSession,
  spawnSession,
  createScheduledTask,
  updateScheduledTask,
  listScheduledTasks,
  listScheduledTaskRuns,
  cancelScheduledTask,
  deleteScheduledTask,
  requestShutdown,
  onHappySessionWebhook
}: {
  getChildren: () => TrackedSession[];
  stopSession: (sessionId: string) => boolean;
  spawnSession: (options: SpawnSessionOptions) => Promise<SpawnSessionResult>;
  createScheduledTask: (input: CreateScheduledTaskInput) => Promise<ScheduledTask>;
  updateScheduledTask: (input: UpdateScheduledTaskInput) => Promise<ScheduledTask | null>;
  listScheduledTasks: () => Promise<ScheduledTask[]>;
  listScheduledTaskRuns: () => Promise<ScheduledTaskRun[]>;
  cancelScheduledTask: (taskId: string) => Promise<ScheduledTask | null>;
  deleteScheduledTask: (taskId: string) => Promise<{ taskId: string; machineId: string; namespace: string } | null>;
  requestShutdown: () => void;
  onHappySessionWebhook: (sessionId: string, metadata: Metadata) => void;
}): Promise<{ port: number; stop: () => Promise<void> }> {
  return new Promise((resolve) => {
    const app = fastify({
      logger: false // We use our own logger
    });

    // Set up Zod type provider
    app.setValidatorCompiler(validatorCompiler);
    app.setSerializerCompiler(serializerCompiler);
    const typed = app.withTypeProvider<ZodTypeProvider>();

    // Session reports itself after creation
    typed.post('/session-started', {
      schema: {
        body: z.object({
          sessionId: z.string(),
          metadata: z.any() // Metadata type from API
        }),
        response: {
          200: z.object({
            status: z.literal('ok')
          })
        }
      }
    }, async (request) => {
      const { sessionId, metadata } = request.body;

      logger.debug(`[CONTROL SERVER] Session started: ${sessionId}`);
      onHappySessionWebhook(sessionId, metadata);

      return { status: 'ok' as const };
    });

    // List all tracked sessions
    typed.post('/list', {
      schema: {
        response: {
          200: z.object({
            children: z.array(z.object({
              startedBy: z.string(),
              happySessionId: z.string(),
              pid: z.number()
            }))
          })
        }
      }
    }, async () => {
      const children = getChildren();
      logger.debug(`[CONTROL SERVER] Listing ${children.length} sessions`);
      return { 
        children: children
          .filter(child => child.happySessionId !== undefined)
          .map(child => ({
            startedBy: child.startedBy,
            happySessionId: child.happySessionId!,
            pid: child.pid
          }))
      }
    });

    // Stop specific session
    typed.post('/stop-session', {
      schema: {
        body: z.object({
          sessionId: z.string()
        }),
        response: {
          200: z.object({
            success: z.boolean()
          })
        }
      }
    }, async (request) => {
      const { sessionId } = request.body;

      logger.debug(`[CONTROL SERVER] Stop session request: ${sessionId}`);
      const success = stopSession(sessionId);
      return { success };
    });

    // Spawn new session
    typed.post('/spawn-session', {
      schema: {
        body: z.object({
          directory: z.string(),
          sessionId: z.string().optional(),
          sessionType: z.enum(['simple', 'worktree']).optional(),
          worktreeName: z.string().optional()
        }),
        response: {
          200: z.object({
            success: z.boolean(),
            sessionId: z.string().optional(),
            approvedNewDirectoryCreation: z.boolean().optional()
          }),
          409: z.object({
            success: z.boolean(),
            requiresUserApproval: z.boolean().optional(),
            actionRequired: z.string().optional(),
            directory: z.string().optional()
          }),
          500: z.object({
            success: z.boolean(),
            error: z.string().optional()
          })
        }
      }
    }, async (request, reply) => {
      const { directory, sessionId, sessionType, worktreeName } = request.body;

      logger.debug(`[CONTROL SERVER] Spawn session request: dir=${directory}, sessionId=${sessionId || 'new'}`);
      const result = await spawnSession({ directory, sessionId, sessionType, worktreeName });

      switch (result.type) {
        case 'success':
          // Check if sessionId exists, if not return error
          if (!result.sessionId) {
            reply.code(500);
            return {
              success: false,
              error: 'Failed to spawn session: no session ID returned'
            };
          }
          return {
            success: true,
            sessionId: result.sessionId,
            approvedNewDirectoryCreation: true
          };
        
        case 'requestToApproveDirectoryCreation':
          reply.code(409); // Conflict - user input needed
          return { 
            success: false,
            requiresUserApproval: true,
            actionRequired: 'CREATE_DIRECTORY',
            directory: result.directory
          };
        
        case 'error':
          reply.code(500);
          return { 
            success: false,
            error: result.errorMessage
          };
      }
    });

    typed.post('/scheduler/tasks/create', {
      schema: {
        body: z.object({
          machineId: z.string(),
          namespace: z.string().optional(),
          createdBySessionId: z.string().optional(),
          title: z.string().min(1),
          prompt: z.string().min(1),
          agentFlavor: z.enum(['claude', 'codex']).optional(),
          targetDirectory: z.string().min(1),
          model: z.string().optional(),
          scheduleType: z.enum(['once', 'cron']).optional(),
          runAt: z.number().optional(),
          cron: z.string().optional(),
          timezone: z.string().optional(),
          paused: z.boolean().optional(),
          allowOverlap: z.boolean().optional(),
          catchUpPolicy: z.enum(['once_within_window', 'skip']).optional(),
          maxSkewMs: z.number().int().nonnegative().optional()
        }),
        response: {
          200: z.object({ task: z.unknown() }),
          500: z.object({ error: z.string(), code: z.string().optional() })
        }
      }
    }, async (request, reply) => {
      try {
        const task = await createScheduledTask(request.body)
        return { task }
      } catch (error) {
        reply.code(500)
        return {
          error: error instanceof Error && error.message ? error.message : 'Failed to create scheduled task',
          code: typeof error === 'object' && error !== null && 'code' in error && typeof (error as { code?: unknown }).code === 'string'
            ? (error as { code: string }).code
            : undefined
        }
      }
    });

    typed.post('/scheduler/tasks/update', {
      schema: {
        body: z.object({
          taskId: z.string(),
          title: z.string().min(1).optional(),
          prompt: z.string().min(1).optional(),
          agentFlavor: z.enum(['claude', 'codex']).optional(),
          targetDirectory: z.string().min(1).optional(),
          model: z.string().optional(),
          scheduleType: z.enum(['once', 'cron']).optional(),
          runAt: z.number().optional(),
          cron: z.string().optional(),
          timezone: z.string().optional(),
          paused: z.boolean().optional(),
          allowOverlap: z.boolean().optional(),
          catchUpPolicy: z.enum(['once_within_window', 'skip']).optional(),
          maxSkewMs: z.number().int().nonnegative().optional()
        }),
        response: {
          200: z.object({ task: z.unknown().nullable() }),
          500: z.object({ error: z.string(), code: z.string().optional() })
        }
      }
    }, async (request, reply) => {
      try {
        const task = await updateScheduledTask(request.body)
        return { task }
      } catch (error) {
        reply.code(500)
        return {
          error: error instanceof Error && error.message ? error.message : 'Failed to update scheduled task',
          code: typeof error === 'object' && error !== null && 'code' in error && typeof (error as { code?: unknown }).code === 'string'
            ? (error as { code: string }).code
            : undefined
        }
      }
    });

    typed.post('/scheduler/tasks/list', {
      schema: {
        response: {
          200: z.object({ tasks: z.array(z.unknown()) })
        }
      }
    }, async () => {
      const tasks = await listScheduledTasks()
      return { tasks }
    });

    typed.post('/scheduler/runs/list', {
      schema: {
        response: {
          200: z.object({ runs: z.array(z.unknown()) })
        }
      }
    }, async () => {
      const runs = await listScheduledTaskRuns()
      return { runs }
    });

    typed.post('/scheduler/tasks/cancel', {
      schema: {
        body: z.object({ taskId: z.string() }),
        response: {
          200: z.object({ task: z.unknown().nullable() }),
          500: z.object({ error: z.string(), code: z.string().optional() })
        }
      }
    }, async (request, reply) => {
      try {
        const task = await cancelScheduledTask(request.body.taskId)
        return { task }
      } catch (error) {
        reply.code(500)
        return {
          error: error instanceof Error && error.message ? error.message : 'Failed to cancel scheduled task',
          code: typeof error === 'object' && error !== null && 'code' in error && typeof (error as { code?: unknown }).code === 'string'
            ? (error as { code: string }).code
            : undefined
        }
      }
    });

    typed.post('/scheduler/tasks/delete', {
      schema: {
        body: z.object({ taskId: z.string() }),
        response: {
          200: z.object({ deleted: z.object({ taskId: z.string(), machineId: z.string(), namespace: z.string() }).nullable() }),
          500: z.object({ error: z.string(), code: z.string().optional() })
        }
      }
    }, async (request, reply) => {
      try {
        const deleted = await deleteScheduledTask(request.body.taskId)
        return { deleted }
      } catch (error) {
        reply.code(500)
        return {
          error: error instanceof Error && error.message ? error.message : 'Failed to delete scheduled task',
          code: typeof error === 'object' && error !== null && 'code' in error && typeof (error as { code?: unknown }).code === 'string'
            ? (error as { code: string }).code
            : undefined
        }
      }
    });

    // Stop runner
    typed.post('/stop', {
      schema: {
        response: {
          200: z.object({
            status: z.string()
          })
        }
      }
    }, async () => {
      logger.debug('[CONTROL SERVER] Stop runner request received');

      // Give time for response to arrive
      setTimeout(() => {
        logger.debug('[CONTROL SERVER] Triggering runner shutdown');
        requestShutdown();
      }, 50);

      return { status: 'stopping' };
    });

    app.listen({ port: 0, host: '127.0.0.1' }, (err, address) => {
      if (err) {
        logger.debug('[CONTROL SERVER] Failed to start:', err);
        throw err;
      }

      const port = parseInt(address.split(':').pop()!);
      logger.debug(`[CONTROL SERVER] Started on port ${port}`);

      resolve({
        port,
        stop: async () => {
          logger.debug('[CONTROL SERVER] Stopping server');
          await app.close();
          logger.debug('[CONTROL SERVER] Server stopped');
        }
      });
    });
  });
}
