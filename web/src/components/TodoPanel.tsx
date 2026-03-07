import { useEffect, useMemo, useState } from 'react'
import type { TodoViewItem } from '@/lib/todos'
import { createTodoFingerprint, getTodoStats } from '@/lib/todos'
import { useTranslation } from '@/lib/use-translation'
import { cn } from '@/lib/utils'

function ChecklistIcon(props: { className?: string }) {
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
            className={cn('h-4 w-4 transition-transform duration-200', props.expanded ? 'rotate-180' : 'rotate-0')}
            viewBox="0 0 16 16"
            fill="none"
            aria-hidden="true"
        >
            <path d="M3.5 6l4.5 4 4.5-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    )
}

function TodoStatusIcon(props: { status: TodoViewItem['status'] }) {
    if (props.status === 'completed') {
        return (
            <span className="inline-flex h-4 w-4 items-center justify-center text-emerald-600">
                <svg className="h-3.5 w-3.5" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                    <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.5" />
                    <path d="M5.25 8.1 7 9.85 10.75 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
            </span>
        )
    }

    if (props.status === 'in_progress') {
        return (
            <span className="inline-flex h-4 w-4 items-center justify-center text-[var(--app-orange-base)]">
                <svg className="h-3.5 w-3.5" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                    <circle cx="8" cy="8" r="5.75" stroke="currentColor" strokeWidth="1.5" opacity="0.35" />
                    <path d="M8 2.25a5.75 5.75 0 0 1 5.75 5.75" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                    <circle cx="8" cy="8" r="1.15" fill="currentColor" />
                </svg>
            </span>
        )
    }

    return (
        <span className="inline-flex h-4 w-4 items-center justify-center text-[var(--app-hint)]">
            <svg className="h-3.5 w-3.5" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <circle cx="8" cy="8" r="5.75" stroke="currentColor" strokeWidth="1.5" />
            </svg>
        </span>
    )
}

function todoTextClass(status: TodoViewItem['status']): string {
    if (status === 'completed') {
        return 'text-[var(--app-hint)] line-through decoration-[var(--app-border)]'
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
                            'min-w-0 break-words',
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
    resetKey?: string
    className?: string
}) {
    const { t } = useTranslation()
    const variant = props.variant ?? 'inline'
    const collapsible = props.collapsible ?? false
    const stats = useMemo(() => getTodoStats(props.todos), [props.todos])
    const fingerprint = useMemo(() => createTodoFingerprint(props.todos), [props.todos])
    const defaultExpanded = props.defaultExpanded ?? (stats.incomplete > 0 || !collapsible)
    const [expanded, setExpanded] = useState(defaultExpanded)

    useEffect(() => {
        setExpanded(defaultExpanded)
    }, [defaultExpanded, props.resetKey, fingerprint])

    if (props.todos.length === 0) {
        return null
    }

    const isDock = variant === 'dock'
    const isExpanded = collapsible ? expanded : true

    return (
        <div
            className={cn(
                'overflow-hidden border border-[var(--app-border)]',
                isDock
                    ? 'rounded-[28px] bg-[var(--app-bg)] shadow-[0_14px_34px_rgba(15,23,42,0.08)]'
                    : 'rounded-[18px] bg-[var(--app-secondary-bg)]',
                props.className
            )}
        >
            <div className={cn('flex items-start justify-between gap-3', isDock ? 'px-6 py-4' : 'px-4 py-3')}>
                <div className="min-w-0 flex items-center gap-3">
                    <span className="shrink-0 text-[var(--app-fg)]">
                        <ChecklistIcon className={isDock ? 'h-5 w-5' : 'h-4 w-4'} />
                    </span>
                    <div className="min-w-0">
                        <div className={cn(
                            'truncate font-medium text-[var(--app-fg)]',
                            isDock ? 'text-[15px] leading-6' : 'text-sm leading-5'
                        )}>
                            {t('todo.summary', { total: stats.total, completed: stats.completed })}
                        </div>
                    </div>
                </div>

                {collapsible ? (
                    <button
                        type="button"
                        className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[var(--app-hint)] transition-colors hover:bg-[var(--app-subtle-bg)]"
                        aria-label={expanded ? t('todo.collapse') : t('todo.expand')}
                        title={expanded ? t('todo.collapse') : t('todo.expand')}
                        onClick={() => setExpanded((value) => !value)}
                    >
                        <ToggleIcon expanded={expanded} />
                    </button>
                ) : null}
            </div>

            {isExpanded ? (
                <div className={cn('border-t border-[var(--app-divider)]', isDock ? 'px-6 pb-4 pt-2.5' : 'px-4 pb-3 pt-2')}>
                    <TodoList todos={props.todos} variant={isDock ? 'dock' : 'inline'} />
                </div>
            ) : null}
        </div>
    )
}
