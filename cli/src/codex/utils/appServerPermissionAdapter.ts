import { randomUUID } from 'node:crypto';
import { logger } from '@/ui/logger';
import type { CodexPermissionHandler } from './permissionHandler';
import type { CodexAppServerClient } from '../codexAppServerClient';

type PermissionDecision = 'approved' | 'approved_for_session' | 'denied' | 'abort';

type PermissionResult = {
    decision: PermissionDecision;
    reason?: string;
};

function asRecord(value: unknown): Record<string, unknown> | null {
    if (!value || typeof value !== 'object') {
        return null;
    }
    return value as Record<string, unknown>;
}

function asString(value: unknown): string | undefined {
    return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function extractRequestedSchema(params: Record<string, unknown>): Record<string, unknown> | null {
    const value = params.requestedSchema ?? params.requested_schema;
    return asRecord(value);
}

function extractToolCallId(params: Record<string, unknown>): string {
    return asString(
        params.codex_call_id
        ?? params.codex_mcp_tool_call_id
        ?? params.codex_event_id
        ?? params.call_id
        ?? params.tool_call_id
        ?? params.toolCallId
        ?? params.mcp_tool_call_id
        ?? params.mcpToolCallId
        ?? params.id
        ?? params.itemId
    ) ?? randomUUID();
}

function extractCommand(params: Record<string, unknown>): string[] | string | undefined {
    const command = params.codex_command ?? params.command ?? params.cmd;
    if (Array.isArray(command) && command.every((item) => typeof item === 'string')) {
        return command;
    }
    return typeof command === 'string' && command.length > 0 ? command : undefined;
}

function extractCwd(params: Record<string, unknown>): string | undefined {
    return asString(params.codex_cwd ?? params.cwd);
}

function extractMcpToolName(params: Record<string, unknown>): string {
    const explicitToolName = asString(
        params.toolName
        ?? params.tool_name
        ?? params.name
        ?? params.mcp_tool_name
        ?? params.mcpToolName
    );
    if (explicitToolName) {
        return explicitToolName;
    }

    const command = extractCommand(params);
    if (Array.isArray(command)) {
        const first = command.find((item) => typeof item === 'string' && item.trim().length > 0);
        if (first) {
            return first;
        }
    }
    if (typeof command === 'string') {
        return command;
    }

    return 'CodexPermission';
}

function buildElicitationResult(args: {
    decision: PermissionDecision;
    requestedSchema: Record<string, unknown> | null;
    reason?: string;
}): {
    action: 'accept' | 'decline' | 'cancel';
    content?: Record<string, string | number | boolean | string[]>;
    decision?: string;
    reason?: string;
} {
    const action: 'accept' | 'decline' | 'cancel' =
        args.decision === 'approved' || args.decision === 'approved_for_session'
            ? 'accept'
            : args.decision === 'abort'
                ? 'cancel'
                : 'decline';

    const properties = asRecord(args.requestedSchema?.properties);
    if (!properties || Object.keys(properties).length === 0) {
        return args.reason
            ? { action, decision: args.decision, reason: args.reason }
            : { action, decision: args.decision };
    }

    if (action !== 'accept') {
        return args.reason
            ? { action, decision: args.decision, reason: args.reason }
            : { action, decision: args.decision };
    }

    const content: Record<string, string | number | boolean | string[]> = {};
    const approved = args.decision === 'approved' || args.decision === 'approved_for_session';

    if (Object.prototype.hasOwnProperty.call(properties, 'decision')) {
        content.decision = args.decision;
    }
    if (Object.prototype.hasOwnProperty.call(properties, 'approved')) {
        content.approved = approved;
    }
    if (Object.prototype.hasOwnProperty.call(properties, 'allow')) {
        content.allow = approved;
    }
    if (args.reason && Object.prototype.hasOwnProperty.call(properties, 'reason')) {
        content.reason = args.reason;
    }

    if (Object.keys(content).length === 0) {
        const [fallbackKey] = Object.keys(properties);
        if (fallbackKey) {
            content[fallbackKey] = args.decision;
        }
    }

    return args.reason
        ? { action, content, decision: args.decision, reason: args.reason }
        : { action, content, decision: args.decision };
}

function mapDecision(decision: PermissionDecision): { decision: string } {
    switch (decision) {
        case 'approved':
            return { decision: 'accept' };
        case 'approved_for_session':
            return { decision: 'acceptForSession' };
        case 'denied':
            return { decision: 'decline' };
        case 'abort':
            return { decision: 'cancel' };
    }
}

export function registerAppServerPermissionHandlers(args: {
    client: CodexAppServerClient;
    permissionHandler: CodexPermissionHandler;
    onUserInputRequest?: (request: unknown) => Promise<Record<string, string[]>>;
}): void {
    const { client, permissionHandler, onUserInputRequest } = args;

    client.registerRequestHandler('item/commandExecution/requestApproval', async (params) => {
        const record = asRecord(params) ?? {};
        const toolCallId = asString(record.itemId) ?? randomUUID();
        const reason = asString(record.reason);
        const command = record.command;
        const cwd = asString(record.cwd);

        const result = await permissionHandler.handleToolCall(
            toolCallId,
            'exec_command',
            {
                message: reason,
                command,
                cwd
            }
        ) as PermissionResult;

        return mapDecision(result.decision);
    });

    client.registerRequestHandler('item/fileChange/requestApproval', async (params) => {
        const record = asRecord(params) ?? {};
        const toolCallId = asString(record.itemId) ?? randomUUID();
        const reason = asString(record.reason);
        const grantRoot = asString(record.grantRoot);

        const result = await permissionHandler.handleToolCall(
            toolCallId,
            'apply_patch',
            {
                message: reason,
                grantRoot
            }
        ) as PermissionResult;

        return mapDecision(result.decision);
    });

    client.registerRequestHandler('item/tool/requestUserInput', async (params) => {
        if (!onUserInputRequest) {
            logger.debug('[CodexAppServer] No user-input handler registered; cancelling request');
            return { decision: 'cancel' };
        }

        const answers = await onUserInputRequest(params);
        return {
            decision: 'accept',
            answers
        };
    });

    client.registerRequestHandler('mcpServer/elicitation/request', async (params) => {
        const record = asRecord(params) ?? {};
        const requestedSchema = extractRequestedSchema(record);

        if (onUserInputRequest) {
            const answers = await onUserInputRequest(params);
            return {
                action: 'accept',
                content: answers
            };
        }

        const toolCallId = extractToolCallId(record);
        const command = extractCommand(record);
        const cwd = extractCwd(record);
        const reason = asString(record.message ?? record.reason);
        const toolName = extractMcpToolName(record);

        const result = await permissionHandler.handleToolCall(
            toolCallId,
            toolName,
            {
                message: reason,
                command,
                cwd
            }
        ) as PermissionResult;

        return buildElicitationResult({
            decision: result.decision,
            requestedSchema,
            reason: result.reason
        });
    });
}
