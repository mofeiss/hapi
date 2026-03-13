import { PageHeaderUtilityControls } from '@/components/PageHeaderUtilityControls'
import { useTranslation } from '@/lib/use-translation'

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

const iconButtonClassName = 'flex h-[30px] w-[30px] items-center justify-center rounded-full text-[var(--app-hint)] hover:bg-[var(--app-secondary-bg)] hover:text-[var(--app-fg)]'

type HeaderActionGroupProps = {
    isDark?: boolean
    onToggleTheme?: () => void
    onOpenSettings?: () => void
    onOpenNewSession?: () => void
    onQuickNewSession?: () => void
    quickNewSessionPending?: boolean
    quickNewSessionDisabled?: boolean
    quickNewSessionTitle?: string
    onToggleTerminal?: () => void
    terminalOpen?: boolean
    onToggleFiles?: () => void
    filesOpen?: boolean
    onToggleWidescreen?: () => void
    widescreen?: boolean
    widescreenClassName?: string
    className?: string
    compactIcons?: boolean
    hideNewSessionButton?: boolean
    hideQuickNewButton?: boolean
    hideThemeControls?: boolean
    hideSettingsButton?: boolean
    utilityContainerClassName?: string
    utilityButtonClassName?: string
    utilityLanguageClassName?: string
}

export function HeaderActionGroup(props: HeaderActionGroupProps) {
    const { t } = useTranslation()
    const newSessionButtonClassName = props.compactIcons
        ? 'session-list-new-button flex h-8 w-8 items-center justify-center rounded-full text-[var(--app-link)] hover:bg-[var(--app-secondary-bg)]'
        : 'session-list-new-button flex h-[30px] w-[30px] items-center justify-center rounded-full text-[var(--app-link)] hover:bg-[var(--app-secondary-bg)]'
    const actionButtonClassName = props.compactIcons
        ? 'flex h-8 w-8 items-center justify-center rounded-full'
        : 'flex h-[30px] w-[30px] items-center justify-center rounded-full'

    return (
        <div className={props.className ?? 'flex items-center gap-0.5'}>
            {!props.hideNewSessionButton && props.onOpenNewSession ? (
                <button
                    type="button"
                    onClick={props.onOpenNewSession}
                    className={newSessionButtonClassName}
                    title={t('sessions.new')}
                    aria-label={t('sessions.new')}
                >
                    <NewChatIcon />
                </button>
            ) : null}

            {!props.hideQuickNewButton && props.onQuickNewSession ? (
                <button
                    type="button"
                    onClick={props.onQuickNewSession}
                    disabled={props.quickNewSessionPending || props.quickNewSessionDisabled}
                    className={`${actionButtonClassName} ${
                        props.quickNewSessionPending || props.quickNewSessionDisabled
                            ? 'cursor-not-allowed text-[var(--app-hint)] opacity-50'
                            : 'text-[var(--app-link)] hover:bg-[var(--app-secondary-bg)]'
                    }`}
                    title={props.quickNewSessionTitle ?? (props.quickNewSessionPending ? t('sessions.quickNew.creating') : t('sessions.quickNew'))}
                    aria-label={props.quickNewSessionTitle ?? (props.quickNewSessionPending ? t('sessions.quickNew.creating') : t('sessions.quickNew'))}
                >
                    <QuickCloneChatIcon />
                </button>
            ) : null}

            {(!props.hideNewSessionButton && props.onOpenNewSession || !props.hideQuickNewButton && props.onQuickNewSession) && ((!props.hideThemeControls && props.onToggleTheme) || (!props.hideSettingsButton && props.onOpenSettings) || props.onToggleTerminal || props.onToggleFiles || props.onToggleWidescreen) ? (
                <div className="mx-0.5 h-4 w-px bg-[var(--app-divider)]" />
            ) : null}

            {(!props.hideThemeControls && props.onToggleTheme) || (!props.hideSettingsButton && props.onOpenSettings) ? (
                <PageHeaderUtilityControls
                    isDark={Boolean(props.isDark)}
                    onToggleTheme={props.hideThemeControls ? undefined : props.onToggleTheme}
                    onOpenSettings={props.hideSettingsButton ? undefined : props.onOpenSettings}
                    containerClassName={props.utilityContainerClassName ?? 'flex items-center gap-0.5'}
                    buttonClassName={props.utilityButtonClassName ?? iconButtonClassName}
                    languageClassName={props.utilityLanguageClassName ?? 'flex h-[30px] min-w-[30px] items-center justify-center rounded-full px-1 text-[var(--app-hint)] transition-colors hover:bg-[var(--app-secondary-bg)] hover:text-[var(--app-fg)]'}
                    hideSettingsButton={props.hideSettingsButton}
                />
            ) : null}

            {props.onToggleTerminal ? (
                <button
                    type="button"
                    onClick={props.onToggleTerminal}
                    className={`${actionButtonClassName} ${
                        props.terminalOpen
                            ? 'bg-[var(--app-secondary-bg)] text-[var(--app-fg)]'
                            : 'text-[var(--app-hint)] hover:bg-[var(--app-secondary-bg)] hover:text-[var(--app-fg)]'
                    }`}
                    title={t('composer.terminal')}
                    aria-label={t('composer.terminal')}
                >
                    <TerminalIcon />
                </button>
            ) : null}

            {props.onToggleFiles ? (
                <button
                    type="button"
                    onClick={props.onToggleFiles}
                    className={`${actionButtonClassName} ${
                        props.filesOpen
                            ? 'bg-[var(--app-secondary-bg)] text-[var(--app-fg)]'
                            : 'text-[var(--app-hint)] hover:bg-[var(--app-secondary-bg)] hover:text-[var(--app-fg)]'
                    }`}
                    title={t('session.title')}
                    aria-label={t('session.title')}
                >
                    <FilesIcon />
                </button>
            ) : null}

            {props.onToggleWidescreen ? (
                <button
                    type="button"
                    onClick={props.onToggleWidescreen}
                    className={props.widescreenClassName ?? `flex h-[30px] w-[30px] items-center justify-center rounded-full hover:bg-[var(--app-secondary-bg)] hover:text-[var(--app-fg)] ${props.widescreen ? 'text-[var(--app-link)]' : 'text-[var(--app-hint)]'}`}
                    title={props.widescreen ? 'Exit widescreen' : 'Widescreen'}
                    aria-label={props.widescreen ? 'Exit widescreen' : 'Widescreen'}
                >
                    <WidescreenIcon active={props.widescreen} />
                </button>
            ) : null}
        </div>
    )
}
