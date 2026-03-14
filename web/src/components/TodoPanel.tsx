import { useEffect, useMemo, useState } from 'react'
import type { TodoViewItem } from '@/lib/todos'
import { createTodoFingerprint, getTodoStats } from '@/lib/todos'
import { useTranslation } from '@/lib/use-translation'
import { cn } from '@/lib/utils'

export function ChecklistIcon(props: { className?: string }) {
    return (
        <svg className={props.className} viewBox="0 0 20 20" fill="none" aria-hidden="true">
            <path d="M7.5 5.25h7" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
            <path d="M7.5 10h7" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
            <path d="M7.5 14.75h7" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
            <path d="m3.5 5.4.9.9 1.7-2" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
            <circle cx="4.35" cy="10" r="1.35" stroke="currentColor" strokeWidth="1.4" />
            <circle cx="4.35" cy="14.75" r="1.35" stroke="currentColor" strokeWidth="1.4" />
        </svg>
    )
}

function ToggleIcon(props: { expanded: boolean }) {
    return (
        <svg
            className={cn('h-4 w-4 transition-transform duration-200', props.expanded ? 'rotate-0' : 'rotate-180')}
            viewBox="0 0 16 16"
            fill="none"
            aria-hidden="true"
        >
            <path d="M3.5 6l4.5 4 4.5-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    )
}

function getOverallTodoStatus(todos: readonly TodoViewItem[], completed: number): TodoViewItem['status'] {
    if (todos.length > 0 && completed === todos.length) {
        return 'completed'
    }

    if (todos.some((todo) => todo.status === 'in_progress') || completed > 0) {
        return 'in_progress'
    }

    return 'pending'
}

function TodoStatusIcon(props: {
    status: TodoViewItem['status']
    className?: string
}) {
    const containerClassName = 'h-4 w-4'
    const iconClassName = 'h-3.5 w-3.5'

    if (props.status === 'completed') {
        return (
            <span className={cn('inline-flex items-center justify-center text-emerald-600', containerClassName, props.className)}>
                <svg className={iconClassName} viewBox="0 0 16 16" fill="none" aria-hidden="true">
                    <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.5" />
                    <path d="M5.25 8.1 7 9.85 10.75 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
            </span>
        )
    }

    if (props.status === 'in_progress') {
        return (
            <span className={cn('inline-flex items-center justify-center text-[var(--app-orange-base)]', containerClassName, props.className)}>
                <svg
                    className={cn(iconClassName, 'animate-[spin_1.15s_linear_infinite] motion-reduce:animate-none')}
                    viewBox="0 0 16 16"
                    fill="none"
                    aria-hidden="true"
                >
                    <circle cx="8" cy="8" r="5.75" stroke="currentColor" strokeWidth="1.5" opacity="0.35" />
                    <path d="M8 2.25a5.75 5.75 0 0 1 5.75 5.75" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                    <circle cx="8" cy="8" r="1.15" fill="currentColor" />
                </svg>
            </span>
        )
    }

    return (
        <span className={cn('inline-flex items-center justify-center text-[var(--app-hint)]', containerClassName, props.className)}>
            <svg className={iconClassName} viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <circle cx="8" cy="8" r="5.75" stroke="currentColor" strokeWidth="1.5" />
            </svg>
        </span>
    )
}

function todoTextClass(status: TodoViewItem['status']): string {
    if (status === 'completed') {
        return 'text-[var(--app-hint)] line-through decoration-current'
    }
    if (status === 'in_progress') {
        return 'text-[var(--app-fg)] font-medium'
    }
    return 'text-[var(--app-fg)]'
}

export function TodoList(props: {
    todos: readonly TodoViewItem[]
    variant?: 'dock' | 'inline'
    className?: string
}) {
    const { t } = useTranslation()
    const isDock = (props.variant ?? 'inline') === 'dock'
    const listGapClass = isDock ? 'gap-2' : 'gap-1.5'
    const itemTextClass = isDock ? 'text-[14px] leading-5' : 'text-[13px] leading-[1.25rem]'

    return (
        <ol className={cn('flex flex-col', listGapClass, props.className)}>
            {props.todos.map((todo, index) => {
                const text = todo.content.trim().length > 0 ? todo.content.trim() : t('todo.empty')
                return (
                    <li key={`${todo.id}:${index}`} className="grid grid-cols-[auto_minmax(0,1fr)] items-start gap-x-2.5">
                        <span>
                            <TodoStatusIcon status={todo.status} />
                        </span>
                        <span className={cn(
                            'min-w-0 overflow-hidden text-ellipsis whitespace-nowrap',
                            todoTextClass(todo.status),
                            itemTextClass
                        )}>
                            {text}
                        </span>
                    </li>
                )
            })}
        </ol>
    )
}

export function TodoPanel(props: {
    todos: readonly TodoViewItem[]
    variant?: 'dock' | 'inline'
    collapsible?: boolean
    defaultExpanded?: boolean
    expanded?: boolean
    onExpandedChange?: (expanded: boolean) => void
    resetKey?: string
    className?: string
}) {
    const { t } = useTranslation()
    const variant = props.variant ?? 'inline'
    const collapsible = props.collapsible ?? false
    const stats = useMemo(() => getTodoStats(props.todos), [props.todos])
    const fingerprint = useMemo(() => createTodoFingerprint(props.todos), [props.todos])
    const defaultExpanded = props.defaultExpanded ?? (stats.incomplete > 0 || !collapsible)
    const isExpandedControlled = typeof props.expanded === 'boolean'
    const [uncontrolledExpanded, setUncontrolledExpanded] = useState(defaultExpanded)
    const expanded = isExpandedControlled ? (props.expanded ?? defaultExpanded) : uncontrolledExpanded

    useEffect(() => {
        if (!isExpandedControlled) {
            setUncontrolledExpanded(defaultExpanded)
        }
    }, [defaultExpanded, fingerprint, isExpandedControlled, props.resetKey])

    if (props.todos.length === 0) {
        return null
    }

    const isDock = variant === 'dock'
    const isExpanded = collapsible ? expanded : true
    const overallStatus = getOverallTodoStatus(props.todos, stats.completed)
    const overlapBufferClass = isDock ? 'h-7' : 'hidden'
    const panelSurfaceClassName = isDock
        ? 'rounded-[20px] bg-[var(--app-secondary-bg)] shadow-[0_6px_18px_rgba(15,23,42,0.045)]'
        : 'rounded-[20px] bg-[var(--app-panel-raised-bg)]'
    const headerClassName = cn(
        'flex w-full items-center justify-between text-left',
        collapsible
            && 'cursor-pointer transition-colors hover:bg-[var(--app-subtle-bg)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--app-border)] focus-visible:ring-inset',
        isDock ? 'gap-2.5 px-[18px] py-2' : 'gap-2.5 px-3.5 py-2'
    )
    const headerContentClassName = cn('min-w-0 flex items-center', isDock ? 'gap-2.5' : 'gap-2')
    const headerTitleClassName = cn(
        'truncate font-medium text-[var(--app-fg)]',
        isDock ? 'text-[14px] leading-5' : 'text-[13px] leading-5'
    )
    const toggleExpanded = () => {
        const nextExpanded = !expanded
        if (!isExpandedControlled) {
            setUncontrolledExpanded(nextExpanded)
        }
        props.onExpandedChange?.(nextExpanded)
    }

    return (
        <div
            className={cn(
                'liquid-line overflow-hidden border border-[var(--app-panel-border)]',
                panelSurfaceClassName,
                props.className
            )}
        >
            {collapsible ? (
                <button
                    type="button"
                    className={headerClassName}
                    aria-expanded={isExpanded}
                    aria-label={expanded ? t('todo.collapse') : t('todo.expand')}
                    title={expanded ? t('todo.collapse') : t('todo.expand')}
                    onClick={toggleExpanded}
                >
                    <div className={headerContentClassName}>
                        <span className="shrink-0 text-[var(--app-hint)] opacity-80">
                            <ChecklistIcon className={isDock ? 'h-5 w-5' : 'h-4 w-4'} />
                        </span>
                        <span className="shrink-0">
                            <TodoStatusIcon status={overallStatus} className="translate-y-px" />
                        </span>
                        <div className="min-w-0">
                            <div className={headerTitleClassName}>
                                {t('todo.summary', { total: stats.total, completed: stats.completed })}
                            </div>
                        </div>
                    </div>
                    <span className="inline-flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-full text-[var(--app-hint)]">
                        <ToggleIcon expanded={expanded} />
                    </span>
                </button>
            ) : (
                <div className={headerClassName}>
                    <div className={headerContentClassName}>
                        <span className="shrink-0 text-[var(--app-hint)] opacity-80">
                            <ChecklistIcon className={isDock ? 'h-5 w-5' : 'h-4 w-4'} />
                        </span>
                        <span className="shrink-0">
                            <TodoStatusIcon status={overallStatus} className="translate-y-px" />
                        </span>
                        <div className="min-w-0">
                            <div className={headerTitleClassName}>
                                {t('todo.summary', { total: stats.total, completed: stats.completed })}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {isExpanded ? (
                <div className={cn('border-t border-[var(--app-divider-soft)]', isDock ? 'px-5 pb-3.5 pt-[13px]' : 'px-4 pb-3 pt-[13px]')}>
                    <TodoList todos={props.todos} variant={isDock ? 'dock' : 'inline'} />
                </div>
            ) : null}

            <div aria-hidden="true" className={overlapBufferClass} />
        </div>
    )
}
