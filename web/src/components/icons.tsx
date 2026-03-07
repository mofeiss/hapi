import type { ReactNode } from 'react'

type IconProps = {
    className?: string
}

function createIcon(paths: ReactNode, props: IconProps, strokeWidth = 1.5) {
    return (
        <svg
            className={props.className ?? 'h-4 w-4'}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            {paths}
        </svg>
    )
}

export function CloseIcon(props: IconProps) {
    return createIcon(
        <path d="M6 18 18 6M6 6l12 12" />,
        props,
        2
    )
}

export function ShareIcon(props: IconProps) {
    return createIcon(
        <path d="M9 8.25H7.5a2.25 2.25 0 0 0-2.25 2.25v9a2.25 2.25 0 0 0 2.25 2.25h9a2.25 2.25 0 0 0 2.25-2.25v-9a2.25 2.25 0 0 0-2.25-2.25H15m0-3-3-3m0 0-3 3m3-3v12" />,
        props
    )
}

export function PlusCircleIcon(props: IconProps) {
    return createIcon(
        <path d="M12 9v6m3-3H9m12 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />,
        props
    )
}

export function ChevronDownIcon(props: IconProps) {
    return createIcon(
        <path d="m6 9 6 6 6-6" />,
        props,
        2
    )
}

export function CopyIcon(props: IconProps) {
    return createIcon(
        <>
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
        </>,
        props,
        2
    )
}

export function CopyAllIcon(props: IconProps) {
    return createIcon(
        <>
            <rect x="9" y="9" width="11" height="11" rx="2" ry="2" />
            <path d="M15 5H7a2 2 0 0 0-2 2v8" />
            <path d="M9 5H7a2 2 0 0 0-2 2v2" />
        </>,
        props,
        2.2
    )
}

export function CheckIcon(props: IconProps) {
    return createIcon(
        <polyline points="20 6 9 17 4 12" />,
        props,
        2
    )
}

export function ResendIcon(props: IconProps) {
    return createIcon(
        <>
            <path d="M20 5v5h-5" />
            <path d="M20 10a8 8 0 1 0 2.34 5.66" />
        </>,
        props,
        2
    )
}

export function EditIcon(props: IconProps) {
    return createIcon(
        <>
            <path d="M12 20h9" />
            <path d="m16.5 3.5 4 4L7 21l-4 1 1-4Z" />
        </>,
        props,
        2
    )
}
