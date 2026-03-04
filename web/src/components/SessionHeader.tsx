import { useId, useMemo, useRef, useState } from 'react'
import type { Session } from '@/types/api'
import type { ApiClient } from '@/api/client'
import { isTelegramApp } from '@/hooks/useTelegram'
import { useSessionActions } from '@/hooks/mutations/useSessionActions'
import { SessionActionMenu } from '@/components/SessionActionMenu'
import { RenameSessionDialog } from '@/components/RenameSessionDialog'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { useTranslation } from '@/lib/use-translation'
import { useWidescreen } from '@/hooks/useWidescreen'
import { useSessionTitleOverride } from '@/lib/session-title-override-store'
import { normalizeProjectPath } from '@/utils/path'
import { useToast } from '@/lib/toast-context'
import { formatSessionModelLabel, ReasoningIcon } from '@/components/SessionModelBadge'

function getSessionTitle(session: Session): string {
    if (session.metadata?.name) {
        return session.metadata.name
    }
    if (session.metadata?.summary?.text) {
        return session.metadata.summary.text
    }
    return 'New Chat'
}

function TerminalIcon(props: { className?: string }) {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={props.className}
        >
            <rect x="3" y="4" width="18" height="16" rx="2" ry="2" />
            <polyline points="7 9 10 12 7 15" />
            <line x1="12" y1="15" x2="17" y2="15" />
        </svg>
    )
}

function FilesIcon(props: { className?: string }) {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={props.className}
        >
            <path d="m6 14 1.5-2.9A2 2 0 0 1 9.24 10H20a2 2 0 0 1 1.94 2.5l-1.54 6a2 2 0 0 1-1.95 1.5H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3.9a2 2 0 0 1 1.69.9l.81 1.2a2 2 0 0 0 1.67.9H18a2 2 0 0 1 2 2v2" />
        </svg>
    )
}

function MoreVerticalIcon(props: { className?: string }) {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="currentColor"
            className={props.className}
        >
            <circle cx="12" cy="5" r="2" />
            <circle cx="12" cy="12" r="2" />
            <circle cx="12" cy="19" r="2" />
        </svg>
    )
}

function WidescreenIcon(props: { className?: string; active?: boolean }) {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={props.className}
        >
            {props.active ? (
                <>
                    <polyline points="4 14 10 14 10 20" />
                    <polyline points="20 10 14 10 14 4" />
                    <line x1="14" y1="10" x2="21" y2="3" />
                    <line x1="3" y1="21" x2="10" y2="14" />
                </>
            ) : (
                <>
                    <polyline points="15 3 21 3 21 9" />
                    <polyline points="9 21 3 21 3 15" />
                    <line x1="21" y1="3" x2="14" y2="10" />
                    <line x1="3" y1="21" x2="10" y2="14" />
                </>
            )}
        </svg>
    )
}

function SunIcon(props: { className?: string }) {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={props.className}
        >
            <circle cx="12" cy="12" r="4" />
            <path d="M12 2v2" />
            <path d="M12 20v2" />
            <path d="m4.93 4.93 1.41 1.41" />
            <path d="m17.66 17.66 1.41 1.41" />
            <path d="M2 12h2" />
            <path d="M20 12h2" />
            <path d="m6.34 17.66-1.41 1.41" />
            <path d="m19.07 4.93-1.41 1.41" />
        </svg>
    )
}

function MoonIcon(props: { className?: string }) {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={props.className}
        >
            <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
        </svg>
    )
}

function SettingsIcon(props: { className?: string }) {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={props.className}
        >
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </svg>
    )
}

function NewChatIcon(props: { className?: string }) {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            width="18"
            height="18"
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

function QuickCloneChatIcon(props: { className?: string }) {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={props.className}
        >
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
            <line x1="15.5" y1="14.5" x2="15.5" y2="18.5" />
            <line x1="13.5" y1="16.5" x2="17.5" y2="16.5" />
        </svg>
    )
}

export function SessionHeader(props: {
    session: Session
    titleOverride?: string | null // deprecated, now reads from store
    onBack: () => void
    onToggleTerminal?: () => void
    terminalOpen?: boolean
    onToggleFiles?: () => void
    filesOpen?: boolean
    isDark?: boolean
    onToggleTheme?: () => void
    onOpenSettings?: () => void
    onOpenNewSession?: () => void
    onQuickNewSession?: () => void
    quickNewSessionPending?: boolean
    api: ApiClient | null
    onSessionDeleted?: () => void
}) {
    const { t } = useTranslation()
    const { addToast } = useToast()
    const { widescreen, toggleWidescreen } = useWidescreen()
    const { session, api, onSessionDeleted } = props
    const titleFromStore = useSessionTitleOverride(session.id)
    const title = useMemo(() => titleFromStore ?? getSessionTitle(session), [session, titleFromStore])
    const worktreeBranch = session.metadata?.worktree?.branch
    const displayPath = session.metadata?.path ? normalizeProjectPath(session.metadata.path) : null
    const modelLabel = useMemo(
        () => formatSessionModelLabel(session.metadata, {
            fallbackModel: session.metadata?.flavor === 'claude' ? session.modelMode : undefined
        }),
        [session.metadata, session.modelMode]
    )

    const [menuOpen, setMenuOpen] = useState(false)
    const [menuAnchorPoint, setMenuAnchorPoint] = useState<{ x: number; y: number }>({ x: 0, y: 0 })
    const menuId = useId()
    const menuAnchorRef = useRef<HTMLButtonElement | null>(null)
    const [renameOpen, setRenameOpen] = useState(false)
    const [archiveOpen, setArchiveOpen] = useState(false)
    const [deleteOpen, setDeleteOpen] = useState(false)

    const { archiveSession, renameSession, deleteSession, isPending } = useSessionActions(
        api,
        session.id,
        session.metadata?.flavor ?? null
    )

    const handleDelete = async () => {
        await deleteSession()
        onSessionDeleted?.()
    }

    const handleArchive = () => {
        void archiveSession().catch((error) => {
            const message = error instanceof Error && error.message
                ? error.message
                : t('dialog.error.default')
            addToast({
                title: t('dialog.archive.title'),
                body: message,
                sessionId: session.id,
                url: `/sessions/${session.id}`
            })
        })
    }

    const handleMenuToggle = () => {
        if (!menuOpen && menuAnchorRef.current) {
            const rect = menuAnchorRef.current.getBoundingClientRect()
            setMenuAnchorPoint({ x: rect.right, y: rect.bottom })
        }
        setMenuOpen((open) => !open)
    }

    // In Telegram, don't render header (Telegram provides its own)
    if (isTelegramApp()) {
        return null
    }

    return (
        <>
            <div className="bg-[var(--app-bg)] pt-[env(safe-area-inset-top)]">
                <div className="mx-auto w-full max-w-content flex items-center gap-2 p-3 border-b border-[var(--app-border)]">
                    {/* Back button (mobile only) */}
                    <button
                        type="button"
                        onClick={props.onBack}
                        className="flex lg:hidden h-8 w-8 items-center justify-center rounded-full bg-[var(--app-secondary-bg)] text-[var(--app-fg)] transition-colors"
                    >
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="20"
                            height="20"
                            viewBox="0 0 24 24"
                            fill="currentColor"
                        >
                            <path d="M15.41 16.59L10.83 12l4.58-4.59L14 6l-6 6 6 6z" />
                        </svg>
                    </button>

                    {/* Session info - two lines: title and path */}
                    <div className="min-w-0 flex-1">
                        <div className="truncate font-semibold">
                            {title}
                        </div>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-[var(--app-hint)]">
                            <span className="inline-flex items-center gap-1">
                                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0" aria-hidden="true"><polyline points="4 17 10 11 4 5" /><line x1="12" y1="19" x2="20" y2="19" /></svg>
                                {session.metadata?.flavor?.trim() || 'unknown'}
                            </span>
                            {modelLabel ? (
                                <span className="inline-flex items-center gap-1 truncate" title={modelLabel}>
                                    <ReasoningIcon className="shrink-0" />
                                    <span className="truncate">{modelLabel}</span>
                                </span>
                            ) : null}
                            {worktreeBranch ? (
                                <span>{t('session.item.worktree')}: {worktreeBranch}</span>
                            ) : null}
                            {session.metadata?.host ? (
                                <span className="inline-flex items-center gap-1">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="2" y="3" width="20" height="14" rx="2" ry="2" /><line x1="8" y1="21" x2="16" y2="21" /><line x1="12" y1="17" x2="12" y2="21" /></svg>
                                    {session.metadata.host}
                                </span>
                            ) : null}
                            {displayPath ? (
                                <span className="inline-flex items-center gap-1 truncate">
                                    <span className="shrink-0 text-[10px]" aria-hidden="true">📂</span>
                                    {displayPath}
                                </span>
                            ) : null}
                        </div>
                    </div>

                    {props.onToggleTheme && props.onOpenSettings && props.onOpenNewSession ? (
                        <div className="flex lg:hidden items-center">
                            <button
                                type="button"
                                onClick={props.onToggleTheme}
                                className="flex h-8 w-8 items-center justify-center rounded-full text-[var(--app-hint)] transition-colors hover:bg-[var(--app-secondary-bg)] hover:text-[var(--app-fg)]"
                                title={props.isDark ? t('theme.switchToLight') : t('theme.switchToDark')}
                            >
                                {props.isDark ? <SunIcon /> : <MoonIcon />}
                            </button>
                            <button
                                type="button"
                                onClick={props.onOpenSettings}
                                className="flex h-8 w-8 items-center justify-center rounded-full text-[var(--app-hint)] transition-colors hover:bg-[var(--app-secondary-bg)] hover:text-[var(--app-fg)]"
                                title={t('settings.title')}
                            >
                                <SettingsIcon />
                            </button>
                            <button
                                type="button"
                                onClick={props.onOpenNewSession}
                                className="session-list-new-button flex h-8 w-8 items-center justify-center rounded-full text-[var(--app-link)] transition-colors hover:bg-[var(--app-secondary-bg)]"
                                title={t('sessions.new')}
                            >
                                <NewChatIcon />
                            </button>
                            {props.onQuickNewSession ? (
                                <button
                                    type="button"
                                    onClick={props.onQuickNewSession}
                                    disabled={props.quickNewSessionPending}
                                    className={`flex h-8 w-8 items-center justify-center rounded-full transition-colors ${
                                        props.quickNewSessionPending
                                            ? 'cursor-not-allowed text-[var(--app-hint)] opacity-50'
                                            : 'text-[var(--app-link)] hover:bg-[var(--app-secondary-bg)]'
                                    }`}
                                    title={props.quickNewSessionPending ? t('sessions.quickNew.creating') : t('sessions.quickNew')}
                                    aria-label={props.quickNewSessionPending ? t('sessions.quickNew.creating') : t('sessions.quickNew')}
                                >
                                    <QuickCloneChatIcon />
                                </button>
                            ) : null}
                            {(props.onToggleTerminal || props.onToggleFiles) ? (
                                <div className="mx-1 h-5 w-0.5 bg-[var(--app-divider)]" />
                            ) : null}
                        </div>
                    ) : null}

                    {props.onToggleTerminal ? (
                        <button
                            type="button"
                            onClick={props.onToggleTerminal}
                            className={`flex h-8 w-8 items-center justify-center rounded-full transition-colors ${
                                props.terminalOpen
                                    ? 'bg-[var(--app-secondary-bg)] text-[var(--app-fg)]'
                                    : 'text-[var(--app-hint)] hover:bg-[var(--app-secondary-bg)] hover:text-[var(--app-fg)]'
                            }`}
                            title={t('composer.terminal')}
                        >
                            <TerminalIcon />
                        </button>
                    ) : null}

                    {props.onToggleFiles ? (
                        <button
                            type="button"
                            onClick={props.onToggleFiles}
                            className={`flex h-8 w-8 items-center justify-center rounded-full transition-colors ${
                                props.filesOpen
                                    ? 'bg-[var(--app-secondary-bg)] text-[var(--app-fg)]'
                                    : 'text-[var(--app-hint)] hover:bg-[var(--app-secondary-bg)] hover:text-[var(--app-fg)]'
                            }`}
                            title={t('session.title')}
                        >
                            <FilesIcon />
                        </button>
                    ) : null}

                    <button
                        type="button"
                        onClick={handleMenuToggle}
                        onPointerDown={(e) => e.stopPropagation()}
                        ref={menuAnchorRef}
                        aria-haspopup="menu"
                        aria-expanded={menuOpen}
                        aria-controls={menuOpen ? menuId : undefined}
                        className="flex h-8 w-8 items-center justify-center rounded-full text-[var(--app-hint)] transition-colors hover:bg-[var(--app-secondary-bg)] hover:text-[var(--app-fg)]"
                        title={t('session.more')}
                    >
                        <MoreVerticalIcon />
                    </button>

                    <button
                        type="button"
                        onClick={toggleWidescreen}
                        className={`hidden lg:flex h-8 w-8 items-center justify-center rounded-full transition-colors hover:bg-[var(--app-secondary-bg)] hover:text-[var(--app-fg)] ${widescreen ? 'text-[var(--app-link)]' : 'text-[var(--app-hint)]'}`}
                        title={widescreen ? 'Exit widescreen' : 'Widescreen'}
                    >
                        <WidescreenIcon active={widescreen} />
                    </button>
                </div>
            </div>

            <SessionActionMenu
                isOpen={menuOpen}
                onClose={() => setMenuOpen(false)}
                sessionActive={session.active}
                onRename={() => setRenameOpen(true)}
                onArchive={() => setArchiveOpen(true)}
                onDelete={() => setDeleteOpen(true)}
                anchorPoint={menuAnchorPoint}
                menuId={menuId}
            />

            <RenameSessionDialog
                isOpen={renameOpen}
                onClose={() => setRenameOpen(false)}
                currentName={title}
                onRename={renameSession}
                isPending={isPending}
            />

            <ConfirmDialog
                isOpen={archiveOpen}
                onClose={() => setArchiveOpen(false)}
                title={t('dialog.archive.title')}
                description={t('dialog.archive.description', { name: title })}
                confirmLabel={t('dialog.archive.confirm')}
                confirmingLabel={t('dialog.archive.confirming')}
                onConfirm={handleArchive}
                isPending={isPending}
                destructive
            />

            <ConfirmDialog
                isOpen={deleteOpen}
                onClose={() => setDeleteOpen(false)}
                title={t('dialog.delete.title')}
                description={t('dialog.delete.description', { name: title })}
                confirmLabel={t('dialog.delete.confirm')}
                confirmingLabel={t('dialog.delete.confirming')}
                onConfirm={handleDelete}
                isPending={isPending}
                destructive
            />
        </>
    )
}
