import { isObject } from '@hapi/protocol'

export type SkillReadData = {
    path: string | null
    skillName: string | null
    content: string | null
}

export type SkillPayloadFromText = {
    path: string | null
    content: string
}

const SKILL_STATUS_PLACEHOLDERS = [
    /^Launching skill:/i,
    /^Loading skill:/i,
    /^Using skill:/i
]

function normalizePath(path: string): string {
    return path.replace(/\\/g, '/').trim()
}

function trimQuotes(text: string): string {
    return text.replace(/^['"`]/, '').replace(/['"`]$/, '')
}

export function isSkillFilePath(path: string): boolean {
    const normalized = normalizePath(path)
    return /(^|\/)SKILL\.md$/i.test(normalized)
}

function skillNameFromPath(path: string | null): string | null {
    if (!path) return null
    const normalized = normalizePath(path)
    const parts = normalized.split('/').filter((part) => part.length > 0)
    if (parts.length < 2) return null
    const parent = parts[parts.length - 2]
    return parent.length > 0 ? parent : null
}

function skillNameFromInput(input: unknown): string | null {
    if (!isObject(input)) return null
    const direct = typeof input.skill === 'string' ? input.skill.trim() : ''
    if (direct.length > 0) return direct
    const byName = typeof input.name === 'string' ? input.name.trim() : ''
    if (byName.length > 0) return byName
    return null
}

function extractSkillPathFromCommand(command: string): string | null {
    const quoted = command.match(/['"`]([^'"`]*SKILL\.md)['"`]/i)
    if (quoted?.[1]) return normalizePath(trimQuotes(quoted[1]))

    const unquoted = command.match(/([^\s"'`|;&()]+SKILL\.md)\b/i)
    if (unquoted?.[1]) return normalizePath(trimQuotes(unquoted[1]))

    return null
}

function extractCommand(input: unknown): string | null {
    if (!isObject(input)) return null

    if (typeof input.command === 'string') return input.command
    if (Array.isArray(input.command)) {
        const parts = input.command.filter((part): part is string => typeof part === 'string')
        if (parts.length > 0) return parts.join(' ')
    }

    if (typeof input.cmd === 'string') return input.cmd
    if (typeof input.shellCommand === 'string') return input.shellCommand
    if (typeof input.rawCommand === 'string') return input.rawCommand

    return null
}

function extractPathFromInputFields(input: unknown): string | null {
    if (!isObject(input)) return null
    const fields = ['file_path', 'path', 'filePath', 'file', 'target']
    for (const field of fields) {
        const value = input[field]
        if (typeof value === 'string' && value.trim().length > 0 && isSkillFilePath(value)) {
            return normalizePath(value)
        }
    }
    return null
}

function extractPathFromParsedCommand(input: unknown): string | null {
    if (!isObject(input) || !Array.isArray(input.parsed_cmd)) return null
    for (const rawEntry of input.parsed_cmd) {
        if (!isObject(rawEntry)) continue
        const entryType = typeof rawEntry.type === 'string' ? rawEntry.type.toLowerCase() : ''
        const pathCandidates = [
            rawEntry.path,
            rawEntry.name,
            rawEntry.file,
            rawEntry.file_path,
            rawEntry.filePath
        ]
        const path = pathCandidates.find((item): item is string => typeof item === 'string' && item.length > 0)
        if (!path || !isSkillFilePath(path)) continue

        if (entryType === 'read' || entryType === 'search' || entryType === 'grep') {
            return normalizePath(path)
        }
    }
    return null
}

function commandLooksLikeSkillRead(command: string, skillPath: string | null): boolean {
    const lower = command.toLowerCase()
    const hasReadVerb = /\b(cat|sed|head|tail|less|more|wc|awk|grep|rg|bat)\b/.test(lower)
    const hasWriteVerb = /\b(rm|mv|cp|touch|tee|chmod|chown|truncate|dd)\b/.test(lower)
        || /\bgit\s+(add|mv|rm)\b/.test(lower)
        || /\bpython\d?\b[\s\S]*\b(write_text|write_bytes|open\([^)]*,\s*['"](?:w|a|x))/i.test(command)
        || /\bperl\b[\s\S]*\b(open|print)\s*[^#\n]*>>/i.test(command)

    if (hasWriteVerb) return false

    // Exclude explicit in-place edits.
    if (/\bsed\b[\s\S]*\s-i(\s|$)/i.test(command)) return false

    if (skillPath) {
        const escapedPath = skillPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        if (new RegExp(`>>?\\s*['"\`]?${escapedPath}['"\`]?`, 'i').test(command)) return false
        if (new RegExp(`\\btee\\b[\\s\\S]*${escapedPath}`, 'i').test(command)) return false
    }

    if (hasReadVerb) return true
    return skillPath !== null
}

export function isSkillReadTool(toolName: string, input: unknown, result?: unknown): boolean {
    if (toolName === 'Edit' || toolName === 'MultiEdit' || toolName === 'Write' || toolName === 'NotebookEdit') {
        return false
    }

    const lowerToolName = toolName.trim().toLowerCase()
    if (lowerToolName === 'skill' && skillNameFromInput(input)) {
        return true
    }

    const byPath = extractPathFromInputFields(input)
    if (byPath && (lowerToolName.includes('read') || lowerToolName === 'cat' || lowerToolName === 'view')) {
        return true
    }

    const byParsedCommand = extractPathFromParsedCommand(input)
    if (byParsedCommand) return true

    const command = extractCommand(input)
    const commandPath = command ? extractSkillPathFromCommand(command) : null
    if (command && commandPath && commandLooksLikeSkillRead(command, commandPath)) return true

    // Fallback: infer from result payload containing a skill file path.
    if (isObject(result)) {
        const file = isObject(result.file) ? result.file : null
        const filePath = typeof file?.filePath === 'string'
            ? file.filePath
            : typeof file?.file_path === 'string'
                ? file.file_path
                : null
        if (filePath && isSkillFilePath(filePath)) return true
    }

    return false
}

export function normalizeToolNameAsSkillRead(toolName: string, input: unknown, result?: unknown): string {
    return isSkillReadTool(toolName, input, result) ? 'SkillRead' : toolName
}

function extractTextFromArray(result: unknown[]): string | null {
    const chunks: string[] = []
    for (const item of result) {
        if (typeof item === 'string') {
            chunks.push(item)
            continue
        }
        if (!isObject(item)) continue
        if (typeof item.text === 'string') chunks.push(item.text)
        else if (item.type === 'text' && typeof item.text === 'string') chunks.push(item.text)
    }
    if (chunks.length === 0) return null
    return chunks.join('\n').trim()
}

function normalizeOutputText(raw: string): string {
    let text = raw
    const outputMatch = text.match(/^Exit code:\s*\d+[\s\S]*?\nOutput:\n([\s\S]*)$/m)
    if (outputMatch?.[1]) {
        text = outputMatch[1]
    }

    const lines = text.split('\n')
    while (lines.length > 0 && /^\s*\d+\s+.+SKILL\.md\s*$/i.test(lines[0] ?? '')) {
        lines.shift()
    }

    const normalized = lines.join('\n').trim()
    if (SKILL_STATUS_PLACEHOLDERS.some((pattern) => pattern.test(normalized))) {
        return ''
    }
    return normalized
}

export function extractSkillReadContent(result: unknown): string | null {
    if (result === null || result === undefined) return null
    if (typeof result === 'string') return normalizeOutputText(result)
    if (Array.isArray(result)) return extractTextFromArray(result)
    if (!isObject(result)) return null

    const file = isObject(result.file) ? result.file : null
    if (file && typeof file.content === 'string') {
        return normalizeOutputText(file.content)
    }

    if (typeof result.content === 'string') return normalizeOutputText(result.content)
    if (typeof result.output === 'string') return normalizeOutputText(result.output)
    if (typeof result.stdout === 'string') return normalizeOutputText(result.stdout)
    if (typeof result.text === 'string') return normalizeOutputText(result.text)

    if (Array.isArray(result.content)) {
        const fromArray = extractTextFromArray(result.content)
        if (fromArray) return normalizeOutputText(fromArray)
    }

    if (isObject(result.output)) {
        const nested = extractSkillReadContent(result.output)
        if (nested) return nested
    }

    if (isObject(result.result)) {
        const nested = extractSkillReadContent(result.result)
        if (nested) return nested
    }

    return null
}

export function extractSkillReadData(input: unknown, result: unknown): SkillReadData | null {
    const pathFromFields = extractPathFromInputFields(input)
    const pathFromParsed = extractPathFromParsedCommand(input)
    const command = extractCommand(input)
    const pathFromCommand = command ? extractSkillPathFromCommand(command) : null
    const path = pathFromFields ?? pathFromParsed ?? pathFromCommand

    const content = extractSkillReadContent(result)
    const skillName = skillNameFromPath(path) ?? skillNameFromInput(input)

    if (!path && !content && !skillName) return null

    return {
        path,
        skillName,
        content
    }
}

export function parseSkillPayloadText(text: string): SkillPayloadFromText | null {
    const normalized = text.replace(/\r\n/g, '\n')
    const marker = 'Base directory for this skill:'
    const markerIndex = normalized.indexOf(marker)
    if (markerIndex < 0) return null

    const start = markerIndex + marker.length
    const firstLineEnd = normalized.indexOf('\n', start)
    if (firstLineEnd < 0) return null

    const baseDir = normalized.slice(start, firstLineEnd).trim()
    if (baseDir.length === 0) return null

    const remainder = normalized.slice(firstLineEnd + 1).trimStart()
    if (remainder.length === 0) return null

    const path = normalizePath(`${baseDir}/SKILL.md`)
    return { path, content: remainder }
}
