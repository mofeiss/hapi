import { getEventPresentation } from '@/chat/presentation'
import { buildAssistantCopyText, type AssistantCopyPart } from '@/components/AssistantChat/messages/messageCopy'
import type { HappyChatMessageMetadata } from '@/lib/assistant-runtime'
import type { Locale } from '@/lib/i18n-context'
import type { SessionMetadataSummary } from '@/types/api'

type TranscriptMessage = {
    id: string
    role: 'user' | 'assistant' | 'system'
    content: readonly AssistantCopyPart[]
    metadata?: {
        custom?: Partial<HappyChatMessageMetadata>
    }
}

type TranslationFn = (key: string, params?: Record<string, string | number>) => string

function escapeXml(text: string): string {
    return text
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
}

function formatMetaTag(tag: string, value: string | number | null | undefined): string {
    if (value === null || value === undefined) return ''
    const text = String(value).trim()
    if (!text) return ''
    return [`<${tag}>`, escapeXml(text), `</${tag}>`].join('')
}

function buildTranscriptMetaBlock(options: {
    sessionId?: string
    metadata: SessionMetadataSummary | null
}): string {
    const { metadata } = options
    const trigger = metadata?.trigger
    const worktree = metadata?.worktree
    const forensics = metadata?.forensics
    const hasResolvedHapiLogFile = typeof forensics?.resolvedHapiLogFile === 'string' && forensics.resolvedHapiLogFile.trim().length > 0
    const hasResolvedAgentSessionFile = typeof forensics?.resolvedAgentSessionFile === 'string' && forensics.resolvedAgentSessionFile.trim().length > 0
    const lines = [
        '<ChatRecordMeta>',
        formatMetaTag('Format', 'hapi-chat-record-v1'),
        formatMetaTag('SessionId', options.sessionId),
        formatMetaTag('SessionTitle', metadata?.name ?? metadata?.summary?.text),
        formatMetaTag('AgentFlavor', metadata?.flavor),
        formatMetaTag('Model', metadata?.model),
        formatMetaTag('ReasoningEffort', metadata?.reasoningEffort),
        formatMetaTag('Host', metadata?.host),
        formatMetaTag('MachineId', metadata?.machineId),
        formatMetaTag('WorkspacePath', metadata?.path),
        formatMetaTag('WorktreeName', worktree?.name),
        formatMetaTag('WorktreeBranch', worktree?.branch),
        formatMetaTag('WorktreeBasePath', worktree?.basePath),
        formatMetaTag('WorktreePath', worktree?.worktreePath),
        formatMetaTag('TriggerType', trigger?.type),
        formatMetaTag('ScheduledTaskId', trigger?.type === 'scheduled-task' ? trigger.taskId : null),
        formatMetaTag('ScheduledRunId', trigger?.type === 'scheduled-task' ? trigger.runId : null),
        formatMetaTag('ScheduledScheduleType', trigger?.type === 'scheduled-task' ? trigger.scheduleType : null),
        formatMetaTag('ScheduledIteration', trigger?.type === 'scheduled-task' ? trigger.iteration : null),
        formatMetaTag('ClaudeSessionId', metadata?.claudeSessionId ?? forensics?.claudeSessionId),
        formatMetaTag('CodexSessionId', metadata?.codexSessionId ?? forensics?.codexSessionId),
        formatMetaTag('HapiHomeDir', hasResolvedHapiLogFile ? null : forensics?.hapiHomeDir),
        formatMetaTag('HapiLogsDir', hasResolvedHapiLogFile ? null : forensics?.hapiLogsDir),
        formatMetaTag('ResolvedHapiLogFile', forensics?.resolvedHapiLogFile),
        formatMetaTag('AgentSessionSearchRoot', hasResolvedAgentSessionFile ? null : forensics?.agentSessionSearchRoot),
        formatMetaTag('ClaudeProjectPath', hasResolvedAgentSessionFile ? null : forensics?.claudeProjectPath),
        formatMetaTag('CodexSessionsRoot', hasResolvedAgentSessionFile ? null : forensics?.codexSessionsRoot),
        formatMetaTag('ResolvedAgentSessionFile', forensics?.resolvedAgentSessionFile),
        formatMetaTag(
            'LogLocatorHint',
            hasResolvedHapiLogFile
                ? null
                : 'Exact absolute log path is not exposed in web copy. Use HapiLogsDir when available; otherwise use SessionId, MachineId, Host, WorkspacePath, AgentFlavor, and nearby timestamps to search local HAPI logs.'
        ),
        formatMetaTag(
            'AgentSessionLocatorHint',
            hasResolvedAgentSessionFile
                ? null
                : 'Exact local agent session/history file path is not exposed in web copy. Use ClaudeSessionId/CodexSessionId and AgentSessionSearchRoot when available; otherwise use AgentFlavor, WorkspacePath, SessionId, session title keywords, and timestamps to search local Claude/Codex session history.'
        ),
        '</ChatRecordMeta>'
    ].filter(Boolean)

    return lines.join('\n')
}

function wrapTranscriptCopy(text: string, options: {
    sessionId?: string
    metadata: SessionMetadataSummary | null
}): string {
    const trimmed = text.trim()
    const metaBlock = buildTranscriptMetaBlock(options)

    return [
        '[聊天记录开始]',
        metaBlock,
        trimmed,
        '[聊天记录结束]'
    ].filter((part) => part.trim().length > 0).join('\n\n')
}

function getCustomMetadata(message: TranscriptMessage): Partial<HappyChatMessageMetadata> | undefined {
    return message.metadata?.custom
}

function getJoinedText(parts: readonly AssistantCopyPart[]): string {
    return parts
        .filter((part): part is AssistantCopyPart & { type: 'text'; text: string } => (
            part.type === 'text' && typeof part.text === 'string'
        ))
        .map((part) => part.text)
        .join('\n\n')
        .trim()
}

function formatUserPrompt(text: string): string {
    const trimmed = text.trim()
    if (!trimmed) return ''
    return [
        '<UserPrompt>',
        trimmed,
        '</UserPrompt>'
    ].join('\n')
}

function formatEvent(text: string): string {
    const trimmed = text.trim()
    if (!trimmed) return ''
    return [
        '<Event>',
        trimmed,
        '</Event>'
    ].join('\n')
}

function resolveVisibleUserText(
    message: TranscriptMessage,
    editedMessageTextById?: Record<string, string>
): string {
    const messageId = message.id.startsWith('user:') ? message.id.slice(5) : message.id
    const edited = editedMessageTextById?.[messageId]
    return (edited ?? getJoinedText(message.content)).trim()
}

function formatTranscriptMessage(
    message: TranscriptMessage,
    options: {
        metadata: SessionMetadataSummary | null
        locale: Locale
        t: TranslationFn
        editedMessageTextById?: Record<string, string>
    }
): string {
    const custom = getCustomMetadata(message)

    if (message.role === 'user') {
        if (custom?.kind === 'cli-output') {
            return getJoinedText(message.content)
        }
        return formatUserPrompt(resolveVisibleUserText(message, options.editedMessageTextById))
    }

    if (message.role === 'assistant') {
        if (custom?.kind === 'cli-output') {
            return getJoinedText(message.content)
        }
        return buildAssistantCopyText(message.content, {
            metadata: options.metadata,
            locale: options.locale,
            includeToolJson: true
        })
    }

    if (custom?.kind === 'event' && custom.event) {
        return formatEvent(getEventPresentation(custom.event, options.t).text)
    }

    return getJoinedText(message.content)
}

function isUserPromptMessage(message: TranscriptMessage): boolean {
    return message.role === 'user' && getCustomMetadata(message)?.kind !== 'cli-output'
}

export function buildTranscriptText(
    messages: readonly TranscriptMessage[],
    options: {
        metadata: SessionMetadataSummary | null
        locale: Locale
        t: TranslationFn
        editedMessageTextById?: Record<string, string>
    }
): string {
    const firstUserPromptIndex = messages.findIndex(isUserPromptMessage)
    const visibleMessages = firstUserPromptIndex >= 0
        ? messages.slice(firstUserPromptIndex)
        : messages

    return visibleMessages
        .map((message) => formatTranscriptMessage(message, options))
        .filter((text) => text.trim().length > 0)
        .join('\n\n')
        .trim()
}

export function buildLoadedTranscriptCopyText(
    messages: readonly TranscriptMessage[],
    options: {
        sessionId?: string
        metadata: SessionMetadataSummary | null
        locale: Locale
        t: TranslationFn
        editedMessageTextById?: Record<string, string>
    }
): string {
    return wrapTranscriptCopy(buildTranscriptText(messages, options), {
        sessionId: options.sessionId,
        metadata: options.metadata
    })
}
