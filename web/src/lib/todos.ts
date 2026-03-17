import type { ChatBlock } from '@/chat/types'
import type { TodoItem } from '@/types/api'
import { isObject } from '@hapi/protocol'

const TODO_TOOL_NAMES = new Set(['TodoWrite', 'functions.update_plan'])

export function isTodoToolName(toolName: string): boolean {
    return TODO_TOOL_NAMES.has(toolName)
}

export type TodoViewItem = {
    id: string
    content: string
    status: TodoItem['status']
    priority: TodoItem['priority'] | null
}

function isTodoStatus(value: unknown): value is TodoItem['status'] {
    return value === 'pending' || value === 'in_progress' || value === 'completed'
}

function isTodoPriority(value: unknown): value is TodoItem['priority'] {
    return value === 'high' || value === 'medium' || value === 'low'
}

function normalizeTodoCandidate(value: unknown, index: number): TodoViewItem | null {
    if (!isObject(value)) return null

    const status = isTodoStatus(value.status) ? value.status : 'pending'
    const priority = isTodoPriority(value.priority) ? value.priority : null
    const id = typeof value.id === 'string' && value.id.trim().length > 0
        ? value.id
        : `todo-${index + 1}`
    const content = typeof value.content === 'string' ? value.content : ''

    return {
        id,
        content,
        status,
        priority
    }
}

export function normalizeTodos(values: readonly unknown[] | null | undefined): TodoViewItem[] {
    if (!Array.isArray(values)) return []

    return values
        .map((value, index) => normalizeTodoCandidate(value, index))
        .filter((value): value is TodoViewItem => value !== null)
}

export function extractToolTodos(input: unknown, result: unknown): TodoViewItem[] {
    const todosFromInput = isObject(input) && Array.isArray(input.todos)
        ? normalizeTodos(input.todos)
        : []
    if (todosFromInput.length > 0) {
        return todosFromInput
    }

    return isObject(result) && Array.isArray(result.newTodos)
        ? normalizeTodos(result.newTodos)
        : []
}

export function getTodoStats(todos: readonly TodoViewItem[]): {
    total: number
    completed: number
    incomplete: number
} {
    const total = todos.length
    const completed = todos.filter((todo) => todo.status === 'completed').length
    return {
        total,
        completed,
        incomplete: total - completed
    }
}

export function createTodoFingerprint(todos: readonly TodoViewItem[]): string {
    return todos
        .map((todo) => `${todo.id}:${todo.status}:${todo.content}`)
        .join('|')
}

export function findLatestTodoToolTodos(blocks: readonly ChatBlock[]): TodoViewItem[] {
    let latestCreatedAt = -Infinity
    let latestTodos: TodoViewItem[] = []

    const visit = (entries: readonly ChatBlock[]) => {
        for (const block of entries) {
            if (block.kind !== 'tool-call') continue

            if (isTodoToolName(block.tool.name)) {
                const todos = extractToolTodos(block.tool.input, block.tool.result)
                if (todos.length > 0 && block.createdAt >= latestCreatedAt) {
                    latestCreatedAt = block.createdAt
                    latestTodos = todos
                }
            }

            if (block.children.length > 0) {
                visit(block.children)
            }
        }
    }

    visit(blocks)
    return latestTodos
}
