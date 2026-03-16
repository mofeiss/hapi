import { describe, expect, it } from 'vitest'

import { buildClaudeSystemPrompt, shouldInjectTitlePrompt } from './systemPrompt'

describe('claude system prompt', () => {
    it('injects title prompt for regular sessions', () => {
        expect(shouldInjectTitlePrompt()).toBe(true)
        expect(buildClaudeSystemPrompt()).toContain('mcp__hapi__change_title')
        expect(buildClaudeSystemPrompt()).toContain('mcp__hapi__schedule_create')
        expect(buildClaudeSystemPrompt()).toContain('mcp__hapi__schedule_list')
        expect(buildClaudeSystemPrompt()).toContain('task creation success from task execution status')
    })

    it('omits title prompt for scheduled-triggered sessions', () => {
        const prompt = buildClaudeSystemPrompt({
            type: 'scheduled-task',
            taskId: 'task-1',
            runId: 'run-1'
        })

        expect(shouldInjectTitlePrompt({
            type: 'scheduled-task',
            taskId: 'task-1',
            runId: 'run-1'
        })).toBe(false)
        expect(prompt).not.toContain('mcp__hapi__change_title')
        expect(prompt).toContain('mcp__hapi__schedule_create')
        expect(prompt).toContain('mcp__hapi__schedule_list')
        expect(prompt).toContain('task creation success from task execution status')
    })
})
