import type { ReactNode } from 'react'
import type { SessionMetadataSummary } from '@/types/api'
import type { Locale } from '@/lib/i18n-context'
import { isObject } from '@hapi/protocol'
import { BulbIcon, ClipboardIcon, EyeIcon, FileDiffIcon, GlobeIcon, PencilIcon, PuzzleIcon, QuestionIcon, RocketIcon, SearchIcon, TerminalIcon, WrenchIcon } from '@/components/ToolCard/icons'
import { ChecklistIcon } from '@/components/TodoPanel'
import { extractToolTodos, getTodoStats } from '@/lib/todos'
import { basename, resolveDisplayPath } from '@/utils/path'
import { getInputStringAny, truncate } from '@/lib/toolInputUtils'
import { extractSkillReadData } from '@/lib/skillRead'

const DEFAULT_ICON_CLASS = 'h-3.5 w-3.5'
// Tool presentation registry for `hapi/web` (aligned with `hapi-app`).

export type ToolPresentation = {
    icon: ReactNode
    title: string
    subtitle: string | null
    minimal: boolean
}

function countLines(text: string): number {
    return text.split('\n').length
}

function snakeToTitleWithSpaces(value: string): string {
    return value
        .split('_')
        .filter((part) => part.length > 0)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
        .join(' ')
}

function isOmcToolName(toolName: string): boolean {
    return toolName.startsWith('mcp__plugin_oh-my-claudecode_')
}

function formatMCPTitle(toolName: string): string {
    if (isOmcToolName(toolName)) {
        const parts = toolName.split('__')
        const action = parts.length >= 3 ? parts[2] : toolName.replace(/^mcp__/, '')
        return `OMC: ${snakeToTitleWithSpaces(action)}`
    }

    const withoutPrefix = toolName.replace(/^mcp__/, '')
    const parts = withoutPrefix.split('__')
    if (parts.length >= 2) {
        const serverName = snakeToTitleWithSpaces(parts[0])
        const toolPart = snakeToTitleWithSpaces(parts.slice(1).join('_'))
        return `MCP: ${serverName} ${toolPart}`
    }
    return `MCP: ${snakeToTitleWithSpaces(withoutPrefix)}`
}

const STANDARD_TOOL_TITLES: Record<string, string> = {
    Task: 'Task',
    Steps: 'Steps',
    Read: 'Read',
    Edit: 'Edit',
    MultiEdit: 'MultiEdit',
    Write: 'Write',
    Glob: 'Glob',
    Grep: 'Grep',
    Bash: 'Bash',
    Agent: 'Agent',
    TodoWrite: 'TodoWrite',
    AskUserQuestion: 'AskUserQuestion',
    ask_user_question: 'AskUserQuestion',
    request_user_input: 'RequestUserInput',
    Skill: 'Skill',
    SkillRead: 'SkillRead',
    WebFetch: 'WebFetch',
    WebSearch: 'WebSearch',
    NotebookEdit: 'NotebookEdit',
    NotebookRead: 'NotebookRead',
    TaskOutput: 'TaskOutput',
    TaskStop: 'TaskStop',
    EnterPlanMode: 'EnterPlanMode',
    ExitPlanMode: 'ExitPlanMode',
    exit_plan_mode: 'ExitPlanMode',
    EnterWorktree: 'EnterWorktree',
    TeamCreate: 'TeamCreate',
    TeamDelete: 'TeamDelete',
    SendMessage: 'SendMessage',
    ListMcpResourcesTool: 'ListMcpResourcesTool',
    ReadMcpResourceTool: 'ReadMcpResourceTool',
    LS: 'LS',
    CodexBash: 'CodexBash',
    CodexPermission: 'CodexPermission',
    shell_command: 'ShellCommand',
    CodexReasoning: 'CodexReasoning',
    CodexPatch: 'CodexPatch',
    CodexDiff: 'CodexDiff',
    hapi__change_title: 'MCP: HAPI Change Title',
    mcp__hapi__change_title: 'MCP: HAPI Change Title',
    'mcp__plugin_oh-my-claudecode_x__ask_codex': 'OMC: Codex Ask',
    'mcp__plugin_oh-my-claudecode_x__wait_for_job': 'OMC: Codex WaitForJob',
    'mcp__plugin_oh-my-claudecode_x__check_job_status': 'OMC: Codex CheckJobStatus',
    'mcp__plugin_oh-my-claudecode_x__kill_job': 'OMC: Codex KillJob',
    'mcp__plugin_oh-my-claudecode_x__list_jobs': 'OMC: Codex ListJobs',
    'mcp__plugin_oh-my-claudecode_g__ask_gemini': 'OMC: Gemini Ask',
    'mcp__plugin_oh-my-claudecode_g__wait_for_job': 'OMC: Gemini WaitForJob',
    'mcp__plugin_oh-my-claudecode_g__check_job_status': 'OMC: Gemini CheckJobStatus',
    'mcp__plugin_oh-my-claudecode_g__kill_job': 'OMC: Gemini KillJob',
    'mcp__plugin_oh-my-claudecode_g__list_jobs': 'OMC: Gemini ListJobs',
    'mcp__plugin_oh-my-claudecode_t__lsp_hover': 'OMC: LSP Hover',
    'mcp__plugin_oh-my-claudecode_t__lsp_goto_definition': 'OMC: LSP GoToDefinition',
    'mcp__plugin_oh-my-claudecode_t__lsp_find_references': 'OMC: LSP FindReferences',
    'mcp__plugin_oh-my-claudecode_t__lsp_document_symbols': 'OMC: LSP DocumentSymbols',
    'mcp__plugin_oh-my-claudecode_t__lsp_workspace_symbols': 'OMC: LSP WorkspaceSymbols',
    'mcp__plugin_oh-my-claudecode_t__lsp_diagnostics': 'OMC: LSP Diagnostics',
    'mcp__plugin_oh-my-claudecode_t__lsp_diagnostics_directory': 'OMC: LSP DiagnosticsDirectory',
    'mcp__plugin_oh-my-claudecode_t__lsp_servers': 'OMC: LSP Servers',
    'mcp__plugin_oh-my-claudecode_t__lsp_prepare_rename': 'OMC: LSP PrepareRename',
    'mcp__plugin_oh-my-claudecode_t__lsp_rename': 'OMC: LSP Rename',
    'mcp__plugin_oh-my-claudecode_t__lsp_code_actions': 'OMC: LSP CodeActions',
    'mcp__plugin_oh-my-claudecode_t__lsp_code_action_resolve': 'OMC: LSP CodeActionResolve',
    'mcp__plugin_oh-my-claudecode_t__ast_grep_search': 'OMC: AST GrepSearch',
    'mcp__plugin_oh-my-claudecode_t__ast_grep_replace': 'OMC: AST GrepReplace',
    'mcp__plugin_oh-my-claudecode_t__state_read': 'OMC: State Read',
    'mcp__plugin_oh-my-claudecode_t__state_write': 'OMC: State Write',
    'mcp__plugin_oh-my-claudecode_t__state_clear': 'OMC: State Clear',
    'mcp__plugin_oh-my-claudecode_t__state_list_active': 'OMC: State ListActive',
    'mcp__plugin_oh-my-claudecode_t__state_get_status': 'OMC: State GetStatus',
    'mcp__plugin_oh-my-claudecode_t__notepad_read': 'OMC: Notepad Read',
    'mcp__plugin_oh-my-claudecode_t__notepad_write_priority': 'OMC: Notepad WritePriority',
    'mcp__plugin_oh-my-claudecode_t__notepad_write_working': 'OMC: Notepad WriteWorking',
    'mcp__plugin_oh-my-claudecode_t__notepad_write_manual': 'OMC: Notepad WriteManual',
    'mcp__plugin_oh-my-claudecode_t__notepad_prune': 'OMC: Notepad Prune',
    'mcp__plugin_oh-my-claudecode_t__notepad_stats': 'OMC: Notepad Stats',
    'mcp__plugin_oh-my-claudecode_t__project_memory_read': 'OMC: ProjectMemory Read',
    'mcp__plugin_oh-my-claudecode_t__project_memory_write': 'OMC: ProjectMemory Write',
    'mcp__plugin_oh-my-claudecode_t__project_memory_add_note': 'OMC: ProjectMemory AddNote',
    'mcp__plugin_oh-my-claudecode_t__project_memory_add_directive': 'OMC: ProjectMemory AddDirective',
    'mcp__plugin_oh-my-claudecode_t__trace_timeline': 'OMC: Trace Timeline',
    'mcp__plugin_oh-my-claudecode_t__trace_summary': 'OMC: Trace Summary',
    'mcp__plugin_oh-my-claudecode_t__python_repl': 'OMC: Python REPL',
    'mcp__plugin_context7_context7__resolve-library-id': 'MCP: Context7 ResolveLibraryId',
    'mcp__plugin_context7_context7__query-docs': 'MCP: Context7 QueryDocs',
    mcp__searxng__searxng_web_search: 'MCP: SearXNG WebSearch',
    mcp__searxng__web_url_read: 'MCP: SearXNG UrlRead',
    'mcp__websearch-serpapi__search': 'MCP: SerpAPI Search'
}

export function getStandardToolTitle(toolName: string): string | null {
    const known = STANDARD_TOOL_TITLES[toolName]
    if (known) return known
    if (toolName.startsWith('mcp__')) return formatMCPTitle(toolName)
    return null
}

function getInputPathSubtitle(input: unknown, metadata: SessionMetadataSummary | null): string | null {
    const path = getInputStringAny(input, ['file_path', 'path', 'filePath', 'file', 'notebook_path'])
    return path ? resolveDisplayPath(path, metadata) : null
}

function getInputCommandSubtitle(input: unknown): string | null {
    const command = getInputStringAny(input, ['command', 'cmd'])
    if (command) return command
    if (isObject(input) && Array.isArray(input.command)) {
        const parts = input.command.filter((part): part is string => typeof part === 'string')
        if (parts.length > 0) return parts.join(' ')
    }
    return null
}

function getGenericSubtitleFromInput(input: unknown, metadata: SessionMetadataSummary | null): string | null {
    const path = getInputPathSubtitle(input, metadata)
    if (path) return path

    const command = getInputCommandSubtitle(input)
    if (command) return truncate(command, 140)

    const pattern = getInputStringAny(input, ['pattern'])
    if (pattern) return truncate(pattern, 140)

    const query = getInputStringAny(input, ['query', 'question', 'prompt'])
    if (query) return truncate(query, 140)

    const url = getInputStringAny(input, ['url', 'uri'])
    if (url) return truncate(url, 140)

    const title = getInputStringAny(input, ['title'])
    if (title) return truncate(title, 140)

    const tool = getInputStringAny(input, ['tool'])
    if (tool) return truncate(tool, 140)

    const identity = getInputStringAny(input, ['id', 'job_id', 'session_id', 'symbol', 'name', 'libraryId', 'server'])
    if (identity) return truncate(identity, 140)

    return null
}

type ToolOpts = {
    toolName: string
    input: unknown
    result: unknown
    childrenCount: number
    description: string | null
    metadata: SessionMetadataSummary | null
    locale: Locale
}

const CORE_TOOL_NAME_ALIASES: Record<string, string> = {
    ask_user_question: 'AskUserQuestion',
    exit_plan_mode: 'ExitPlanMode',
    SkillRead: 'Skill'
}

const CORE_TOOL_NAMES = new Set<string>([
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
    'SkillRead',
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
])

function normalizeCoreToolName(toolName: string): string {
    return CORE_TOOL_NAME_ALIASES[toolName] ?? toolName
}

function isCoreToolName(toolName: string): boolean {
    return CORE_TOOL_NAMES.has(normalizeCoreToolName(toolName))
}

function parseResultCount(value: unknown): number | null {
    if (Array.isArray(value)) return value.length
    if (!isObject(value)) return null

    const commonArrayKeys = ['paths', 'matches', 'results', 'files', 'items', 'resources', 'entries']
    for (const key of commonArrayKeys) {
        const candidate = value[key]
        if (Array.isArray(candidate)) return candidate.length
    }

    const count = value.count
    if (typeof count === 'number' && Number.isFinite(count) && count >= 0) return count
    return null
}

function getPathLabel(input: unknown, metadata: SessionMetadataSummary | null): string | null {
    return getInputPathSubtitle(input, metadata)
}

function formatTodoCompactSummary(locale: Locale, total: number, completed: number): string {
    if (locale === 'zh-CN') {
        return `${total} 个任务，已完成 ${completed} 个`
    }
    return `${total} tasks, ${completed} completed`
}

function getCoreToolNarrative(opts: ToolOpts): string | null {
    const toolName = normalizeCoreToolName(opts.toolName)
    const path = getPathLabel(opts.input, opts.metadata)
    const zh = opts.locale === 'zh-CN'

    switch (toolName) {
        case 'Read': {
            return path ? (zh ? `查看 ${path} 文件` : `view ${path} file`) : (zh ? '查看文件' : 'view file')
        }
        case 'Edit': {
            return path ? (zh ? `编辑 ${path} 文件` : `edit ${path} file`) : (zh ? '编辑文件' : 'edit file')
        }
        case 'Write': {
            const content = getInputStringAny(opts.input, ['content', 'text'])
            if (content) {
                if (path) return zh ? `向 ${path} 写入 ${content.length} 个字符` : `write ${content.length} chars to ${path}`
                return zh ? `写入 ${content.length} 个字符` : `write ${content.length} chars`
            }
            return path ? (zh ? `向 ${path} 写入内容` : `write content to ${path}`) : (zh ? '写入内容' : 'write content')
        }
        case 'Glob': {
            const pattern = getInputStringAny(opts.input, ['pattern'])
            const count = parseResultCount(opts.result)
            if (pattern && count !== null) return zh ? `搜索 ${pattern}（${count} 个路径）` : `search ${pattern} (${count} paths)`
            if (pattern) return zh ? `搜索 ${pattern}` : `search ${pattern}`
            return zh ? '搜索路径' : 'search paths'
        }
        case 'Grep': {
            const pattern = getInputStringAny(opts.input, ['pattern'])
            const count = parseResultCount(opts.result)
            if (pattern && count !== null) return zh ? `搜索 ${pattern}（${count} 处匹配）` : `search ${pattern} (${count} matches)`
            if (pattern) return zh ? `搜索 ${pattern}` : `search ${pattern}`
            return zh ? '搜索内容' : 'search content'
        }
        case 'Bash': {
            const command = getInputCommandSubtitle(opts.input)
            if (command) return zh ? `执行命令 ${truncate(command, 90)}` : `run command ${truncate(command, 90)}`
            return zh ? '执行命令' : 'run command'
        }
        case 'Agent': {
            const description = getInputStringAny(opts.input, ['description'])
            if (description) return zh ? `派发子代理处理 ${truncate(description, 60)}` : `dispatch sub-agent for ${truncate(description, 60)}`
            return zh ? '派发子代理' : 'dispatch sub-agent'
        }
        case 'TodoWrite': {
            const todos = isObject(opts.input) && Array.isArray(opts.input.todos) ? opts.input.todos : null
            if (todos && todos.length > 0) return zh ? `更新任务列表（${todos.length} 项）` : `update todo list (${todos.length} items)`
            const newTodos = isObject(opts.result) && Array.isArray(opts.result.newTodos) ? opts.result.newTodos : null
            if (newTodos && newTodos.length > 0) return zh ? `更新任务列表（${newTodos.length} 项）` : `update todo list (${newTodos.length} items)`
            return zh ? '更新任务列表' : 'update todo list'
        }
        case 'AskUserQuestion': {
            const questions = isObject(opts.input) && Array.isArray(opts.input.questions) ? opts.input.questions : []
            const firstQuestion = questions[0]
            const firstHeader = isObject(firstQuestion) && typeof firstQuestion.header === 'string'
                ? firstQuestion.header.trim()
                : ''
            if (firstHeader.length > 0) {
                if (questions.length > 1) {
                    return zh
                        ? `请求用户回答关于 ${firstHeader} 等多个问题`
                        : `request user answers about ${firstHeader} and more questions`
                }
                return zh
                    ? `请求用户回答关于 ${firstHeader} 的问题`
                    : `request user answer about ${firstHeader}`
            }
            if (questions.length > 0) return zh ? `请求用户回答 ${questions.length} 个问题` : `request user answers for ${questions.length} questions`
            return zh ? '请求用户回答' : 'request user answer'
        }
        case 'Skill': {
            const name = getInputStringAny(opts.input, ['name', 'skill', 'skill_name'])
                ?? extractSkillReadData(opts.input, opts.result)?.skillName
            if (name) return zh ? `调用技能 ${name}` : `invoke skill ${name}`
            return zh ? '调用技能' : 'invoke skill'
        }
        case 'WebFetch': {
            const url = getInputStringAny(opts.input, ['url'])
            if (!url) return zh ? '获取网页' : 'fetch web page'
            try {
                return zh ? `获取 ${new URL(url).hostname} 网页` : `fetch web page from ${new URL(url).hostname}`
            } catch {
                return zh ? `获取 ${truncate(url, 80)}` : `fetch ${truncate(url, 80)}`
            }
        }
        case 'NotebookEdit': {
            if (path) return zh ? `编辑 Notebook ${path}` : `edit notebook ${path}`
            return zh ? '编辑 Notebook' : 'edit notebook'
        }
        case 'TaskOutput': {
            const id = getInputStringAny(opts.input, ['task_id', 'id', 'job_id'])
            if (id) return zh ? `获取任务 ${id} 输出` : `get output for task ${id}`
            return zh ? '获取任务输出' : 'get task output'
        }
        case 'TaskStop': {
            const id = getInputStringAny(opts.input, ['task_id', 'id', 'job_id'])
            if (id) return zh ? `停止任务 ${id}` : `stop task ${id}`
            return zh ? '停止任务' : 'stop task'
        }
        case 'EnterPlanMode': {
            return zh ? '进入计划模式' : 'enter plan mode'
        }
        case 'ExitPlanMode': {
            return zh ? '退出计划模式' : 'exit plan mode'
        }
        case 'EnterWorktree': {
            return zh ? '进入隔离环境' : 'enter isolated worktree'
        }
        case 'TeamCreate': {
            const name = getInputStringAny(opts.input, ['name', 'team'])
            if (name) return zh ? `创建团队 ${name}` : `create team ${name}`
            return zh ? '创建团队' : 'create team'
        }
        case 'TeamDelete': {
            const name = getInputStringAny(opts.input, ['name', 'team'])
            if (name) return zh ? `删除团队 ${name}` : `delete team ${name}`
            return zh ? '删除团队' : 'delete team'
        }
        case 'SendMessage': {
            const content = getInputStringAny(opts.input, ['message', 'text', 'content'])
            if (content) return zh ? `发送 ${content.length} 个字符的消息` : `send message with ${content.length} chars`
            return zh ? '发送消息' : 'send message'
        }
        case 'ListMcpResourcesTool': {
            const server = getInputStringAny(opts.input, ['server'])
            if (server) return zh ? `列出 ${server} 的 MCP 资源` : `list MCP resources from ${server}`
            return zh ? '列出 MCP 资源' : 'list MCP resources'
        }
        case 'ReadMcpResourceTool': {
            const server = getInputStringAny(opts.input, ['server'])
            const uri = getInputStringAny(opts.input, ['uri'])
            if (server && uri) return zh ? `读取 ${server} 的资源 ${truncate(uri, 60)}` : `read ${server} resource ${truncate(uri, 60)}`
            if (server) return zh ? `读取 ${server} 的 MCP 资源` : `read MCP resource from ${server}`
            return zh ? '读取 MCP 资源' : 'read MCP resource'
        }
        default:
            return null
    }
}

function getCoreToolRichTitle(opts: ToolOpts): string | null {
    if (!isCoreToolName(opts.toolName)) return null
    const narrative = getCoreToolNarrative(opts)
    if (narrative) {
        if (opts.locale === 'zh-CN') return narrative
        return narrative.charAt(0).toUpperCase() + narrative.slice(1)
    }
    return getStandardToolTitle(opts.toolName) ?? normalizeCoreToolName(opts.toolName)
}

export const knownTools: Record<string, {
    icon: (opts: ToolOpts) => ReactNode
    title: (opts: ToolOpts) => string
    subtitle?: (opts: ToolOpts) => string | null
    minimal?: boolean | ((opts: ToolOpts) => boolean)
}> = {
    Task: {
        icon: () => <RocketIcon className={DEFAULT_ICON_CLASS} />,
        title: (opts) => {
            const description = getInputStringAny(opts.input, ['description'])
            if (description) return description
            return opts.locale === 'zh-CN' ? '任务' : 'Task'
        },
        subtitle: (opts) => {
            const prompt = getInputStringAny(opts.input, ['prompt'])
            return prompt ? truncate(prompt, 120) : null
        },
        minimal: (opts) => opts.childrenCount === 0
    },
    Bash: {
        icon: () => <TerminalIcon className={DEFAULT_ICON_CLASS} />,
        title: (opts) => opts.description ?? 'Terminal',
        subtitle: (opts) => getInputStringAny(opts.input, ['command', 'cmd']),
        minimal: true
    },
    Glob: {
        icon: () => <SearchIcon className={DEFAULT_ICON_CLASS} />,
        title: (opts) => getInputStringAny(opts.input, ['pattern']) ?? 'Search files',
        minimal: true
    },
    Grep: {
        icon: () => <EyeIcon className={DEFAULT_ICON_CLASS} />,
        title: (opts) => {
            const pattern = getInputStringAny(opts.input, ['pattern'])
            return pattern ? `grep(pattern: ${pattern})` : 'Search content'
        },
        minimal: true
    },
    LS: {
        icon: () => <SearchIcon className={DEFAULT_ICON_CLASS} />,
        title: (opts) => {
            const path = getInputStringAny(opts.input, ['path'])
            return path ? resolveDisplayPath(path, opts.metadata) : 'List files'
        },
        minimal: true
    },
    CodexBash: {
        icon: (opts) => {
            if (isObject(opts.input) && Array.isArray(opts.input.parsed_cmd) && opts.input.parsed_cmd.length > 0) {
                const first = opts.input.parsed_cmd[0]
                const type = isObject(first) ? first.type : null
                if (type === 'read') return <EyeIcon className={DEFAULT_ICON_CLASS} />
                if (type === 'write') return <FileDiffIcon className={DEFAULT_ICON_CLASS} />
            }
            return <TerminalIcon className={DEFAULT_ICON_CLASS} />
        },
        title: (opts) => {
            if (isObject(opts.input) && Array.isArray(opts.input.parsed_cmd) && opts.input.parsed_cmd.length === 1) {
                const parsed = opts.input.parsed_cmd[0]
                if (isObject(parsed) && parsed.type === 'read' && typeof parsed.name === 'string') {
                    return resolveDisplayPath(parsed.name, opts.metadata)
                }
            }
            return opts.description ?? 'Terminal'
        },
        subtitle: (opts) => {
            const command = getInputStringAny(opts.input, ['command', 'cmd'])
            if (command) return command
            if (isObject(opts.input) && Array.isArray(opts.input.command)) {
                return opts.input.command.filter((part) => typeof part === 'string').join(' ')
            }
            return null
        },
        minimal: true
    },
    CodexPermission: {
        icon: () => <QuestionIcon className={DEFAULT_ICON_CLASS} />,
        title: (opts) => {
            const tool = getInputStringAny(opts.input, ['tool'])
            return tool ? `Permission: ${tool}` : 'Permission request'
        },
        subtitle: (opts) => getInputStringAny(opts.input, ['message', 'command']) ?? null,
        minimal: true
    },
    shell_command: {
        icon: () => <TerminalIcon className={DEFAULT_ICON_CLASS} />,
        title: (opts) => opts.description ?? 'Terminal',
        subtitle: (opts) => getInputStringAny(opts.input, ['command', 'cmd']),
        minimal: true
    },
    Read: {
        icon: () => <EyeIcon className={DEFAULT_ICON_CLASS} />,
        title: (opts) => {
            const file = getInputStringAny(opts.input, ['file_path', 'path', 'file'])
            return file ? resolveDisplayPath(file, opts.metadata) : 'Read file'
        },
        minimal: true
    },
    Edit: {
        icon: () => <PencilIcon className={DEFAULT_ICON_CLASS} />,
        title: (opts) => {
            const file = getInputStringAny(opts.input, ['file_path', 'path'])
            return file ? resolveDisplayPath(file, opts.metadata) : 'Edit file'
        },
        minimal: true
    },
    MultiEdit: {
        icon: () => <FileDiffIcon className={DEFAULT_ICON_CLASS} />,
        title: (opts) => {
            const file = getInputStringAny(opts.input, ['file_path', 'path'])
            if (!file) return 'Edit file'
            const edits = isObject(opts.input) && Array.isArray(opts.input.edits) ? opts.input.edits : null
            const count = edits ? edits.length : 0
            const path = resolveDisplayPath(file, opts.metadata)
            return count > 1 ? `${path} (${count} edits)` : path
        },
        minimal: true
    },
    Write: {
        icon: () => <FileDiffIcon className={DEFAULT_ICON_CLASS} />,
        title: (opts) => {
            const file = getInputStringAny(opts.input, ['file_path', 'path'])
            return file ? resolveDisplayPath(file, opts.metadata) : 'Write file'
        },
        subtitle: (opts) => {
            const content = getInputStringAny(opts.input, ['content', 'text'])
            if (!content) return null
            const lines = countLines(content)
            return lines > 1 ? `${lines} lines` : `${content.length} chars`
        },
        minimal: true
    },
    WebFetch: {
        icon: () => <GlobeIcon className={DEFAULT_ICON_CLASS} />,
        title: (opts) => {
            const url = getInputStringAny(opts.input, ['url'])
            if (!url) return 'Web fetch'
            try {
                return new URL(url).hostname
            } catch {
                return url
            }
        },
        subtitle: (opts) => {
            const url = getInputStringAny(opts.input, ['url'])
            if (!url) return null
            return url
        },
        minimal: true
    },
    WebSearch: {
        icon: () => <GlobeIcon className={DEFAULT_ICON_CLASS} />,
        title: (opts) => getInputStringAny(opts.input, ['query']) ?? 'Web search',
        subtitle: (opts) => {
            const query = getInputStringAny(opts.input, ['query'])
            return query ? truncate(query, 80) : null
        },
        minimal: true
    },
    NotebookRead: {
        icon: () => <EyeIcon className={DEFAULT_ICON_CLASS} />,
        title: (opts) => {
            const path = getInputStringAny(opts.input, ['notebook_path'])
            return path ? resolveDisplayPath(path, opts.metadata) : 'Read notebook'
        },
        minimal: true
    },
    NotebookEdit: {
        icon: () => <FileDiffIcon className={DEFAULT_ICON_CLASS} />,
        title: (opts) => {
            const path = getInputStringAny(opts.input, ['notebook_path'])
            return path ? resolveDisplayPath(path, opts.metadata) : 'Edit notebook'
        },
        subtitle: (opts) => {
            const mode = getInputStringAny(opts.input, ['edit_mode'])
            return mode ? `mode: ${mode}` : null
        },
        minimal: false
    },
    TodoWrite: {
        icon: () => <ChecklistIcon className={DEFAULT_ICON_CLASS} />,
        title: (opts) => opts.locale === 'zh-CN' ? '更新任务列表' : 'Update todo list',
        subtitle: (opts) => {
            const todos = extractToolTodos(opts.input, opts.result)
            if (todos.length === 0) return null
            const stats = getTodoStats(todos)
            return formatTodoCompactSummary(opts.locale, stats.total, stats.completed)
        },
        minimal: (opts) => {
            const todos = isObject(opts.input) && Array.isArray(opts.input.todos) ? opts.input.todos : null
            if (todos && todos.length > 0) return false
            const newTodos = isObject(opts.result) && Array.isArray(opts.result.newTodos) ? opts.result.newTodos : null
            if (newTodos && newTodos.length > 0) return false
            return true
        }
    },
    CodexReasoning: {
        icon: () => <BulbIcon className={DEFAULT_ICON_CLASS} />,
        title: (opts) => getInputStringAny(opts.input, ['title']) ?? 'Reasoning',
        minimal: true
    },
    CodexPatch: {
        icon: () => <FileDiffIcon className={DEFAULT_ICON_CLASS} />,
        title: () => 'Apply changes',
        subtitle: (opts) => {
            if (isObject(opts.input) && isObject(opts.input.changes)) {
                const files = Object.keys(opts.input.changes)
                if (files.length === 0) return null
                const first = files[0]
                const display = resolveDisplayPath(first, opts.metadata)
                const name = basename(display)
                return files.length > 1 ? `${name} (+${files.length - 1})` : name
            }
            return null
        },
        minimal: true
    },
    CodexDiff: {
        icon: () => <FileDiffIcon className={DEFAULT_ICON_CLASS} />,
        title: () => 'Diff',
        subtitle: (opts) => {
            const unified = getInputStringAny(opts.input, ['unified_diff'])
            if (!unified) return null
            const lines = unified.split('\n')
            for (const line of lines) {
                if (line.startsWith('+++ b/') || line.startsWith('+++ ')) {
                    const fileName = line.replace(/^\+\+\+ (b\/)?/, '')
                    return fileName.split('/').pop() ?? fileName
                }
            }
            return null
        },
        minimal: (opts) => {
            const unified = getInputStringAny(opts.input, ['unified_diff'])
            if (!unified) return true
            return unified.length >= 2000 || countLines(unified) >= 50
        }
    },
    ExitPlanMode: {
        icon: () => <ClipboardIcon className={DEFAULT_ICON_CLASS} />,
        title: () => 'Plan proposal',
        minimal: false
    },
    exit_plan_mode: {
        icon: () => <ClipboardIcon className={DEFAULT_ICON_CLASS} />,
        title: () => 'Plan proposal',
        minimal: false
    },
    AskUserQuestion: {
        icon: () => <QuestionIcon className={DEFAULT_ICON_CLASS} />,
        title: (opts) => {
            const questions = isObject(opts.input) && Array.isArray(opts.input.questions)
                ? opts.input.questions : []
            const count = questions.length
            const first = questions[0] ?? null
            const header = isObject(first) && typeof first.header === 'string'
                ? first.header.trim() : ''

            if (count > 1) {
                const question = isObject(first) && typeof first.question === 'string'
                    ? first.question.trim() : ''
                const display = question.length > 0 ? truncate(question, 80) : (header.length > 0 ? header : 'Question')
                return `${display}  (+${count - 1} more)`
            }
            return header.length > 0 ? header : 'Question'
        },
        subtitle: () => null,
        minimal: true
    },
    ask_user_question: {
        icon: () => <QuestionIcon className={DEFAULT_ICON_CLASS} />,
        title: (opts) => {
            const questions = isObject(opts.input) && Array.isArray(opts.input.questions)
                ? opts.input.questions : []
            const count = questions.length
            const first = questions[0] ?? null
            const header = isObject(first) && typeof first.header === 'string'
                ? first.header.trim() : ''

            if (count > 1) {
                const question = isObject(first) && typeof first.question === 'string'
                    ? first.question.trim() : ''
                const display = question.length > 0 ? truncate(question, 80) : (header.length > 0 ? header : 'Question')
                return `${display}  (+${count - 1} more)`
            }
            return header.length > 0 ? header : 'Question'
        },
        subtitle: () => null,
        minimal: true
    },
    request_user_input: {
        icon: () => <QuestionIcon className={DEFAULT_ICON_CLASS} />,
        title: (opts) => {
            const questions = isObject(opts.input) && Array.isArray(opts.input.questions)
                ? opts.input.questions : []
            const count = questions.length
            const first = questions[0] ?? null
            const id = isObject(first) && typeof first.id === 'string'
                ? first.id.trim() : ''

            if (count > 1) {
                return `${count} Questions`
            }
            return id.length > 0 ? id : 'Question'
        },
        subtitle: (opts) => {
            const questions = isObject(opts.input) && Array.isArray(opts.input.questions)
                ? opts.input.questions : []
            const count = questions.length
            const first = questions[0] ?? null
            const question = isObject(first) && typeof first.question === 'string'
                ? first.question.trim() : ''

            if (count > 1 && question.length > 0) {
                return truncate(question, 100) + ` (+${count - 1} more)`
            }
            return question.length > 0 ? truncate(question, 120) : null
        },
        minimal: true
    },
    Skill: {
        icon: () => <PuzzleIcon className={DEFAULT_ICON_CLASS} />,
        title: (opts) => getInputStringAny(opts.input, ['name', 'skill', 'skill_name']) ?? 'Skill',
        minimal: true
    },
    SkillRead: {
        icon: () => <PuzzleIcon className={DEFAULT_ICON_CLASS} />,
        title: (opts) => {
            const data = extractSkillReadData(opts.input, opts.result)
            const name = data?.skillName
            return name ? `Skill: ${name}` : 'Skill'
        },
        subtitle: (opts) => {
            const data = extractSkillReadData(opts.input, opts.result)
            if (!data?.path) return null
            return resolveDisplayPath(data.path, opts.metadata)
        },
        minimal: false
    },
    Steps: {
        icon: () => <ClipboardIcon className={DEFAULT_ICON_CLASS} />,
        title: (opts) => {
            const zh = opts.locale === 'zh-CN'
            return zh ? '工具调用' : 'Tool Calls'
        },
        subtitle: (opts) => {
            const zh = opts.locale === 'zh-CN'
            const count = isObject(opts.input) && typeof opts.input.count === 'number'
                ? opts.input.count
                : opts.childrenCount
            if (count <= 0) return null
            return zh ? `连续 ${count} 次调用` : `${count} calls`
        },
        minimal: false
    }
}

export function getToolPresentation(opts: Omit<ToolOpts, 'locale'> & { locale?: Locale }): ToolPresentation {
    const toolOpts: ToolOpts = {
        ...opts,
        locale: opts.locale ?? 'en'
    }

    const standardTitle = getStandardToolTitle(toolOpts.toolName)
    const coreRichTitle = toolOpts.toolName === 'TodoWrite' ? null : getCoreToolRichTitle(toolOpts)

    if (toolOpts.toolName.startsWith('mcp__')) {
        return {
            icon: <PuzzleIcon className={DEFAULT_ICON_CLASS} />,
            title: standardTitle ?? formatMCPTitle(toolOpts.toolName),
            subtitle: getGenericSubtitleFromInput(toolOpts.input, toolOpts.metadata),
            minimal: true
        }
    }

    const known = knownTools[toolOpts.toolName]
    if (known) {
        const minimal = typeof known.minimal === 'function' ? known.minimal(toolOpts) : (known.minimal ?? false)
        const computedTitle = known.title(toolOpts)
        const preferComputedTitle = toolOpts.toolName === 'Steps' || toolOpts.toolName === 'Task' || toolOpts.toolName === 'TodoWrite'
        let subtitle = known.subtitle ? known.subtitle(toolOpts) : null
        if (coreRichTitle) {
            subtitle = null
        } else if (standardTitle) {
            if (!subtitle && computedTitle !== standardTitle) {
                subtitle = computedTitle
            }
            if (!subtitle) {
                subtitle = getGenericSubtitleFromInput(toolOpts.input, toolOpts.metadata)
            }
        }
        return {
            icon: known.icon(toolOpts),
            title: preferComputedTitle ? computedTitle : (coreRichTitle ?? standardTitle ?? computedTitle),
            subtitle,
            minimal
        }
    }

    if (coreRichTitle) {
        return {
            icon: <WrenchIcon className={DEFAULT_ICON_CLASS} />,
            title: coreRichTitle,
            subtitle: null,
            minimal: true
        }
    }

    const subtitle = getGenericSubtitleFromInput(toolOpts.input, toolOpts.metadata)

    return {
        icon: <WrenchIcon className={DEFAULT_ICON_CLASS} />,
        title: standardTitle ?? toolOpts.toolName,
        subtitle: subtitle ? truncate(subtitle, 80) : null,
        minimal: true
    }
}
