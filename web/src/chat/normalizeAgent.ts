import type { AgentEvent, NormalizedAgentContent, NormalizedMessage, ToolResultPermission } from '@/chat/types'
import { asNumber, asString, isObject } from '@hapi/protocol'

function extractCodexContextTokens(data: Record<string, unknown>): number | null {
    const info = isObject(data.info) ? data.info : null
    if (!info) return null

    const total = isObject(info.total) ? info.total : null

    const totalTokenUsage = isObject(info.total_token_usage)
        ? info.total_token_usage
        : isObject(info.totalTokenUsage)
            ? info.totalTokenUsage
            : null

    return asNumber(totalTokenUsage?.total_tokens)
        ?? asNumber(totalTokenUsage?.totalTokens)
        ?? asNumber(total?.total_tokens)
        ?? asNumber(total?.totalTokens)
        ?? asNumber(info.total_tokens)
        ?? asNumber(info.totalTokens)
        ?? null
}

function extractCodexContextWindowTokens(data: Record<string, unknown>): number | null {
    const info = isObject(data.info) ? data.info : null
    if (!info) return null

    return asNumber(info.model_context_window)
        ?? asNumber(info.modelContextWindow)
        ?? null
}

function normalizeToolResultPermissions(value: unknown): ToolResultPermission | undefined {
    if (!isObject(value)) return undefined
    const date = asNumber(value.date)
    const result = value.result
    if (date === null) return undefined
    if (result !== 'approved' && result !== 'denied') return undefined

    const mode = asString(value.mode) ?? undefined
    const allowedTools = Array.isArray(value.allowedTools)
        ? value.allowedTools.filter((tool) => typeof tool === 'string')
        : undefined
    const decision = value.decision
    const normalizedDecision = decision === 'approved' || decision === 'approved_for_session' || decision === 'denied' || decision === 'abort'
        ? decision
        : undefined

    return {
        date,
        result,
        mode,
        allowedTools,
        decision: normalizedDecision
    }
}

function normalizeAgentEvent(value: unknown): AgentEvent | null {
    if (!isObject(value) || typeof value.type !== 'string') return null
    return value as AgentEvent
}

function isCodexReasoningToolResult(data: Record<string, unknown>): boolean {
    if (data.type !== 'tool-call-result') return false
    const output = isObject(data.output) ? data.output : null
    if (!output) return false
    return 'status' in output && 'content' in output
}

function extractCodexReasoningTitle(data: Record<string, unknown>): string | null {
    const output = isObject(data.output) ? data.output : null
    if (!output) return null

    return asString(output.title)
        ?? asString(output.reasoning_title)
        ?? asString(output.reasoningTitle)
        ?? null
}

function buildCodexReasoningText(data: Record<string, unknown>): string | null {
    const output = isObject(data.output) ? data.output : null
    const contentText = asString(output?.content)
    if (!contentText || contentText.trim().length === 0) return null

    const title = extractCodexReasoningTitle(data)?.trim()
    if (!title) return contentText

    return `**${title}**\n\n${contentText}`
}

function normalizeAssistantOutput(
    messageId: string,
    localId: string | null,
    createdAt: number,
    data: Record<string, unknown>,
    meta?: unknown
): NormalizedMessage | null {
    const uuid = asString(data.uuid) ?? messageId
    const parentUUID = asString(data.parentUuid) ?? null
    const isSidechain = Boolean(data.isSidechain)

    const message = isObject(data.message) ? data.message : null
    if (!message) return null

    const modelContent = message.content
    const blocks: NormalizedAgentContent[] = []

    if (typeof modelContent === 'string') {
        blocks.push({ type: 'text', text: modelContent, uuid, parentUUID })
    } else if (Array.isArray(modelContent)) {
        for (const block of modelContent) {
            if (!isObject(block) || typeof block.type !== 'string') continue
            if (block.type === 'text' && typeof block.text === 'string') {
                blocks.push({ type: 'text', text: block.text, uuid, parentUUID })
                continue
            }
            if (block.type === 'thinking' && typeof block.thinking === 'string') {
                blocks.push({ type: 'reasoning', text: block.thinking, uuid, parentUUID })
                continue
            }
            if (block.type === 'tool_use' && typeof block.id === 'string') {
                const name = asString(block.name) ?? 'Tool'
                const input = 'input' in block ? (block as Record<string, unknown>).input : undefined
                const description = isObject(input) && typeof input.description === 'string' ? input.description : null
                blocks.push({ type: 'tool-call', id: block.id, name, input, description, uuid, parentUUID })
            }
        }
    }

    const usage = isObject(message.usage) ? (message.usage as Record<string, unknown>) : null
    const inputTokens = usage ? asNumber(usage.input_tokens) : null
    const outputTokens = usage ? asNumber(usage.output_tokens) : null

    return {
        id: messageId,
        localId,
        createdAt,
        role: 'agent',
        isSidechain,
        content: blocks,
        meta,
        usage: inputTokens !== null && outputTokens !== null ? {
            input_tokens: inputTokens,
            output_tokens: outputTokens,
            cache_creation_input_tokens: asNumber(usage?.cache_creation_input_tokens) ?? undefined,
            cache_read_input_tokens: asNumber(usage?.cache_read_input_tokens) ?? undefined,
            service_tier: asString(usage?.service_tier) ?? undefined
        } : undefined
    }
}

function normalizeUserOutput(
    messageId: string,
    localId: string | null,
    createdAt: number,
    data: Record<string, unknown>,
    meta?: unknown
): NormalizedMessage | null {
    const uuid = asString(data.uuid) ?? messageId
    const parentUUID = asString(data.parentUuid) ?? null
    const isSidechain = Boolean(data.isSidechain)

    const message = isObject(data.message) ? data.message : null
    if (!message) return null

    const messageContent = message.content

    if (isSidechain && typeof messageContent === 'string') {
        return {
            id: messageId,
            localId,
            createdAt,
            role: 'agent',
            isSidechain: true,
            content: [{ type: 'sidechain', uuid, prompt: messageContent }]
        }
    }

    if (typeof messageContent === 'string') {
        return {
            id: messageId,
            localId,
            createdAt,
            role: 'user',
            isSidechain: false,
            content: { type: 'text', text: messageContent },
            meta
        }
    }

    const blocks: NormalizedAgentContent[] = []

    if (Array.isArray(messageContent)) {
        for (const block of messageContent) {
            if (!isObject(block) || typeof block.type !== 'string') continue
            if (block.type === 'text' && typeof block.text === 'string') {
                blocks.push({ type: 'text', text: block.text, uuid, parentUUID })
                continue
            }
            if (block.type === 'tool_result' && typeof block.tool_use_id === 'string') {
                const isError = Boolean(block.is_error)
                const rawContent = 'content' in block ? (block as Record<string, unknown>).content : undefined
                const embeddedToolUseResult = (() => {
                    if ('toolUseResult' in data) return (data as Record<string, unknown>).toolUseResult
                    // Compatibility: some Claude streams emit snake_case payload key.
                    if ('tool_use_result' in data) return (data as Record<string, unknown>).tool_use_result
                    return null
                })()

                const permissions = normalizeToolResultPermissions(block.permissions)

                blocks.push({
                    type: 'tool-result',
                    tool_use_id: block.tool_use_id,
                    content: embeddedToolUseResult ?? rawContent,
                    is_error: isError,
                    uuid,
                    parentUUID,
                    permissions
                })
            }
        }
    }

    return {
        id: messageId,
        localId,
        createdAt,
        role: 'agent',
        isSidechain,
        content: blocks,
        meta
    }
}

export function isSkippableAgentContent(content: unknown): boolean {
    if (!isObject(content) || content.type !== 'output') return false
    const data = isObject(content.data) ? content.data : null
    if (!data) return false
    return Boolean(data.isMeta) || Boolean(data.isCompactSummary)
}

export function isCodexContent(content: unknown): boolean {
    return isObject(content) && content.type === 'codex'
}

export function normalizeAgentRecord(
    messageId: string,
    localId: string | null,
    createdAt: number,
    content: unknown,
    meta?: unknown
): NormalizedMessage | null {
    if (!isObject(content) || typeof content.type !== 'string') return null

    if (content.type === 'output') {
        const data = isObject(content.data) ? content.data : null
        if (!data || typeof data.type !== 'string') return null

        // Skip meta/compact-summary messages (parity with hapi-app)
        if (data.isMeta) return null
        if (data.isCompactSummary) return null

        if (data.type === 'assistant') {
            return normalizeAssistantOutput(messageId, localId, createdAt, data, meta)
        }
        if (data.type === 'user') {
            return normalizeUserOutput(messageId, localId, createdAt, data, meta)
        }
        if (data.type === 'summary' && typeof data.summary === 'string') {
            return {
                id: messageId,
                localId,
                createdAt,
                role: 'agent',
                isSidechain: false,
                content: [{ type: 'summary', summary: data.summary }],
                meta
            }
        }
        if (data.type === 'system' && data.subtype === 'api_error') {
            return {
                id: messageId,
                localId,
                createdAt,
                role: 'event',
                content: {
                    type: 'api-error',
                    retryAttempt: asNumber(data.retryAttempt) ?? 0,
                    maxRetries: asNumber(data.maxRetries) ?? 0,
                    error: data.error
                },
                isSidechain: false,
                meta
            }
        }
        if (data.type === 'system' && data.subtype === 'turn_duration') {
            return {
                id: messageId,
                localId,
                createdAt,
                role: 'event',
                content: {
                    type: 'turn-duration',
                    durationMs: asNumber(data.durationMs) ?? 0
                },
                isSidechain: false,
                meta
            }
        }
        if (data.type === 'system' && data.subtype === 'microcompact_boundary') {
            const metadata = isObject(data.microcompactMetadata) ? data.microcompactMetadata : null
            return {
                id: messageId,
                localId,
                createdAt,
                role: 'event',
                content: {
                    type: 'microcompact',
                    trigger: asString(metadata?.trigger) ?? 'auto',
                    preTokens: asNumber(metadata?.preTokens) ?? 0,
                    tokensSaved: asNumber(metadata?.tokensSaved) ?? 0
                },
                isSidechain: false,
                meta
            }
        }
        if (data.type === 'system' && data.subtype === 'compact_boundary') {
            const metadata = isObject(data.compactMetadata) ? data.compactMetadata : null
            return {
                id: messageId,
                localId,
                createdAt,
                role: 'event',
                content: {
                    type: 'compact',
                    trigger: asString(metadata?.trigger) ?? 'auto',
                    preTokens: asNumber(metadata?.preTokens) ?? 0
                },
                isSidechain: false,
                meta
            }
        }
        return null
    }

    if (content.type === 'event') {
        const event = normalizeAgentEvent(content.data)
        if (!event) return null
        return {
            id: messageId,
            localId,
            createdAt,
            role: 'event',
            content: event,
            isSidechain: false,
            meta
        }
    }

    if (content.type === 'codex') {
        const data = isObject(content.data) ? content.data : null
        if (!data || typeof data.type !== 'string') return null

        if (data.type === 'tool-call' && asString(data.name) === 'CodexReasoning') {
            return null
        }

        if (data.type === 'tool-call-result' && typeof data.callId === 'string') {
            const output = isObject(data.output) ? data.output : null
            const status = asString(output?.status)
            const contentText = buildCodexReasoningText(data)
            if (status !== 'canceled' && contentText && contentText.trim().length > 0) {
                return {
                    id: messageId,
                    localId,
                    createdAt,
                    role: 'agent',
                    isSidechain: false,
                    content: [{
                        type: 'reasoning',
                        text: contentText,
                        uuid: asString(data.id) ?? messageId,
                        parentUUID: null
                    }],
                    meta
                }
            }
            if (isCodexReasoningToolResult(data)) {
                return null
            }
        }

        if (data.type === 'message' && typeof data.message === 'string') {
            return {
                id: messageId,
                localId,
                createdAt,
                role: 'agent',
                isSidechain: false,
                content: [{ type: 'text', text: data.message, uuid: messageId, parentUUID: null }],
                meta
            }
        }

        if (data.type === 'reasoning' && typeof data.message === 'string') {
            return {
                id: messageId,
                localId,
                createdAt,
                role: 'agent',
                isSidechain: false,
                content: [{ type: 'reasoning', text: data.message, uuid: messageId, parentUUID: null }],
                meta
            }
        }

        if (data.type === 'token_count') {
            const contextTokens = extractCodexContextTokens(data)
            if (contextTokens === null) {
                return null
            }
            const contextWindowTokens = extractCodexContextWindowTokens(data) ?? undefined

            return {
                id: messageId,
                localId,
                createdAt,
                role: 'agent',
                isSidechain: false,
                content: [],
                usage: {
                    input_tokens: contextTokens,
                    output_tokens: 0,
                    context_tokens: contextTokens,
                    context_window_tokens: contextWindowTokens
                },
                meta
            }
        }

        if (data.type === 'tool-call' && typeof data.callId === 'string') {
            const uuid = asString(data.id) ?? messageId
            return {
                id: messageId,
                localId,
                createdAt,
                role: 'agent',
                isSidechain: false,
                content: [{
                    type: 'tool-call',
                    id: data.callId,
                    name: asString(data.name) ?? 'unknown',
                    input: data.input,
                    description: null,
                    uuid,
                    parentUUID: null
                }],
                meta
            }
        }

        if (data.type === 'tool-call-result' && typeof data.callId === 'string') {
            const uuid = asString(data.id) ?? messageId
            return {
                id: messageId,
                localId,
                createdAt,
                role: 'agent',
                isSidechain: false,
                content: [{
                    type: 'tool-result',
                    tool_use_id: data.callId,
                    content: data.output,
                    is_error: Boolean(data.is_error),
                    uuid,
                    parentUUID: null
                }],
                meta
            }
        }
    }

    return null
}
