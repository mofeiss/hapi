import type { ScheduledDelay } from './scheduler'
import { HAPI_TIMEZONE } from './scheduler'

const SHANGHAI_LOCALE = 'sv-SE'

export function getHapiTimezone(): string {
    return HAPI_TIMEZONE
}

function getShanghaiDateParts(date: Date): {
    year: number
    month: number
    day: number
    hour: number
    minute: number
    second: number
} {
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

    const parts = formatter.formatToParts(date)
    const values = Object.fromEntries(parts.filter((part) => part.type !== 'literal').map((part) => [part.type, part.value]))
    return {
        year: Number(values.year),
        month: Number(values.month),
        day: Number(values.day),
        hour: Number(values.hour),
        minute: Number(values.minute),
        second: Number(values.second)
    }
}

export function formatInHapiTimezone(date: Date, options: Intl.DateTimeFormatOptions & { locale?: string } = {}): string {
    const { locale = SHANGHAI_LOCALE, ...formatOptions } = options
    return new Intl.DateTimeFormat(locale, {
        timeZone: HAPI_TIMEZONE,
        ...formatOptions
    }).format(date)
}

export function createHapiTimestampForFilename(date: Date = new Date()): string {
    return formatInHapiTimezone(date, {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    }).replace(/[: ]/g, '-').replace(/,/g, '')
}

export function createHapiTimestampForLogEntry(date: Date = new Date()): string {
    const base = formatInHapiTimezone(date, {
        locale: 'en-GB',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hourCycle: 'h23'
    })
    return `${base}.${String(date.getMilliseconds()).padStart(3, '0')}`
}

export function createHapiIsoOffsetTimestamp(date: Date = new Date()): string {
    const { year, month, day, hour, minute, second } = getShanghaiDateParts(date)
    const pad = (value: number) => String(value).padStart(2, '0')
    return `${year}-${pad(month)}-${pad(day)}T${pad(hour)}:${pad(minute)}:${pad(second)}+08:00`
}

export function resolveDelayedRunAt(baseTimestamp: number, delay: ScheduledDelay): number {
    const baseDate = new Date(baseTimestamp)
    const parts = getShanghaiDateParts(baseDate)
    const result = new Date(Date.UTC(
        parts.year + (delay.years ?? 0),
        (parts.month - 1) + (delay.months ?? 0),
        parts.day + (delay.days ?? 0),
        (parts.hour - 8) + (delay.hours ?? 0),
        parts.minute + (delay.minutes ?? 0),
        parts.second + (delay.seconds ?? 0),
        baseDate.getMilliseconds()
    ))
    return result.getTime()
}
