import type { ChatBlock, ChatToolCall, ToolCallBlock } from '@/chat/types'

function deriveStepsState(children: ToolCallBlock[]): ChatToolCall['state'] {
    if (children.some((child) => child.tool.state === 'pending')) return 'pending'
    if (children.some((child) => child.tool.state === 'running')) return 'running'
    if (children.some((child) => child.tool.state === 'error')) return 'error'
    return 'completed'
}

function createStepsBlock(children: ToolCallBlock[]): ToolCallBlock {
    const first = children[0]
    const last = children[children.length - 1]
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
                count: children.length
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
    let toolBuffer: ToolCallBlock[] = []

    const flushToolBuffer = () => {
        if (toolBuffer.length === 0) return
        if (toolBuffer.length >= 2) {
            grouped.push(createStepsBlock(toolBuffer))
        } else {
            grouped.push(toolBuffer[0])
        }
        toolBuffer = []
    }

    for (const block of blocks) {
        if (block.kind === 'tool-call' && block.tool.name !== 'Steps' && block.tool.name !== 'Task') {
            toolBuffer.push(block)
            continue
        }

        flushToolBuffer()
        grouped.push(block)
    }

    flushToolBuffer()
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
