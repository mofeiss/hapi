import { isObject } from '@hapi/protocol'
import { getInputStringAny } from '@/lib/toolInputUtils'

function normalizeMultilineText(text: string): string {
    return text.replace(/\r\n/g, '\n').trim()
}

function collapseInlineWhitespace(text: string): string {
    return text.replace(/\s+/g, ' ').trim()
}

function stripMarkdownLead(text: string): string {
    return text.replace(/^[#>*-]+\s*/, '').trim()
}

function extractTextBlocks(value: unknown[]): string[] {
    const parts: string[] = []

    for (const item of value) {
        if (typeof item === 'string') {
            const normalized = normalizeMultilineText(item)
            if (normalized.length > 0) parts.push(normalized)
            continue
        }

        if (!isObject(item)) continue

        const text = typeof item.text === 'string'
            ? item.text
            : typeof item.content === 'string'
                ? item.content
                : null

        if (!text) continue

        const normalized = normalizeMultilineText(text)
        if (normalized.length > 0) parts.push(normalized)
    }

    return parts
}

export function extractAgentPrompt(input: unknown): string | null {
    const prompt = getInputStringAny(input, ['prompt', 'task'])
    if (!prompt) return null

    const normalized = normalizeMultilineText(prompt)
    return normalized.length > 0 ? normalized : null
}

export function extractAgentTopic(input: unknown): string | null {
    const description = getInputStringAny(input, ['description', 'title', 'summary'])
    if (description) {
        const normalized = collapseInlineWhitespace(description)
        if (normalized.length > 0) return normalized
    }

    const prompt = extractAgentPrompt(input)
    if (!prompt) return null

    const firstLine = prompt
        .split('\n')
        .map((line) => stripMarkdownLead(collapseInlineWhitespace(line)))
        .find((line) => line.length > 0)

    return firstLine ?? null
}

export function extractAgentResultMarkdown(result: unknown, depth: number = 0): string | null {
    if (depth > 3 || result === null || result === undefined) return null

    if (typeof result === 'string') {
        const normalized = normalizeMultilineText(result)
        return normalized.length > 0 ? normalized : null
    }

    if (Array.isArray(result)) {
        const parts = extractTextBlocks(result)
        return parts.length > 0 ? parts.join('\n\n') : null
    }

    if (!isObject(result)) return null

    if (typeof result.content === 'string') {
        const normalized = normalizeMultilineText(result.content)
        return normalized.length > 0 ? normalized : null
    }

    if (Array.isArray(result.content)) {
        const parts = extractTextBlocks(result.content)
        if (parts.length > 0) return parts.join('\n\n')
    }

    const nestedKeys = ['result', 'output', 'data'] as const
    for (const key of nestedKeys) {
        const nested = extractAgentResultMarkdown(result[key], depth + 1)
        if (nested) return nested
    }

    return null
}
