import { useMemo } from 'react'
import type { Session } from '@/types/api'
import type { ApiClient } from '@/api/client'
import { isTelegramApp } from '@/hooks/useTelegram'
import { PageHeaderUtilityControls } from '@/components/PageHeaderUtilityControls'
import { useTranslation } from '@/lib/use-translation'
import { useWidescreen } from '@/hooks/useWidescreen'
import { useSessionTitleOverride } from '@/lib/session-title-override-store'
import { normalizeProjectPath } from '@/utils/path'
import { formatSessionModelLabel, ReasoningIcon } from '@/components/SessionModelBadge'
import { AgentFlavorStatusIcon } from '@/components/AgentFlavorStatusIcon'

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
    const { widescreen, toggleWidescreen } = useWidescreen()
    const { session } = props
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

    // In Telegram, don't render header (Telegram provides its own)
    if (isTelegramApp()) {
        return null
    }

    return (
        <>
            <div className="bg-[var(--app-bg)] pt-[env(safe-area-inset-top)]">
                <div className="mx-auto w-full max-w-content flex items-center p-3 border-b border-[var(--app-border)]">
                    {/* Back button (mobile only) */}
                    <button
                        type="button"
                        onClick={props.onBack}
                        className="mr-2 flex lg:hidden h-8 w-8 items-center justify-center rounded-full bg-[var(--app-secondary-bg)] text-[var(--app-fg)] transition-colors"
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
                        <div className="flex min-w-0 items-center gap-2">
                            <AgentFlavorStatusIcon
                                flavor={session.metadata?.flavor}
                                active={session.active}
                                thinking={session.thinking}
                                sizeClassName="h-4 w-4"
                            />
                            <div className="min-w-0 flex-1 truncate font-semibold">
                                {title}
                            </div>
                        </div>
                        <div
                            className="flex min-w-0 items-center gap-x-3 overflow-hidden whitespace-nowrap text-xs text-[var(--app-hint)]"
                            style={{ opacity: 'var(--app-session-subtitle-opacity)' }}
                        >
                            <span className="inline-flex shrink-0 items-center gap-1">
                                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0" aria-hidden="true"><polyline points="4 17 10 11 4 5" /><line x1="12" y1="19" x2="20" y2="19" /></svg>
                                {session.metadata?.flavor?.trim() || 'unknown'}
                            </span>
                            {modelLabel ? (
                                <span className="inline-flex min-w-0 items-center gap-1 overflow-hidden" title={modelLabel}>
                                    <ReasoningIcon className="shrink-0" />
                                    <span className="truncate">{modelLabel}</span>
                                </span>
                            ) : null}
                            {worktreeBranch ? (
                                <span className="min-w-0 truncate">{t('session.item.worktree')}: {worktreeBranch}</span>
                            ) : null}
                            {session.metadata?.host ? (
                                <span className="inline-flex min-w-0 items-center gap-1 overflow-hidden">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="2" y="3" width="20" height="14" rx="2" ry="2" /><line x1="8" y1="21" x2="16" y2="21" /><line x1="12" y1="17" x2="12" y2="21" /></svg>
                                    <span className="truncate">{session.metadata.host}</span>
                                </span>
                            ) : null}
                            {displayPath ? (
                                <span className="inline-flex min-w-0 items-center gap-1 overflow-hidden">
                                    <span className="shrink-0 text-[10px]" aria-hidden="true">📂</span>
                                    <span className="truncate">{displayPath}</span>
                                </span>
                            ) : null}
                        </div>
                    </div>

                    {props.onOpenNewSession ? (
                        <div className="flex lg:hidden items-center">
                            <button
                                type="button"
                                onClick={props.onOpenNewSession}
                                className="session-list-new-button flex h-[30px] w-[30px] items-center justify-center rounded-full text-[var(--app-link)] transition-colors hover:bg-[var(--app-secondary-bg)]"
                                title={t('sessions.new')}
                            >
                                <NewChatIcon />
                            </button>
                            {props.onQuickNewSession ? (
                                <button
                                    type="button"
                                    onClick={props.onQuickNewSession}
                                    disabled={props.quickNewSessionPending}
                                    className={`flex h-[30px] w-[30px] items-center justify-center rounded-full transition-colors ${
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
                            <div className="mx-0.5 h-4 w-0.5 bg-[var(--app-divider)]" />
                        </div>
                    ) : null}

                    <div className="flex items-center">
                        {(props.onToggleTheme || props.onOpenSettings) ? (
                            <PageHeaderUtilityControls
                                isDark={Boolean(props.isDark)}
                                onToggleTheme={props.onToggleTheme}
                                onOpenSettings={props.onOpenSettings}
                            />
                        ) : null}

                        {props.onToggleTerminal ? (
                            <button
                                type="button"
                                onClick={props.onToggleTerminal}
                                className={`flex h-[30px] w-[30px] items-center justify-center rounded-full transition-colors ${
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
                                className={`flex h-[30px] w-[30px] items-center justify-center rounded-full transition-colors ${
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
                            onClick={toggleWidescreen}
                            className={`hidden lg:flex h-[30px] w-[30px] items-center justify-center rounded-full transition-colors hover:bg-[var(--app-secondary-bg)] hover:text-[var(--app-fg)] ${widescreen ? 'text-[var(--app-link)]' : 'text-[var(--app-hint)]'}`}
                            title={widescreen ? 'Exit widescreen' : 'Widescreen'}
                        >
                            <WidescreenIcon active={widescreen} />
                        </button>
                    </div>
                </div>
            </div>
        </>
    )
}
