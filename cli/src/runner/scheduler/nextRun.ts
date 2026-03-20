import { CronExpressionParser } from 'cron-parser'
import type { ScheduledTask } from '@hapi/protocol'

export function resolveNextRunAt(task: ScheduledTask, now: number): number | undefined {
  if (task.phase !== 'enabled') {
    return undefined
  }

  if (task.scheduleType === 'once') {
    const runAt = task.runAt
    if (typeof runAt !== 'number') {
      return undefined
    }
    return runAt
  }

  const expression = task.cron?.trim()
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

export function resolveDueRunAt(task: ScheduledTask, now: number): number | undefined {
  if (task.phase !== 'enabled') {
    return undefined
  }

  if (task.scheduleType === 'once') {
    return typeof task.runAt === 'number' && task.runAt <= now ? task.runAt : undefined
  }

  const expression = task.cron?.trim()
  if (!expression) {
    return undefined
  }

  try {
    const nextRunAt = CronExpressionParser.parse(expression, {
      currentDate: now,
      tz: task.timezone
    }).next().getTime()

    const scheduledFor = nextRunAt <= now
      ? nextRunAt
      : CronExpressionParser.parse(expression, {
          currentDate: now,
          tz: task.timezone
        }).prev().getTime()

    if (!Number.isFinite(scheduledFor) || scheduledFor > now) {
      return undefined
    }

    if (scheduledFor <= task.updatedAt) {
      return undefined
    }

    if (task.catchUpPolicy === 'skip' && scheduledFor < now) {
      return undefined
    }

    if (now - scheduledFor > task.maxSkewMs) {
      return undefined
    }

    return scheduledFor
  } catch {
    return undefined
  }
}

export function isTaskDue(task: ScheduledTask, now: number): boolean {
  if (task.phase !== 'enabled') {
    return false
  }

  return typeof resolveDueRunAt(task, now) === 'number'
}
