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

export function isTaskDue(task: ScheduledTask, now: number): boolean {
  if (task.phase !== 'enabled') {
    return false
  }

  const nextRunAt = resolveNextRunAt(task, now)
  return typeof nextRunAt === 'number' && nextRunAt <= now
}
