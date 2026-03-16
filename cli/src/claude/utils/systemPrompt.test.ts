import { describe, expect, it } from 'vitest'

import { buildClaudeSystemPrompt, shouldInjectTitlePrompt } from './systemPrompt'

describe('claude system prompt', () => {
    it('injects title prompt for regular sessions', () => {
        expect(shouldInjectTitlePrompt()).toBe(true)
        expect(buildClaudeSystemPrompt()).toContain('mcp__hapi__change_title')
        expect(buildClaudeSystemPrompt()).toContain('mcp__hapi__schedule_create')
        expect(buildClaudeSystemPrompt()).toContain('mcp__hapi__schedule_list')
        expect(buildClaudeSystemPrompt()).toContain('must explicitly specify one of: aware, self_control, system_control')
        expect(buildClaudeSystemPrompt()).toContain('task creation success from task execution status')
    })

    it('omits title prompt for scheduled-triggered sessions', () => {
        const prompt = buildClaudeSystemPrompt({
            type: 'scheduled-task',
            taskId: 'task-1',
            runId: 'run-1',
            scheduleType: 'cron',
            scheduledSessionPermission: 'aware',
            iteration: 3
        })

        expect(shouldInjectTitlePrompt({
            type: 'scheduled-task',
            taskId: 'task-1',
            runId: 'run-1',
            scheduleType: 'cron',
            scheduledSessionPermission: 'aware',
            iteration: 3
        })).toBe(false)
        expect(prompt).not.toContain('mcp__hapi__change_title')
        expect(prompt).toContain('mcp__hapi__schedule_create')
        expect(prompt).toContain('mcp__hapi__schedule_list')
        expect(prompt).toContain('task creation success from task execution status')
        expect(prompt).toContain('You are running inside a HAPI scheduled session.')
        expect(prompt).toContain('There is no active user supervising this run.')
        expect(prompt).toContain('scheduledSessionPermission: aware')
        expect(prompt).not.toContain('mcp__hapi__schedule_report_outcome')
        expect(prompt).not.toContain('You may use HAPI scheduler tools only for your own task')
        expect(prompt).not.toContain('You may use the full HAPI scheduler toolset')
    })

    it('injects self-control scheduler guidance for self_control scheduled sessions', () => {
        const prompt = buildClaudeSystemPrompt({
            type: 'scheduled-task',
            taskId: 'task-1',
            runId: 'run-1',
            scheduleType: 'cron',
            scheduledSessionPermission: 'self_control',
            iteration: 4
        })

        expect(prompt).toContain('You may use HAPI scheduler tools only for your own task (task-1).')
        expect(prompt).toContain('mcp__hapi__schedule_report_outcome')
        expect(prompt).not.toContain('mcp__hapi__change_title')
        expect(prompt).not.toContain('You may use the full HAPI scheduler toolset')
    })

    it('injects full scheduler guidance for system_control scheduled sessions', () => {
        const prompt = buildClaudeSystemPrompt({
            type: 'scheduled-task',
            taskId: 'task-1',
            runId: 'run-1',
            scheduleType: 'cron',
            scheduledSessionPermission: 'system_control',
            iteration: 5
        })

        expect(prompt).toContain('You may use the full HAPI scheduler toolset, including creating new scheduled tasks and managing existing ones.')
        expect(prompt).toContain('mcp__hapi__schedule_report_outcome')
        expect(prompt).toContain('prevent repeated pointless failures')
        expect(prompt).not.toContain('mcp__hapi__change_title')
    })
})
