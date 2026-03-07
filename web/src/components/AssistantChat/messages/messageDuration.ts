import type { HappyChatMessageMetadata } from '@/lib/assistant-runtime'

type DurationMessage = {
    role: 'user' | 'assistant' | 'system'
    createdAt?: Date | null
    metadata?: {
        custom?: Partial<HappyChatMessageMetadata>
    }
}

function getMessageTimestamp(message: DurationMessage | undefined): number | null {
    if (!message?.createdAt) return null
    const timestamp = message.createdAt.getTime()
    return Number.isFinite(timestamp) ? timestamp : null
}

function isPromptUserMessage(message: DurationMessage | undefined): boolean {
    if (!message || message.role !== 'user') return false
    const custom = message.metadata?.custom
    return custom?.kind !== 'cli-output'
}

function isAssistantOutputMessage(message: DurationMessage | undefined): boolean {
    return message?.role === 'assistant'
}

function getTurnDurationMs(message: DurationMessage | undefined): number | null {
    const event = message?.metadata?.custom?.event
    if (!event || event.type !== 'turn-duration') return null
    return typeof event.durationMs === 'number' ? event.durationMs : null
}

export function getAssistantTurnDurationInfo(
    messages: readonly DurationMessage[],
    currentMessageIndex: number
): {
    startAt: number
    fallbackEndAt: number
    finalEndAt: number | null
    turnEndIndex: number
    lastAssistantOutputIndex: number
} | null {
    if (currentMessageIndex < 0 || currentMessageIndex >= messages.length) return null

    let promptIndex = -1
    for (let index = currentMessageIndex - 1; index >= 0; index -= 1) {
        const candidate = messages[index]
        if (!isPromptUserMessage(candidate)) continue
        promptIndex = index
        break
    }

    if (promptIndex < 0) return null

    const startAt = getMessageTimestamp(messages[promptIndex])
    if (startAt === null) return null

    let turnEndIndex = messages.length - 1
    for (let index = promptIndex + 1; index < messages.length; index += 1) {
        if (!isPromptUserMessage(messages[index])) continue
        turnEndIndex = index - 1
        break
    }

    let fallbackEndAt = startAt
    let finalEndAt: number | null = null
    let lastAssistantOutputIndex = -1

    for (let index = promptIndex + 1; index <= turnEndIndex; index += 1) {
        const timestamp = getMessageTimestamp(messages[index])
        if (timestamp !== null) {
            fallbackEndAt = Math.max(fallbackEndAt, timestamp)
        }

        if (isAssistantOutputMessage(messages[index])) {
            lastAssistantOutputIndex = index
        }

        const durationMs = getTurnDurationMs(messages[index])
        if (durationMs === null) continue
        finalEndAt = startAt + Math.max(0, durationMs)
    }

    if (lastAssistantOutputIndex < 0) return null

    return {
        startAt,
        fallbackEndAt,
        finalEndAt,
        turnEndIndex,
        lastAssistantOutputIndex
    }
}

export function formatTurnDurationCompact(ms: number): string {
    const normalizedMs = Math.max(0, ms)
    const totalSeconds = normalizedMs > 0
        ? Math.max(1, Math.floor(normalizedMs / 1000))
        : 0

    if (totalSeconds < 60) {
        return `${totalSeconds}S`
    }

    const totalMinutes = Math.floor(totalSeconds / 60)
    const remainingSeconds = totalSeconds % 60
    if (totalMinutes < 60) {
        return `${totalMinutes}M ${String(remainingSeconds).padStart(2, '0')}S`
    }

    const totalHours = Math.floor(totalMinutes / 60)
    const remainingMinutes = totalMinutes % 60
    if (totalHours < 24) {
        return `${totalHours}H ${String(remainingMinutes).padStart(2, '0')}M`
    }

    const totalDays = Math.floor(totalHours / 24)
    const remainingHours = totalHours % 24
    return `${totalDays}D ${String(remainingHours).padStart(2, '0')}H`
}
