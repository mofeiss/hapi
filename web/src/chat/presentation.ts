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

export function getEventPresentation(event: AgentEvent): EventPresentation {
    const s = 'assistant' as const

    if (event.type === 'api-error') {
        const { retryAttempt, maxRetries } = event as { retryAttempt: number; maxRetries: number }
        if (maxRetries > 0 && retryAttempt >= maxRetries) {
            return { icon: '⚠️', text: 'API error: Max retries reached', source: s }
        }
        if (maxRetries > 0) {
            return { icon: '⏳', text: `API error: Retrying (${retryAttempt}/${maxRetries})`, source: s }
        }
        if (retryAttempt > 0) {
            return { icon: '⏳', text: 'API error: Retrying...', source: s }
        }
        return { icon: '⚠️', text: 'API error', source: s }
    }
    if (event.type === 'switch') {
        const mode = event.mode === 'local' ? 'local' : 'remote'
        return { icon: '🔄', text: `Switched to ${mode}`, source: s }
    }
    if (event.type === 'title-changed') {
        const title = typeof event.title === 'string' ? event.title : ''
        return { icon: null, text: title ? `Title changed to "${title}"` : 'Title changed', source: s }
    }
    if (event.type === 'permission-mode-changed') {
        const modeValue = (event as Record<string, unknown>).mode
        const mode = typeof modeValue === 'string' ? modeValue : 'default'
        return { icon: '🔐', text: `Permission mode: ${mode}`, source: s }
    }
    if (event.type === 'limit-reached') {
        const endsAt = typeof event.endsAt === 'number' ? event.endsAt : null
        return { icon: '⏳', text: endsAt ? `Usage limit reached until ${formatUnixTimestamp(endsAt)}` : 'Usage limit reached', source: s }
    }
    if (event.type === 'message') {
        return { icon: null, text: typeof event.message === 'string' ? event.message : 'Message', source: s }
    }
    if (event.type === 'turn-duration') {
        const ms = typeof event.durationMs === 'number' ? event.durationMs : 0
        return { icon: '⏱️', text: `Turn: ${formatDuration(ms)}`, source: s }
    }
    if (event.type === 'microcompact') {
        const saved = typeof event.tokensSaved === 'number' ? event.tokensSaved : 0
        const formatted = saved >= 1000 ? `${Math.round(saved / 1000)}K` : String(saved)
        return { icon: '📦', text: `Context compacted (saved ${formatted} tokens)`, source: s }
    }
    if (event.type === 'compact') {
        return { icon: '📦', text: 'Conversation compacted', source: s }
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
