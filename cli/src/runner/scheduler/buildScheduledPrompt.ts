import type { ScheduledTaskRun, ScheduledTask } from '@hapi/protocol'

export function buildScheduledPrompt(task: ScheduledTask, run: ScheduledTaskRun): string {
  const plannedAt = new Date(run.scheduledFor).toLocaleString('zh-CN', { hour12: false })
  const triggeredAt = new Date(run.triggeredAt).toLocaleString('zh-CN', { hour12: false })

  return [
    '这是一个由 HAPI Scheduled Task 触发的自动任务。',
    '',
    `任务标题：${task.title}`,
    `计划时间：${plannedAt} ${task.timezone}`,
    `触发时间：${triggeredAt} ${task.timezone}`,
    '',
    '请执行以下任务：',
    task.prompt
  ].join('\n')
}

