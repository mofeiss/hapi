import type { ScheduledTask } from '@hapi/protocol'

export function buildScheduledPrompt(task: ScheduledTask): string {
  return task.prompt
}
