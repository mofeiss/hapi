import { describe, expect, it } from 'vitest'
import type { ScheduledTask } from '@hapi/protocol'

import { buildScheduledPrompt } from './buildScheduledPrompt'

describe('buildScheduledPrompt', () => {
  it('returns the original user prompt without scheduler preamble', () => {
    const task: ScheduledTask = {
      id: 'task-1',
      namespace: 'default',
      machineId: 'machine-1',
      title: '查询巴中天气',
      prompt: '请查询四川巴中在 2026-03-16 今天的天气信息，并用简洁中文总结。',
      agentFlavor: 'codex',
      targetDirectory: '/tmp',
      runStrategy: 'new_session',
      scheduleType: 'once',
      runAt: Date.now() + 60_000,
      timezone: 'Asia/Shanghai',
      phase: 'enabled',
      scheduledSessionPermission: 'aware',
      allowOverlap: false,
      catchUpPolicy: 'skip',
      maxSkewMs: 0,
      createdAt: Date.now(),
      updatedAt: Date.now()
    }

    expect(buildScheduledPrompt(task)).toBe(task.prompt)
  })
})
