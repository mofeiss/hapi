import type { ToolViewComponent, ToolViewProps } from '@/components/ToolCard/views/_all'
import { isObject, safeStringify } from '@hapi/protocol'
import { CodeBlock } from '@/components/CodeBlock'
import { basename, resolveDisplayPath } from '@/utils/path'

function parseToolUseError(message: string): { isToolUseError: boolean; errorMessage: string | null } {
    const regex = /<tool_use_error>(.*?)<\/tool_use_error>/s
    const match = message.match(regex)

    if (match) {
        return {
            isToolUseError: true,
            errorMessage: typeof match[1] === 'string' ? match[1].trim() : ''
        }
    }

    return { isToolUseError: false, errorMessage: null }
}

function extractTextFromContentBlock(block: unknown): string | null {
    if (typeof block === 'string') return block
    if (!isObject(block)) return null
    if (block.type === 'text' && typeof block.text === 'string') return block.text
    if (typeof block.text === 'string') return block.text
    return null
}

const SYSTEM_REMINDER_BLOCK_REGEX = /<system-reminder>[\s\S]*?<\/system-reminder>/gi
const READ_LINE_NUMBER_PREFIX_REGEX = /^\s*\d+\s*→\s?/

export function sanitizeToolResultText(text: string): string {
    const toolUseError = parseToolUseError(text)
    const unwrapped = toolUseError.isToolUseError ? (toolUseError.errorMessage ?? '') : text
    return unwrapped
        .replace(SYSTEM_REMINDER_BLOCK_REGEX, '')
        .replace(/\n[ \t]*\n[ \t]*\n+/g, '\n\n')
        .replace(/^[ \t]*\n/, '')
        .replace(/\n[ \t]*$/, '')
}

function stripReadLineNumberPrefixes(text: string): string {
    const lines = text.split('\n')
    let nonEmptyLines = 0
    let prefixedLines = 0

    for (const line of lines) {
        if (line.trim().length === 0) continue
        nonEmptyLines += 1
        if (READ_LINE_NUMBER_PREFIX_REGEX.test(line)) {
            prefixedLines += 1
        }
    }

    // Only strip when line-number prefixes dominate, avoiding accidental content loss.
    if (nonEmptyLines === 0 || (prefixedLines / nonEmptyLines) < 0.6) {
        return text
    }

    return lines.map((line) => line.replace(READ_LINE_NUMBER_PREFIX_REGEX, '')).join('\n')
}

export function sanitizeReadResultText(text: string): string {
    const sanitized = sanitizeToolResultText(text)
    return stripReadLineNumberPrefixes(sanitized)
}

function extractTextFromResult(result: unknown, depth: number = 0): string | null {
    if (depth > 2) return null
    if (result === null || result === undefined) return null
    if (typeof result === 'string') {
        return sanitizeToolResultText(result)
    }

    if (Array.isArray(result)) {
        const parts = result
            .map(extractTextFromContentBlock)
            .filter((part): part is string => typeof part === 'string' && part.length > 0)
        return parts.length > 0 ? sanitizeToolResultText(parts.join('\n')) : null
    }

    if (!isObject(result)) return null

    if (typeof result.content === 'string') return sanitizeToolResultText(result.content)
    if (typeof result.text === 'string') return sanitizeToolResultText(result.text)
    if (typeof result.output === 'string') return sanitizeToolResultText(result.output)
    if (typeof result.error === 'string') return sanitizeToolResultText(result.error)
    if (typeof result.message === 'string') return sanitizeToolResultText(result.message)

    const contentArray = Array.isArray(result.content) ? result.content : null
    if (contentArray) {
        const parts = contentArray
            .map(extractTextFromContentBlock)
            .filter((part): part is string => typeof part === 'string' && part.length > 0)
        return parts.length > 0 ? sanitizeToolResultText(parts.join('\n')) : null
    }

    const nestedOutput = isObject(result.output) ? result.output : null
    if (nestedOutput) {
        if (typeof nestedOutput.content === 'string') return sanitizeToolResultText(nestedOutput.content)
        if (typeof nestedOutput.text === 'string') return sanitizeToolResultText(nestedOutput.text)
    }

    const nestedError = isObject(result.error) ? result.error : null
    if (nestedError) {
        if (typeof nestedError.message === 'string') return sanitizeToolResultText(nestedError.message)
        if (typeof nestedError.error === 'string') return sanitizeToolResultText(nestedError.error)
    }

    const nestedResult = isObject(result.result) ? result.result : null
    if (nestedResult) {
        const nestedText = extractTextFromResult(nestedResult, depth + 1)
        if (nestedText) return nestedText
    }

    const nestedData = isObject(result.data) ? result.data : null
    if (nestedData) {
        const nestedText = extractTextFromResult(nestedData, depth + 1)
        if (nestedText) return nestedText
    }

    return null
}

interface CodexBashOutput {
    exitCode: number | null
    wallTime: string | null
    output: string
}

function parseCodexBashOutput(text: string): CodexBashOutput | null {
    const exitMatch = text.match(/^Exit code:\s*(\d+)/m)
    const wallMatch = text.match(/^Wall time:\s*(.+)$/m)
    const outputMatch = text.match(/^Output:\n([\s\S]*)$/m)

    if (!exitMatch && !wallMatch && !outputMatch) return null

    return {
        exitCode: exitMatch ? parseInt(exitMatch[1], 10) : null,
        wallTime: wallMatch ? wallMatch[1].trim() : null,
        output: outputMatch ? outputMatch[1] : text
    }
}

function looksLikeHtml(text: string): boolean {
    const trimmed = text.trimStart()
    return trimmed.startsWith('<!DOCTYPE') || trimmed.startsWith('<html') || trimmed.startsWith('<div') || trimmed.startsWith('<span')
}

function looksLikeJson(text: string): boolean {
    const trimmed = text.trim()
    return (trimmed.startsWith('{') && trimmed.endsWith('}')) || (trimmed.startsWith('[') && trimmed.endsWith(']'))
}

function renderText(text: string, opts: { mode: 'markdown' | 'code' | 'auto'; language?: string } = { mode: 'auto' }) {
    if (opts.mode === 'code') {
        return <CodeBlock code={text} language={opts.language ?? 'text'} />
    }

    if (opts.mode === 'markdown') {
        return <CodeBlock code={text} language="markdown" />
    }

    if (looksLikeJson(text)) {
        return <CodeBlock code={text} language="json" />
    }

    if (looksLikeHtml(text)) {
        return <CodeBlock code={text} language="html" />
    }

    return <CodeBlock code={text} language="text" />
}

function placeholderForState(state: ToolViewProps['block']['tool']['state']): string {
    if (state === 'pending') return 'Waiting for permission…'
    if (state === 'running') return 'Running…'
    return '(no output)'
}

function RawJsonDevOnly(props: { value: unknown }) {
    void props
    return null
}

function extractStdoutStderr(result: unknown): { stdout: string | null; stderr: string | null } | null {
    if (!isObject(result)) return null

    const stdout = typeof result.stdout === 'string' ? result.stdout : null
    const stderr = typeof result.stderr === 'string' ? result.stderr : null
    if (stdout !== null || stderr !== null) {
        return { stdout, stderr }
    }

    const nested = isObject(result.output) ? result.output : null
    if (nested) {
        const nestedStdout = typeof nested.stdout === 'string' ? nested.stdout : null
        const nestedStderr = typeof nested.stderr === 'string' ? nested.stderr : null
        if (nestedStdout !== null || nestedStderr !== null) {
            return { stdout: nestedStdout, stderr: nestedStderr }
        }
    }

    return null
}

function extractReadFileContent(result: unknown): { filePath: string | null; content: string } | null {
    if (!isObject(result)) return null
    const file = isObject(result.file) ? result.file : null
    if (!file) return null

    const content = typeof file.content === 'string' ? file.content : null
    if (content === null) return null

    const filePath = typeof file.filePath === 'string'
        ? file.filePath
        : typeof file.file_path === 'string'
            ? file.file_path
            : null

    return { filePath, content }
}

function extractLineList(text: string): string[] {
    return text
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line.length > 0)
}

const AskUserQuestionResultView: ToolViewComponent = (props: ToolViewProps) => {
    const answers = props.block.tool.permission?.answers ?? null

    // If answers exist, AskUserQuestionView already shows them with highlighting
    // Return null to avoid duplicate display
    if (answers && Object.keys(answers).length > 0) {
        return null
    }

    // Fallback for tools without structured answers
    return <MarkdownResultView {...props} />
}

const BashResultView: ToolViewComponent = (props: ToolViewProps) => {
    const result = props.block.tool.result

    if (result === undefined || result === null) {
        return <div className="text-sm text-[var(--app-hint)]">{placeholderForState(props.block.tool.state)}</div>
    }

    if (typeof result === 'string') {
        const display = sanitizeToolResultText(result)
        return (
            <>
                <CodeBlock code={display} language="text" />
                <RawJsonDevOnly value={result} />
            </>
        )
    }

    const stdio = extractStdoutStderr(result)
    if (stdio) {
        return (
            <>
                <div className="flex flex-col gap-2">
                    {stdio.stdout ? <CodeBlock code={stdio.stdout} language="text" /> : null}
                    {stdio.stderr ? <CodeBlock code={stdio.stderr} language="text" /> : null}
                </div>
                <RawJsonDevOnly value={result} />
            </>
        )
    }

    const text = extractTextFromResult(result)
    if (text) {
        return (
            <>
                {renderText(text, { mode: 'code', language: 'text' })}
                <RawJsonDevOnly value={result} />
            </>
        )
    }

    return (
        <>
            <div className="text-sm text-[var(--app-hint)]">(no output)</div>
            <RawJsonDevOnly value={result} />
        </>
    )
}

const MarkdownResultView: ToolViewComponent = (props: ToolViewProps) => {
    const result = props.block.tool.result

    if (result === undefined || result === null) {
        return <div className="text-sm text-[var(--app-hint)]">{placeholderForState(props.block.tool.state)}</div>
    }

    const text = extractTextFromResult(result)
    if (text) {
        return (
            <>
                {renderText(text, { mode: 'auto' })}
                <RawJsonDevOnly value={result} />
            </>
        )
    }

    return (
        <>
            <div className="text-sm text-[var(--app-hint)]">(no output)</div>
            <RawJsonDevOnly value={result} />
        </>
    )
}

const WebFetchResultView: ToolViewComponent = (props: ToolViewProps) => {
    const result = props.block.tool.result

    if (result === undefined || result === null) {
        return <div className="text-sm text-[var(--app-hint)]">{placeholderForState(props.block.tool.state)}</div>
    }

    if (typeof result === 'string') {
        return (
            <>
                <CodeBlock code={sanitizeToolResultText(result)} language="text" />
                <RawJsonDevOnly value={result} />
            </>
        )
    }

    const text = extractTextFromResult(result)
    if (text) {
        return (
            <>
                <CodeBlock code={text} language="text" />
                <RawJsonDevOnly value={result} />
            </>
        )
    }

    return (
        <>
            <CodeBlock code={safeStringify(result)} language="json" />
            <RawJsonDevOnly value={result} />
        </>
    )
}

const LineListResultView: ToolViewComponent = (props: ToolViewProps) => {
    const result = props.block.tool.result

    if (result === undefined || result === null) {
        return <div className="text-sm text-[var(--app-hint)]">{placeholderForState(props.block.tool.state)}</div>
    }

    const text = extractTextFromResult(result)
    if (!text) {
        return (
            <>
                <div className="text-sm text-[var(--app-hint)]">(no output)</div>
                <RawJsonDevOnly value={result} />
            </>
        )
    }

    const lines = extractLineList(text)
    if (lines.length === 0) {
        return (
            <>
                <div className="text-sm text-[var(--app-hint)]">(no output)</div>
                <RawJsonDevOnly value={result} />
            </>
        )
    }

    return (
        <>
            <CodeBlock code={lines.join('\n')} language="text" />
            <RawJsonDevOnly value={result} />
        </>
    )
}

const ReadResultView: ToolViewComponent = (props: ToolViewProps) => {
    const result = props.block.tool.result

    if (result === undefined || result === null) {
        return <div className="text-sm text-[var(--app-hint)]">{placeholderForState(props.block.tool.state)}</div>
    }

    const file = extractReadFileContent(result)
    if (file) {
        const sanitizedContent = sanitizeReadResultText(file.content)
        const path = file.filePath ? resolveDisplayPath(file.filePath, props.metadata) : null
        return (
            <>
                {path ? (
                    <div className="mb-2 text-xs text-[var(--app-hint)] font-mono break-all">
                        {basename(path)}
                    </div>
                ) : null}
                <CodeBlock code={sanitizedContent} language="text" showLineNumbers />
                <RawJsonDevOnly value={result} />
            </>
        )
    }

    const text = extractTextFromResult(result)
    if (text) {
        const sanitizedText = sanitizeReadResultText(text)
        if (sanitizedText.trim().length === 0) {
            return (
                <>
                    <div className="text-sm text-[var(--app-hint)]">(no output)</div>
                    <RawJsonDevOnly value={result} />
                </>
            )
        }
        return (
            <>
                <CodeBlock code={sanitizedText} language="text" showLineNumbers />
                <RawJsonDevOnly value={result} />
            </>
        )
    }

    return (
        <>
            <div className="text-sm text-[var(--app-hint)]">(no output)</div>
            <RawJsonDevOnly value={result} />
        </>
    )
}

const MutationResultView: ToolViewComponent = (props: ToolViewProps) => {
    const { state, result } = props.block.tool

    if (result === undefined || result === null) {
        return <div className="text-sm text-[var(--app-hint)]">{placeholderForState(state)}</div>
    }

    // Keep Edit result display aligned with Steps raw content:
    // parse and strip <tool_use_error> wrapper, keep raw message body.
    if (props.block.tool.name === 'Edit' && typeof result === 'string') {
        const display = sanitizeToolResultText(result)
        return (
            <>
                <CodeBlock code={display} language="text" />
                <RawJsonDevOnly value={result} />
            </>
        )
    }

    // Keep Write card result aligned with Steps result style.
    if (props.block.tool.name === 'Write') {
        return (
            <>
                <CodeBlock
                    code={safeStringify(result)}
                    language={typeof result === 'string' ? 'text' : 'json'}
                />
                <RawJsonDevOnly value={result} />
            </>
        )
    }

    const text = extractTextFromResult(result)
    if (typeof text === 'string' && text.trim().length > 0) {
        return (
            <>
                {renderText(text, { mode: state === 'error' ? 'code' : 'auto' })}
                <RawJsonDevOnly value={result} />
            </>
        )
    }

    return (
        <>
            <div className="text-sm text-[var(--app-hint)]">(no output)</div>
            <RawJsonDevOnly value={result} />
        </>
    )
}

const CodexPatchResultView: ToolViewComponent = (props: ToolViewProps) => {
    const result = props.block.tool.result
    const text = extractTextFromResult(result)
    if (text) {
        return (
            <>
                {renderText(text, { mode: 'auto' })}
                <RawJsonDevOnly value={result} />
            </>
        )
    }

    if (result === undefined || result === null) {
        return <div className="text-sm text-[var(--app-hint)]">{placeholderForState(props.block.tool.state)}</div>
    }

    return (
        <>
            <div className="text-sm text-[var(--app-hint)]">(no output)</div>
            <RawJsonDevOnly value={result} />
        </>
    )
}

const CodexReasoningResultView: ToolViewComponent = (props: ToolViewProps) => {
    const result = props.block.tool.result
    if (result === undefined || result === null) {
        return <div className="text-sm text-[var(--app-hint)]">{placeholderForState(props.block.tool.state)}</div>
    }

    const text = extractTextFromResult(result)
    if (text) {
        return (
            <>
                {renderText(text, { mode: 'auto' })}
                <RawJsonDevOnly value={result} />
            </>
        )
    }

    return (
        <>
            <div className="text-sm text-[var(--app-hint)]">(no output)</div>
            <RawJsonDevOnly value={result} />
        </>
    )
}

const CodexDiffResultView: ToolViewComponent = (props: ToolViewProps) => {
    const result = props.block.tool.result
    if (result === undefined || result === null) {
        return <div className="text-sm text-[var(--app-hint)]">{placeholderForState(props.block.tool.state)}</div>
    }

    const text = extractTextFromResult(result)
    if (text) {
        return (
            <>
                {renderText(text, { mode: 'code', language: 'diff' })}
                <RawJsonDevOnly value={result} />
            </>
        )
    }

    return (
        <>
            <div className="text-sm text-[var(--app-hint)]">(no output)</div>
            <RawJsonDevOnly value={result} />
        </>
    )
}

type TodoItem = {
    id?: string
    content?: string
    status?: 'pending' | 'in_progress' | 'completed'
    priority?: 'high' | 'medium' | 'low'
}

function extractTodos(input: unknown, result: unknown): TodoItem[] {
    const todosFromInput = isObject(input) && Array.isArray(input.todos)
        ? input.todos.filter(isObject)
        : []
    if (todosFromInput.length > 0) {
        return todosFromInput.map((t) => ({
            id: typeof t.id === 'string' ? t.id : undefined,
            content: typeof t.content === 'string' ? t.content : undefined,
            status: t.status === 'pending' || t.status === 'in_progress' || t.status === 'completed' ? t.status : undefined,
            priority: t.priority === 'high' || t.priority === 'medium' || t.priority === 'low' ? t.priority : undefined
        }))
    }

    const newTodos = isObject(result) && Array.isArray(result.newTodos)
        ? result.newTodos.filter(isObject)
        : []
    return newTodos.map((t) => ({
        id: typeof t.id === 'string' ? t.id : undefined,
        content: typeof t.content === 'string' ? t.content : undefined,
        status: t.status === 'pending' || t.status === 'in_progress' || t.status === 'completed' ? t.status : undefined,
        priority: t.priority === 'high' || t.priority === 'medium' || t.priority === 'low' ? t.priority : undefined
    }))
}

function todoIcon(todo: TodoItem): string {
    if (todo.status === 'completed') return '☑'
    return '☐'
}

const TodoWriteResultView: ToolViewComponent = (props: ToolViewProps) => {
    const todos = extractTodos(props.block.tool.input, props.block.tool.result)
    if (todos.length === 0) {
        return <div className="text-sm text-[var(--app-hint)]">{placeholderForState(props.block.tool.state)}</div>
    }

    const lines = todos.map((todo) => {
        const text = todo.content?.trim() ? todo.content.trim() : '(empty)'
        return `${todoIcon(todo)} ${text}`
    })

    return (
        <CodeBlock code={lines.join('\n')} language="text" />
    )
}

const RawResultView: ToolViewComponent = (props: ToolViewProps) => {
    const result = props.block.tool.result

    if (result === undefined || result === null) {
        return <div className="text-sm text-[var(--app-hint)]">{placeholderForState(props.block.tool.state)}</div>
    }

    if (typeof result === 'string') {
        return (
            <>
                <CodeBlock code={sanitizeToolResultText(result)} language="text" />
                <RawJsonDevOnly value={result} />
            </>
        )
    }

    return (
        <>
            <CodeBlock code={safeStringify(result)} language="json" />
            <RawJsonDevOnly value={result} />
        </>
    )
}

const GenericResultView: ToolViewComponent = (props: ToolViewProps) => {
    const result = props.block.tool.result

    if (result === undefined || result === null) {
        return <div className="text-sm text-[var(--app-hint)]">{placeholderForState(props.block.tool.state)}</div>
    }

    // Detect codex bash output format and render accordingly
    if (typeof result === 'string') {
        const parsed = parseCodexBashOutput(sanitizeToolResultText(result))
        if (parsed) {
            return (
                <>
                    <div className="text-xs text-[var(--app-hint)] mb-2">
                        {parsed.exitCode !== null && `Exit code: ${parsed.exitCode}`}
                        {parsed.exitCode !== null && parsed.wallTime && ' · '}
                        {parsed.wallTime && `Wall time: ${parsed.wallTime}`}
                    </div>
                    {renderText(parsed.output.trim(), { mode: 'code' })}
                    <RawJsonDevOnly value={result} />
                </>
            )
        }
    }

    const text = extractTextFromResult(result)
    if (text) {
        return (
            <>
                {renderText(text, { mode: 'auto' })}
                {typeof result === 'object' ? <RawJsonDevOnly value={result} /> : null}
            </>
        )
    }

    if (typeof result === 'string') {
        return renderText(sanitizeToolResultText(result), { mode: 'auto' })
    }

    return <CodeBlock code={safeStringify(result)} language="json" />
}

export const toolResultViewRegistry: Record<string, ToolViewComponent> = {
    Task: MarkdownResultView,
    Bash: BashResultView,
    Glob: LineListResultView,
    Grep: LineListResultView,
    LS: LineListResultView,
    Read: ReadResultView,
    Edit: MutationResultView,
    MultiEdit: MutationResultView,
    Write: MutationResultView,
    Agent: RawResultView,
    Skill: RawResultView,
    WebFetch: WebFetchResultView,
    WebSearch: MarkdownResultView,
    NotebookRead: ReadResultView,
    NotebookEdit: RawResultView,
    TodoWrite: TodoWriteResultView,
    TaskOutput: RawResultView,
    TaskStop: RawResultView,
    EnterPlanMode: RawResultView,
    EnterWorktree: RawResultView,
    TeamCreate: RawResultView,
    TeamDelete: RawResultView,
    SendMessage: RawResultView,
    ListMcpResourcesTool: RawResultView,
    ReadMcpResourceTool: RawResultView,
    CodexReasoning: CodexReasoningResultView,
    CodexPatch: CodexPatchResultView,
    CodexDiff: CodexDiffResultView,
    AskUserQuestion: AskUserQuestionResultView,
    ExitPlanMode: MarkdownResultView,
    ask_user_question: AskUserQuestionResultView,
    exit_plan_mode: MarkdownResultView
}

export function getToolResultViewComponent(toolName: string): ToolViewComponent {
    if (toolName.startsWith('mcp__')) {
        return GenericResultView
    }
    return toolResultViewRegistry[toolName] ?? GenericResultView
}
