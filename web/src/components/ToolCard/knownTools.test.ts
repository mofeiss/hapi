import { describe, expect, it } from 'vitest'
import { getStandardToolTitle, getToolPresentation } from '@/components/ToolCard/knownTools'

const CORE_TOOLS = [
    'Read',
    'Edit',
    'Write',
    'Glob',
    'Grep',
    'Bash',
    'Agent',
    'TodoWrite',
    'AskUserQuestion',
    'Skill',
    'WebFetch',
    'NotebookEdit',
    'TaskOutput',
    'TaskStop',
    'EnterPlanMode',
    'ExitPlanMode',
    'EnterWorktree',
    'TeamCreate',
    'TeamDelete',
    'SendMessage',
    'ListMcpResourcesTool',
    'ReadMcpResourceTool'
] as const

const MCP_TOOLS = [
    'mcp__hapi__change_title',
    'mcp__plugin_oh-my-claudecode_x__ask_codex',
    'mcp__plugin_oh-my-claudecode_x__wait_for_job',
    'mcp__plugin_oh-my-claudecode_x__check_job_status',
    'mcp__plugin_oh-my-claudecode_x__kill_job',
    'mcp__plugin_oh-my-claudecode_x__list_jobs',
    'mcp__plugin_oh-my-claudecode_g__ask_gemini',
    'mcp__plugin_oh-my-claudecode_g__wait_for_job',
    'mcp__plugin_oh-my-claudecode_g__check_job_status',
    'mcp__plugin_oh-my-claudecode_g__kill_job',
    'mcp__plugin_oh-my-claudecode_g__list_jobs',
    'mcp__plugin_oh-my-claudecode_t__lsp_hover',
    'mcp__plugin_oh-my-claudecode_t__lsp_goto_definition',
    'mcp__plugin_oh-my-claudecode_t__lsp_find_references',
    'mcp__plugin_oh-my-claudecode_t__lsp_document_symbols',
    'mcp__plugin_oh-my-claudecode_t__lsp_workspace_symbols',
    'mcp__plugin_oh-my-claudecode_t__lsp_diagnostics',
    'mcp__plugin_oh-my-claudecode_t__lsp_diagnostics_directory',
    'mcp__plugin_oh-my-claudecode_t__lsp_servers',
    'mcp__plugin_oh-my-claudecode_t__lsp_prepare_rename',
    'mcp__plugin_oh-my-claudecode_t__lsp_rename',
    'mcp__plugin_oh-my-claudecode_t__lsp_code_actions',
    'mcp__plugin_oh-my-claudecode_t__lsp_code_action_resolve',
    'mcp__plugin_oh-my-claudecode_t__ast_grep_search',
    'mcp__plugin_oh-my-claudecode_t__ast_grep_replace',
    'mcp__plugin_oh-my-claudecode_t__state_read',
    'mcp__plugin_oh-my-claudecode_t__state_write',
    'mcp__plugin_oh-my-claudecode_t__state_clear',
    'mcp__plugin_oh-my-claudecode_t__state_list_active',
    'mcp__plugin_oh-my-claudecode_t__state_get_status',
    'mcp__plugin_oh-my-claudecode_t__notepad_read',
    'mcp__plugin_oh-my-claudecode_t__notepad_write_priority',
    'mcp__plugin_oh-my-claudecode_t__notepad_write_working',
    'mcp__plugin_oh-my-claudecode_t__notepad_write_manual',
    'mcp__plugin_oh-my-claudecode_t__notepad_prune',
    'mcp__plugin_oh-my-claudecode_t__notepad_stats',
    'mcp__plugin_oh-my-claudecode_t__project_memory_read',
    'mcp__plugin_oh-my-claudecode_t__project_memory_write',
    'mcp__plugin_oh-my-claudecode_t__project_memory_add_note',
    'mcp__plugin_oh-my-claudecode_t__project_memory_add_directive',
    'mcp__plugin_oh-my-claudecode_t__trace_timeline',
    'mcp__plugin_oh-my-claudecode_t__trace_summary',
    'mcp__plugin_oh-my-claudecode_t__python_repl',
    'mcp__plugin_context7_context7__resolve-library-id',
    'mcp__plugin_context7_context7__query-docs',
    'mcp__searxng__searxng_web_search',
    'mcp__searxng__web_url_read',
    'mcp__websearch-serpapi__search'
] as const

describe('getStandardToolTitle', () => {
    it('covers all listed core tools', () => {
        for (const tool of CORE_TOOLS) {
            expect(getStandardToolTitle(tool), `missing mapping for ${tool}`).toBeTruthy()
        }
    })

    it('covers all listed MCP tools', () => {
        for (const tool of MCP_TOOLS) {
            expect(getStandardToolTitle(tool), `missing mapping for ${tool}`).toBeTruthy()
        }
    })

    it('formats unknown MCP tools with MCP prefix', () => {
        expect(getStandardToolTitle('mcp__unknown__tool')).toMatch(/^MCP:\s/)
    })

    it('formats unknown OMC tools with OMC prefix', () => {
        expect(getStandardToolTitle('mcp__plugin_oh-my-claudecode_x__custom_action')).toMatch(/^OMC:\s/)
    })
})

describe('getToolPresentation', () => {
    it('uses zh-CN narrative for core tools in Chinese locale', () => {
        const presentation = getToolPresentation({
            toolName: 'Read',
            input: { file_path: 'src/main.ts' },
            result: null,
            childrenCount: 0,
            description: null,
            metadata: null,
            locale: 'zh-CN'
        })

        expect(presentation.title).toBe('查看 src/main.ts 文件')
        expect(presentation.subtitle).toBeNull()
    })

    it('uses en narrative for core tools in English locale', () => {
        const presentation = getToolPresentation({
            toolName: 'Read',
            input: { file_path: '/etc/hosts' },
            result: null,
            childrenCount: 0,
            description: null,
            metadata: null,
            locale: 'en'
        })

        expect(presentation.title).toBe('View /etc/hosts file')
        expect(presentation.subtitle).toBeNull()
    })

    it('treats CodexBash like Bash for presentation', () => {
        const presentation = getToolPresentation({
            toolName: 'CodexBash',
            input: { command: 'pwd', cwd: '/workspace' },
            result: null,
            childrenCount: 0,
            description: null,
            metadata: null,
            locale: 'zh-CN'
        })

        expect(presentation.title).toBe('执行命令 pwd')
        expect(presentation.subtitle).toBeNull()
        expect(presentation.minimal).toBe(true)
    })

    it('falls back to generic tool presentation for CodexReasoning', () => {
        const presentation = getToolPresentation({
            toolName: 'CodexReasoning',
            input: { title: 'Inspecting workspace state' },
            result: null,
            childrenCount: 0,
            description: null,
            metadata: null,
            locale: 'zh-CN'
        })

        expect(presentation.title).toBe('CodexReasoning')
        expect(presentation.subtitle).toBe('Inspecting workspace state')
    })

    it('renders semantic write title with char count', () => {
        const presentation = getToolPresentation({
            toolName: 'Write',
            input: { file_path: '__mock_render_test__.txt', content: 'x'.repeat(24) },
            result: null,
            childrenCount: 0,
            description: null,
            metadata: null,
            locale: 'zh-CN'
        })

        expect(presentation.title).toBe('向 __mock_render_test__.txt 写入 24 个字符')
        expect(presentation.subtitle).toBeNull()
    })

    it('renders semantic glob title with result count', () => {
        const presentation = getToolPresentation({
            toolName: 'Glob',
            input: { pattern: '*.txt' },
            result: { paths: ['a.txt'] },
            childrenCount: 0,
            description: null,
            metadata: null,
            locale: 'zh-CN'
        })

        expect(presentation.title).toBe('搜索 *.txt（1 个路径）')
        expect(presentation.subtitle).toBeNull()
    })

    it('localizes TodoWrite title and compact summary', () => {
        const zhPresentation = getToolPresentation({
            toolName: 'TodoWrite',
            input: {
                todos: [
                    { id: '1', content: '实现任务面板', status: 'pending', priority: 'high' }
                ]
            },
            result: null,
            childrenCount: 0,
            description: null,
            metadata: null,
            locale: 'zh-CN'
        })
        const enPresentation = getToolPresentation({
            toolName: 'TodoWrite',
            input: {
                todos: [
                    { id: '1', content: 'Implement task panel', status: 'pending', priority: 'high' }
                ]
            },
            result: null,
            childrenCount: 0,
            description: null,
            metadata: null,
            locale: 'en'
        })

        expect(zhPresentation.title).toBe('更新任务列表')
        expect(zhPresentation.subtitle).toBe('1 个任务，已完成 0 个')
        expect(enPresentation.title).toBe('Update todo list')
        expect(enPresentation.subtitle).toBe('1 tasks, 0 completed')
    })

    it('treats functions.update_plan like TodoWrite', () => {
        const presentation = getToolPresentation({
            toolName: 'functions.update_plan',
            input: {
                todos: [
                    { id: '1', content: 'Implement task panel', status: 'in_progress', priority: 'high' }
                ]
            },
            result: null,
            childrenCount: 0,
            description: null,
            metadata: null,
            locale: 'en'
        })

        expect(presentation.title).toBe('Update todo list')
        expect(presentation.subtitle).toBe('1 tasks, 0 completed')
        expect(presentation.minimal).toBe(false)
    })

    it('localizes Task default title', () => {
        const zhPresentation = getToolPresentation({
            toolName: 'Task',
            input: {},
            result: null,
            childrenCount: 0,
            description: null,
            metadata: null,
            locale: 'zh-CN'
        })
        const enPresentation = getToolPresentation({
            toolName: 'Task',
            input: {},
            result: null,
            childrenCount: 0,
            description: null,
            metadata: null,
            locale: 'en'
        })

        expect(zhPresentation.title).toBe('任务')
        expect(enPresentation.title).toBe('Task')
    })

    it('uses standardized title for listed MCP tools', () => {
        const presentation = getToolPresentation({
            toolName: 'mcp__hapi__change_title',
            input: { title: 'Improve tool title rendering' },
            result: null,
            childrenCount: 0,
            description: null,
            metadata: null
        })

        expect(presentation.title).toBe('MCP: HAPI Change Title')
    })

    it('uses OMC prefix for oh-my-claudecode tools', () => {
        const presentation = getToolPresentation({
            toolName: 'mcp__plugin_oh-my-claudecode_x__ask_codex',
            input: {},
            result: null,
            childrenCount: 0,
            description: null,
            metadata: null
        })

        expect(presentation.title).toBe('OMC: Codex Ask')
    })

    it('derives Agent title from prompt when description is missing', () => {
        const presentation = getToolPresentation({
            toolName: 'Agent',
            input: {
                prompt: '# 分析日志\n\n请只输出关键结论。'
            },
            result: null,
            childrenCount: 0,
            description: null,
            metadata: null,
            locale: 'zh-CN'
        })

        expect(presentation.title).toBe('派发子代理处理 分析日志')
        expect(presentation.subtitle).toBeNull()
    })
})
