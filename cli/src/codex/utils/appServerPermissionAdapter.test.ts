import { describe, expect, it, vi } from 'vitest';
import { registerAppServerPermissionHandlers } from './appServerPermissionAdapter';

describe('registerAppServerPermissionHandlers', () => {
    it('handles mcpServer elicitation requests through the permission handler', async () => {
        const handlers = new Map<string, (params: unknown) => Promise<unknown> | unknown>();
        const registerRequestHandler = vi.fn((method: string, handler: (params: unknown) => Promise<unknown> | unknown) => {
            handlers.set(method, handler);
        });
        const handleToolCall = vi.fn(async () => ({
            decision: 'approved_for_session' as const,
            reason: 'auto-approved in yolo'
        }));

        registerAppServerPermissionHandlers({
            client: {
                registerRequestHandler
            } as any,
            permissionHandler: {
                handleToolCall
            } as any
        });

        const handler = handlers.get('mcpServer/elicitation/request');
        expect(handler).toBeTypeOf('function');

        const result = await handler!({
            id: 'request-1',
            message: 'Approve HAPI MCP tool call',
            command: ['mcp__hapi__change_title'],
            cwd: '/Users/ofeiss/project',
            requestedSchema: {
                type: 'object',
                properties: {
                    approved: { type: 'boolean' },
                    decision: { type: 'string' },
                    reason: { type: 'string' }
                }
            }
        });

        expect(handleToolCall).toHaveBeenCalledWith('request-1', 'mcp__hapi__change_title', {
            message: 'Approve HAPI MCP tool call',
            command: ['mcp__hapi__change_title'],
            cwd: '/Users/ofeiss/project'
        });
        expect(result).toEqual({
            action: 'accept',
            content: {
                approved: true,
                decision: 'approved_for_session',
                reason: 'auto-approved in yolo'
            },
            decision: 'approved_for_session',
            reason: 'auto-approved in yolo'
        });
    });
});
