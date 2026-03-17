import type { ReactNode } from 'react'
import type { ToolCallBlock } from '@/chat/types'
import type { SessionMetadataSummary } from '@/types/api'
import { isObject, safeStringify } from '@hapi/protocol'
import { CodeBlock } from '@/components/CodeBlock'
import { DiffView } from '@/components/DiffView'
import { MarkdownRenderer } from '@/components/MarkdownRenderer'
import { getToolParamFieldPosition, ToolParamField } from '@/components/ToolCard/ToolParamField'
import { resolveNotebookEditDiffData } from '@/components/ToolCard/views/notebookEditDiff'
import { extractSkillReadData } from '@/lib/skillRead'
import { isTodoToolName } from '@/lib/todos'
import { getInputStringAny, truncate } from '@/lib/toolInputUtils'
import { resolveDisplayPath } from '@/utils/path'

type ParamRow = {
    name: string
    value: string
}

function normalizeCoreToolName(toolName: string): string {
    if (toolName === 'ask_user_question') return 'AskUserQuestion'
    if (toolName === 'exit_plan_mode') return 'ExitPlanMode'
    return toolName
}

function toSingleLine(text: string): string {
    return text.replace(/\s+/g, ' ').trim()
}

function toScalarString(value: unknown): string | null {
    if (typeof value === 'string') {
        const normalized = toSingleLine(value)
        return normalized.length > 0 ? normalized : null
    }
    if (typeof value === 'number' || typeof value === 'boolean') {
        return String(value)
    }
    return null
}

function getInputScalar(input: unknown, keys: string[]): string | null {
    if (!isObject(input)) return null
    for (const key of keys) {
        const value = toScalarString(input[key])
        if (value) return value
    }
    return null
}

function getInputPath(input: unknown, metadata: SessionMetadataSummary | null, keys: string[]): string | null {
    const path = getInputStringAny(input, keys)
    if (!path) return null
    return resolveDisplayPath(path, metadata)
}

function getInputCommand(input: unknown): string | null {
    if (!isObject(input)) return null
    if (Array.isArray(input.command)) {
        const joined = input.command
            .filter((part): part is string => typeof part === 'string' && part.trim().length > 0)
            .join(' ')
        if (joined.length > 0) return joined
    }
    return getInputStringAny(input, ['command', 'cmd'])
}

function pushRow(rows: ParamRow[], name: string, value: string | null): void {
    if (!value) return
    rows.push({ name, value })
}

function formatCharsLabel(text: string): string {
    return `${text.length} chars`
}

function extractCoreToolParamRows(block: ToolCallBlock, metadata: SessionMetadataSummary | null): ParamRow[] | null {
    const toolName = normalizeCoreToolName(block.tool.name)
    const input = block.tool.input
    const result = block.tool.result

    if (!isObject(input) && !isTodoToolName(toolName)) return null
    const inputObj = isObject(input) ? input : null

    const rows: ParamRow[] = []

    switch (toolName) {
        case 'Glob': {
            pushRow(rows, 'pattern', getInputScalar(inputObj, ['pattern']))
            pushRow(rows, 'path', getInputPath(inputObj, metadata, ['path', 'cwd']))
            pushRow(rows, 'glob', getInputScalar(inputObj, ['glob']))
            pushRow(rows, 'case_sensitive', getInputScalar(inputObj, ['case_sensitive']))
            pushRow(rows, 'include_hidden', getInputScalar(inputObj, ['include_hidden']))
            break
        }
        case 'Grep': {
            pushRow(rows, 'pattern', getInputScalar(inputObj, ['pattern']))
            pushRow(rows, 'path', getInputPath(inputObj, metadata, ['path', 'cwd']))
            pushRow(rows, 'glob', getInputScalar(inputObj, ['glob']))
            pushRow(rows, 'output_mode', getInputScalar(inputObj, ['output_mode']))
            pushRow(rows, 'head_limit', getInputScalar(inputObj, ['head_limit']))
            break
        }
        case 'Agent': {
            pushRow(rows, 'agent', getInputScalar(inputObj, ['agent', 'name', 'model']))
            const prompt = getInputScalar(inputObj, ['description', 'prompt', 'task'])
            if (prompt) {
                pushRow(rows, 'prompt', truncate(prompt, 180))
            }
            break
        }
        case 'TodoWrite':
        case 'functions.update_plan': {
            const todos = inputObj && Array.isArray(inputObj.todos)
                ? inputObj.todos.filter(isObject)
                : []
            const fallbackTodos = isObject(result) && Array.isArray(result.newTodos)
                ? result.newTodos.filter(isObject)
                : []
            const activeTodos = todos.length > 0 ? todos : fallbackTodos
            if (activeTodos.length > 0) {
                pushRow(rows, 'todos', `${activeTodos.length} items`)
                const statusCounts: Record<'pending' | 'in_progress' | 'completed', number> = {
                    pending: 0,
                    in_progress: 0,
                    completed: 0
                }
                for (const todo of activeTodos) {
                    const status = typeof todo.status === 'string' ? todo.status : null
                    if (status === 'pending' || status === 'in_progress' || status === 'completed') {
                        statusCounts[status] += 1
                    }
                }
                const summary = [
                    statusCounts.pending > 0 ? `${statusCounts.pending} pending` : null,
                    statusCounts.in_progress > 0 ? `${statusCounts.in_progress} in_progress` : null,
                    statusCounts.completed > 0 ? `${statusCounts.completed} completed` : null
                ].filter((part): part is string => typeof part === 'string')
                if (summary.length > 0) {
                    pushRow(rows, 'status', summary.join(' / '))
                }
            }
            break
        }
        case 'WebFetch': {
            pushRow(rows, 'url', getInputScalar(inputObj, ['url', 'uri']))
            const prompt = getInputScalar(inputObj, ['prompt', 'query'])
            if (prompt) {
                pushRow(rows, 'prompt', truncate(prompt, 160))
            }
            break
        }
        case 'NotebookEdit': {
            pushRow(rows, 'notebook_path', getInputPath(inputObj, metadata, ['notebook_path', 'path']))
            pushRow(rows, 'edit_mode', getInputScalar(inputObj, ['edit_mode']))
            pushRow(rows, 'cell_id', getInputScalar(inputObj, ['cell_id']))
            const source = getInputScalar(inputObj, ['new_source', 'old_source', 'source'])
            if (source) {
                pushRow(rows, 'source', formatCharsLabel(source))
            }
            break
        }
        case 'TaskOutput': {
            pushRow(rows, 'task_id', getInputScalar(inputObj, ['task_id', 'id', 'job_id']))
            pushRow(rows, 'stream', getInputScalar(inputObj, ['stream']))
            break
        }
        case 'TaskStop': {
            pushRow(rows, 'task_id', getInputScalar(inputObj, ['task_id', 'id', 'job_id']))
            pushRow(rows, 'signal', getInputScalar(inputObj, ['signal']))
            break
        }
        case 'EnterWorktree': {
            pushRow(rows, 'worktree', getInputPath(inputObj, metadata, ['worktree_path', 'worktreePath', 'path']))
            pushRow(rows, 'branch', getInputScalar(inputObj, ['branch']))
            pushRow(rows, 'name', getInputScalar(inputObj, ['name']))
            break
        }
        case 'TeamCreate': {
            pushRow(rows, 'name', getInputScalar(inputObj, ['name', 'team']))
            pushRow(rows, 'model', getInputScalar(inputObj, ['model']))
            const description = getInputScalar(inputObj, ['description'])
            if (description) {
                pushRow(rows, 'description', truncate(description, 160))
            }
            break
        }
        case 'TeamDelete': {
            pushRow(rows, 'name', getInputScalar(inputObj, ['name', 'team', 'id']))
            break
        }
        case 'SendMessage': {
            pushRow(rows, 'to', getInputScalar(inputObj, ['to', 'recipient', 'agent', 'team']))
            const content = getInputScalar(inputObj, ['message', 'text', 'content'])
            if (content) {
                pushRow(rows, 'message', formatCharsLabel(content))
                pushRow(rows, 'preview', truncate(content, 160))
            }
            break
        }
        case 'ListMcpResourcesTool':
        case 'mcp__codex__list_mcp_resources':
        case 'mcp__codex__list_mcp_resource_templates': {
            pushRow(rows, 'server', getInputScalar(inputObj, ['server']))
            pushRow(rows, 'cursor', getInputScalar(inputObj, ['cursor']))
            break
        }
        case 'ReadMcpResourceTool':
        case 'mcp__searxng__read_mcp_resource':
        case 'mcp__codex__read_mcp_resource': {
            pushRow(rows, 'server', getInputScalar(inputObj, ['server']))
            pushRow(rows, 'uri', getInputScalar(inputObj, ['uri']))
            break
        }
        case 'Skill':
        case 'SkillRead': {
            const skillReadData = extractSkillReadData(inputObj, result)
            const skillName = skillReadData?.skillName ?? getInputScalar(inputObj, ['skill', 'name', 'skill_name'])
            pushRow(rows, 'skill', skillName)
            if (skillReadData?.path) {
                pushRow(rows, 'path', resolveDisplayPath(skillReadData.path, metadata))
            }
            const query = getInputScalar(inputObj, ['query', 'prompt', 'question'])
            if (query) {
                pushRow(rows, 'query', truncate(query, 160))
            }
            break
        }
        case 'AskUserQuestion': {
            const rawQuestions = inputObj ? inputObj.questions : null
            const questions = Array.isArray(rawQuestions) ? rawQuestions.filter(isObject) : []
            if (questions.length > 0) {
                pushRow(rows, 'questions', `${questions.length}`)
                const first = questions[0]
                pushRow(rows, 'header', getInputScalar(first, ['header']))
                const firstQuestionText = getInputScalar(first, ['question'])
                if (firstQuestionText) {
                    pushRow(rows, 'first_question', truncate(firstQuestionText, 160))
                }
                const firstOptions = Array.isArray(first.options) ? first.options : []
                if (firstOptions.length > 0) {
                    pushRow(rows, 'options', `${firstOptions.length}`)
                }

                for (let idx = 1; idx < questions.length; idx += 1) {
                    const question = questions[idx]
                    const n = idx + 1
                    pushRow(rows, `header_${n}`, getInputScalar(question, ['header']))
                    const questionText = getInputScalar(question, ['question'])
                    if (questionText) {
                        pushRow(rows, `question_${n}`, truncate(questionText, 160))
                    }
                    const options = Array.isArray(question.options) ? question.options : []
                    if (options.length > 0) {
                        pushRow(rows, `options_${n}`, `${options.length}`)
                    }
                }
            }
            break
        }
        default:
            return null
    }

    return rows.length > 0 ? rows : null
}

function renderParamRows(rows: ParamRow[]): ReactNode {
    return (
        <div className="space-y-0">
            {rows.map((row, idx) => (
                <ToolParamField
                    key={`${row.name}-${idx}`}
                    name={row.name}
                    value={row.value}
                    position={getToolParamFieldPosition(idx, rows.length)}
                />
            ))}
        </div>
    )
}

function renderEditInput(input: unknown): ReactNode | null {
    if (!isObject(input)) return null
    const oldString = getInputStringAny(input, ['old_string'])
    const newString = getInputStringAny(input, ['new_string'])
    if (oldString === null || newString === null) return null

    return (
        <DiffView
            oldString={oldString}
            newString={newString}
        />
    )
}

function renderNotebookEditInput(block: ToolCallBlock, metadata: SessionMetadataSummary | null): ReactNode {
    const { oldSource, newSource } = resolveNotebookEditDiffData(block.tool.input, block.tool.result)

    if (oldSource === null || newSource === null) {
        return <CodeBlock code={safeStringify(block.tool.input)} language="json" />
    }

    const rows = extractCoreToolParamRows(block, metadata)

    return (
        <div className="space-y-2">
            {rows ? renderParamRows(rows) : null}
            <DiffView
                oldString={oldSource}
                newString={newSource}
                variant="inline"
            />
        </div>
    )
}

export function renderToolInputContent(block: ToolCallBlock, metadata: SessionMetadataSummary | null): ReactNode {
    const toolName = block.tool.name
    const input = block.tool.input

    if (toolName === 'Bash' || toolName === 'CodexBash' || toolName === 'exec_command') {
        return <CodeBlock code={safeStringify(input)} language="json" />
    }

    if (toolName === 'Task' && isObject(input) && typeof input.prompt === 'string') {
        return <MarkdownRenderer content={input.prompt} />
    }

    if (toolName === 'Edit') {
        const diff = renderEditInput(input)
        if (diff) return diff
    }

    if (toolName === 'NotebookEdit') {
        return renderNotebookEditInput(block, metadata)
    }

    if (toolName === 'MultiEdit' && isObject(input)) {
        const filePath = getInputPath(input, metadata, ['file_path', 'path']) ?? undefined
        const edits = Array.isArray(input.edits) ? input.edits : null
        if (edits && edits.length > 0) {
            const rendered = edits
                .slice(0, 3)
                .map((edit, idx) => {
                    if (!isObject(edit)) return null
                    const oldString = getInputStringAny(edit, ['old_string'])
                    const newString = getInputStringAny(edit, ['new_string'])
                    if (oldString === null || newString === null) return null
                    return (
                        <div key={idx}>
                            <DiffView oldString={oldString} newString={newString} filePath={filePath} />
                        </div>
                    )
                })
                .filter(Boolean)

            if (rendered.length > 0) {
                return (
                    <div className="flex flex-col gap-2">
                        {rendered}
                        {edits.length > 3 ? (
                            <div className="text-xs text-[var(--app-hint)]">
                                (+{edits.length - 3} more edits)
                            </div>
                        ) : null}
                    </div>
                )
            }
        }
    }

    if (toolName === 'Write' && isObject(input)) {
        const filePath = getInputPath(input, metadata, ['file_path', 'path'])
        const content = getInputStringAny(input, ['content', 'text'])
        if (content !== null) {
            return (
                <div className="flex flex-col gap-2">
                    {filePath ? <ToolParamField name="file_path" value={filePath} /> : null}
                    <CodeBlock code={content} language="text" />
                </div>
            )
        }
    }

    if (toolName === 'Read' || toolName === 'NotebookRead') {
        const filePath = getInputPath(input, metadata, ['file_path', 'path', 'notebook_path'])
        if (filePath) return <ToolParamField name="file_path" value={filePath} />
    }

    if (toolName === 'CodexDiff' && isObject(input) && typeof input.unified_diff === 'string') {
        return <CodeBlock code={input.unified_diff} language="diff" />
    }

    const coreRows = extractCoreToolParamRows(block, metadata)
    if (coreRows) {
        return renderParamRows(coreRows)
    }

    return <CodeBlock code={safeStringify(input)} language="json" />
}
