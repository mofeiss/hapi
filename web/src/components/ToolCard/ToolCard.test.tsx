import { render, screen } from '@testing-library/react'
import { createElement } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ToolCard } from '@/components/ToolCard/ToolCard'
import { I18nProvider } from '@/lib/i18n-context'

beforeEach(() => {
    localStorage.setItem('hapi-lang', 'zh-CN')

    Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: vi.fn().mockImplementation(() => ({
            matches: false,
            media: '',
            onchange: null,
            addListener: vi.fn(),
            removeListener: vi.fn(),
            addEventListener: vi.fn(),
            removeEventListener: vi.fn(),
            dispatchEvent: vi.fn()
        }))
    })
})

describe('ToolCard Todo rendering', () => {
    it('renders update_plan like TodoWrite without Input and Result headings', () => {
        render(
            createElement(
                I18nProvider,
                null,
                createElement(ToolCard, {
                    api: {} as never,
                    sessionId: 'session-1',
                    metadata: null,
                    disabled: false,
                    onDone: vi.fn(),
                    block: {
                        kind: 'tool-call',
                        id: 'plan-tool-1',
                        localId: null,
                        createdAt: 1,
                        tool: {
                            id: 'plan-tool-1',
                            name: 'update_plan',
                            state: 'completed',
                            input: {
                                todos: [
                                    { id: '1', content: '修复 update_plan 渲染', status: 'in_progress', priority: 'high' }
                                ]
                            },
                            createdAt: 1,
                            startedAt: 1,
                            completedAt: 2,
                            description: null,
                            result: {
                                newTodos: [
                                    { id: '1', content: '修复 update_plan 渲染', status: 'in_progress', priority: 'high' }
                                ]
                            }
                        },
                        children: []
                    }
                })
            )
        )

        expect(screen.queryByText('Input')).not.toBeInTheDocument()
        expect(screen.queryByText('Result')).not.toBeInTheDocument()
        expect(screen.getByText('修复 update_plan 渲染')).toBeInTheDocument()
    })
})

describe('ToolCard Agent header', () => {
    it('does not reuse description as subtitle when title already contains the topic', () => {
        const { container } = render(
            createElement(
                I18nProvider,
                null,
                createElement(ToolCard, {
                    api: {} as never,
                    sessionId: 'session-1',
                    metadata: null,
                    disabled: false,
                    onDone: vi.fn(),
                    block: {
                        kind: 'tool-call',
                        id: 'agent-tool-1',
                        localId: null,
                        createdAt: 1,
                        tool: {
                            id: 'agent-tool-1',
                            name: 'Agent',
                            state: 'completed',
                            input: {
                                description: '读取并总结 RTK 文档',
                                prompt: '请读取 ~/.claude/RTK.md 文件，然后总结其主要内容。'
                            },
                            createdAt: 1,
                            startedAt: 1,
                            completedAt: 2,
                            description: '读取并总结 RTK 文档',
                            result: null
                        },
                        children: []
                    }
                })
            )
        )

        expect(screen.getByText('派发子代理处理 读取并总结 RTK 文档')).toBeInTheDocument()
        expect(container.querySelector('span[title="读取并总结 RTK 文档"]')).toBeNull()
    })

    it('renders raw tool name for codex sessions', () => {
        render(
            createElement(
                I18nProvider,
                null,
                createElement(ToolCard, {
                    api: {} as never,
                    sessionId: 'session-1',
                    metadata: {
                        path: '/workspace',
                        host: 'local',
                        flavor: 'codex'
                    },
                    disabled: false,
                    onDone: vi.fn(),
                    block: {
                        kind: 'tool-call',
                        id: 'bash-tool-1',
                        localId: null,
                        createdAt: 1,
                        tool: {
                            id: 'bash-tool-1',
                            name: 'Bash',
                            state: 'completed',
                            input: {
                                command: 'pwd'
                            },
                            createdAt: 1,
                            startedAt: 1,
                            completedAt: 2,
                            description: null,
                            result: null
                        },
                        children: []
                    }
                })
            )
        )

        expect(screen.getByText('Bash')).toBeInTheDocument()
        expect(screen.getByText('执行命令 pwd')).toBeInTheDocument()
    })

    it('preserves preview subtitle for read-like tools in codex sessions', () => {
        render(
            createElement(
                I18nProvider,
                null,
                createElement(ToolCard, {
                    api: {} as never,
                    sessionId: 'session-1',
                    metadata: {
                        path: '/workspace',
                        host: 'local',
                        flavor: 'codex'
                    },
                    disabled: false,
                    onDone: vi.fn(),
                    block: {
                        kind: 'tool-call',
                        id: 'read-tool-1',
                        localId: null,
                        createdAt: 1,
                        tool: {
                            id: 'read-tool-1',
                            name: 'Read',
                            state: 'completed',
                            input: {
                                file_path: '/workspace/src/main.ts'
                            },
                            createdAt: 1,
                            startedAt: 1,
                            completedAt: 2,
                            description: null,
                            result: null
                        },
                        children: []
                    }
                })
            )
        )

        expect(screen.getByText('Read')).toBeInTheDocument()
        expect(screen.getByText('查看 src/main.ts 文件')).toBeInTheDocument()
    })
})
