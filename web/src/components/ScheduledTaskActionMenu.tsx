import {
    useCallback,
    useEffect,
    useId,
    useLayoutEffect,
    useRef,
    useState,
    type CSSProperties,
} from 'react'

import { useTranslation } from '@/lib/use-translation'

type ScheduledTaskActionMenuProps = {
    isOpen: boolean
    onClose: () => void
    paused: boolean
    canTogglePaused: boolean
    togglePausedTitle?: string
    canArchive: boolean
    onTogglePaused: () => void
    onArchive: () => void
    onDelete: () => void
    anchorPoint: { x: number; y: number }
    menuId?: string
}

function PauseIcon(props: { className?: string }) {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="currentColor"
            className={props.className}
        >
            <rect x="6" y="4" width="4" height="16" rx="1" />
            <rect x="14" y="4" width="4" height="16" rx="1" />
        </svg>
    )
}

function PlayIcon(props: { className?: string }) {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="currentColor"
            className={props.className}
        >
            <path d="M8 5.14v13.72a1 1 0 0 0 1.5.86l10-6.86a1 1 0 0 0 0-1.72l-10-6.86A1 1 0 0 0 8 5.14Z" />
        </svg>
    )
}

function ArchiveIcon(props: { className?: string }) {
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
            <rect width="20" height="5" x="2" y="3" rx="1" />
            <path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8" />
            <path d="M10 12h4" />
        </svg>
    )
}

function TrashIcon(props: { className?: string }) {
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
            <path d="M3 6h18" />
            <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
            <path d="M8 6V4c0-1 1-2 2-2h4c1 0 1 2 2 2v2" />
            <line x1="10" x2="10" y1="11" y2="17" />
            <line x1="14" x2="14" y1="11" y2="17" />
        </svg>
    )
}

type MenuPosition = {
    top: number
    left: number
    transformOrigin: string
}

export function ScheduledTaskActionMenu(props: ScheduledTaskActionMenuProps) {
    const { t } = useTranslation()
    const {
        isOpen,
        onClose,
        paused,
        canTogglePaused,
        togglePausedTitle,
        canArchive,
        onTogglePaused,
        onArchive,
        onDelete,
        anchorPoint,
        menuId,
    } = props
    const menuRef = useRef<HTMLDivElement | null>(null)
    const [menuPosition, setMenuPosition] = useState<MenuPosition | null>(null)
    const internalId = useId()
    const resolvedMenuId = menuId ?? `scheduled-task-action-menu-${internalId}`
    const headingId = `${resolvedMenuId}-heading`

    const updatePosition = useCallback(() => {
        const menuEl = menuRef.current
        if (!menuEl) return

        const menuRect = menuEl.getBoundingClientRect()
        const viewportWidth = window.innerWidth
        const viewportHeight = window.innerHeight
        const padding = 8
        const gap = 8

        const spaceBelow = viewportHeight - anchorPoint.y
        const spaceAbove = anchorPoint.y
        const openAbove = spaceBelow < menuRect.height + gap && spaceAbove > spaceBelow

        let top = openAbove ? anchorPoint.y - menuRect.height - gap : anchorPoint.y + gap
        let left = anchorPoint.x - menuRect.width / 2
        const transformOrigin = openAbove ? 'bottom center' : 'top center'

        top = Math.min(Math.max(top, padding), viewportHeight - menuRect.height - padding)
        left = Math.min(Math.max(left, padding), viewportWidth - menuRect.width - padding)

        setMenuPosition({ top, left, transformOrigin })
    }, [anchorPoint])

    useLayoutEffect(() => {
        if (!isOpen) return
        updatePosition()
    }, [isOpen, updatePosition])

    useEffect(() => {
        if (!isOpen) {
            setMenuPosition(null)
            return
        }

        const handlePointerDown = (event: PointerEvent) => {
            const target = event.target as Node
            if (menuRef.current?.contains(target)) return
            onClose()
        }

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                onClose()
            }
        }

        document.addEventListener('pointerdown', handlePointerDown)
        document.addEventListener('keydown', handleKeyDown)
        window.addEventListener('resize', updatePosition)
        window.addEventListener('scroll', updatePosition, true)

        return () => {
            document.removeEventListener('pointerdown', handlePointerDown)
            document.removeEventListener('keydown', handleKeyDown)
            window.removeEventListener('resize', updatePosition)
            window.removeEventListener('scroll', updatePosition, true)
        }
    }, [isOpen, onClose, updatePosition])

    useEffect(() => {
        if (!isOpen) return

        const frame = window.requestAnimationFrame(() => {
            const firstItem = menuRef.current?.querySelector<HTMLElement>('[role="menuitem"]')
            firstItem?.focus()
        })

        return () => window.cancelAnimationFrame(frame)
    }, [isOpen])

    if (!isOpen) return null

    const menuStyle: CSSProperties | undefined = menuPosition
        ? {
            top: menuPosition.top,
            left: menuPosition.left,
            transformOrigin: menuPosition.transformOrigin,
        }
        : undefined

    const baseItemClassName =
        'flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-base transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--app-link)]'

    return (
        <div
            ref={menuRef}
            className="fixed z-[100] min-w-[200px] rounded-lg border border-[var(--app-border)] bg-[var(--app-bg)] p-1 shadow-lg animate-menu-pop"
            style={menuStyle}
        >
            <div
                id={headingId}
                className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--app-hint)]"
            >
                {t('session.more')}
            </div>
            <div
                id={resolvedMenuId}
                role="menu"
                aria-labelledby={headingId}
                className="flex flex-col gap-1"
            >
                <button
                    type="button"
                    role="menuitem"
                    className={`${baseItemClassName} ${canTogglePaused ? 'hover:bg-[var(--app-subtle-bg)]' : 'cursor-not-allowed opacity-50'}`}
                    onClick={() => {
                        if (!canTogglePaused) return
                        onClose()
                        onTogglePaused()
                    }}
                    disabled={!canTogglePaused}
                    title={togglePausedTitle}
                    aria-label={togglePausedTitle}
                >
                    {paused ? (
                        <PlayIcon className="h-4 w-4 text-[var(--app-hint)]" />
                    ) : (
                        <PauseIcon className="h-4 w-4 text-[var(--app-hint)]" />
                    )}
                    {paused ? t('scheduled.action.resume') : t('scheduled.action.pause')}
                </button>
                <button
                    type="button"
                    role="menuitem"
                    className={`${baseItemClassName} ${canArchive ? 'hover:bg-[var(--app-subtle-bg)]' : 'cursor-not-allowed opacity-50'}`}
                    onClick={() => {
                        if (!canArchive) return
                        onClose()
                        onArchive()
                    }}
                    disabled={!canArchive}
                >
                    <ArchiveIcon className="text-[var(--app-hint)]" />
                    {t('scheduled.action.archive')}
                </button>
                <button
                    type="button"
                    role="menuitem"
                    className={`${baseItemClassName} text-red-600 hover:bg-red-500/10 focus-visible:ring-red-400`}
                    onClick={() => {
                        onClose()
                        onDelete()
                    }}
                >
                    <TrashIcon className="text-current" />
                    {t('scheduled.action.delete')}
                </button>
            </div>
        </div>
    )
}
