import { useCallback } from 'react'
import { QuickLanguageToggle } from '@/components/QuickLanguageToggle'
import { useTranslation } from '@/lib/use-translation'

function SettingsIcon() {
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
        >
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </svg>
    )
}

function SunIcon() {
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

function MoonIcon() {
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
        >
            <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
        </svg>
    )
}

export function PageHeaderUtilityControls(props: {
    isDark: boolean
    onToggleTheme?: () => void
    onOpenSettings?: () => void
    containerClassName?: string
    buttonClassName?: string
    languageClassName?: string
    useFallbackSettingsEvent?: boolean
}) {
    const { t } = useTranslation()
    const buttonClassName = props.buttonClassName
        ?? 'flex h-[30px] w-[30px] items-center justify-center rounded-full text-[var(--app-hint)] transition-colors hover:bg-[var(--app-secondary-bg)] hover:text-[var(--app-fg)]'
    const languageClassName = props.languageClassName
        ?? 'flex h-[30px] min-w-[30px] items-center justify-center rounded-full px-1 text-[var(--app-hint)] transition-colors hover:bg-[var(--app-secondary-bg)] hover:text-[var(--app-fg)]'

    const handleOpenSettings = useCallback(() => {
        if (props.onOpenSettings) {
            props.onOpenSettings()
            return
        }
        if (props.useFallbackSettingsEvent && typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('hapi:open-settings-overlay'))
        }
    }, [props.onOpenSettings, props.useFallbackSettingsEvent])

    return (
        <div className={props.containerClassName ?? 'flex items-center'}>
            <QuickLanguageToggle className={languageClassName} />
            {props.onToggleTheme ? (
                <button
                    type="button"
                    onClick={props.onToggleTheme}
                    className={buttonClassName}
                    title={props.isDark ? t('theme.switchToLight') : t('theme.switchToDark')}
                    aria-label={props.isDark ? t('theme.switchToLight') : t('theme.switchToDark')}
                >
                    {props.isDark ? <SunIcon /> : <MoonIcon />}
                </button>
            ) : null}
            {(props.onOpenSettings || props.useFallbackSettingsEvent) ? (
                <button
                    type="button"
                    onClick={handleOpenSettings}
                    className={buttonClassName}
                    title={t('settings.title')}
                    aria-label={t('settings.title')}
                >
                    <SettingsIcon />
                </button>
            ) : null}
        </div>
    )
}
