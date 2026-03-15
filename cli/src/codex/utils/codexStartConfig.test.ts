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
                runId: 'run-1'
            }
        });

        expect(config.config).toEqual({
            mcp_servers: mcpServers
        });
        expect(config.config?.developer_instructions).not.toBe(codexSystemPrompt);
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
        expect(String(config.config?.developer_instructions)).toContain('task creation success from task execution status');
    });
});
