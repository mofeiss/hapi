import { logger } from '@/ui/logger';

type ConvertedEvent = {
    type: string;
    [key: string]: unknown;
};

function asRecord(value: unknown): Record<string, unknown> | null {
    if (!value || typeof value !== 'object') {
        return null;
    }
    return value as Record<string, unknown>;
}

function asString(value: unknown): string | null {
    return typeof value === 'string' && value.length > 0 ? value : null;
}

function asBoolean(value: unknown): boolean | null {
    return typeof value === 'boolean' ? value : null;
}

function asNumber(value: unknown): number | null {
    return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function extractItemId(params: Record<string, unknown>): string | null {
    const direct = asString(params.itemId ?? params.item_id ?? params.id);
    if (direct) return direct;

    const item = asRecord(params.item);
    if (item) {
        return asString(item.id ?? item.itemId ?? item.item_id);
    }

    return null;
}

function extractItem(params: Record<string, unknown>): Record<string, unknown> | null {
    const item = asRecord(params.item);
    return item ?? params;
}

function normalizeItemType(value: unknown): string | null {
    const raw = asString(value);
    if (!raw) return null;
    return raw.toLowerCase().replace(/[\s_-]/g, '');
}

function extractCommand(value: unknown): string | null {
    if (typeof value === 'string') return value;
    if (Array.isArray(value)) {
        const parts = value.filter((part): part is string => typeof part === 'string');
        return parts.length > 0 ? parts.join(' ') : null;
    }
    return null;
}

function extractChanges(value: unknown): Record<string, unknown> | null {
    const record = asRecord(value);
    if (record) return record;

    if (Array.isArray(value)) {
        const changes: Record<string, unknown> = {};
        for (const entry of value) {
            const entryRecord = asRecord(entry);
            if (!entryRecord) continue;
            const path = asString(entryRecord.path ?? entryRecord.file ?? entryRecord.filePath ?? entryRecord.file_path);
            if (path) {
                changes[path] = entryRecord;
            }
        }
        return Object.keys(changes).length > 0 ? changes : null;
    }

    return null;
}

export class AppServerEventConverter {
    private readonly agentMessageBuffers = new Map<string, string>();
    private readonly agentMessageSources = new Map<string, 'raw' | 'wrapper'>();
    private readonly agentMessageItemsByTurn = new Map<string, string>();
    private readonly completedAgentMessageItems = new Set<string>();
    private readonly reasoningBuffers = new Map<string, string>();
    private readonly commandOutputBuffers = new Map<string, string>();
    private readonly commandMeta = new Map<string, Record<string, unknown>>();
    private readonly fileChangeMeta = new Map<string, Record<string, unknown>>();
    private readonly execCommandBeginScores = new Map<string, number>();
    private readonly execCommandEndScores = new Map<string, number>();

    private shouldEmitExecCommandBegin(callId: string, score: number): boolean {
        const previous = this.execCommandBeginScores.get(callId);
        if (previous !== undefined && previous >= score) {
            return false;
        }
        this.execCommandBeginScores.set(callId, score);
        return true;
    }

    private shouldEmitExecCommandEnd(callId: string, score: number): boolean {
        const previous = this.execCommandEndScores.get(callId);
        if (previous !== undefined && previous >= score) {
            return false;
        }
        this.execCommandEndScores.set(callId, score);
        return true;
    }

    private rememberAgentMessageItem(itemId: string, turnId?: string | null): void {
        if (!turnId) {
            return;
        }
        this.agentMessageItemsByTurn.set(turnId, itemId);
    }

    private resolveAgentMessageItemId(
        params: Record<string, unknown>,
        source?: Record<string, unknown> | null
    ): string | null {
        const direct = extractItemId(source ?? params);
        if (direct) {
            return direct;
        }

        const turnId = asString(
            source?.turn_id
            ?? source?.turnId
            ?? params.turn_id
            ?? params.turnId
            ?? params.id
        );

        if (turnId) {
            const mapped = this.agentMessageItemsByTurn.get(turnId);
            if (mapped) {
                return mapped;
            }
        }

        if (this.agentMessageBuffers.size === 1) {
            return this.agentMessageBuffers.keys().next().value ?? null;
        }

        return null;
    }

    private shouldAcceptAgentMessageDelta(itemId: string, source: 'raw' | 'wrapper'): boolean {
        if (this.completedAgentMessageItems.has(itemId)) {
            return false;
        }

        const existing = this.agentMessageSources.get(itemId);
        if (existing && existing !== source) {
            return false;
        }

        this.agentMessageSources.set(itemId, source);
        return true;
    }

    private shouldAcceptAgentMessageCompletion(itemId: string, source: 'raw' | 'wrapper'): boolean {
        if (this.completedAgentMessageItems.has(itemId)) {
            return false;
        }

        const existing = this.agentMessageSources.get(itemId);
        if (!existing || existing === source || this.agentMessageBuffers.has(itemId)) {
            this.agentMessageSources.set(itemId, existing ?? source);
            return true;
        }

        return false;
    }

    private completeAgentMessage(itemId: string, message?: string | null): ConvertedEvent[] {
        if (this.completedAgentMessageItems.has(itemId)) {
            return [];
        }

        const text = message ?? this.agentMessageBuffers.get(itemId);
        if (!text) {
            return [];
        }

        this.agentMessageBuffers.delete(itemId);
        this.agentMessageSources.delete(itemId);
        this.completedAgentMessageItems.add(itemId);

        for (const [turnId, mappedItemId] of this.agentMessageItemsByTurn.entries()) {
            if (mappedItemId === itemId) {
                this.agentMessageItemsByTurn.delete(turnId);
            }
        }

        return [{
            type: 'agent_message',
            item_id: itemId,
            message: text
        }];
    }

    handleNotification(method: string, params: unknown): ConvertedEvent[] {
        const events: ConvertedEvent[] = [];
        const paramsRecord = asRecord(params) ?? {};
        const wrappedMsg = asRecord(paramsRecord.msg);

        if (method === 'thread/started' || method === 'thread/resumed') {
            const thread = asRecord(paramsRecord.thread) ?? paramsRecord;
            const threadId = asString(thread.threadId ?? thread.thread_id ?? thread.id);
            if (threadId) {
                events.push({ type: 'thread_started', thread_id: threadId });
            }
            return events;
        }

        if (method === 'turn/started') {
            const turn = asRecord(paramsRecord.turn) ?? paramsRecord;
            const turnId = asString(turn.turnId ?? turn.turn_id ?? turn.id);
            events.push({ type: 'task_started', ...(turnId ? { turn_id: turnId } : {}) });
            return events;
        }

        if (method === 'turn/completed') {
            const turn = asRecord(paramsRecord.turn) ?? paramsRecord;
            const statusRaw = asString(paramsRecord.status ?? turn.status);
            const status = statusRaw?.toLowerCase();
            const turnId = asString(turn.turnId ?? turn.turn_id ?? turn.id);
            const errorMessage = asString(paramsRecord.error ?? paramsRecord.message ?? paramsRecord.reason);

            if (status === 'interrupted' || status === 'cancelled' || status === 'canceled') {
                events.push({ type: 'turn_aborted', ...(turnId ? { turn_id: turnId } : {}) });
                return events;
            }

            if (status === 'failed' || status === 'error') {
                events.push({ type: 'task_failed', ...(turnId ? { turn_id: turnId } : {}), ...(errorMessage ? { error: errorMessage } : {}) });
                return events;
            }

            events.push({ type: 'task_complete', ...(turnId ? { turn_id: turnId } : {}) });
            return events;
        }

        if (method === 'turn/diff/updated') {
            const diff = asString(paramsRecord.diff ?? paramsRecord.unified_diff ?? paramsRecord.unifiedDiff);
            if (diff) {
                events.push({ type: 'turn_diff', unified_diff: diff });
            }
            return events;
        }

        if (method === 'thread/tokenUsage/updated') {
            const info = asRecord(paramsRecord.tokenUsage ?? paramsRecord.token_usage ?? paramsRecord) ?? {};
            events.push({ type: 'token_count', info });
            return events;
        }

        if (method === 'codex/event/token_count') {
            const source = wrappedMsg ?? paramsRecord;
            const info = asRecord(source.info ?? source.tokenUsage ?? source.token_usage ?? source) ?? {};
            events.push({ type: 'token_count', info });
            return events;
        }

        if (method === 'error') {
            const willRetry = asBoolean(paramsRecord.will_retry ?? paramsRecord.willRetry) ?? false;
            if (willRetry) return events;
            const message = asString(paramsRecord.message) ?? asString(asRecord(paramsRecord.error)?.message);
            if (message) {
                events.push({ type: 'task_failed', error: message });
            }
            return events;
        }

        if (method === 'thread/status/changed') {
            const statusRecord = asRecord(paramsRecord.status) ?? paramsRecord;
            const statusType = asString(statusRecord.type ?? statusRecord.status)?.toLowerCase();

            if (statusType === 'systemerror' || statusType === 'error' || statusType === 'failed') {
                const message = asString(statusRecord.message ?? statusRecord.reason ?? statusRecord.error)
                    ?? asString(paramsRecord.message ?? paramsRecord.reason ?? paramsRecord.error)
                    ?? `thread status changed: ${statusType}`;
                events.push({ type: 'task_failed', error: message });
            }
            return events;
        }

        if (method === 'codex/event/stream_error') {
            const source = wrappedMsg ?? paramsRecord;
            const warning = asString(source.additional_details ?? source.additionalDetails)
                ?? asString(source.message)
                ?? asString(asRecord(source.error)?.message);
            if (warning) {
                events.push({ type: 'task_warning', warning });
            }
            return events;
        }

        if (method === 'codex/event/error') {
            const source = wrappedMsg ?? paramsRecord;
            const message = asString(source.message)
                ?? asString(source.additional_details ?? source.additionalDetails)
                ?? asString(asRecord(source.error)?.message);

            events.push({
                type: 'task_failed',
                ...(message ? { error: message } : {})
            });
            return events;
        }

        if (method === 'codex/event/task_complete') {
            const source = wrappedMsg ?? paramsRecord;
            const turnId = asString(source.turn_id ?? source.turnId ?? paramsRecord.id);
            events.push({ type: 'task_complete', ...(turnId ? { turn_id: turnId } : {}) });
            return events;
        }

        if (method === 'codex/event/task_started') {
            const source = wrappedMsg ?? paramsRecord;
            const turnId = asString(source.turn_id ?? source.turnId ?? paramsRecord.id);
            events.push({ type: 'task_started', ...(turnId ? { turn_id: turnId } : {}) });
            return events;
        }

        if (method === 'codex/event/warning') {
            const source = wrappedMsg ?? paramsRecord;
            const warning = asString(source.message)
                ?? asString(source.additional_details ?? source.additionalDetails)
                ?? asString(asRecord(source.error)?.message);
            if (warning) {
                events.push({ type: 'task_warning', warning });
            }
            return events;
        }

        if (
            method === 'codex/event/mcp_startup_update'
            || method === 'codex/event/mcp_startup_complete'
            || method === 'codex/event/item_started'
            || method === 'codex/event/item_completed'
            || method === 'codex/event/agent_message_delta'
            || method === 'codex/event/user_message'
        ) {
            // These wrapper notifications are informative duplicates for flows we already track.
            return events;
        }

        if (method === 'codex/event/exec_command_begin') {
            const source = wrappedMsg ?? paramsRecord;
            const callId = asString(source.call_id ?? source.callId ?? source.id);
            if (!callId) return events;

            const command = extractCommand(source.command ?? source.cmd);
            const cwd = asString(source.cwd ?? source.workingDirectory ?? source.working_directory);
            const parsedCmd = Array.isArray(source.parsed_cmd) ? source.parsed_cmd : null;
            const outputSource = asString(source.source);
            const processId = asString(source.process_id ?? source.processId);
            const score = (command ? 2 : 0)
                + (cwd ? 1 : 0)
                + (parsedCmd && parsedCmd.length > 0 ? 4 : 0)
                + (outputSource ? 2 : 0)
                + (processId ? 1 : 0);

            if (!this.shouldEmitExecCommandBegin(callId, score)) {
                return events;
            }

            const event: ConvertedEvent = {
                type: 'exec_command_begin',
                call_id: callId,
                ...(command ? { command } : {}),
                ...(cwd ? { cwd } : {}),
                ...(parsedCmd ? { parsed_cmd: parsedCmd } : {}),
                ...(outputSource ? { source: outputSource } : {}),
                ...(processId ? { process_id: processId } : {})
            };
            events.push(event);
            return events;
        }

        if (method === 'codex/event/exec_command_end') {
            const source = wrappedMsg ?? paramsRecord;
            const callId = asString(source.call_id ?? source.callId ?? source.id);
            if (!callId) return events;

            const command = extractCommand(source.command ?? source.cmd);
            const cwd = asString(source.cwd ?? source.workingDirectory ?? source.working_directory);
            const parsedCmd = Array.isArray(source.parsed_cmd) ? source.parsed_cmd : null;
            const outputSource = asString(source.source);
            const processId = asString(source.process_id ?? source.processId);
            const stdout = asString(source.stdout);
            const stderr = asString(source.stderr);
            const aggregatedOutput = asString(source.formatted_output ?? source.aggregated_output ?? source.output);
            const status = asString(source.status);
            const error = asString(source.error);
            const exitCode = asNumber(source.exit_code ?? source.exitCode ?? source.exitcode);
            const score = (command ? 2 : 0)
                + (cwd ? 1 : 0)
                + (parsedCmd && parsedCmd.length > 0 ? 4 : 0)
                + (outputSource ? 1 : 0)
                + (processId ? 1 : 0)
                + (stdout ? 6 : 0)
                + (stderr ? 3 : 0)
                + (aggregatedOutput ? 6 : 0)
                + (error ? 3 : 0)
                + (exitCode !== null ? 1 : 0)
                + (status ? 1 : 0);

            if (!this.shouldEmitExecCommandEnd(callId, score)) {
                return events;
            }

            const event: ConvertedEvent = {
                type: 'exec_command_end',
                call_id: callId,
                ...(command ? { command } : {}),
                ...(cwd ? { cwd } : {}),
                ...(parsedCmd ? { parsed_cmd: parsedCmd } : {}),
                ...(outputSource ? { source: outputSource } : {}),
                ...(processId ? { process_id: processId } : {}),
                ...(stdout ? { stdout } : {}),
                ...(stderr ? { stderr } : {}),
                ...(aggregatedOutput ? { output: aggregatedOutput } : {}),
                ...(error ? { error } : {}),
                ...(exitCode !== null ? { exit_code: exitCode } : {}),
                ...(status ? { status } : {})
            };
            events.push(event);
            return events;
        }

        if (method === 'item/agentMessage/delta') {
            const itemId = extractItemId(paramsRecord);
            const delta = asString(paramsRecord.delta ?? paramsRecord.text ?? paramsRecord.message);
            if (itemId && delta && this.shouldAcceptAgentMessageDelta(itemId, 'raw')) {
                const prev = this.agentMessageBuffers.get(itemId) ?? '';
                this.agentMessageBuffers.set(itemId, prev + delta);
                events.push({
                    type: 'agent_message_delta',
                    item_id: itemId,
                    delta
                });
            }
            return events;
        }

        if (method === 'codex/event/agent_message_content_delta') {
            const source = wrappedMsg ?? paramsRecord;
            const itemId = this.resolveAgentMessageItemId(paramsRecord, source);
            const turnId = asString(source.turn_id ?? source.turnId ?? paramsRecord.id);
            const delta = asString(source.delta ?? source.text ?? source.message);

            if (itemId && delta && this.shouldAcceptAgentMessageDelta(itemId, 'wrapper')) {
                this.rememberAgentMessageItem(itemId, turnId);
                const prev = this.agentMessageBuffers.get(itemId) ?? '';
                this.agentMessageBuffers.set(itemId, prev + delta);
                events.push({
                    type: 'agent_message_delta',
                    item_id: itemId,
                    delta
                });
            }
            return events;
        }

        if (method === 'codex/event/agent_message') {
            const source = wrappedMsg ?? paramsRecord;
            const itemId = this.resolveAgentMessageItemId(paramsRecord, source);
            const message = asString(source.message ?? source.text ?? source.content);

            if (itemId && message && this.shouldAcceptAgentMessageCompletion(itemId, 'wrapper')) {
                events.push(...this.completeAgentMessage(itemId, message));
            }
            return events;
        }

        if (method === 'item/reasoning/textDelta') {
            const itemId = extractItemId(paramsRecord) ?? 'reasoning';
            const delta = asString(paramsRecord.delta ?? paramsRecord.text ?? paramsRecord.message);
            if (delta) {
                const prev = this.reasoningBuffers.get(itemId) ?? '';
                this.reasoningBuffers.set(itemId, prev + delta);
                events.push({ type: 'agent_reasoning_delta', delta });
            }
            return events;
        }

        if (method === 'item/reasoning/summaryPartAdded') {
            events.push({ type: 'agent_reasoning_section_break' });
            return events;
        }

        if (method === 'item/commandExecution/outputDelta') {
            const itemId = extractItemId(paramsRecord);
            const delta = asString(paramsRecord.delta ?? paramsRecord.text ?? paramsRecord.output ?? paramsRecord.stdout);
            if (itemId && delta) {
                const prev = this.commandOutputBuffers.get(itemId) ?? '';
                this.commandOutputBuffers.set(itemId, prev + delta);
            }
            return events;
        }

        if (method === 'item/started' || method === 'item/completed') {
            const item = extractItem(paramsRecord);
            if (!item) return events;

            const itemType = normalizeItemType(item.type ?? item.itemType ?? item.kind);
            const itemId = extractItemId(paramsRecord) ?? asString(item.id ?? item.itemId ?? item.item_id);

            if (!itemType || !itemId) {
                return events;
            }

            if (itemType === 'usermessage') {
                return events;
            }

            if (itemType === 'agentmessage') {
                if (method === 'item/completed') {
                    const text = asString(item.text ?? item.message ?? item.content) ?? this.agentMessageBuffers.get(itemId);
                    if (text && this.shouldAcceptAgentMessageCompletion(itemId, 'raw')) {
                        events.push(...this.completeAgentMessage(itemId, text));
                    }
                }
                return events;
            }

            if (itemType === 'reasoning') {
                if (method === 'item/completed') {
                    const text = asString(item.text ?? item.message ?? item.content) ?? this.reasoningBuffers.get(itemId);
                    if (text) {
                        events.push({ type: 'agent_reasoning', text });
                    }
                    this.reasoningBuffers.delete(itemId);
                }
                return events;
            }

            if (itemType === 'commandexecution') {
                if (method === 'item/started') {
                    const command = extractCommand(item.command ?? item.cmd ?? item.args);
                    const cwd = asString(item.cwd ?? item.workingDirectory ?? item.working_directory);
                    const autoApproved = asBoolean(item.autoApproved ?? item.auto_approved);
                    const meta: Record<string, unknown> = {};
                    if (command) meta.command = command;
                    if (cwd) meta.cwd = cwd;
                    if (autoApproved !== null) meta.auto_approved = autoApproved;
                    this.commandMeta.set(itemId, meta);
                    const score = (command ? 2 : 0)
                        + (cwd ? 1 : 0)
                        + (autoApproved !== null ? 1 : 0);

                    if (!this.shouldEmitExecCommandBegin(itemId, score)) {
                        return events;
                    }

                    events.push({
                        type: 'exec_command_begin',
                        call_id: itemId,
                        ...meta
                    });
                }

                if (method === 'item/completed') {
                    const meta = this.commandMeta.get(itemId) ?? {};
                    const stdout = asString(item.stdout);
                    const output = asString(
                        item.formatted_output
                        ?? item.aggregated_output
                        ?? item.output
                        ?? item.result
                        ?? item.content
                    ) ?? this.commandOutputBuffers.get(itemId) ?? stdout;
                    const stderr = asString(item.stderr);
                    const error = asString(item.error);
                    const exitCode = asNumber(item.exitCode ?? item.exit_code ?? item.exitcode);
                    const status = asString(item.status);
                    const score = (typeof meta.command === 'string' ? 2 : 0)
                        + (typeof meta.cwd === 'string' ? 1 : 0)
                        + (stdout ? 6 : 0)
                        + (stderr ? 3 : 0)
                        + (output ? 6 : 0)
                        + (error ? 3 : 0)
                        + (exitCode !== null ? 1 : 0)
                        + (status ? 1 : 0);

                    if (!this.shouldEmitExecCommandEnd(itemId, score)) {
                        this.commandMeta.delete(itemId);
                        this.commandOutputBuffers.delete(itemId);
                        return events;
                    }

                    events.push({
                        type: 'exec_command_end',
                        call_id: itemId,
                        ...meta,
                        ...(stdout ? { stdout } : {}),
                        ...(output ? { output } : {}),
                        ...(stderr ? { stderr } : {}),
                        ...(error ? { error } : {}),
                        ...(exitCode !== null ? { exit_code: exitCode } : {}),
                        ...(status ? { status } : {})
                    });

                    this.commandMeta.delete(itemId);
                    this.commandOutputBuffers.delete(itemId);
                }

                return events;
            }

            if (itemType === 'filechange') {
                if (method === 'item/started') {
                    const changes = extractChanges(item.changes ?? item.change ?? item.diff);
                    const autoApproved = asBoolean(item.autoApproved ?? item.auto_approved);
                    const meta: Record<string, unknown> = {};
                    if (changes) meta.changes = changes;
                    if (autoApproved !== null) meta.auto_approved = autoApproved;
                    this.fileChangeMeta.set(itemId, meta);

                    events.push({
                        type: 'patch_apply_begin',
                        call_id: itemId,
                        ...meta
                    });
                }

                if (method === 'item/completed') {
                    const meta = this.fileChangeMeta.get(itemId) ?? {};
                    const stdout = asString(item.stdout ?? item.output);
                    const stderr = asString(item.stderr);
                    const success = asBoolean(item.success ?? item.ok ?? item.applied ?? item.status === 'completed');

                    events.push({
                        type: 'patch_apply_end',
                        call_id: itemId,
                        ...meta,
                        ...(stdout ? { stdout } : {}),
                        ...(stderr ? { stderr } : {}),
                        success: success ?? false
                    });

                    this.fileChangeMeta.delete(itemId);
                }

                return events;
            }
        }

        logger.debug('[AppServerEventConverter] Unhandled notification', { method, params });
        return events;
    }

    reset(): void {
        this.agentMessageBuffers.clear();
        this.agentMessageSources.clear();
        this.agentMessageItemsByTurn.clear();
        this.completedAgentMessageItems.clear();
        this.reasoningBuffers.clear();
        this.commandOutputBuffers.clear();
        this.commandMeta.clear();
        this.fileChangeMeta.clear();
        this.execCommandBeginScores.clear();
        this.execCommandEndScores.clear();
    }
}
