import { useEffect, useState } from 'react'
import type { ToolViewComponent, ToolViewProps } from '@/components/ToolCard/views/_all'
import { isObject, safeStringify } from '@hapi/protocol'
import { CodeBlock } from '@/components/CodeBlock'
import { DisclosureChevron, DisclosureRail } from '@/components/Disclosure'
import { CopyIcon, CheckIcon } from '@/components/icons'
import { MarkdownRenderer } from '@/components/MarkdownRenderer'
import { TodoList } from '@/components/TodoPanel'
import { ToolParamField } from '@/components/ToolCard/ToolParamField'
import { parseAskUserQuestionInput } from '@/components/ToolCard/askUserQuestion'
import { EyeIcon, TerminalIcon } from '@/components/ToolCard/icons'
import { resolveNotebookEditDiffData } from '@/components/ToolCard/views/notebookEditDiff'
import { useCopyToClipboard } from '@/hooks/useCopyToClipboard'
import { extractSkillReadData } from '@/lib/skillRead'
import { extractToolTodos } from '@/lib/todos'
import { useTranslation } from '@/lib/use-translation'
import { cn } from '@/lib/utils'
import { resolveDisplayPath } from '@/utils/path'

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

function extractMessageFromStructuredResult(result: unknown, depth: number = 0): string | null {
    if (depth > 4) return null

    if (Array.isArray(result)) {
        for (const item of result) {
            const message = extractMessageFromStructuredResult(item, depth + 1)
            if (message) return message
        }
        return null
    }

    if (!isObject(result)) return null

    if (typeof result.message === 'string') {
        const message = sanitizeToolResultText(result.message).trim()
        if (message.length > 0) return message
    }

    const nestedKeys = ['error', 'errors', 'issues', 'details', 'result', 'data', 'output', 'content']
    for (const key of nestedKeys) {
        const message = extractMessageFromStructuredResult(result[key], depth + 1)
        if (message) return message
    }

    return null
}

function parseJsonValue(text: string): unknown | null {
    try {
        return JSON.parse(text)
    } catch {
        return null
    }
}

export function extractPlanModeMessage(result: unknown): string | null {
    if (result === null || result === undefined) return null

    const directMessage = extractMessageFromStructuredResult(result)
    if (directMessage) return directMessage

    if (typeof result !== 'string') return null

    const raw = sanitizeToolResultText(result)
    const trimmed = raw.trim()
    if (trimmed.length === 0) return null

    const directParsed = parseJsonValue(trimmed)
    if (directParsed) {
        const parsedMessage = extractMessageFromStructuredResult(directParsed)
        if (parsedMessage) return parsedMessage
    }

    const separatorIndex = trimmed.indexOf(':')
    if (separatorIndex >= 0) {
        const suffix = trimmed.slice(separatorIndex + 1).trim()
        if (suffix.startsWith('{') || suffix.startsWith('[')) {
            const parsedSuffix = parseJsonValue(suffix)
            if (parsedSuffix) {
                const parsedMessage = extractMessageFromStructuredResult(parsedSuffix)
                if (parsedMessage) return parsedMessage
            }
        }
    }

    const messageMatch = trimmed.match(/"message"\s*:\s*"((?:\\.|[^"\\])*)"/)
    if (messageMatch?.[1]) {
        try {
            const decoded = JSON.parse(`"${messageMatch[1]}"`)
            if (typeof decoded === 'string') {
                const normalized = sanitizeToolResultText(decoded).trim()
                if (normalized.length > 0) return normalized
            }
        } catch {
            // ignore malformed escape sequences and fall back to raw rendering.
        }
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

function countVisibleLines(text: string): number {
    const normalized = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
    const lines = normalized.split('\n')
    while (lines.length > 1 && lines[lines.length - 1]?.trim().length === 0) {
        lines.pop()
    }
    return lines.length
}

function hasToolUseErrorResult(result: unknown): boolean {
    if (typeof result === 'string') {
        return parseToolUseError(result).isToolUseError
    }
    if (!isObject(result)) return false

    const candidates: unknown[] = [
        result.content,
        result.text,
        result.output,
        result.error,
        result.message
    ]

    for (const candidate of candidates) {
        if (typeof candidate === 'string' && parseToolUseError(candidate).isToolUseError) {
            return true
        }
    }

    return false
}

type PreviewMode = 'source' | 'markdown'

function MarkdownPreviewActions(props: {
    copyText: string
    mode: PreviewMode
    canToggleMode: boolean
    onToggleMode?: () => void
    centered: boolean
}) {
    const { t } = useTranslation()
    const { copied, copy } = useCopyToClipboard()

    return (
        <div
            className={cn(
                'absolute right-1.5 z-10 flex items-center gap-0.5',
                props.centered ? 'top-1/2 -translate-y-1/2' : 'top-1.5'
            )}
        >
            {props.canToggleMode ? (
                <button
                    type="button"
                    onClick={props.onToggleMode}
                    className="rounded p-1 text-[var(--app-hint)] hover:bg-[var(--app-subtle-bg)] hover:text-[var(--app-fg)] transition-colors"
                    title={props.mode === 'source' ? t('tool.viewMarkdown') : t('tool.viewSource')}
                    aria-label={props.mode === 'source' ? t('tool.viewMarkdown') : t('tool.viewSource')}
                >
                    {props.mode === 'source' ? (
                        <EyeIcon className="h-3.5 w-3.5" />
                    ) : (
                        <TerminalIcon className="h-3.5 w-3.5" />
                    )}
                </button>
            ) : null}
            <button
                type="button"
                onClick={() => copy(props.copyText)}
                className="rounded p-1 text-[var(--app-hint)] hover:bg-[var(--app-subtle-bg)] hover:text-[var(--app-fg)] transition-colors"
                title={t('code.copy')}
                aria-label={t('code.copy')}
            >
                {copied ? <CheckIcon className="h-3.5 w-3.5" /> : <CopyIcon className="h-3.5 w-3.5" />}
            </button>
        </div>
    )
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

function extractReadInputPath(input: unknown, metadata: ToolViewProps['metadata']): string | null {
    if (!isObject(input)) return null

    const rawPath = typeof input.file_path === 'string'
        ? input.file_path
        : typeof input.path === 'string'
            ? input.path
            : typeof input.filePath === 'string'
                ? input.filePath
                : typeof input.notebook_path === 'string'
                    ? input.notebook_path
                    : null

    return rawPath ? resolveDisplayPath(rawPath, metadata) : null
}

export function isMarkdownFilePath(path: string | null | undefined): boolean {
    if (typeof path !== 'string') return false
    const normalized = path.trim().toLowerCase()
    return normalized.endsWith('.md') || normalized.endsWith('.markdown')
}

function extractLineList(text: string): string[] {
    return text
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line.length > 0)
}

type McpResourceListEntry = {
    server: string | null
    name: string | null
    description: string | null
}

type McpResourceServerGroup = {
    server: string
    resources: Array<{
        name: string | null
        description: string | null
    }>
}

function normalizeMcpResourceField(value: unknown): string | null {
    if (typeof value !== 'string') return null
    const normalized = sanitizeToolResultText(value).replace(/\s+/g, ' ').trim()
    return normalized.length > 0 ? normalized : null
}

function extractMcpResourceListEntry(value: unknown): McpResourceListEntry | null {
    if (!isObject(value)) return null

    const name = normalizeMcpResourceField(value.name)
    const description = normalizeMcpResourceField(value.description)
    const isResourceLike = name !== null
        || description !== null
        || typeof value.uri === 'string'
        || typeof value.mimeType === 'string'
        || typeof value.server === 'string'

    if (!isResourceLike) return null

    return {
        server: normalizeMcpResourceField(value.server),
        name,
        description
    }
}

export function shouldUseGroupedMcpResourceListLayout(input: unknown): boolean {
    return isObject(input) && Object.keys(input).length === 0
}

export function extractMcpResourceListEntries(result: unknown, depth: number = 0): McpResourceListEntry[] | null {
    if (depth > 4 || result === null || result === undefined) return null

    if (typeof result === 'string') {
        const normalized = sanitizeToolResultText(result).trim()
        if (!normalized.startsWith('[') && !normalized.startsWith('{')) return null
        const parsed = parseJsonValue(normalized)
        return parsed ? extractMcpResourceListEntries(parsed, depth + 1) : null
    }

    if (Array.isArray(result)) {
        const entries = result
            .map(extractMcpResourceListEntry)
            .filter((entry): entry is McpResourceListEntry => entry !== null)

        if (entries.length > 0) return entries
        return result.length === 0 ? [] : null
    }

    if (!isObject(result)) return null

    const nestedCandidates: unknown[] = [
        result.resources,
        result.result,
        result.data,
        result.output,
        result.content
    ]

    for (const candidate of nestedCandidates) {
        const entries = extractMcpResourceListEntries(candidate, depth + 1)
        if (entries !== null) return entries
    }

    return null
}

export function groupMcpResourceListEntries(entries: McpResourceListEntry[]): McpResourceServerGroup[] {
    const groups = new Map<string, McpResourceServerGroup>()
    const orderedServers: string[] = []

    for (const entry of entries) {
        if (entry.name === null && entry.description === null) continue

        const server = entry.server ?? 'Unknown server'
        let group = groups.get(server)
        if (!group) {
            group = { server, resources: [] }
            groups.set(server, group)
            orderedServers.push(server)
        }

        group.resources.push({
            name: entry.name,
            description: entry.description
        })
    }

    return orderedServers
        .map((server) => groups.get(server))
        .filter((group): group is McpResourceServerGroup => group !== undefined && group.resources.length > 0)
}

export function extractMcpResourceServerGroups(result: unknown): McpResourceServerGroup[] | null {
    const entries = extractMcpResourceListEntries(result)
    if (entries === null) return null

    const groups = groupMcpResourceListEntries(entries)
    if (groups.length > 0 || entries.length === 0) return groups
    return null
}

function McpServerNodeStatusIcon(props: { state: ToolViewProps['block']['tool']['state'] }) {
    if (props.state === 'completed') {
        return (
            <svg className="h-3.5 w-3.5 text-emerald-600" viewBox="0 0 16 16" fill="none">
                <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.5" />
                <path d="M5.2 8.3l1.8 1.8 3.8-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
        )
    }
    if (props.state === 'error') {
        return (
            <svg className="h-3.5 w-3.5 text-red-600" viewBox="0 0 16 16" fill="none">
                <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.5" />
                <path d="M5.6 5.6l4.8 4.8M10.4 5.6l-4.8 4.8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
        )
    }
    if (props.state === 'pending') {
        return (
            <svg className="h-3.5 w-3.5 text-amber-600" viewBox="0 0 16 16" fill="none">
                <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.5" />
            </svg>
        )
    }
    return (
        <svg className="h-3.5 w-3.5 animate-spin text-amber-600" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2.5" opacity="0.25" />
            <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" opacity="0.75" />
        </svg>
    )
}

function formatMcpResourceCount(count: number): string {
    return count === 1 ? '1 resource' : `${count} resources`
}

function renderMcpResourceRows(entries: McpResourceListEntry[]) {
    return (
        <div className="space-y-2">
            {entries.map((resource, idx) => (
                <div key={`${resource.server ?? 'server'}-${resource.name ?? 'resource'}-${idx}`} className="space-y-0">
                    {resource.name ? <ToolParamField name="name" value={resource.name} /> : null}
                    {resource.description ? <ToolParamField name="description" value={resource.description} /> : null}
                </div>
            ))}
        </div>
    )
}

function NotebookEditStatsBar(props: { oldSource: string; newSource: string }) {
    const oldChars = props.oldSource.length
    const newChars = props.newSource.length
    const label = `old: ${oldChars.toLocaleString()} chars → new: ${newChars.toLocaleString()} chars`

    return (
        <div className="tool-plain-surface overflow-hidden rounded-md border border-[var(--app-border)] bg-[var(--app-subtle-bg)]">
            <div className="px-2 py-2">
                <div className="min-w-0 font-mono text-xs text-[var(--app-hint)] truncate">
                    {label}
                </div>
            </div>
        </div>
    )
}

const NotebookEditResultView: ToolViewComponent = (props: ToolViewProps) => {
    const result = props.block.tool.result

    if (result === undefined || result === null) {
        return <div className="text-sm text-[var(--app-hint)]">{placeholderForState(props.block.tool.state)}</div>
    }

    const { oldSource, newSource } = resolveNotebookEditDiffData(props.block.tool.input, result)
    if (oldSource !== null && newSource !== null) {
        return (
            <NotebookEditStatsBar
                oldSource={oldSource}
                newSource={newSource}
            />
        )
    }

    return <CodeBlock code={safeStringify(result)} language="json" />
}

const AskUserQuestionResultView: ToolViewComponent = (props: ToolViewProps) => {
    const answers = props.block.tool.permission?.answers ?? null
    const hasStructuredQuestions = parseAskUserQuestionInput(props.block.tool.input).questions.length > 0

    // If answers exist and payload is valid, AskUserQuestion view already renders them.
    // Return null to avoid duplicate display
    if (hasStructuredQuestions && answers && Object.keys(answers).length > 0) {
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
    const [readViewMode, setReadViewMode] = useState<PreviewMode>('source')
    const isReadErrorResult = props.block.tool.state === 'error' || hasToolUseErrorResult(result)

    useEffect(() => {
        setReadViewMode('source')
    }, [props.block.id])

    if (result === undefined || result === null) {
        return <div className="text-sm text-[var(--app-hint)]">{placeholderForState(props.block.tool.state)}</div>
    }

    const file = extractReadFileContent(result)
    if (file) {
        const sanitizedContent = sanitizeReadResultText(file.content)
        const path = file.filePath
            ? resolveDisplayPath(file.filePath, props.metadata)
            : extractReadInputPath(props.block.tool.input, props.metadata)
        const isMarkdownReadFile = Boolean(path && isMarkdownFilePath(path))
        const canPreviewMarkdown = Boolean(
            isMarkdownReadFile
            && sanitizedContent.trim().length > 0
            && !isReadErrorResult
        )
        const toggleMode = () => {
            setReadViewMode((prev) => (prev === 'source' ? 'markdown' : 'source'))
        }

        return (
            <>
                {canPreviewMarkdown && readViewMode === 'markdown' ? (
                    <div className="relative min-w-0 max-w-full">
                        <MarkdownPreviewActions
                            copyText={sanitizedContent}
                            mode={readViewMode}
                            canToggleMode={canPreviewMarkdown}
                            onToggleMode={toggleMode}
                            centered={false}
                        />
                        <div className="tool-markdown-surface max-h-[48vh] overflow-auto rounded-md bg-[var(--app-bg)] p-3 pr-12">
                            <MarkdownRenderer content={sanitizedContent} />
                        </div>
                    </div>
                ) : canPreviewMarkdown ? (
                    <div className="relative min-w-0 max-w-full">
                        <MarkdownPreviewActions
                            copyText={sanitizedContent}
                            mode={readViewMode}
                            canToggleMode={canPreviewMarkdown}
                            onToggleMode={toggleMode}
                            centered={false}
                        />
                        <CodeBlock
                            code={sanitizedContent}
                            language="text"
                            showLineNumbers={!isMarkdownReadFile}
                            showCopyButton={false}
                            contentRightPaddingClassName="pr-14"
                        />
                    </div>
                ) : (
                    <CodeBlock code={sanitizedContent} language="text" showLineNumbers={!isMarkdownReadFile} />
                )}
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

const SkillResultView: ToolViewComponent = (props: ToolViewProps) => {
    const result = props.block.tool.result
    const [skillViewMode, setSkillViewMode] = useState<PreviewMode>('source')
    const isSkillErrorResult = props.block.tool.state === 'error' || hasToolUseErrorResult(result)
    const skillData = result === undefined || result === null
        ? null
        : extractSkillReadData(props.block.tool.input, result)
    const skillContent = typeof skillData?.content === 'string' ? sanitizeReadResultText(skillData.content) : null
    const canToggleSkillView = Boolean(
        skillContent
        && skillContent.trim().length > 0
        && !isSkillErrorResult
    )

    useEffect(() => {
        setSkillViewMode('source')
    }, [props.block.id])

    useEffect(() => {
        if (!canToggleSkillView && skillViewMode !== 'source') {
            setSkillViewMode('source')
        }
    }, [canToggleSkillView, skillViewMode])

    if (result === undefined || result === null) {
        return <div className="text-sm text-[var(--app-hint)]">{placeholderForState(props.block.tool.state)}</div>
    }

    if (skillContent && skillContent.trim().length > 0) {
        const toggleMode = () => {
            setSkillViewMode((prev) => (prev === 'source' ? 'markdown' : 'source'))
        }
        if (canToggleSkillView && skillViewMode === 'markdown') {
            return (
                <>
                    <div className="relative min-w-0 max-w-full">
                        <MarkdownPreviewActions
                            copyText={skillContent}
                            mode={skillViewMode}
                            canToggleMode={canToggleSkillView}
                            onToggleMode={toggleMode}
                            centered={false}
                        />
                        <div className="tool-markdown-surface max-h-[48vh] overflow-auto rounded-md bg-[var(--app-bg)] p-3 pr-12">
                            <MarkdownRenderer content={skillContent} />
                        </div>
                    </div>
                    <RawJsonDevOnly value={result} />
                </>
            )
        }

        const centeredActions = !canToggleSkillView && countVisibleLines(skillContent) <= 1

        return (
            <>
                <div className="relative min-w-0 max-w-full">
                    <MarkdownPreviewActions
                        copyText={skillContent}
                        mode={skillViewMode}
                        canToggleMode={canToggleSkillView}
                        onToggleMode={toggleMode}
                        centered={centeredActions}
                    />
                    <CodeBlock
                        code={skillContent}
                        language={isSkillErrorResult ? 'text' : 'markdown'}
                        showLineNumbers={false}
                        showCopyButton={false}
                        contentRightPaddingClassName={canToggleSkillView ? 'pr-14' : 'pr-8'}
                    />
                </div>
                <RawJsonDevOnly value={result} />
            </>
        )
    }

    const text = extractTextFromResult(result)
    if (text) {
        const sanitizedText = sanitizeReadResultText(text)
        if (sanitizedText.trim().length > 0) {
            const centeredActions = countVisibleLines(sanitizedText) <= 1
            return (
                <>
                    <div className="relative min-w-0 max-w-full">
                        <MarkdownPreviewActions
                            copyText={sanitizedText}
                            mode="source"
                            canToggleMode={false}
                            centered={centeredActions}
                        />
                        <CodeBlock
                            code={sanitizedText}
                            language="text"
                            showLineNumbers={false}
                            showCopyButton={false}
                            contentRightPaddingClassName="pr-8"
                        />
                    </div>
                    <RawJsonDevOnly value={result} />
                </>
            )
        }
    }

    if (typeof result !== 'string') {
        return (
            <>
                <CodeBlock code={safeStringify(result)} language="json" />
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

const TodoWriteResultView: ToolViewComponent = (props: ToolViewProps) => {
    const todos = extractToolTodos(props.block.tool.input, props.block.tool.result)
    if (todos.length === 0) {
        return <div className="text-sm text-[var(--app-hint)]">{placeholderForState(props.block.tool.state)}</div>
    }

    return (
        <TodoList todos={todos} variant="inline" />
    )
}

const ListMcpResourcesResultView: ToolViewComponent = (props: ToolViewProps) => {
    const { input, result, state } = props.block.tool
    const entries = extractMcpResourceListEntries(result)
    const [openServers, setOpenServers] = useState<Record<string, boolean>>({})
    const shouldUseGroupedLayout = shouldUseGroupedMcpResourceListLayout(input)

    useEffect(() => {
        setOpenServers({})
    }, [props.block.id])

    if (result === undefined || result === null) {
        return <div className="text-sm text-[var(--app-hint)]">{placeholderForState(state)}</div>
    }

    if (state === 'error' || hasToolUseErrorResult(result)) {
        return <RawResultView {...props} />
    }

    if (entries === null) {
        return <RawResultView {...props} />
    }

    const displayEntries = entries.filter((entry) => entry.name !== null || entry.description !== null)

    if (displayEntries.length === 0) {
        return (
            <>
                <div className="text-sm text-[var(--app-hint)]">0 resources</div>
                <RawJsonDevOnly value={result} />
            </>
        )
    }

    if (!shouldUseGroupedLayout) {
        return (
            <>
                {renderMcpResourceRows(displayEntries)}
                <RawJsonDevOnly value={result} />
            </>
        )
    }

    const groups = groupMcpResourceListEntries(displayEntries)

    return (
        <>
            <div className="space-y-0.5">
                {groups.map((group) => (
                    <div key={group.server} className="space-y-0.5">
                        <button
                            type="button"
                            className="flex w-full items-center gap-1.5 rounded px-1 py-0.5 text-left hover:bg-[var(--app-subtle-bg)]"
                            onClick={() => {
                                setOpenServers((prev) => ({
                                    ...prev,
                                    [group.server]: !prev[group.server]
                                }))
                            }}
                            aria-expanded={Boolean(openServers[group.server])}
                            aria-label={`Toggle ${group.server}`}
                        >
                            <span className="shrink-0 text-[var(--app-hint)]">
                                <DisclosureChevron open={Boolean(openServers[group.server])} />
                            </span>
                            <span className="shrink-0">
                                <McpServerNodeStatusIcon state={state} />
                            </span>
                            <span className="min-w-0 flex-1 truncate whitespace-nowrap">
                                <span className="text-sm text-[var(--app-fg)]">{group.server}</span>
                                <span className="ml-2 font-mono text-xs text-[var(--app-hint)]">
                                    {formatMcpResourceCount(group.resources.length)}
                                </span>
                            </span>
                        </button>

                        {openServers[group.server] ? (
                            <DisclosureRail level="inner" className="space-y-1">
                                {renderMcpResourceRows(group.resources.map((resource) => ({
                                    server: group.server,
                                    name: resource.name,
                                    description: resource.description
                                })))}
                            </DisclosureRail>
                        ) : null}
                    </div>
                ))}
            </div>
            <RawJsonDevOnly value={result} />
        </>
    )
}

const EnterPlanModeResultView: ToolViewComponent = (props: ToolViewProps) => {
    const { state, result } = props.block.tool

    if (result === undefined || result === null) {
        return <div className="text-sm text-[var(--app-hint)]">{placeholderForState(state)}</div>
    }

    const message = extractPlanModeMessage(result)
    if (message) {
        return (
            <>
                <CodeBlock code={message} language="text" />
                <RawJsonDevOnly value={result} />
            </>
        )
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

const ExitPlanModeResultView: ToolViewComponent = (props: ToolViewProps) => {
    const { t } = useTranslation()
    const { state, result } = props.block.tool

    if (state === 'completed') {
        return (
            <>
                <CodeBlock code={t('tool.exitPlanMode.success')} language="text" />
                <RawJsonDevOnly value={result} />
            </>
        )
    }

    if (state === 'error') {
        return (
            <>
                <CodeBlock code={t('tool.exitPlanMode.failed')} language="text" />
                <RawJsonDevOnly value={result} />
            </>
        )
    }

    if (result === undefined || result === null) {
        return <div className="text-sm text-[var(--app-hint)]">{placeholderForState(state)}</div>
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
    CodexBash: BashResultView,
    Glob: LineListResultView,
    Grep: LineListResultView,
    LS: LineListResultView,
    Read: ReadResultView,
    Edit: MutationResultView,
    MultiEdit: MutationResultView,
    Write: MutationResultView,
    Agent: RawResultView,
    Skill: SkillResultView,
    SkillRead: SkillResultView,
    WebFetch: WebFetchResultView,
    WebSearch: MarkdownResultView,
    NotebookRead: ReadResultView,
    NotebookEdit: NotebookEditResultView,
    TodoWrite: TodoWriteResultView,
    TaskOutput: RawResultView,
    TaskStop: RawResultView,
    EnterPlanMode: EnterPlanModeResultView,
    enter_plan_mode: EnterPlanModeResultView,
    EnterWorktree: RawResultView,
    TeamCreate: RawResultView,
    TeamDelete: RawResultView,
    SendMessage: RawResultView,
    ListMcpResourcesTool: ListMcpResourcesResultView,
    ReadMcpResourceTool: RawResultView,
    CodexReasoning: CodexReasoningResultView,
    CodexPatch: CodexPatchResultView,
    CodexDiff: CodexDiffResultView,
    AskUserQuestion: AskUserQuestionResultView,
    ExitPlanMode: ExitPlanModeResultView,
    ask_user_question: AskUserQuestionResultView,
    exit_plan_mode: ExitPlanModeResultView
}

export function getToolResultViewComponent(toolName: string): ToolViewComponent {
    if (toolName.startsWith('mcp__')) {
        return GenericResultView
    }
    return toolResultViewRegistry[toolName] ?? GenericResultView
}
