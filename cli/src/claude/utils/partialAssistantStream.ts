import { randomUUID } from 'node:crypto'
import type { SDKAssistantMessage, SDKStreamEventMessage } from '@/claude/sdk'
import type { RawJSONLines } from '@/claude/types'

type UsageData = {
    input_tokens: number
    output_tokens: number
    cache_creation_input_tokens?: number
    cache_read_input_tokens?: number
    service_tier?: string
}

type TextBlockState = {
    type: 'text'
    text: string
}

type ThinkingBlockState = {
    type: 'thinking'
    thinking: string
}

type StreamBlockState = TextBlockState | ThinkingBlockState

type StreamState = {
    messageId: string
    messageUuid: string
    blocks: Map<number, StreamBlockState>
    usage?: UsageData
    parentToolUseId?: string
}

const ROOT_STREAM_KEY = '__root__'

function asRecord(value: unknown): Record<string, unknown> | null {
    if (!value || typeof value !== 'object') {
        return null
    }
    return value as Record<string, unknown>
}

function asString(value: unknown): string | null {
    return typeof value === 'string' ? value : null
}

function asNumber(value: unknown): number | null {
    return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function buildUsage(value: unknown): UsageData | undefined {
    const record = asRecord(value)
    if (!record) {
        return undefined
    }

    const inputTokens = asNumber(record.input_tokens)
    const outputTokens = asNumber(record.output_tokens)
    if (inputTokens === null || outputTokens === null) {
        return undefined
    }
    const usage: UsageData = {
        input_tokens: inputTokens,
        output_tokens: outputTokens
    }
    const cacheCreationInputTokens = asNumber(record.cache_creation_input_tokens)
    if (cacheCreationInputTokens !== null) {
        usage.cache_creation_input_tokens = cacheCreationInputTokens
    }
    const cacheReadInputTokens = asNumber(record.cache_read_input_tokens)
    if (cacheReadInputTokens !== null) {
        usage.cache_read_input_tokens = cacheReadInputTokens
    }
    const serviceTier = asString(record.service_tier)
    if (serviceTier) {
        usage.service_tier = serviceTier
    }

    return usage
}

function makeStreamKey(parentToolUseId?: string): string {
    return parentToolUseId ?? ROOT_STREAM_KEY
}

export class PartialAssistantStreamTracker {
    private readonly streams = new Map<string, StreamState>()

    constructor(
        private readonly context: {
            cwd: string
            sessionId: () => string
            version?: string
            gitBranch?: string
        }
    ) {}

    consume(message: SDKStreamEventMessage): { messageId: string; logMessage: RawJSONLines } | null {
        const event = asRecord(message.event)
        if (!event) {
            return null
        }

        const eventType = asString(event.type)
        if (!eventType) {
            return null
        }

        const key = makeStreamKey(message.parent_tool_use_id)

        if (eventType === 'message_start') {
            const state = this.getOrCreateState(key, message.parent_tool_use_id)
            const startedMessage = asRecord(event.message)
            if (startedMessage) {
                state.usage = buildUsage(startedMessage.usage) ?? state.usage
            }
            return null
        }

        if (eventType === 'message_delta') {
            const state = this.streams.get(key)
            if (!state) {
                return null
            }
            const usage = buildUsage(event.usage)
            if (usage) {
                state.usage = usage
                if (this.hasVisibleContent(state)) {
                    return {
                        messageId: state.messageId,
                        logMessage: this.buildSnapshot(state)
                    }
                }
            }
            return null
        }

        if (eventType === 'content_block_start') {
            const blockIndex = asNumber(event.index)
            const contentBlock = asRecord(event.content_block ?? event.contentBlock)
            if (blockIndex === null || !contentBlock) {
                return null
            }

            const state = this.getOrCreateState(key, message.parent_tool_use_id)
            const blockType = asString(contentBlock.type)
            if (blockType === 'text') {
                state.blocks.set(blockIndex, { type: 'text', text: asString(contentBlock.text) ?? '' })
            } else if (blockType === 'thinking') {
                state.blocks.set(blockIndex, { type: 'thinking', thinking: asString(contentBlock.thinking) ?? '' })
            } else {
                return null
            }

            if (!this.hasVisibleContent(state)) {
                return null
            }

            return {
                messageId: state.messageId,
                logMessage: this.buildSnapshot(state)
            }
        }

        if (eventType === 'content_block_delta') {
            const blockIndex = asNumber(event.index)
            const delta = asRecord(event.delta)
            if (blockIndex === null || !delta) {
                return null
            }

            const deltaType = asString(delta.type)
            const state = this.getOrCreateState(key, message.parent_tool_use_id)

            if (deltaType === 'text_delta') {
                const textDelta = asString(delta.text)
                if (!textDelta) {
                    return null
                }
                const current = state.blocks.get(blockIndex)
                state.blocks.set(blockIndex, {
                    type: 'text',
                    text: `${current?.type === 'text' ? current.text : ''}${textDelta}`
                })
            } else if (deltaType === 'thinking_delta') {
                const thinkingDelta = asString(delta.thinking)
                if (!thinkingDelta) {
                    return null
                }
                const current = state.blocks.get(blockIndex)
                state.blocks.set(blockIndex, {
                    type: 'thinking',
                    thinking: `${current?.type === 'thinking' ? current.thinking : ''}${thinkingDelta}`
                })
            } else {
                return null
            }

            return {
                messageId: state.messageId,
                logMessage: this.buildSnapshot(state)
            }
        }

        return null
    }

    claimMessageId(message: SDKAssistantMessage): string | undefined {
        const key = makeStreamKey(message.parent_tool_use_id)
        const state = this.streams.get(key)
        if (!state) {
            return undefined
        }
        this.streams.delete(key)
        return state.messageId
    }

    clear(): void {
        this.streams.clear()
    }

    private getOrCreateState(key: string, parentToolUseId?: string): StreamState {
        const existing = this.streams.get(key)
        if (existing) {
            return existing
        }

        const state: StreamState = {
            messageId: randomUUID(),
            messageUuid: randomUUID(),
            blocks: new Map(),
            parentToolUseId
        }
        this.streams.set(key, state)
        return state
    }

    private hasVisibleContent(state: StreamState): boolean {
        for (const block of state.blocks.values()) {
            if (block.type === 'text' && block.text.length > 0) {
                return true
            }
            if (block.type === 'thinking' && block.thinking.length > 0) {
                return true
            }
        }
        return false
    }

    private buildSnapshot(state: StreamState): RawJSONLines {
        const content = Array.from(state.blocks.entries())
            .sort((a, b) => a[0] - b[0])
            .map(([, block]) => {
                if (block.type === 'text') {
                    return {
                        type: 'text',
                        text: block.text
                    }
                }
                return {
                    type: 'thinking',
                    thinking: block.thinking
                }
            })

        return {
            type: 'assistant',
            uuid: state.messageUuid,
            parentUuid: null,
            isSidechain: Boolean(state.parentToolUseId),
            userType: 'external',
            cwd: this.context.cwd,
            sessionId: this.context.sessionId(),
            version: this.context.version,
            gitBranch: this.context.gitBranch,
            timestamp: new Date().toISOString(),
            message: {
                role: 'assistant',
                content,
                ...(state.usage ? { usage: state.usage } : {})
            }
        }
    }
}
