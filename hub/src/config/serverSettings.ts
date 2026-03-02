/**
 * Hub Settings Management
 *
 * Handles loading and persistence of hub configuration.
 * Priority: environment variable > settings.json > default value
 *
 * When a value is loaded from environment variable and not present in settings.json,
 * it will be saved to settings.json for future use
 */

import { getSettingsFile, readSettings, writeSettings } from './settings'

export interface ServerSettings {
    telegramBotToken: string | null
    telegramNotification: boolean
    listenHost: string
    listenPort: number
    publicUrl: string
    corsOrigins: string[]
}

export interface ServerSettingsResult {
    settings: ServerSettings
    sources: {
        telegramBotToken: 'env' | 'file' | 'default'
        telegramNotification: 'env' | 'file' | 'default'
        listenHost: 'env' | 'file' | 'default'
        listenPort: 'env' | 'file' | 'default'
        publicUrl: 'env' | 'file' | 'default'
        corsOrigins: 'env' | 'file' | 'default'
    }
    savedToFile: boolean
}

/**
 * Parse and normalize CORS origins
 */
function parseCorsOrigins(str: string): string[] {
    const entries = str
        .split(',')
        .map(origin => origin.trim())
        .filter(Boolean)

    if (entries.includes('*')) {
        return ['*']
    }

    const normalized: string[] = []
    for (const entry of entries) {
        try {
            normalized.push(new URL(entry).origin)
        } catch {
            // Keep raw value if it's already an origin-like string
            normalized.push(entry)
        }
    }
    return normalized
}

/**
 * Derive CORS origins from public URL
 */
function deriveCorsOrigins(publicUrl: string): string[] {
    try {
        return [new URL(publicUrl).origin]
    } catch {
        return []
    }
}

function normalizeCorsOrigins(value: string[] | string | undefined): string[] | null {
    if (Array.isArray(value)) {
        return value.map((origin) => origin.trim()).filter(Boolean)
    }
    if (typeof value === 'string') {
        return parseCorsOrigins(value)
    }
    return null
}

function normalizeListenPort(value: number | string | undefined): number | null {
    if (value === undefined || value === null) {
        return null
    }

    const parsed = typeof value === 'string' ? Number.parseInt(value, 10) : value
    if (!Number.isFinite(parsed) || parsed <= 0) {
        throw new Error('HAPI_LISTEN_PORT in settings.json must be a valid port number')
    }
    return parsed
}

function normalizeBoolean(value: boolean | string | undefined): boolean | null {
    if (value === undefined || value === null) {
        return null
    }
    if (typeof value === 'boolean') {
        return value
    }
    const normalized = value.trim().toLowerCase()
    if (['true', '1', 'yes', 'on'].includes(normalized)) {
        return true
    }
    if (['false', '0', 'no', 'off'].includes(normalized)) {
        return false
    }
    return null
}

/**
 * Load hub settings with priority: env > file > default
 * Saves new env values to file when not already present
 */
export async function loadServerSettings(dataDir: string): Promise<ServerSettingsResult> {
    const settingsFile = getSettingsFile(dataDir)
    const settings = await readSettings(settingsFile)

    // If settings file exists but couldn't be parsed, fail fast
    if (settings === null) {
        throw new Error(
            `Cannot read ${settingsFile}. Please fix or remove the file and restart.`
        )
    }

    let needsSave = false
    const sources: ServerSettingsResult['sources'] = {
        telegramBotToken: 'default',
        telegramNotification: 'default',
        listenHost: 'default',
        listenPort: 'default',
        publicUrl: 'default',
        corsOrigins: 'default',
    }
    // telegramBotToken: env > file (unified/legacy names) > null
    let telegramBotToken: string | null = null
    if (process.env.TELEGRAM_BOT_TOKEN) {
        telegramBotToken = process.env.TELEGRAM_BOT_TOKEN
        sources.telegramBotToken = 'env'
        if (settings.TELEGRAM_BOT_TOKEN === undefined) {
            settings.TELEGRAM_BOT_TOKEN = telegramBotToken
            needsSave = true
        }
        if (settings.telegramBotToken !== undefined) {
            delete settings.telegramBotToken
            needsSave = true
        }
    } else {
        const fileTelegramBotToken = settings.TELEGRAM_BOT_TOKEN ?? settings.telegramBotToken
        if (fileTelegramBotToken !== undefined) {
            telegramBotToken = fileTelegramBotToken
            sources.telegramBotToken = 'file'
            if (settings.TELEGRAM_BOT_TOKEN !== fileTelegramBotToken || settings.telegramBotToken !== undefined) {
                settings.TELEGRAM_BOT_TOKEN = fileTelegramBotToken
                delete settings.telegramBotToken
                needsSave = true
            }
        }
    }

    // telegramNotification: env > file (unified/legacy names) > true
    let telegramNotification = true
    if (process.env.TELEGRAM_NOTIFICATION !== undefined) {
        telegramNotification = process.env.TELEGRAM_NOTIFICATION === 'true'
        sources.telegramNotification = 'env'
        if (settings.TELEGRAM_NOTIFICATION === undefined) {
            settings.TELEGRAM_NOTIFICATION = telegramNotification
            needsSave = true
        }
        if (settings.telegramNotification !== undefined) {
            delete settings.telegramNotification
            needsSave = true
        }
    } else {
        const fileTelegramNotificationRaw = settings.TELEGRAM_NOTIFICATION ?? settings.telegramNotification
        const fileTelegramNotification = normalizeBoolean(fileTelegramNotificationRaw)
        if (fileTelegramNotification !== null) {
            telegramNotification = fileTelegramNotification
            sources.telegramNotification = 'file'
            if (
                settings.TELEGRAM_NOTIFICATION !== fileTelegramNotification
                || settings.telegramNotification !== undefined
            ) {
                settings.TELEGRAM_NOTIFICATION = fileTelegramNotification
                delete settings.telegramNotification
                needsSave = true
            }
        }
    }

    // listenHost: env > file (unified/legacy names) > default
    let listenHost = '127.0.0.1'
    if (process.env.HAPI_LISTEN_HOST) {
        listenHost = process.env.HAPI_LISTEN_HOST
        sources.listenHost = 'env'
        if (settings.HAPI_LISTEN_HOST === undefined) {
            settings.HAPI_LISTEN_HOST = listenHost
            needsSave = true
        }
        if (settings.listenHost !== undefined || settings.webappHost !== undefined) {
            delete settings.listenHost
            delete settings.webappHost
            needsSave = true
        }
    } else {
        const fileListenHost = settings.HAPI_LISTEN_HOST ?? settings.listenHost ?? settings.webappHost
        if (fileListenHost !== undefined) {
            listenHost = fileListenHost
            sources.listenHost = 'file'
            if (
                settings.HAPI_LISTEN_HOST !== fileListenHost
                || settings.listenHost !== undefined
                || settings.webappHost !== undefined
            ) {
                settings.HAPI_LISTEN_HOST = fileListenHost
                delete settings.listenHost
                delete settings.webappHost
                needsSave = true
            }
        }
    }

    // listenPort: env > file (unified/legacy names) > default
    let listenPort = 3006
    if (process.env.HAPI_LISTEN_PORT) {
        const parsed = parseInt(process.env.HAPI_LISTEN_PORT, 10)
        if (!Number.isFinite(parsed) || parsed <= 0) {
            throw new Error('HAPI_LISTEN_PORT must be a valid port number')
        }
        listenPort = parsed
        sources.listenPort = 'env'
        if (settings.HAPI_LISTEN_PORT === undefined) {
            settings.HAPI_LISTEN_PORT = listenPort
            needsSave = true
        }
        if (settings.listenPort !== undefined || settings.webappPort !== undefined) {
            delete settings.listenPort
            delete settings.webappPort
            needsSave = true
        }
    } else {
        const fileListenPortRaw = settings.HAPI_LISTEN_PORT ?? settings.listenPort ?? settings.webappPort
        const fileListenPort = normalizeListenPort(fileListenPortRaw)
        if (fileListenPort !== null) {
            listenPort = fileListenPort
            sources.listenPort = 'file'
            if (
                settings.HAPI_LISTEN_PORT !== fileListenPort
                || settings.listenPort !== undefined
                || settings.webappPort !== undefined
            ) {
                settings.HAPI_LISTEN_PORT = fileListenPort
                delete settings.listenPort
                delete settings.webappPort
                needsSave = true
            }
        }
    }

    // publicUrl: env > file (unified/legacy names) > default
    let publicUrl = `http://localhost:${listenPort}`
    if (process.env.HAPI_PUBLIC_URL) {
        publicUrl = process.env.HAPI_PUBLIC_URL
        sources.publicUrl = 'env'
        if (settings.HAPI_PUBLIC_URL === undefined) {
            settings.HAPI_PUBLIC_URL = publicUrl
            needsSave = true
        }
        if (settings.publicUrl !== undefined || settings.webappUrl !== undefined) {
            delete settings.publicUrl
            delete settings.webappUrl
            needsSave = true
        }
    } else {
        const filePublicUrl = settings.HAPI_PUBLIC_URL ?? settings.publicUrl ?? settings.webappUrl
        if (filePublicUrl !== undefined) {
            publicUrl = filePublicUrl
            sources.publicUrl = 'file'
            if (
                settings.HAPI_PUBLIC_URL !== filePublicUrl
                || settings.publicUrl !== undefined
                || settings.webappUrl !== undefined
            ) {
                settings.HAPI_PUBLIC_URL = filePublicUrl
                delete settings.publicUrl
                delete settings.webappUrl
                needsSave = true
            }
        }
    }

    // corsOrigins: env > file (unified/legacy names) > derived from publicUrl
    let corsOrigins: string[]
    if (process.env.CORS_ORIGINS) {
        corsOrigins = parseCorsOrigins(process.env.CORS_ORIGINS)
        sources.corsOrigins = 'env'
        if (settings.CORS_ORIGINS === undefined) {
            settings.CORS_ORIGINS = corsOrigins
            needsSave = true
        }
        if (settings.corsOrigins !== undefined) {
            delete settings.corsOrigins
            needsSave = true
        }
    } else {
        const fileCorsOrigins = normalizeCorsOrigins(settings.CORS_ORIGINS ?? settings.corsOrigins)
        if (fileCorsOrigins !== null) {
            corsOrigins = fileCorsOrigins
            sources.corsOrigins = 'file'
            if (
                settings.CORS_ORIGINS === undefined
                || settings.corsOrigins !== undefined
            ) {
                settings.CORS_ORIGINS = fileCorsOrigins
                delete settings.corsOrigins
                needsSave = true
            }
        } else {
            corsOrigins = deriveCorsOrigins(publicUrl)
        }
    }

    // Save settings if any new values were added
    if (needsSave) {
        await writeSettings(settingsFile, settings)
    }

    return {
        settings: {
            telegramBotToken,
            telegramNotification,
            listenHost,
            listenPort,
            publicUrl,
            corsOrigins,
        },
        sources,
        savedToFile: needsSave,
    }
}
