import type { ChatBlock, ToolCallBlock, ToolPermission } from '@/chat/types'
import type { TracedMessage } from '@/chat/tracer'
import { isObject } from '@hapi/protocol'
import { createCliOutputBlock, isCliOutputText, mergeCliOutputBlocks } from '@/chat/reducerCliOutput'
import { parseMessageAsEvent } from '@/chat/reducerEvents'
import { ensureToolBlock, extractTitleFromChangeTitleInput, isChangeTitleToolName, type PermissionEntry } from '@/chat/reducerTools'
import { extractSkillReadContent, normalizeToolNameAsSkillRead, parseSkillPayloadText } from '@/lib/skillRead'

export function reduceTimeline(
    messages: TracedMessage[],
    context: {
        permissionsById: Map<string, PermissionEntry>
        groups: Map<string, TracedMessage[]>
        consumedGroupIds: Set<string>
        titleChangesByToolUseId: Map<string, string>
        emittedTitleChangeToolUseIds: Set<string>
        seenSkillReadContents: Set<string>
    }
): { blocks: ChatBlock[]; toolBlocksById: Map<string, ToolCallBlock>; hasReadyEvent: boolean } {
    const blocks: ChatBlock[] = []
    const toolBlocksById = new Map<string, ToolCallBlock>()
    let hasReadyEvent = false
    const findLatestSkillReadBlock = (): ToolCallBlock | null => {
        let candidate: ToolCallBlock | null = null
        for (const block of toolBlocksById.values()) {
            if (block.tool.name !== 'SkillRead') continue
            const existing = extractSkillReadContent(block.tool.result)
            if (existing && existing.trim().length > 0) continue
            if (!candidate || block.createdAt > candidate.createdAt) {
                candidate = block
            }
        }
        return candidate
    }
    const bindSkillPayloadToLatestBlock = (payload: { path: string | null; content: string }, createdAt: number): boolean => {
        const target = findLatestSkillReadBlock()
        if (!target) return false

        target.tool.result = payload.content
        if (target.tool.state !== 'error') {
            target.tool.state = 'completed'
        }
        target.tool.completedAt = createdAt

        if (payload.path && target.tool.input && typeof target.tool.input === 'object' && !Array.isArray(target.tool.input)) {
            const inputRecord = target.tool.input as Record<string, unknown>
            if (typeof inputRecord.path !== 'string' && typeof inputRecord.file_path !== 'string') {
                target.tool.input = {
                    ...inputRecord,
                    path: payload.path
                }
            }
        }

        const normalized = payload.content.trim()
        if (normalized.length > 0) {
            context.seenSkillReadContents.add(normalized)
        }
        return true
    }

    // Collect all titles from change_title tool calls across the entire timeline
    // so we can suppress agent text blocks that merely echo the title
    const allChangeTitles = new Set<string>()
    for (const title of context.titleChangesByToolUseId.values()) {
        allChangeTitles.add(title)
    }
    for (const msg of messages) {
        if (msg.role !== 'agent') continue
        for (const c of msg.content) {
            if (c.type === 'tool-call' && isChangeTitleToolName(c.name)) {
                const title = extractTitleFromChangeTitleInput(c.input)
                if (title) allChangeTitles.add(title)
            }
        }
    }

    for (const msg of messages) {
        if (msg.role === 'event') {
            if (msg.content.type === 'ready') {
                hasReadyEvent = true
                continue
            }
            blocks.push({
                kind: 'agent-event',
                id: msg.id,
                createdAt: msg.createdAt,
                event: msg.content,
                meta: msg.meta
            })
            continue
        }

        const event = parseMessageAsEvent(msg)
        if (event) {
            blocks.push({
                kind: 'agent-event',
                id: msg.id,
                createdAt: msg.createdAt,
                event,
                meta: msg.meta
            })
            continue
        }

        if (msg.role === 'user') {
            const skillPayload = parseSkillPayloadText(msg.content.text)
            if (skillPayload && bindSkillPayloadToLatestBlock(skillPayload, msg.createdAt)) {
                continue
            }

            if (isCliOutputText(msg.content.text, msg.meta)) {
                blocks.push(createCliOutputBlock({
                    id: msg.id,
                    localId: msg.localId,
                    createdAt: msg.createdAt,
                    text: msg.content.text,
                    source: 'user',
                    meta: msg.meta
                }))
                continue
            }
            blocks.push({
                kind: 'user-text',
                id: msg.id,
                localId: msg.localId,
                createdAt: msg.createdAt,
                text: msg.content.text,
                attachments: msg.content.attachments,
                status: msg.status,
                originalText: msg.originalText,
                meta: msg.meta
            })
            continue
        }

        if (msg.role === 'agent') {
            for (let idx = 0; idx < msg.content.length; idx += 1) {
                const c = msg.content[idx]
                if (c.type === 'text') {
                    const skillPayload = parseSkillPayloadText(c.text)
                    if (skillPayload && bindSkillPayloadToLatestBlock(skillPayload, msg.createdAt)) {
                        continue
                    }

                    const normalizedText = c.text.trim()
                    if (normalizedText.length > 0 && context.seenSkillReadContents.has(normalizedText)) {
                        continue
                    }
                    if (allChangeTitles.size > 0 && allChangeTitles.has(c.text.trim())) {
                        continue
                    }
                    if (isCliOutputText(c.text, msg.meta)) {
                        blocks.push(createCliOutputBlock({
                            id: `${msg.id}:${idx}`,
                            localId: msg.localId,
                            createdAt: msg.createdAt,
                            text: c.text,
                            source: 'assistant',
                            meta: msg.meta
                        }))
                        continue
                    }
                    blocks.push({
                        kind: 'agent-text',
                        id: `${msg.id}:${idx}`,
                        localId: msg.localId,
                        createdAt: msg.createdAt,
                        text: c.text,
                        meta: msg.meta
                    })
                    continue
                }

                if (c.type === 'reasoning') {
                    blocks.push({
                        kind: 'agent-reasoning',
                        id: `${msg.id}:${idx}`,
                        localId: msg.localId,
                        createdAt: msg.createdAt,
                        text: c.text,
                        meta: msg.meta
                    })
                    continue
                }

                if (c.type === 'summary') {
                    blocks.push({
                        kind: 'agent-event',
                        id: `${msg.id}:${idx}`,
                        createdAt: msg.createdAt,
                        event: { type: 'message', message: c.summary },
                        meta: msg.meta
                    })
                    continue
                }

                if (c.type === 'tool-call') {
                    if (isChangeTitleToolName(c.name)) {
                        const title = context.titleChangesByToolUseId.get(c.id) ?? extractTitleFromChangeTitleInput(c.input)
                        if (title && !context.emittedTitleChangeToolUseIds.has(c.id)) {
                            context.emittedTitleChangeToolUseIds.add(c.id)
                            blocks.push({
                                kind: 'agent-event',
                                id: `${msg.id}:${idx}`,
                                createdAt: msg.createdAt,
                                event: { type: 'title-changed', title },
                                meta: msg.meta
                            })
                        }
                        continue
                    }

                    const normalizedToolName = normalizeToolNameAsSkillRead(c.name, c.input)
                    const permission = context.permissionsById.get(c.id)?.permission

                    const block = ensureToolBlock(blocks, toolBlocksById, c.id, {
                        createdAt: msg.createdAt,
                        localId: msg.localId,
                        meta: msg.meta,
                        name: normalizedToolName,
                        input: c.input,
                        description: c.description,
                        permission
                    })

                    if (block.tool.state === 'pending') {
                        block.tool.state = 'running'
                        block.tool.startedAt = msg.createdAt
                    }

                    if (c.name === 'Task' && !context.consumedGroupIds.has(msg.id)) {
                        const sidechain = context.groups.get(msg.id) ?? null
                        if (sidechain && sidechain.length > 0) {
                            context.consumedGroupIds.add(msg.id)
                            const child = reduceTimeline(sidechain, context)
                            hasReadyEvent = hasReadyEvent || child.hasReadyEvent
                            block.children = child.blocks
                        }
                    }
                    continue
                }

                if (c.type === 'tool-result') {
                    const title = context.titleChangesByToolUseId.get(c.tool_use_id) ?? null
                    if (title) {
                        if (!context.emittedTitleChangeToolUseIds.has(c.tool_use_id)) {
                            context.emittedTitleChangeToolUseIds.add(c.tool_use_id)
                            blocks.push({
                                kind: 'agent-event',
                                id: `${msg.id}:${idx}`,
                                createdAt: msg.createdAt,
                                event: { type: 'title-changed', title },
                                meta: msg.meta
                            })
                        }
                        continue
                    }

                    const permissionEntry = context.permissionsById.get(c.tool_use_id)
                    const permissionFromResult = c.permissions ? ({
                        id: c.tool_use_id,
                        status: c.permissions.result === 'approved' ? 'approved' : 'denied',
                        date: c.permissions.date,
                        mode: c.permissions.mode,
                        allowedTools: c.permissions.allowedTools,
                        decision: c.permissions.decision
                    } satisfies ToolPermission) : undefined

                    const permission = (() => {
                        if (permissionFromResult && permissionEntry?.permission) {
                            return {
                                ...permissionEntry.permission,
                                ...permissionFromResult,
                                allowedTools: permissionFromResult.allowedTools ?? permissionEntry.permission.allowedTools,
                                decision: permissionFromResult.decision ?? permissionEntry.permission.decision
                            } satisfies ToolPermission
                        }
                        return permissionFromResult ?? permissionEntry?.permission
                    })()

                    const block = ensureToolBlock(blocks, toolBlocksById, c.tool_use_id, {
                        createdAt: msg.createdAt,
                        localId: msg.localId,
                        meta: msg.meta,
                        name: normalizeToolNameAsSkillRead(
                            permissionEntry?.toolName ?? 'Tool',
                            permissionEntry?.input ?? null,
                            c.content
                        ),
                        input: permissionEntry?.input ?? null,
                        description: null,
                        permission
                    })

                    const previousResult = block.tool.result
                    const previousSkillContent = block.tool.name === 'SkillRead'
                        ? extractSkillReadContent(previousResult)?.trim()
                        : null
                    const incomingSkillContent = block.tool.name === 'SkillRead'
                        ? extractSkillReadContent(c.content)?.trim()
                        : null

                    if (block.tool.name === 'SkillRead' && previousSkillContent && !incomingSkillContent) {
                        if (isObject(previousResult) && isObject(c.content)) {
                            block.tool.result = { ...previousResult, ...c.content }
                        } else {
                            block.tool.result = previousResult
                        }
                    } else {
                        block.tool.result = c.content
                    }
                    block.tool.completedAt = msg.createdAt
                    block.tool.state = c.is_error ? 'error' : 'completed'
                    if (block.tool.name === 'SkillRead') {
                        const content = extractSkillReadContent(block.tool.result)
                        const normalizedContent = content?.trim()
                        if (normalizedContent) {
                            context.seenSkillReadContents.add(normalizedContent)
                        }
                    }
                    continue
                }

                if (c.type === 'sidechain') {
                    blocks.push({
                        kind: 'user-text',
                        id: `${msg.id}:${idx}`,
                        localId: null,
                        createdAt: msg.createdAt,
                        text: c.prompt
                    })
                }
            }
        }
    }

    return { blocks: mergeCliOutputBlocks(blocks), toolBlocksById, hasReadyEvent }
}
