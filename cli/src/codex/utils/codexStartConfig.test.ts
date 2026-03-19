import { describe, expect, it } from 'vitest';
import { buildCodexStartConfig } from './codexStartConfig';
import { codexSystemPrompt } from './systemPrompt';

describe('buildCodexStartConfig', () => {
    const mcpServers = { hapi: { command: 'node', args: ['mcp'] } };

    it('applies CLI overrides when permission mode is default', () => {
        const config = buildCodexStartConfig({
            message: 'hello',
            mode: { permissionMode: 'default' },
            first: true,
            mcpServers,
            cliOverrides: { sandbox: 'danger-full-access', approvalPolicy: 'never' }
        });

        expect(config.sandbox).toBe('danger-full-access');
        expect(config['approval-policy']).toBe('never');
        expect(config.config).toEqual({
            mcp_servers: mcpServers,
            developer_instructions: codexSystemPrompt
        });
    });

    it('ignores CLI overrides when permission mode is not default', () => {
        const config = buildCodexStartConfig({
            message: 'hello',
            mode: { permissionMode: 'yolo' },
            first: false,
            mcpServers,
            cliOverrides: { sandbox: 'read-only', approvalPolicy: 'never' }
        });

        expect(config.sandbox).toBe('danger-full-access');
        expect(config['approval-policy']).toBe('on-failure');
    });

    it('passes model when provided', () => {
        const config = buildCodexStartConfig({
            message: 'hello',
            mode: { permissionMode: 'default', model: 'o3' },
            first: false,
            mcpServers
        });

        expect(config.model).toBe('o3');
    });

    it('omits title instructions for scheduled-triggered sessions', () => {
        const config = buildCodexStartConfig({
            message: 'hello',
            mode: { permissionMode: 'default' },
            first: true,
            mcpServers,
            trigger: {
                type: 'scheduled-task',
                taskId: 'task-1',
                runId: 'run-1',
                scheduleType: 'cron',
                scheduledSessionPermission: 'aware',
                iteration: 2
            }
        });

        expect(config.config).toEqual({
            mcp_servers: mcpServers,
            developer_instructions: expect.any(String)
        });
        expect(String(config.config?.developer_instructions)).not.toContain('functions.hapi__change_title');
        expect(String(config.config?.developer_instructions)).toContain('## Scheduled Session Environment');
        expect(String(config.config?.developer_instructions)).toContain('## Scheduled Run Outcome Reporting');
        expect(String(config.config?.developer_instructions)).toContain('## Scheduled Session Permissions');
        expect(String(config.config?.developer_instructions)).toContain('functions.hapi__schedule_create');
        expect(String(config.config?.developer_instructions)).toContain('functions.hapi__schedule_list');
        expect(String(config.config?.developer_instructions)).toContain('You are running inside a HAPI scheduled session.');
        expect(String(config.config?.developer_instructions)).toContain('scheduledSessionPermission: aware');
        expect(String(config.config?.developer_instructions)).toContain('MUST use "functions.hapi__schedule_report_outcome" to report the final business outcome of this run.');
        expect(String(config.config?.developer_instructions)).toContain('Do not rely on plain text alone to report completion status.');
        expect(String(config.config?.developer_instructions)).toContain('The summary must describe the real business outcome, not merely list actions taken.');
        expect(String(config.config?.developer_instructions)).toContain('Do not use this tool for partial progress updates.');
        expect(String(config.config?.developer_instructions)).toContain('Use these meanings:');
        expect(String(config.config?.developer_instructions)).toContain('- completed: the requested task objective was successfully achieved.');
        expect(String(config.config?.developer_instructions)).toContain('- partial: useful progress was made, but the full requested objective was not fully achieved.');
        expect(String(config.config?.developer_instructions)).toContain('- blocked: the objective could not be completed because required information, access, dependencies, or external conditions were missing or unavailable.');
        expect(String(config.config?.developer_instructions)).toContain('- abandoned: the objective should be treated as intentionally stopped');
        expect(String(config.config?.developer_instructions)).toContain('If you are unsure between partial and blocked, prefer blocked');
        expect(String(config.config?.developer_instructions)).toContain('Your permission level is aware.');
        expect(String(config.config?.developer_instructions)).toContain('Even without scheduler control permissions, you still MUST report the final run outcome through the scheduled outcome reporting tool.');
        expect(String(config.config?.developer_instructions)).not.toContain('You may use HAPI scheduler tools only for your own task');
        expect(String(config.config?.developer_instructions)).not.toContain('You may use the full HAPI scheduler toolset');
    });

    it('injects scheduled task guidance for regular sessions', () => {
        const config = buildCodexStartConfig({
            message: 'hello',
            mode: { permissionMode: 'default' },
            first: true,
            mcpServers
        });

        expect(String(config.config?.developer_instructions)).toContain('## Title Management');
        expect(String(config.config?.developer_instructions)).toContain('## Scheduled Task Creation');
        expect(String(config.config?.developer_instructions)).toContain('functions.hapi__schedule_create');
        expect(String(config.config?.developer_instructions)).toContain('functions.hapi__schedule_list');
        expect(String(config.config?.developer_instructions)).toContain('All scheduled task times in HAPI use the fixed timezone Asia/Shanghai.');
        expect(String(config.config?.developer_instructions)).toContain('Never invent an absolute timestamp for a relative-time request.');
        expect(String(config.config?.developer_instructions)).toContain('If the user does not specify a permission level, default to aware.');
        expect(String(config.config?.developer_instructions)).toContain('Only use self_control or system_control when the user explicitly asks');
        expect(String(config.config?.developer_instructions)).toContain('task creation success from task execution status');
    });

    it('injects self-control scheduler guidance for self_control scheduled sessions', () => {
        const config = buildCodexStartConfig({
            message: 'hello',
            mode: { permissionMode: 'default' },
            first: true,
            mcpServers,
            trigger: {
                type: 'scheduled-task',
                taskId: 'task-1',
                runId: 'run-1',
                scheduleType: 'cron',
                scheduledSessionPermission: 'self_control',
                iteration: 4
            }
        });

        expect(String(config.config?.developer_instructions)).toContain('You may use HAPI scheduler tools only for your own task (task-1).');
        expect(String(config.config?.developer_instructions)).toContain('functions.hapi__schedule_archive');
        expect(String(config.config?.developer_instructions)).toContain('functions.hapi__schedule_report_outcome');
        expect(String(config.config?.developer_instructions)).toContain('Your permission level is self_control.');
        expect(String(config.config?.developer_instructions)).not.toContain('functions.hapi__change_title');
        expect(String(config.config?.developer_instructions)).not.toContain('You may use the full HAPI scheduler toolset');
    });

    it('injects full scheduler guidance for system_control scheduled sessions', () => {
        const config = buildCodexStartConfig({
            message: 'hello',
            mode: { permissionMode: 'default' },
            first: true,
            mcpServers,
            trigger: {
                type: 'scheduled-task',
                taskId: 'task-1',
                runId: 'run-1',
                scheduleType: 'cron',
                scheduledSessionPermission: 'system_control',
                iteration: 5
            }
        });

        expect(String(config.config?.developer_instructions)).toContain('functions.hapi__schedule_archive');
        expect(String(config.config?.developer_instructions)).toContain('functions.hapi__schedule_run_get');
        expect(String(config.config?.developer_instructions)).toContain('functions.hapi__schedule_report_outcome');
        expect(String(config.config?.developer_instructions)).toContain('Your permission level is system_control.');
        expect(String(config.config?.developer_instructions)).toContain('prevent repeated pointless failures');
        expect(String(config.config?.developer_instructions)).not.toContain('functions.hapi__change_title');
    });
});
