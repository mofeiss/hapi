import type { AgentEvent } from '@/chat/types'

export function formatUnixTimestamp(value: number): string {
    const ms = value < 1_000_000_000_000 ? value * 1000 : value
    const date = new Date(ms)
    if (Number.isNaN(date.getTime())) return String(value)
    return date.toLocaleString()
}

function formatDuration(ms: number): string {
    const seconds = ms / 1000
    if (seconds < 60) return `${seconds.toFixed(1)}s`
    const mins = Math.floor(seconds / 60)
    const secs = Math.round(seconds % 60)
    return `${mins}m ${secs}s`
}

export type EventPresentation = {
    icon: string | null
    text: string
    source: 'assistant' | 'user'
}

export type TFunction = (key: string, params?: Record<string, string | number>) => string

function localize(
    t: TFunction | undefined,
    key: string,
    fallback: string,
    params?: Record<string, string | number>,
): string {
    if (t) return t(key, params)
    if (!params) return fallback
    return fallback.replace(/\{(\w+)\}/g, (m, k) => params[k] !== undefined ? String(params[k]) : m)
}

export function getEventPresentation(event: AgentEvent, t?: TFunction): EventPresentation {
    const s = 'assistant' as const

    if (event.type === 'api-error') {
        const { retryAttempt, maxRetries } = event as { retryAttempt: number; maxRetries: number }
        if (maxRetries > 0 && retryAttempt >= maxRetries) {
            return { icon: null, text: localize(t, 'event.apiError.maxRetries', 'API error: Max retries reached'), source: s }
        }
        if (maxRetries > 0) {
            return { icon: null, text: localize(t, 'event.apiError.retrying', 'API error: Retrying ({attempt}/{max})', { attempt: retryAttempt, max: maxRetries }), source: s }
        }
        if (retryAttempt > 0) {
            return { icon: null, text: localize(t, 'event.apiError.retryingGeneric', 'API error: Retrying...'), source: s }
        }
        return { icon: null, text: localize(t, 'event.apiError', 'API error'), source: s }
    }
    if (event.type === 'switch') {
        const mode = event.mode === 'local' ? 'local' : 'remote'
        return { icon: null, text: localize(t, 'event.switchedTo', 'Switched to {mode}', { mode }), source: s }
    }
    if (event.type === 'title-changed') {
        const title = typeof event.title === 'string' ? event.title : ''
        return {
            icon: null,
            text: title
                ? localize(t, 'event.titleChangedTo', 'Title changed to "{title}"', { title })
                : localize(t, 'event.titleChanged', 'Title changed'),
            source: s,
        }
    }
    if (event.type === 'permission-mode-changed') {
        const modeValue = (event as Record<string, unknown>).mode
        const mode = typeof modeValue === 'string' ? modeValue : 'default'
        return { icon: null, text: localize(t, 'event.permissionMode', 'Permission mode: {mode}', { mode }), source: s }
    }
    if (event.type === 'limit-reached') {
        const endsAt = typeof event.endsAt === 'number' ? event.endsAt : null
        return {
            icon: null,
            text: endsAt
                ? localize(t, 'event.limitReachedUntil', 'Usage limit reached until {time}', { time: formatUnixTimestamp(endsAt) })
                : localize(t, 'event.limitReached', 'Usage limit reached'),
            source: s,
        }
    }
    if (event.type === 'message') {
        return { icon: null, text: typeof event.message === 'string' ? event.message : localize(t, 'event.message', 'Message'), source: s }
    }
    if (event.type === 'turn-duration') {
        const ms = typeof event.durationMs === 'number' ? event.durationMs : 0
        return { icon: null, text: localize(t, 'event.turnDuration', 'Turn: {duration}', { duration: formatDuration(ms) }), source: s }
    }
    if (event.type === 'microcompact') {
        const saved = typeof event.tokensSaved === 'number' ? event.tokensSaved : 0
        const formatted = saved >= 1000 ? `${Math.round(saved / 1000)}K` : String(saved)
        return { icon: null, text: localize(t, 'event.contextCompacted', 'Context compacted (saved {tokens} tokens)', { tokens: formatted }), source: s }
    }
    if (event.type === 'compact') {
        return { icon: null, text: localize(t, 'event.conversationCompacted', 'Conversation compacted'), source: s }
    }
    try {
        return { icon: null, text: JSON.stringify(event), source: s }
    } catch {
        return { icon: null, text: String(event.type), source: s }
    }
}

export function renderEventLabel(event: AgentEvent): string {
    return getEventPresentation(event).text
}
