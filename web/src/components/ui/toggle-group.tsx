import * as React from 'react'
import { cn } from '@/lib/utils'

export function ToggleGroup(props: {
    value: string
    onValueChange: (value: string) => void
    'aria-label'?: string
    className?: string
    children: React.ReactNode
}) {
    return (
        <div
            role="tablist"
            aria-label={props['aria-label']}
            className={cn(
                'inline-flex items-center gap-1 rounded-full border border-[var(--app-border)] bg-[var(--app-secondary-bg)] p-1',
                props.className,
            )}
        >
            {React.Children.map(props.children, (child) => {
                if (!React.isValidElement<ToggleGroupItemProps>(child)) return child
                return React.cloneElement(child, {
                    selected: child.props.value === props.value,
                    onSelect: () => props.onValueChange(child.props.value),
                })
            })}
        </div>
    )
}

type ToggleGroupItemProps = {
    value: string
    children: React.ReactNode
    className?: string
    selected?: boolean
    onSelect?: () => void
}

export function ToggleGroupItem(props: ToggleGroupItemProps) {
    return (
        <button
            type="button"
            role="tab"
            aria-selected={props.selected}
            onClick={props.onSelect}
            className={cn(
                'inline-flex min-w-0 items-center justify-center rounded-full px-2 py-1 text-xs font-medium',
                props.selected
                    ? 'bg-[var(--app-bg)] text-[var(--app-fg)]'
                    : 'text-[var(--app-hint)] hover:bg-[var(--app-subtle-bg)] hover:text-[var(--app-fg)]',
                props.className,
            )}
        >
            {props.children}
        </button>
    )
}
