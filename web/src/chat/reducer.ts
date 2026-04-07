import type { AgentState } from '@/types/api'
import type { ChatBlock, ContextUsageData, NormalizedMessage } from '@/chat/types'
import { traceMessages, type TracedMessage } from '@/chat/tracer'
import { dedupeAgentEvents, foldApiErrorEvents } from '@/chat/reducerEvents'
import { groupToolBlocksIntoSteps } from '@/chat/reducerSteps'
import { collectTitleChanges, collectToolIdsFromMessages, ensureToolBlock, getPermissions } from '@/chat/reducerTools'
import { reduceTimeline } from '@/chat/reducerTimeline'
import { normalizeToolNameAsSkillRead } from '@/lib/skillRead'
import { isObject } from '@hapi/protocol'

// Calculate context size from usage data
function calculateContextSize(usage: ContextUsageData): number {
    if (typeof usage.context_tokens === 'number') {
        return usage.context_tokens
    }
    return (usage.cache_creation_input_tokens || 0) + (usage.cache_read_input_tokens || 0) + usage.input_tokens
}

function hasContextUsage(usage: ContextUsageData): boolean {
    if (typeof usage.context_tokens === 'number') {
        return true
    }
    return (usage.cache_creation_input_tokens || 0) > 0
        || (usage.cache_read_input_tokens || 0) > 0
        || usage.input_tokens > 0
}

function normalizeSubAgentPrompt(text: string): string {
    return text.replace(/\r\n/g, '\n').trim()
}

function collectSubAgentPrompts(messages: NormalizedMessage[]): Set<string> {
    const prompts = new Set<string>()

    for (const message of messages) {
        if (message.role !== 'agent') continue
        for (const content of message.content) {
            if (content.type !== 'tool-call') continue
            if (content.name !== 'Task' && content.name !== 'Agent') continue
            if (!isObject(content.input) || typeof content.input.prompt !== 'string') continue

            const prompt = normalizeSubAgentPrompt(content.input.prompt)
            if (prompt.length > 0) {
                prompts.add(prompt)
            }
        }
    }

    return prompts
}

export type LatestUsage = {
    inputTokens: number
    outputTokens: number
    cacheCreation: number
    cacheRead: number
    contextSize?: number
    contextWindowTokens?: number
    rateLimitUsedPercent?: number
    rateLimitWindowMinutes?: number
    rateLimitResetsAt?: number
    timestamp: number
}

export function reduceChatBlocks(
    normalized: NormalizedMessage[],
    agentState: AgentState | null | undefined
): { blocks: ChatBlock[]; hasReadyEvent: boolean; latestUsage: LatestUsage | null } {
    const permissionsById = getPermissions(agentState)
    const toolIdsInMessages = collectToolIdsFromMessages(normalized)
    const titleChangesByToolUseId = collectTitleChanges(normalized)
    const subAgentPrompts = collectSubAgentPrompts(normalized)

    const traced = traceMessages(normalized)
    const groups = new Map<string, TracedMessage[]>()
    const root: TracedMessage[] = []

    for (const msg of traced) {
        if (msg.sidechainId) {
            const existing = groups.get(msg.sidechainId) ?? []
            existing.push(msg)
            groups.set(msg.sidechainId, existing)
        } else {
            root.push(msg)
        }
    }

    const consumedGroupIds = new Set<string>()
    const emittedTitleChangeToolUseIds = new Set<string>()
    const seenSkillReadContents = new Set<string>()
    const reducerContext = {
        permissionsById,
        groups,
        consumedGroupIds,
        subAgentPrompts,
        titleChangesByToolUseId,
        emittedTitleChangeToolUseIds,
        seenSkillReadContents
    }
    const rootResult = reduceTimeline(root, reducerContext)
    let hasReadyEvent = rootResult.hasReadyEvent

    // Only create permission-only tool cards for *pending* requests.
    // Completed/approved requests can linger in agentState and should not be re-materialized
    // as sticky cards in newer turns/sessions.
    // Also skip if the permission is older than the oldest message in the current view,
    // to avoid mixing old tool cards with newer messages when paginating.
    const oldestMessageTime = normalized.length > 0
        ? Math.min(...normalized.map(m => m.createdAt))
        : null

    for (const [id, entry] of permissionsById) {
        if (entry.permission.status !== 'pending') continue
        if (toolIdsInMessages.has(id)) continue
        if (rootResult.toolBlocksById.has(id)) continue

        const createdAt = entry.permission.createdAt ?? Date.now()

        // Skip permissions that are older than the oldest message in the current view.
        // These will be shown when the user loads older messages.
        if (oldestMessageTime !== null && createdAt < oldestMessageTime) {
            continue
        }

        const block = ensureToolBlock(rootResult.blocks, rootResult.toolBlocksById, id, {
            createdAt,
            localId: null,
            name: normalizeToolNameAsSkillRead(entry.toolName, entry.input),
            input: entry.input,
            description: null,
            permission: entry.permission
        })
        block.tool.state = 'pending'
    }

    // Calculate latest usage from messages (find the most recent message with usage data)
    let latestUsage: LatestUsage | null = null
    for (let i = normalized.length - 1; i >= 0; i--) {
        const msg = normalized[i]
        if (msg.usage) {
            if (!latestUsage) {
                latestUsage = {
                    inputTokens: msg.usage.input_tokens,
                    outputTokens: msg.usage.output_tokens,
                    cacheCreation: msg.usage.cache_creation_input_tokens ?? 0,
                    cacheRead: msg.usage.cache_read_input_tokens ?? 0,
                    timestamp: msg.createdAt
                }
            }

            if (latestUsage.contextSize === undefined && hasContextUsage(msg.usage)) {
                latestUsage.inputTokens = msg.usage.input_tokens
                latestUsage.outputTokens = msg.usage.output_tokens
                latestUsage.cacheCreation = msg.usage.cache_creation_input_tokens ?? 0
                latestUsage.cacheRead = msg.usage.cache_read_input_tokens ?? 0
                latestUsage.contextSize = calculateContextSize(msg.usage)
                latestUsage.contextWindowTokens = msg.usage.context_window_tokens
            }

            if (latestUsage.rateLimitUsedPercent === undefined && msg.usage.rate_limit_used_percent !== undefined) {
                latestUsage.rateLimitUsedPercent = msg.usage.rate_limit_used_percent
                latestUsage.rateLimitWindowMinutes = msg.usage.rate_limit_window_minutes
                latestUsage.rateLimitResetsAt = msg.usage.rate_limit_resets_at
            }

            if (latestUsage.contextSize !== undefined && latestUsage.rateLimitUsedPercent !== undefined) {
                break
            }
        }
    }

    const normalizedBlocks = dedupeAgentEvents(foldApiErrorEvents(rootResult.blocks))
    const groupedBlocks = groupToolBlocksIntoSteps(normalizedBlocks)
    return { blocks: groupedBlocks, hasReadyEvent, latestUsage }
}
