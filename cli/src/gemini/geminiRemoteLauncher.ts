import React from 'react';
import { logger } from '@/ui/logger';
import { buildHapiMcpBridge } from '@/codex/utils/buildHapiMcpBridge';
import { convertAgentMessage } from '@/agent/messageConverter';
import type { AgentMessage, McpServerStdio, PromptContent } from '@/agent/types';
import { RemoteLauncherBase, type RemoteLauncherDisplayContext, type RemoteLauncherExitReason } from '@/modules/common/remote/RemoteLauncherBase';
import { GeminiDisplay } from '@/ui/ink/GeminiDisplay';
import type { GeminiSession } from './session';
import type { PermissionMode } from './types';
import { createGeminiBackend } from './utils/geminiBackend';
import { GeminiPermissionHandler } from './utils/permissionHandler';
import { resolveGeminiRuntimeConfig } from './utils/config';
import { formatSessionFailureMessage } from '@/utils/sessionFailure';
import { isDiagnosticLoggingEnabled } from '@/config/diagnosticLogging';

class GeminiRemoteLauncher extends RemoteLauncherBase {
    private readonly session: GeminiSession;
    private readonly hookSettingsPath?: string;
    private backend: ReturnType<typeof createGeminiBackend> | null = null;
    private permissionHandler: GeminiPermissionHandler | null = null;
    private happyServer: { stop: () => void } | null = null;
    private abortController = new AbortController();
    private displayModel: string | null = null;
    private displayPermissionMode: PermissionMode | null = null;
    private currentBackendModel: string | null = null;
    private acpSessionId: string | null = null;
    private mcpServers: McpServerStdio[] = [];

    constructor(session: GeminiSession, opts: { hookSettingsPath?: string }) {
        super(isDiagnosticLoggingEnabled() ? session.logPath : undefined);
        this.session = session;
        this.hookSettingsPath = opts.hookSettingsPath;
    }

    public async launch(): Promise<RemoteLauncherExitReason> {
        return this.start({
            onExit: () => this.handleExitFromUi(),
            onSwitchToLocal: () => this.handleSwitchFromUi()
        });
    }

    protected createDisplay(context: RemoteLauncherDisplayContext): React.ReactElement {
        return React.createElement(GeminiDisplay, context);
    }

    protected async runMainLoop(): Promise<void> {
        const session = this.session;
        const messageBuffer = this.messageBuffer;

        const { server: happyServer, mcpServers } = await buildHapiMcpBridge(session.client);
        this.happyServer = happyServer;
        this.mcpServers = toAcpMcpServers(mcpServers);

        const initialModel = resolveGeminiRuntimeConfig({ model: session.getModel() }).model;
        await this.ensureBackendModel(initialModel);
        this.applyDisplayMode(session.getPermissionMode() as PermissionMode, initialModel);

        this.setupAbortHandlers(session.client.rpcHandlerManager, {
            onAbort: () => this.handleAbort(),
            onSwitch: () => this.handleSwitchRequest()
        });

        const sendReady = () => {
            session.sendSessionEvent({ type: 'ready' });
        };

        while (!this.shouldExit) {
            const batch = await session.queue.waitForMessagesAndGetAsString(this.abortController.signal);
            if (!batch) {
                if (this.abortController.signal.aborted && !this.shouldExit) {
                    continue;
                }
                break;
            }

            const promptModel = batch.mode.model
                ?? resolveGeminiRuntimeConfig({ model: session.getModel() }).model;
            await this.ensureBackendModel(promptModel);
            this.applyDisplayMode(batch.mode.permissionMode, promptModel);
            messageBuffer.addMessage(batch.message, 'user');

            const promptContent: PromptContent[] = [{
                type: 'text',
                text: batch.message
            }];
            const backend = this.backend;
            const acpSessionId = this.acpSessionId;
            if (!backend || !acpSessionId) {
                throw new Error('Gemini backend unavailable');
            }

            session.onThinkingChange(true);

            try {
                await backend.prompt(acpSessionId, promptContent, (message: AgentMessage) => {
                    this.handleAgentMessage(message);
                });
            } catch (error) {
                logger.warn('[gemini-remote] prompt failed', error);
                const failureMessage = formatSessionFailureMessage({
                    headline: 'Gemini prompt failed.',
                    error,
                    fallbackReason: 'Unknown Gemini prompt error',
                    logPath: session.logPath
                });
                session.sendSessionEvent({
                    type: 'message',
                    message: failureMessage
                });
                messageBuffer.addMessage(failureMessage, 'status');
            } finally {
                session.onThinkingChange(false);
                await this.permissionHandler?.cancelAll('Prompt finished');
                if (session.queue.size() === 0 && !this.shouldExit) {
                    sendReady();
                }
            }
        }
    }

    protected async cleanup(): Promise<void> {
        this.clearAbortHandlers(this.session.client.rpcHandlerManager);

        if (this.permissionHandler) {
            await this.permissionHandler.cancelAll('Session ended');
            this.permissionHandler = null;
        }

        if (this.backend) {
            await this.backend.disconnect();
            this.backend = null;
        }
        this.currentBackendModel = null;
        this.acpSessionId = null;

        if (this.happyServer) {
            this.happyServer.stop();
            this.happyServer = null;
        }
    }

    private handleAgentMessage(message: AgentMessage): void {
        const converted = convertAgentMessage(message);
        if (converted) {
            this.session.sendCodexMessage(converted);
        }

        switch (message.type) {
            case 'text':
                this.messageBuffer.addMessage(message.text, 'assistant');
                break;
            case 'tool_call':
                this.messageBuffer.addMessage(`Tool call: ${message.name}`, 'tool');
                break;
            case 'tool_result':
                this.messageBuffer.addMessage('Tool result received', 'result');
                break;
            case 'plan':
                this.messageBuffer.addMessage('Plan updated', 'status');
                break;
            case 'error':
                this.messageBuffer.addMessage(message.message, 'status');
                break;
            case 'turn_complete':
                this.messageBuffer.addMessage('Turn complete', 'status');
                break;
            default: {
                const _exhaustive: never = message;
                return _exhaustive;
            }
        }
    }

    private applyDisplayMode(permissionMode: PermissionMode | undefined, model?: string): void {
        if (permissionMode && permissionMode !== this.displayPermissionMode) {
            this.displayPermissionMode = permissionMode;
            this.messageBuffer.addMessage(`[MODE:${permissionMode}]`, 'system');
        }
        if (model && model !== this.displayModel) {
            this.displayModel = model;
            this.messageBuffer.addMessage(`[MODEL:${model}]`, 'system');
        }
    }

    private async handleAbort(): Promise<void> {
        const backend = this.backend;
        if (backend && this.acpSessionId) {
            await backend.cancelPrompt(this.acpSessionId);
        }
        await this.permissionHandler?.cancelAll('User aborted');
        this.session.queue.reset();
        this.session.onThinkingChange(false);
        this.abortController.abort();
        this.abortController = new AbortController();
        this.messageBuffer.addMessage('Turn aborted', 'status');
    }

    private async handleExitFromUi(): Promise<void> {
        await this.requestExit('exit', () => this.handleAbort());
    }

    private async handleSwitchFromUi(): Promise<void> {
        await this.requestExit('switch', () => this.handleAbort());
    }

    private async handleSwitchRequest(): Promise<void> {
        await this.requestExit('switch', () => this.handleAbort());
    }

    private async ensureBackendModel(model: string): Promise<void> {
        if (this.backend && this.currentBackendModel === model && this.acpSessionId) {
            return;
        }

        if (this.permissionHandler) {
            await this.permissionHandler.cancelAll('Gemini backend restarted');
            this.permissionHandler = null;
        }

        if (this.backend) {
            await this.backend.disconnect();
            this.backend = null;
        }

        const backend = createGeminiBackend({
            model,
            resumeSessionId: this.session.sessionId,
            hookSettingsPath: this.hookSettingsPath,
            cwd: this.session.path
        });
        this.attachBackendListeners(backend);
        await backend.initialize();

        const acpSessionId = await backend.newSession({
            cwd: this.session.path,
            mcpServers: this.mcpServers
        });
        this.session.onSessionFound(acpSessionId);

        this.backend = backend;
        this.acpSessionId = acpSessionId;
        this.currentBackendModel = model;
        this.permissionHandler = new GeminiPermissionHandler(
            this.session.client,
            backend,
            () => this.session.getPermissionMode() as PermissionMode | undefined
        );
    }

    private attachBackendListeners(backend: ReturnType<typeof createGeminiBackend>): void {
        backend.onStderrError((error) => {
            logger.debug('[gemini-remote] stderr error', error);
            const failureMessage = formatSessionFailureMessage({
                headline: 'Gemini runtime error.',
                error,
                fallbackReason: error.message,
                logPath: this.session.logPath
            });
            this.session.sendSessionEvent({ type: 'message', message: failureMessage });
            this.messageBuffer.addMessage(failureMessage, 'status');
        });
    }
}

function toAcpMcpServers(config: Record<string, { command: string; args: string[] }>): McpServerStdio[] {
    return Object.entries(config).map(([name, entry]) => ({
        name,
        command: entry.command,
        args: entry.args,
        env: []
    }));
}

export async function geminiRemoteLauncher(
    session: GeminiSession,
    opts: { hookSettingsPath?: string }
): Promise<'switch' | 'exit'> {
    const launcher = new GeminiRemoteLauncher(session, opts);
    return launcher.launch();
}
