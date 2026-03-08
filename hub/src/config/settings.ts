import { existsSync } from 'node:fs'
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'

export interface Settings {
    machineId?: string
    machineIdConfirmedByServer?: boolean
    runnerAutoStartWhenRunningHappy?: boolean
    // Unified keys (same naming as environment variables)
    CLI_API_TOKEN?: string
    HAPI_API_URL?: string
    HAPI_LISTEN_HOST?: string
    HAPI_LISTEN_PORT?: number | string
    HAPI_PUBLIC_URL?: string
    HAPI_DIAGNOSTIC_LOGGING?: boolean | string
    CORS_ORIGINS?: string[] | string
    TELEGRAM_BOT_TOKEN?: string
    TELEGRAM_NOTIFICATION?: boolean | string
    ELEVENLABS_API_KEY?: string
    ELEVENLABS_AGENT_ID?: string
    HAPI_VOICE_CORRECTION_BASE_URL?: string
    HAPI_VOICE_CORRECTION_API_KEY?: string
    HAPI_VOICE_CORRECTION_MODEL?: string
    // Legacy keys (read-only compatibility)
    cliApiToken?: string
    vapidKeys?: {
        publicKey: string
        privateKey: string
    }
    // Server configuration (legacy names)
    telegramBotToken?: string
    telegramNotification?: boolean
    listenHost?: string
    listenPort?: number | string
    publicUrl?: string
    diagnosticLogging?: boolean | string
    corsOrigins?: string[] | string
    apiUrl?: string
    // Legacy voice correction keys (read-only compatibility)
    voiceCorrectionBaseUrl?: string
    voiceCorrectionApiKey?: string
    voiceCorrectionModel?: string
    // Legacy field names (for migration, read-only)
    serverUrl?: string
    webappHost?: string
    webappPort?: number
    webappUrl?: string
}

export function getSettingsFile(dataDir: string): string {
    return join(dataDir, 'settings.json')
}

/**
 * Read settings from file, preserving all existing fields.
 * Returns null if file exists but cannot be parsed (to avoid data loss).
 */
export async function readSettings(settingsFile: string): Promise<Settings | null> {
    if (!existsSync(settingsFile)) {
        return {}
    }
    try {
        const content = await readFile(settingsFile, 'utf8')
        return JSON.parse(content)
    } catch (error) {
        // Return null to signal parse error - caller should not overwrite
        console.error(`[WARN] Failed to parse ${settingsFile}: ${error}`)
        return null
    }
}

export async function readSettingsOrThrow(settingsFile: string): Promise<Settings> {
    const settings = await readSettings(settingsFile)
    if (settings === null) {
        throw new Error(
            `Cannot read ${settingsFile}. Please fix or remove the file and restart.`
        )
    }
    return settings
}

/**
 * Write settings to file atomically (temp file + rename)
 */
export async function writeSettings(settingsFile: string, settings: Settings): Promise<void> {
    const dir = dirname(settingsFile)
    if (!existsSync(dir)) {
        await mkdir(dir, { recursive: true, mode: 0o700 })
    }

    const tmpFile = settingsFile + '.tmp'
    await writeFile(tmpFile, JSON.stringify(settings, null, 2))
    await rename(tmpFile, settingsFile)
}
