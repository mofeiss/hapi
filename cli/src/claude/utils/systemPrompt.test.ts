import { describe, expect, it } from 'vitest'

import { buildClaudeSystemPrompt, shouldInjectTitlePrompt } from './systemPrompt'

describe('claude system prompt', () => {
    it('injects title prompt for regular sessions', () => {
        expect(shouldInjectTitlePrompt()).toBe(true)
        expect(buildClaudeSystemPrompt()).toContain('## Title Management')
        expect(buildClaudeSystemPrompt()).toContain('## Scheduled Task Creation')
        expect(buildClaudeSystemPrompt()).toContain('mcp__hapi__change_title')
        expect(buildClaudeSystemPrompt()).toContain('mcp__hapi__schedule_create')
        expect(buildClaudeSystemPrompt()).toContain('mcp__hapi__schedule_list')
        expect(buildClaudeSystemPrompt()).toContain('All scheduled task times in HAPI use the fixed timezone Asia/Shanghai.')
        expect(buildClaudeSystemPrompt()).toContain('Never invent an absolute timestamp for a relative-time request.')
        expect(buildClaudeSystemPrompt()).toContain('If the user does not specify a permission level, default to aware.')
        expect(buildClaudeSystemPrompt()).toContain('Only use self_control or system_control when the user explicitly asks')
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
        expect(prompt).toContain('## Scheduled Session Environment')
        expect(prompt).toContain('## Scheduled Run Outcome Reporting')
        expect(prompt).toContain('## Scheduled Session Permissions')
        expect(prompt).toContain('You are running inside a HAPI scheduled session.')
        expect(prompt).toContain('There is no active user supervising this run.')
        expect(prompt).toContain('scheduledSessionPermission: aware')
        expect(prompt).toContain('MUST use "mcp__hapi__schedule_report_outcome" to report the final business outcome of this run.')
        expect(prompt).toContain('Do not rely on plain text alone to report completion status.')
        expect(prompt).toContain('The summary must describe the real business outcome, not merely list actions taken.')
        expect(prompt).toContain('final scheduler-related wrap-up step')
        expect(prompt).toContain('Do not use this tool for partial progress updates.')
        expect(prompt).toContain('Use these meanings:')
        expect(prompt).toContain('- completed: the requested task objective was successfully achieved.')
        expect(prompt).toContain('- partial: useful progress was made, but the full requested objective was not fully achieved.')
        expect(prompt).toContain('- blocked: the objective could not be completed because required information, access, dependencies, or external conditions were missing or unavailable.')
        expect(prompt).toContain('- abandoned: the objective should be treated as intentionally stopped')
        expect(prompt).toContain('If you are unsure between partial and blocked, prefer blocked')
        expect(prompt).toContain('Your permission level is aware.')
        expect(prompt).toContain('Even without scheduler control permissions, you still MUST report the final run outcome through the scheduled outcome reporting tool.')
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
        expect(prompt).toContain('mcp__hapi__schedule_archive')
        expect(prompt).toContain('mcp__hapi__schedule_report_outcome')
        expect(prompt).toContain('Your permission level is self_control.')
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

        expect(prompt).toContain('mcp__hapi__schedule_archive')
        expect(prompt).toContain('mcp__hapi__schedule_run_get')
        expect(prompt).toContain('mcp__hapi__schedule_report_outcome')
        expect(prompt).toContain('Your permission level is system_control.')
        expect(prompt).toContain('prevent repeated pointless failures')
        expect(prompt).not.toContain('mcp__hapi__change_title')
    })
})
