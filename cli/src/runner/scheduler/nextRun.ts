import type { ScheduledTask } from '@hapi/protocol'

export function resolveNextRunAt(task: ScheduledTask, now: number): number | undefined {
  if (task.scheduleType === 'once') {
    const runAt = task.scheduleSpec.runAt
    if (typeof runAt !== 'number') {
      return undefined
    }
    if (task.status === 'completed' || task.status === 'canceled') {
      return undefined
    }
    return runAt >= now ? runAt : runAt
  }

  return undefined
}

export function isTaskDue(task: ScheduledTask, now: number): boolean {
  if (task.paused || task.status !== 'active') {
    return false
  }

  return typeof task.nextRunAt === 'number' && task.nextRunAt <= now
}

