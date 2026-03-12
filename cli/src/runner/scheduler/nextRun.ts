import { CronExpressionParser } from 'cron-parser'
import type { ScheduledTask } from '@hapi/protocol'

export function resolveNextRunAt(task: ScheduledTask, now: number): number | undefined {
  if (task.status === 'canceled') {
    return undefined
  }

  if (task.scheduleType === 'once') {
    const runAt = task.scheduleSpec.runAt
    if (typeof runAt !== 'number') {
      return undefined
    }
    if (task.status === 'completed') {
      return undefined
    }
    return runAt
  }

  const expression = task.scheduleSpec.cron?.trim()
  if (!expression) {
    return undefined
  }

  try {
    const interval = CronExpressionParser.parse(expression, {
      currentDate: now,
      tz: task.timezone
    })
    return interval.next().getTime()
  } catch {
    return undefined
  }
}

export function isTaskDue(task: ScheduledTask, now: number): boolean {
  if (task.paused || task.status !== 'active') {
    return false
  }

  return typeof task.nextRunAt === 'number' && task.nextRunAt <= now
}
