import { useEffect, useMemo, useState } from 'react'
import type { SessionSummary } from '@/types/api'
import type { ApiClient } from '@/api/client'
import { useLongPress } from '@/hooks/useLongPress'
import { usePlatform } from '@/hooks/usePlatform'
import { useSessionActions } from '@/hooks/mutations/useSessionActions'
import { SessionActionMenu } from '@/components/SessionActionMenu'
import { RenameSessionDialog } from '@/components/RenameSessionDialog'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { useTranslation } from '@/lib/use-translation'

type SessionGroup = {
    host: string
    sessions: SessionSummary[]
    latestUpdatedAt: number
    hasActiveSession: boolean
}

function getPathDisplayName(path: string): string {
    const parts = path.split(/[\\/]+/).filter(Boolean)
    if (parts.length === 0) return path
    if (parts.length === 1) return parts[0]
    return `${parts[parts.length - 2]}/${parts[parts.length - 1]}`
}

function groupSessionsByHost(sessions: SessionSummary[]): SessionGroup[] {
    const groups = new Map<string, SessionSummary[]>()

    sessions.forEach(session => {
        const host = session.metadata?.host ?? 'Unknown'
        if (!groups.has(host)) {
            groups.set(host, [])
        }
        groups.get(host)!.push(session)
    })

    return Array.from(groups.entries())
        .map(([host, groupSessions]) => {
            const sortedSessions = [...groupSessions].sort((a, b) => b.updatedAt - a.updatedAt)
            const latestUpdatedAt = groupSessions.reduce(
                (max, s) => (s.updatedAt > max ? s.updatedAt : max),
                -Infinity
            )
            const hasActiveSession = groupSessions.some(s => s.active)

            return { host, sessions: sortedSessions, latestUpdatedAt, hasActiveSession }
        })
        .sort((a, b) => {
            if (a.hasActiveSession !== b.hasActiveSession) {
                return a.hasActiveSession ? -1 : 1
            }
            return b.latestUpdatedAt - a.latestUpdatedAt
        })
}

function NewChatIcon(props: { className?: string }) {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={props.className}
        >
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            <line x1="12" y1="7" x2="12" y2="13" />
            <line x1="9" y1="10" x2="15" y2="10" />
        </svg>
    )
}

function BulbIcon(props: { className?: string }) {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={props.className}
        >
            <path d="M9 18h6" />
            <path d="M10 22h4" />
            <path d="M12 2a7 7 0 0 0-4 12c.6.6 1 1.2 1 2h6c0-.8.4-1.4 1-2a7 7 0 0 0-4-12Z" />
        </svg>
    )
}

function ChevronIcon(props: { className?: string; collapsed?: boolean }) {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={`${props.className ?? ''} transition-transform duration-200 ${props.collapsed ? '' : 'rotate-90'}`}
        >
            <polyline points="9 18 15 12 9 6" />
        </svg>
    )
}

function getSessionTitle(session: SessionSummary): string {
    if (session.metadata?.name) {
        return session.metadata.name
    }
    if (session.metadata?.summary?.text) {
        return session.metadata.summary.text
    }
    if (session.metadata?.path) {
        const parts = session.metadata.path.split('/').filter(Boolean)
        return parts.length > 0 ? parts[parts.length - 1] : session.id.slice(0, 8)
    }
    return session.id.slice(0, 8)
}

function getTodoProgress(session: SessionSummary): { completed: number; total: number } | null {
    if (!session.todoProgress) return null
    if (session.todoProgress.completed === session.todoProgress.total) return null
    return session.todoProgress
}

function getAgentLabel(session: SessionSummary): string {
    const flavor = session.metadata?.flavor?.trim()
    if (flavor) return flavor
    return 'unknown'
}

function formatRelativeTime(value: number, t: (key: string, params?: Record<string, string | number>) => string): string | null {
    const ms = value < 1_000_000_000_000 ? value * 1000 : value
    if (!Number.isFinite(ms)) return null
    const delta = Date.now() - ms
    if (delta < 60_000) return t('session.time.justNow')
    const minutes = Math.floor(delta / 60_000)
    if (minutes < 60) return t('session.time.minutesAgo', { n: minutes })
    const hours = Math.floor(minutes / 60)
    if (hours < 24) return t('session.time.hoursAgo', { n: hours })
    const days = Math.floor(hours / 24)
    if (days < 7) return t('session.time.daysAgo', { n: days })
    return new Date(ms).toLocaleDateString()
}

function SessionItem(props: {
    session: SessionSummary
    onSelect: (sessionId: string) => void
    api: ApiClient | null
    selected?: boolean
    batchMode?: 'archive' | 'delete' | null
    batchSelected?: boolean
    onBatchToggleSelect?: () => void
}) {
    const { t } = useTranslation()
    const { session: s, onSelect, api, selected = false, batchMode, batchSelected, onBatchToggleSelect } = props
    const { haptic } = usePlatform()
    const [menuOpen, setMenuOpen] = useState(false)
    const [menuAnchorPoint, setMenuAnchorPoint] = useState<{ x: number; y: number }>({ x: 0, y: 0 })
    const [renameOpen, setRenameOpen] = useState(false)
    const [archiveOpen, setArchiveOpen] = useState(false)
    const [deleteOpen, setDeleteOpen] = useState(false)

    const { archiveSession, renameSession, deleteSession, isPending } = useSessionActions(
        api,
        s.id,
        s.metadata?.flavor ?? null
    )

    const skipArchiveConfirm = (() => { try { return localStorage.getItem('hapi:skip-confirm:archive') === '1' } catch { return false } })()
    const skipDeleteConfirm = (() => { try { return localStorage.getItem('hapi:skip-confirm:delete') === '1' } catch { return false } })()

    const handleQuickArchive = async () => {
        try { await archiveSession() } catch { /* toast handles errors */ }
    }
    const handleQuickDelete = async () => {
        try { await deleteSession() } catch { /* toast handles errors */ }
    }

    const longPressHandlers = useLongPress({
        onLongPress: (point) => {
            haptic.impact('medium')
            setMenuAnchorPoint(point)
            setMenuOpen(true)
        },
        onClick: () => {
            if (!menuOpen) {
                onSelect(s.id)
            }
        },
        threshold: 500
    })

    const sessionName = getSessionTitle(s)
    return (
        <>
            <button
                type="button"
                {...(batchMode ? { onClick: onBatchToggleSelect } : longPressHandlers)}
                className={`session-list-item flex w-full flex-col gap-1.5 px-3 py-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--app-link)] select-none ${batchMode ? (batchSelected ? 'bg-[var(--app-link)]/10' : '') : (selected ? 'bg-[var(--app-secondary-bg)]' : '')} ${!s.active ? 'opacity-70' : ''}`}
                style={{ WebkitTouchCallout: 'none' }}
                aria-current={!batchMode && selected ? 'page' : undefined}
            >
                <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 min-w-0">
                        {batchMode ? (
                            <input
                                type="checkbox"
                                checked={batchSelected ?? false}
                                readOnly
                                className="h-4 w-4 shrink-0 rounded accent-[var(--app-link)] pointer-events-none"
                            />
                        ) : null}
                        <span className={`flex h-4 w-4 shrink-0 items-center justify-center ${s.active ? 'rounded-[4px] bg-emerald-600' : ''}`} aria-hidden="true">
                            {s.active && s.thinking ? (
                                <span className="inline-block text-[10px] leading-none text-white animate-[spin_3s_linear_infinite]">✻</span>
                            ) : s.active ? (
                                <span className="text-[10px] leading-none text-white">✻</span>
                            ) : (
                                <span className="text-xs leading-none text-[var(--app-hint)]">✻</span>
                            )}
                        </span>
                        <div className={`truncate text-base ${!s.active ? 'font-normal text-[var(--app-hint)]' : 'font-medium'}`}>
                            {sessionName}
                        </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 text-xs">
                        {s.thinking ? (
                            <span className="text-[var(--app-hint)] animate-pulse flex items-center">
                                <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    width="14"
                                    height="14"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                >
                                    <path d="M12 5a3 3 0 1 0-5.997.125 4 4 0 0 0-2.526 5.77 4 4 0 0 0 .556 6.588A4 4 0 1 0 12 18Z" />
                                    <path d="M12 5a3 3 0 1 1 5.997.125 4 4 0 0 1 2.526 5.77 4 4 0 0 1-.556 6.588A4 4 0 1 1 12 18Z" />
                                    <path d="M15 13a4.5 4.5 0 0 1-3-4 4.5 4.5 0 0 1-3 4" />
                                    <path d="M17.599 6.5a3 3 0 0 0 .399-1.375" />
                                    <path d="M6.003 5.125A3 3 0 0 0 6.401 6.5" />
                                    <path d="M3.477 10.896a4 4 0 0 1 .585-.396" />
                                    <path d="M19.938 10.5a4 4 0 0 1 .585.396" />
                                    <path d="M6 18a4 4 0 0 1-1.967-.516" />
                                    <path d="M19.967 17.484A4 4 0 0 1 18 18" />
                                </svg>
                            </span>
                        ) : null}
                        {(() => {
                            const progress = getTodoProgress(s)
                            if (!progress) return null
                            return (
                                <span className="flex items-center gap-1 text-[var(--app-hint)]">
                                    <BulbIcon className="h-3 w-3" />
                                    {progress.completed}/{progress.total}
                                </span>
                            )
                        })()}
                        {s.pendingRequestsCount > 0 ? (
                            <span className="text-[var(--app-badge-warning-text)]">
                                {t('session.item.pending')} {s.pendingRequestsCount}
                            </span>
                        ) : null}
                        <span className="text-[var(--app-hint)]">
                            {formatRelativeTime(s.updatedAt, t)}
                        </span>
                    </div>
                </div>
                <div className="flex items-center gap-x-3 text-xs text-[var(--app-hint)]">
                    <span className="inline-flex items-center gap-1 shrink-0">
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 ml-1" aria-hidden="true"><polyline points="4 17 10 11 4 5" /><line x1="12" y1="19" x2="20" y2="19" /></svg>
                        {getAgentLabel(s)}
                    </span>
                    <span className="inline-flex items-center gap-1 truncate">
                        <span className="shrink-0 text-[10px]" aria-hidden="true">📂</span>
                        <span className="truncate" title={s.metadata?.path}>{s.metadata?.path ? getPathDisplayName(s.metadata.path) : s.id.slice(0, 8)}</span>
                    </span>
                </div>
            </button>

            {!batchMode ? (
                <>
                    <SessionActionMenu
                        isOpen={menuOpen}
                        onClose={() => setMenuOpen(false)}
                        sessionActive={s.active}
                        onRename={() => setRenameOpen(true)}
                        onArchive={() => skipArchiveConfirm ? handleQuickArchive() : setArchiveOpen(true)}
                        onDelete={() => skipDeleteConfirm ? handleQuickDelete() : setDeleteOpen(true)}
                        anchorPoint={menuAnchorPoint}
                    />

                    <RenameSessionDialog
                        isOpen={renameOpen}
                        onClose={() => setRenameOpen(false)}
                        currentName={sessionName}
                        onRename={renameSession}
                        isPending={isPending}
                    />

                    <ConfirmDialog
                        isOpen={archiveOpen}
                        onClose={() => setArchiveOpen(false)}
                        title={t('dialog.archive.title')}
                        description={t('dialog.archive.description', { name: sessionName })}
                        confirmLabel={t('dialog.archive.confirm')}
                        confirmingLabel={t('dialog.archive.confirming')}
                        onConfirm={archiveSession}
                        isPending={isPending}
                        destructive
                        dontAskAgainKey="hapi:skip-confirm:archive"
                    />

                    <ConfirmDialog
                        isOpen={deleteOpen}
                        onClose={() => setDeleteOpen(false)}
                        title={t('dialog.delete.title')}
                        description={t('dialog.delete.description', { name: sessionName })}
                        confirmLabel={t('dialog.delete.confirm')}
                        confirmingLabel={t('dialog.delete.confirming')}
                        onConfirm={deleteSession}
                        isPending={isPending}
                        destructive
                        dontAskAgainKey="hapi:skip-confirm:delete"
                    />
                </>
            ) : null}
        </>
    )
}

export function SessionList(props: {
    sessions: SessionSummary[]
    onSelect: (sessionId: string) => void
    onNewSession: () => void
    onRefresh: () => void
    isLoading: boolean
    renderHeader?: boolean
    api: ApiClient | null
    selectedSessionId?: string | null
    batchMode?: 'archive' | 'delete' | null
    batchSelectedIds?: Set<string>
    onBatchToggleSelect?: (sessionId: string) => void
}) {
    const { t } = useTranslation()
    const { renderHeader = true, api, selectedSessionId, batchMode, batchSelectedIds, onBatchToggleSelect } = props

    const filteredSessions = useMemo(() => {
        if (!batchMode) return props.sessions
        if (batchMode === 'archive') return props.sessions.filter(s => s.active)
        return props.sessions.filter(s => !s.active)
    }, [props.sessions, batchMode])

    const groups = useMemo(
        () => groupSessionsByHost(filteredSessions),
        [filteredSessions]
    )
    const [collapseOverrides, setCollapseOverrides] = useState<Map<string, boolean>>(
        () => {
            try {
                const stored = localStorage.getItem('hapi:panel:group-collapsed')
                if (stored) return new Map(JSON.parse(stored) as [string, boolean][])
            } catch { /* ignore */ }
            return new Map()
        }
    )
    const isGroupCollapsed = (group: SessionGroup): boolean => {
        if (batchMode) return false
        const override = collapseOverrides.get(group.host)
        if (override !== undefined) return override
        return false
    }

    const toggleGroup = (host: string, isCollapsed: boolean) => {
        setCollapseOverrides(prev => {
            const next = new Map(prev)
            next.set(host, !isCollapsed)
            try { localStorage.setItem('hapi:panel:group-collapsed', JSON.stringify([...next.entries()])) } catch { /* ignore */ }
            return next
        })
    }

    useEffect(() => {
        if (groups.length === 0) return
        setCollapseOverrides(prev => {
            if (prev.size === 0) return prev
            const next = new Map(prev)
            const knownGroups = new Set(groups.map(group => group.host))
            let changed = false
            for (const host of next.keys()) {
                if (!knownGroups.has(host)) {
                    next.delete(host)
                    changed = true
                }
            }
            if (changed) {
                try { localStorage.setItem('hapi:panel:group-collapsed', JSON.stringify([...next.entries()])) } catch { /* ignore */ }
            }
            return changed ? next : prev
        })
    }, [groups])

    return (
        <div className="mx-auto w-full max-w-content flex flex-col">
            {renderHeader ? (
                <div className="flex items-center justify-between px-3 py-1">
                    <div className="text-xs text-[var(--app-hint)]">
                        {t('sessions.count', { n: props.sessions.length, m: groups.length })}
                    </div>
                    <button
                        type="button"
                        onClick={props.onNewSession}
                        className="session-list-new-button p-1.5 rounded-full text-[var(--app-link)] transition-colors"
                        title={t('sessions.new')}
                    >
                        <NewChatIcon className="h-5 w-5" />
                    </button>
                </div>
            ) : null}

            <div className="flex flex-col">
                {groups.map((group) => {
                    const isCollapsed = isGroupCollapsed(group)
                    return (
                        <div key={group.host}>
                            <button
                                type="button"
                                onClick={() => toggleGroup(group.host, isCollapsed)}
                                className="sticky top-0 z-10 flex w-full items-center gap-2 px-3 py-2 text-left bg-[var(--app-bg)] border-b border-[var(--app-divider)] transition-colors hover:bg-[var(--app-secondary-bg)]"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 shrink-0 text-[var(--app-hint)]" aria-hidden="true"><rect x="2" y="2" width="20" height="8" rx="2" ry="2" /><rect x="2" y="14" width="20" height="8" rx="2" ry="2" /><line x1="6" y1="6" x2="6.01" y2="6" /><line x1="6" y1="18" x2="6.01" y2="18" /></svg>
                                <ChevronIcon
                                    className="h-4 w-4 text-[var(--app-hint)]"
                                    collapsed={isCollapsed}
                                />
                                <div className="flex items-center gap-2 min-w-0 flex-1">
                                    <span className="font-medium text-base break-words">
                                        {group.host}
                                    </span>
                                    <span className="shrink-0 text-xs text-[var(--app-hint)]">
                                        ({group.sessions.length})
                                    </span>
                                </div>
                            </button>
                            {!isCollapsed ? (
                                <div className="flex flex-col divide-y divide-[var(--app-divider)] border-b border-[var(--app-divider)]">
                                    {group.sessions.map((s) => (
                                        <SessionItem
                                            key={s.id}
                                            session={s}
                                            onSelect={props.onSelect}
                                            api={api}
                                            selected={s.id === selectedSessionId}
                                            batchMode={batchMode}
                                            batchSelected={batchSelectedIds?.has(s.id)}
                                            onBatchToggleSelect={onBatchToggleSelect ? () => onBatchToggleSelect(s.id) : undefined}
                                        />
                                    ))}
                                </div>
                            ) : null}
                        </div>
                    )
                })}
            </div>
        </div>
    )
}
