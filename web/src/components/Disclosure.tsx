import type { ElementType, PropsWithChildren } from 'react'
import { cn } from '@/lib/utils'

export type DisclosureLevel = 'outer' | 'inner'

const OUTER_DISCLOSURE_BLOCK_CLASS = 'ml-0.5 border-l-2 border-[var(--app-border)] pl-4 pt-2'
const INNER_DISCLOSURE_BLOCK_CLASS = 'ml-5 border-l border-[var(--app-border)] pl-2.5'

const OUTER_DISCLOSURE_INLINE_CLASS = 'ml-0.5 inline-flex items-center border-l-2 border-[var(--app-border)] pl-1.5'
const INNER_DISCLOSURE_INLINE_CLASS = 'ml-5 inline-flex items-center border-l border-[var(--app-border)] pl-1.5'

export function getDisclosureBlockClass(level: DisclosureLevel): string {
    return level === 'inner' ? INNER_DISCLOSURE_BLOCK_CLASS : OUTER_DISCLOSURE_BLOCK_CLASS
}

export function getDisclosureInlineClass(level: DisclosureLevel): string {
    return level === 'inner' ? INNER_DISCLOSURE_INLINE_CLASS : OUTER_DISCLOSURE_INLINE_CLASS
}

export function DisclosureChevron(props: { open: boolean; className?: string }) {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={cn(
                'h-3 w-3 transition-transform duration-200 ease-out',
                props.open ? 'rotate-90' : '',
                props.className
            )}
        >
            <polyline points="9 18 15 12 9 6" />
        </svg>
    )
}

type DisclosureRailProps = PropsWithChildren<{
    level: DisclosureLevel
    className?: string
}>

export function DisclosureRail(props: DisclosureRailProps) {
    return (
        <div className={cn(getDisclosureBlockClass(props.level), props.className)}>
            {props.children}
        </div>
    )
}

type DisclosureInlineRailProps<T extends ElementType> = PropsWithChildren<{
    level: DisclosureLevel
    as?: T
    className?: string
}>

export function DisclosureInlineRail<T extends ElementType = 'span'>(
    props: DisclosureInlineRailProps<T>
) {
    const { as, children, className, level } = props
    const Component = (as ?? 'span') as ElementType

    return (
        <Component className={cn(getDisclosureInlineClass(level), className)}>
            {children}
        </Component>
    )
}
