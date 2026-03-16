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
        expect(String(config.config?.developer_instructions)).toContain('functions.hapi__schedule_create');
        expect(String(config.config?.developer_instructions)).toContain('functions.hapi__schedule_list');
        expect(String(config.config?.developer_instructions)).toContain('You are running inside a HAPI scheduled session.');
        expect(String(config.config?.developer_instructions)).toContain('scheduledSessionPermission: aware');
        expect(String(config.config?.developer_instructions)).not.toContain('functions.hapi__schedule_report_outcome');
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

        expect(String(config.config?.developer_instructions)).toContain('functions.hapi__schedule_create');
        expect(String(config.config?.developer_instructions)).toContain('functions.hapi__schedule_list');
        expect(String(config.config?.developer_instructions)).toContain('must explicitly specify one of: aware, self_control, system_control');
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
        expect(String(config.config?.developer_instructions)).toContain('functions.hapi__schedule_report_outcome');
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

        expect(String(config.config?.developer_instructions)).toContain('You may use the full HAPI scheduler toolset, including creating new scheduled tasks and managing existing ones.');
        expect(String(config.config?.developer_instructions)).toContain('functions.hapi__schedule_report_outcome');
        expect(String(config.config?.developer_instructions)).toContain('prevent repeated pointless failures');
        expect(String(config.config?.developer_instructions)).not.toContain('functions.hapi__change_title');
    });
});
