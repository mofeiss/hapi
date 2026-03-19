import { HAPI_TIMEZONE } from '@hapi/protocol'

function normalizeTimestamp(value: number): number | null {
    if (!Number.isFinite(value)) return null
    return value < 1_000_000_000_000 ? value * 1000 : value
}

function pad(value: number): string {
    return String(value).padStart(2, '0')
}

export function formatTimestamp(value: number | null | undefined): string | null {
    if (typeof value !== 'number') return null
    const timestamp = normalizeTimestamp(value)
    if (timestamp === null) return null

    const date = new Date(timestamp)
    if (Number.isNaN(date.getTime())) return null

    const formatter = new Intl.DateTimeFormat('en-CA', {
        timeZone: HAPI_TIMEZONE,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hourCycle: 'h23'
    })
    const parts = Object.fromEntries(formatter.formatToParts(date).filter((part) => part.type !== 'literal').map((part) => [part.type, part.value]))
    return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}:${parts.second}`
}
