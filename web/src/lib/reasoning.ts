export type ParsedReasoning = {
    title: string | null
    body: string
}

export function parseReasoningText(text: string): ParsedReasoning {
    const trimmed = text.trim()
    if (!trimmed) {
        return {
            title: null,
            body: ''
        }
    }

    const match = trimmed.match(/^\*\*([^*\n][\s\S]*?)\*\*(?:\n\n?|$)([\s\S]*)$/)
    if (!match) {
        return {
            title: null,
            body: trimmed
        }
    }

    const [, rawTitle, rawBody = ''] = match
    const title = rawTitle.trim()
    const body = rawBody.trim()

    if (!title) {
        return {
            title: null,
            body: trimmed
        }
    }

    return {
        title,
        body
    }
}

export function summarizeReasoning(text: string): string {
    const parsed = parseReasoningText(text)
    if (parsed.title) return parsed.title

    return parsed.body
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line.length > 0)
        .join(' ')
}

export function getReasoningRenderText(text: string): string {
    const parsed = parseReasoningText(text)
    if (parsed.title && parsed.body) return parsed.body
    return text.trim()
}

