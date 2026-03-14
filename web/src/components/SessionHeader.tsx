import { useMemo } from 'react'
import type { Session } from '@/types/api'
import type { ApiClient } from '@/api/client'
import { isTelegramApp } from '@/hooks/useTelegram'
import { HeaderActionGroup } from '@/components/HeaderActionGroup'
import { useWidescreen } from '@/hooks/useWidescreen'
import { useSessionTitleOverride } from '@/lib/session-title-override-store'
import { normalizeProjectPath } from '@/utils/path'
import { AgentFlavorStatusIcon } from '@/components/AgentFlavorStatusIcon'
import { formatTimestamp } from '@/lib/dateTime'

function getSessionTitle(session: Session): string {
    if (session.metadata?.name) {
        return session.metadata.name
    }
    if (session.metadata?.summary?.text) {
        return session.metadata.summary.text
    }
    return 'New Chat'
}

export function SessionHeader(props: {
    session: Session
    titleOverride?: string | null // deprecated, now reads from store
    onBack: () => void
    onToggleTerminal?: () => void
    terminalOpen?: boolean
    onToggleFiles?: () => void
    filesOpen?: boolean
    onQuickNewSession?: () => void
    quickNewSessionPending?: boolean
    api: ApiClient | null
    onSessionDeleted?: () => void
}) {
    const { widescreen, toggleWidescreen } = useWidescreen()
    const { session } = props
    const titleFromStore = useSessionTitleOverride(session.id)
    const title = useMemo(() => titleFromStore ?? getSessionTitle(session), [session, titleFromStore])
    const displayPath = session.metadata?.path ? normalizeProjectPath(session.metadata.path) : null
    const createdAtLabel = useMemo(() => formatTimestamp(session.createdAt), [session.createdAt])

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
                        className="mr-2 flex lg:hidden h-8 w-8 items-center justify-center rounded-full bg-[var(--app-secondary-bg)] text-[var(--app-fg)]"
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
                            {createdAtLabel ? (
                                <span className="inline-flex shrink-0 items-center gap-1">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
                                    <span>{createdAtLabel}</span>
                                </span>
                            ) : null}
                        </div>
                    </div>

                    <HeaderActionGroup
                        onQuickNewSession={props.onQuickNewSession}
                        hideNewSessionButton
                        hideThemeControls
                        hideSettingsButton
                        quickNewSessionPending={props.quickNewSessionPending}
                        onToggleTerminal={props.onToggleTerminal}
                        terminalOpen={props.terminalOpen}
                        onToggleFiles={props.onToggleFiles}
                        filesOpen={props.filesOpen}
                        onToggleWidescreen={toggleWidescreen}
                        widescreen={widescreen}
                        widescreenClassName={`flex h-[30px] w-[30px] items-center justify-center rounded-full transition-colors hover:bg-[var(--app-secondary-bg)] hover:text-[var(--app-fg)] ${widescreen ? 'text-[var(--app-link)]' : 'text-[var(--app-hint)]'}`}
                        className="flex items-center gap-0.5"
                    />
                </div>
            </div>
        </>
    )
}
