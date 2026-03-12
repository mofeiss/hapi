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

    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
}
