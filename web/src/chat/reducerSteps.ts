import type { AgentReasoningBlock, ChatBlock, ChatToolCall, ToolCallBlock } from '@/chat/types'

function isGroupableStepToolBlock(block: ChatBlock): block is ToolCallBlock {
    return block.kind === 'tool-call' && block.tool.name !== 'Steps' && block.tool.name !== 'Task'
}

function isStepReasoningBlock(block: ChatBlock): block is AgentReasoningBlock {
    return block.kind === 'agent-reasoning'
}

function deriveStepsState(children: ChatBlock[]): ChatToolCall['state'] {
    const toolChildren = children.filter(isGroupableStepToolBlock)
    if (toolChildren.some((child) => child.tool.state === 'pending')) return 'pending'
    if (toolChildren.some((child) => child.tool.state === 'running')) return 'running'
    if (toolChildren.some((child) => child.tool.state === 'error')) return 'error'
    return 'completed'
}

function createStepsBlock(children: ChatBlock[]): ToolCallBlock {
    const toolChildren = children.filter(isGroupableStepToolBlock)
    const first = toolChildren[0]
    const last = toolChildren[toolChildren.length - 1]
    const id = `steps:${first.id}:${last.id}`
    const state = deriveStepsState(children)

    return {
        kind: 'tool-call',
        id,
        localId: null,
        createdAt: first.createdAt,
        tool: {
            id,
            name: 'Steps',
            state,
            input: {
                count: toolChildren.length
            },
            createdAt: first.createdAt,
            startedAt: first.tool.startedAt ?? first.createdAt,
            completedAt: state === 'completed' || state === 'error'
                ? (last.tool.completedAt ?? last.createdAt)
                : null,
            description: null
        },
        children,
        meta: first.meta
    }
}

function groupSingleLevel(blocks: ChatBlock[]): ChatBlock[] {
    const grouped: ChatBlock[] = []
    let idx = 0

    while (idx < blocks.length) {
        const first = blocks[idx]
        if (!isGroupableStepToolBlock(first)) {
            grouped.push(first)
            idx += 1
            continue
        }

        const passthrough: ChatBlock[] = [first]
        const stepChildren: ChatBlock[] = [first]
        let toolCount = 1
        let trailingReasoning: AgentReasoningBlock[] = []
        let cursor = idx + 1

        while (cursor < blocks.length) {
            const block = blocks[cursor]
            if (isStepReasoningBlock(block)) {
                passthrough.push(block)
                trailingReasoning.push(block)
                cursor += 1
                continue
            }

            if (isGroupableStepToolBlock(block)) {
                passthrough.push(block)
                stepChildren.push(...trailingReasoning, block)
                trailingReasoning = []
                toolCount += 1
                cursor += 1
                continue
            }

            break
        }

        if (toolCount >= 2) {
            grouped.push(createStepsBlock(stepChildren))
            grouped.push(...trailingReasoning)
        } else {
            grouped.push(...passthrough)
        }

        idx = cursor
    }

    return grouped
}

export function groupToolBlocksIntoSteps(blocks: ChatBlock[]): ChatBlock[] {
    const normalized = blocks.map((block) => {
        if (block.kind !== 'tool-call') return block
        if (block.children.length === 0) return block
        const groupedChildren = groupToolBlocksIntoSteps(block.children)
        if (groupedChildren === block.children) return block
        return {
            ...block,
            children: groupedChildren
        }
    })

    return groupSingleLevel(normalized)
}
