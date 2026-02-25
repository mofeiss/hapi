import { useQuery } from '@tanstack/react-query'
import { useCallback, useMemo } from 'react'
import type { ApiClient } from '@/api/client'
import type { SlashCommand } from '@/types/api'
import type { Suggestion } from '@/hooks/useActiveSuggestions'
import { queryKeys } from '@/lib/query-keys'
import { useTranslation } from '@/lib/use-translation'

function levenshteinDistance(a: string, b: string): number {
    if (a.length === 0) return b.length
    if (b.length === 0) return a.length
    const matrix: number[][] = []
    for (let i = 0; i <= b.length; i++) matrix[i] = [i]
    for (let j = 0; j <= a.length; j++) matrix[0][j] = j
    for (let i = 1; i <= b.length; i++) {
        for (let j = 1; j <= a.length; j++) {
            matrix[i][j] = b[i - 1] === a[j - 1]
                ? matrix[i - 1][j - 1]
                : Math.min(matrix[i - 1][j - 1] + 1, matrix[i][j - 1] + 1, matrix[i - 1][j] + 1)
        }
    }
    return matrix[b.length][a.length]
}

/**
 * Built-in slash commands per agent type.
 * These are shown immediately without waiting for RPC.
 */
const BUILTIN_COMMANDS: Record<string, { name: string; source: 'builtin' }[]> = {
    claude: [
        { name: 'clear', source: 'builtin' },
        { name: 'compact', source: 'builtin' },
        { name: 'context', source: 'builtin' },
        { name: 'cost', source: 'builtin' },
        { name: 'doctor', source: 'builtin' },
        { name: 'plan', source: 'builtin' },
        { name: 'stats', source: 'builtin' },
        { name: 'status', source: 'builtin' },
    ],
    codex: [
        { name: 'review', source: 'builtin' },
        { name: 'new', source: 'builtin' },
        { name: 'compat', source: 'builtin' },
        { name: 'undo', source: 'builtin' },
        { name: 'diff', source: 'builtin' },
        { name: 'status', source: 'builtin' },
    ],
    gemini: [
        { name: 'about', source: 'builtin' },
        { name: 'clear', source: 'builtin' },
        { name: 'compress', source: 'builtin' },
        { name: 'stats', source: 'builtin' },
    ],
    opencode: [],
}

export function useSlashCommands(
    api: ApiClient | null,
    sessionId: string | null,
    agentType: string = 'claude'
): {
    commands: SlashCommand[]
    isLoading: boolean
    error: string | null
    getSuggestions: (query: string) => Promise<Suggestion[]>
} {
    const { t } = useTranslation()
    const resolvedSessionId = sessionId ?? 'unknown'

    // Fetch user-defined commands from the CLI (requires active session)
    const query = useQuery({
        queryKey: queryKeys.slashCommands(resolvedSessionId),
        queryFn: async () => {
            if (!api || !sessionId) {
                throw new Error('Session unavailable')
            }
            return await api.getSlashCommands(sessionId)
        },
        enabled: Boolean(api && sessionId),
        staleTime: Infinity,
        gcTime: 30 * 60 * 1000,
        retry: false, // Don't retry RPC failures
    })

    // Resolve agent type key for i18n lookups
    const resolvedAgentType = (BUILTIN_COMMANDS[agentType] ? agentType : 'claude')

    // Merge built-in commands with user-defined and plugin commands from API
    const commands = useMemo(() => {
        const rawBuiltin = BUILTIN_COMMANDS[resolvedAgentType] ?? []
        const builtin: SlashCommand[] = rawBuiltin.map(cmd => ({
            ...cmd,
            description: t(`command.${resolvedAgentType}.${cmd.name}`),
        }))

        // If API succeeded, add user-defined and plugin commands
        if (query.data?.success && query.data.commands) {
            const extraCommands = query.data.commands.filter(
                cmd => cmd.source === 'user' || cmd.source === 'plugin'
            )
            return [...builtin, ...extraCommands]
        }

        // Fallback to built-in commands only
        return builtin
    }, [resolvedAgentType, query.data, t])

    const getSuggestions = useCallback(async (queryText: string): Promise<Suggestion[]> => {
        const searchTerm = queryText.startsWith('/')
            ? queryText.slice(1).toLowerCase()
            : queryText.toLowerCase()

        if (!searchTerm) {
            return commands.map(cmd => ({
                key: `/${cmd.name}`,
                text: `/${cmd.name}`,
                label: `/${cmd.name}`,
                description: cmd.description ?? (cmd.source === 'user' ? t('command.customCommand') : undefined),
                content: cmd.content,
                source: cmd.source
            }))
        }

        const maxDistance = Math.max(2, Math.floor(searchTerm.length / 2))
        return commands
            .map(cmd => {
                const name = cmd.name.toLowerCase()
                let score: number
                if (name === searchTerm) score = 0
                else if (name.startsWith(searchTerm)) score = 1
                else if (name.includes(searchTerm)) score = 2
                else {
                    const dist = levenshteinDistance(searchTerm, name)
                    score = dist <= maxDistance ? 3 + dist : Infinity
                }
                return { cmd, score }
            })
            .filter(item => item.score < Infinity)
            .sort((a, b) => a.score - b.score)
            .map(({ cmd }) => ({
                key: `/${cmd.name}`,
                text: `/${cmd.name}`,
                label: `/${cmd.name}`,
                description: cmd.description ?? (cmd.source === 'user' ? t('command.customCommand') : undefined),
                content: cmd.content,
                source: cmd.source
            }))
    }, [commands, t])

    return {
        commands,
        isLoading: query.isLoading,
        error: query.error instanceof Error ? query.error.message : query.error ? t('command.loadError') : null,
        getSuggestions,
    }
}
