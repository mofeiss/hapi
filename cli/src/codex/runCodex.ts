import { logger } from '@/ui/logger';
import { loop, type EnhancedMode, type PermissionMode } from './loop';
import { MessageQueue2 } from '@/utils/MessageQueue2';
import { hashObject } from '@/utils/deterministicJson';
import { registerKillSessionHandler } from '@/claude/registerKillSessionHandler';
import type { AgentState } from '@/api/types';
import type { CodexSession } from './session';
import { parseCodexCliOverrides } from './utils/codexCliOverrides';
import { bootstrapSession } from '@/agent/sessionFactory';
import { createModeChangeHandler, createRunnerLifecycle, setControlledByUser } from '@/agent/runnerLifecycle';
import { isPermissionModeAllowedForFlavor } from '@hapi/protocol';
import { PermissionModeSchema } from '@hapi/protocol/schemas';
import { formatMessageWithAttachments } from '@/utils/attachmentFormatter';
import { resolveTargetWorkingDirectory } from '@/utils/targetWorkingDirectory';

export { emitReadyIfIdle } from './utils/emitReadyIfIdle';

export async function runCodex(opts: {
    startedBy?: 'runner' | 'terminal';
    codexArgs?: string[];
    permissionMode?: PermissionMode;
    resumeSessionId?: string;
    model?: string;
    reasoningEffort?: EnhancedMode['effort'];
}): Promise<void> {
    const workingDirectory = resolveTargetWorkingDirectory();
    const startedBy = opts.startedBy ?? 'terminal';

    logger.debug(`[codex] Starting with options: startedBy=${startedBy}`);

    let state: AgentState = {
        controlledByUser: false
    };
    const { api, session } = await bootstrapSession({
        flavor: 'codex',
        startedBy,
        workingDirectory,
        agentState: state
    });

    type CodexReasoningEffort = Exclude<EnhancedMode['effort'], undefined>;
    const reasoningEfforts = new Set<CodexReasoningEffort>([
        'none',
        'minimal',
        'low',
        'medium',
        'high',
        'xhigh'
    ]);

    const normalizeModel = (value: unknown): string | undefined => {
        if (typeof value !== 'string') {
            return undefined;
        }
        const trimmed = value.trim();
        return trimmed.length > 0 ? trimmed : undefined;
    };

    const normalizeReasoningEffort = (value: unknown): EnhancedMode['effort'] => {
        if (typeof value !== 'string') {
            return undefined;
        }
        if (reasoningEfforts.has(value as CodexReasoningEffort)) {
            return value as CodexReasoningEffort;
        }
        return undefined;
    };

    const startingMode: 'local' | 'remote' = startedBy === 'runner' ? 'remote' : 'local';

    setControlledByUser(session, startingMode);

    const messageQueue = new MessageQueue2<EnhancedMode>((mode) => hashObject({
        permissionMode: mode.permissionMode,
        model: mode.model,
        effort: mode.effort,
        collaborationMode: mode.collaborationMode
    }));

    const codexCliOverrides = parseCodexCliOverrides(opts.codexArgs);
    const sessionWrapperRef: { current: CodexSession | null } = { current: null };

    let currentPermissionMode: PermissionMode = opts.permissionMode ?? 'default';
    let currentModel = normalizeModel(opts.model);
    let currentReasoningEffort = normalizeReasoningEffort(opts.reasoningEffort);
    let lastPublishedModel: string | undefined = undefined;
    let lastPublishedReasoningEffort: EnhancedMode['effort'] = undefined;
    let currentCollaborationMode: EnhancedMode['collaborationMode'];

    const lifecycle = createRunnerLifecycle({
        session,
        logTag: 'codex',
        stopKeepAlive: () => sessionWrapperRef.current?.stopKeepAlive()
    });

    lifecycle.registerProcessHandlers();
    registerKillSessionHandler(session.rpcHandlerManager, lifecycle.cleanupAndExit);

    const syncSessionMode = () => {
        const sessionInstance = sessionWrapperRef.current;
        if (!sessionInstance) {
            return;
        }
        sessionInstance.setPermissionMode(currentPermissionMode);
        logger.debug(`[Codex] Synced session permission mode for keepalive: ${currentPermissionMode}`);
    };

    const publishRuntimeMetadata = () => {
        if (lastPublishedModel === currentModel && lastPublishedReasoningEffort === currentReasoningEffort) {
            return;
        }

        lastPublishedModel = currentModel;
        lastPublishedReasoningEffort = currentReasoningEffort;

        session.updateMetadata((currentMetadata) => ({
            ...currentMetadata,
            model: currentModel,
            reasoningEffort: currentReasoningEffort
        }));
    };

    publishRuntimeMetadata();

    session.onUserMessage((message) => {
        const messagePermissionMode = currentPermissionMode;

        if (message.meta && Object.prototype.hasOwnProperty.call(message.meta, 'model')) {
            currentModel = normalizeModel(message.meta.model);
        }

        if (message.meta && Object.prototype.hasOwnProperty.call(message.meta, 'reasoningEffort')) {
            currentReasoningEffort = normalizeReasoningEffort(message.meta.reasoningEffort);
        }

        publishRuntimeMetadata();
        logger.debug(`[Codex] User message received with permission mode: ${currentPermissionMode}`);

        const enhancedMode: EnhancedMode = {
            permissionMode: messagePermissionMode ?? 'default',
            model: currentModel,
            effort: currentReasoningEffort,
            collaborationMode: currentCollaborationMode
        };
        const formattedText = formatMessageWithAttachments(message.content.text, message.content.attachments);
        messageQueue.push(formattedText, enhancedMode);
    });

    const formatFailureReason = (message: string): string => {
        const maxLength = 200;
        if (message.length <= maxLength) {
            return message;
        }
        return `${message.slice(0, maxLength)}...`;
    };

    const resolvePermissionMode = (value: unknown): PermissionMode => {
        const parsed = PermissionModeSchema.safeParse(value);
        if (!parsed.success || !isPermissionModeAllowedForFlavor(parsed.data, 'codex')) {
            throw new Error('Invalid permission mode');
        }
        return parsed.data as PermissionMode;
    };

    const resolveCollaborationMode = (value: unknown): EnhancedMode['collaborationMode'] => {
        if (value === null) {
            return undefined;
        }
        if (typeof value !== 'string') {
            throw new Error('Invalid collaboration mode');
        }
        const trimmed = value.trim();
        if (!trimmed) {
            throw new Error('Invalid collaboration mode');
        }
        return trimmed as EnhancedMode['collaborationMode'];
    };

    session.rpcHandlerManager.registerHandler('set-session-config', async (payload: unknown) => {
        if (!payload || typeof payload !== 'object') {
            throw new Error('Invalid session config payload');
        }
        const config = payload as {
            permissionMode?: unknown;
            collaborationMode?: unknown;
            model?: unknown;
            reasoningEffort?: unknown;
        };

        if (config.permissionMode !== undefined) {
            currentPermissionMode = resolvePermissionMode(config.permissionMode);
        }

        if (config.collaborationMode !== undefined) {
            currentCollaborationMode = resolveCollaborationMode(config.collaborationMode);
        }

        if (config.model !== undefined) {
            currentModel = normalizeModel(config.model);
        }

        if (config.reasoningEffort !== undefined) {
            currentReasoningEffort = normalizeReasoningEffort(config.reasoningEffort);
        }

        publishRuntimeMetadata();

        syncSessionMode();
        return {
            applied: {
                permissionMode: currentPermissionMode,
                collaborationMode: currentCollaborationMode,
                model: currentModel,
                reasoningEffort: currentReasoningEffort
            }
        };
    });

    try {
        await loop({
            path: workingDirectory,
            startingMode,
            messageQueue,
            api,
            session,
            codexArgs: opts.codexArgs,
            codexCliOverrides,
            startedBy,
            permissionMode: currentPermissionMode,
            resumeSessionId: opts.resumeSessionId,
            onModeChange: createModeChangeHandler(session),
            onSessionReady: (instance) => {
                sessionWrapperRef.current = instance;
                syncSessionMode();
            }
        });
    } catch (error) {
        lifecycle.markCrash(error);
        logger.debug('[codex] Loop error:', error);
    } finally {
        const localFailure = sessionWrapperRef.current?.localLaunchFailure;
        if (localFailure?.exitReason === 'exit') {
            lifecycle.setExitCode(1);
            lifecycle.setArchiveReason(`Local launch failed: ${formatFailureReason(localFailure.message)}`);
        }
        await lifecycle.cleanupAndExit();
    }
}
