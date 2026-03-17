import { describe, expect, it } from 'vitest'
import type { ChatBlock } from '@/chat/types'
import { extractToolTodos, findLatestTodoToolTodos, isTodoToolName } from '@/lib/todos'

describe('extractToolTodos', () => {
    it('recognizes update_plan as a todo tool', () => {
        expect(isTodoToolName('TodoWrite')).toBe(true)
        expect(isTodoToolName('functions.update_plan')).toBe(true)
        expect(isTodoToolName('Bash')).toBe(false)
    })

    it('prefers structured todos from tool input', () => {
        const todos = extractToolTodos(
            {
                todos: [
                    { id: '1', content: 'Read README', status: 'pending', priority: 'high' },
                    { id: '2', content: 'Render todo panel', status: 'in_progress', priority: 'medium' }
                ]
            },
            null
        )

        expect(todos).toHaveLength(2)
        expect(todos[0]).toMatchObject({ id: '1', content: 'Read README', status: 'pending' })
        expect(todos[1]).toMatchObject({ id: '2', content: 'Render todo panel', status: 'in_progress' })
    })

    it('falls back to result.newTodos when input has no todos', () => {
        const todos = extractToolTodos(
            {},
            {
                newTodos: [
                    { id: '3', content: 'Verify locale copy', status: 'completed', priority: 'low' }
                ]
            }
        )

        expect(todos).toEqual([
            {
                id: '3',
                content: 'Verify locale copy',
                status: 'completed',
                priority: 'low'
            }
        ])
    })
})

describe('findLatestTodoToolTodos', () => {
    it('finds the newest todo payload across nested blocks', () => {
        const blocks: ChatBlock[] = [
            {
                kind: 'tool-call',
                id: 'task-root',
                localId: null,
                createdAt: 1,
                tool: {
                    id: 'task-root',
                    name: 'Task',
                    state: 'completed',
                    input: {},
                    createdAt: 1,
                    startedAt: 1,
                    completedAt: 2,
                    description: null
                },
                children: [
                    {
                        kind: 'tool-call',
                        id: 'todo-old',
                        localId: null,
                        createdAt: 2,
                        tool: {
                            id: 'todo-old',
                            name: 'TodoWrite',
                            state: 'completed',
                            input: {
                                todos: [
                                    { id: 'old', content: 'Old todo', status: 'pending', priority: 'medium' }
                                ]
                            },
                            createdAt: 2,
                            startedAt: 2,
                            completedAt: 2,
                            description: null
                        },
                        children: []
                    }
                ]
            },
            {
                kind: 'tool-call',
                id: 'todo-new',
                localId: null,
                createdAt: 3,
                tool: {
                    id: 'todo-new',
                    name: 'functions.update_plan',
                    state: 'completed',
                    input: {
                        todos: [
                            { id: 'new', content: 'New todo', status: 'in_progress', priority: 'high' }
                        ]
                    },
                    createdAt: 3,
                    startedAt: 3,
                    completedAt: 3,
                    description: null
                },
                children: []
            }
        ]

        expect(findLatestTodoToolTodos(blocks)).toEqual([
            {
                id: 'new',
                content: 'New todo',
                status: 'in_progress',
                priority: 'high'
            }
        ])
    })
})
