import { useState, useEffect, type FC, type PropsWithChildren, type TransitionEvent } from 'react'
import { useMessage, type ReasoningGroupProps } from '@assistant-ui/react'
import { MarkdownTextPrimitive } from '@assistant-ui/react-markdown'
import { cn } from '@/lib/utils'
import { defaultComponents, MARKDOWN_PLUGINS } from '@/components/assistant-ui/markdown-text'

type ReasoningMessagePart = {
    type: 'reasoning'
    text: string
}

function ChevronIcon(props: { className?: string; open?: boolean }) {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={cn(
                'transition-transform duration-200',
                props.open ? 'rotate-90' : '',
                props.className
            )}
        >
            <polyline points="9 18 15 12 9 6" />
        </svg>
    )
}

export function BrainIcon(props: { className?: string }) {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={props.className}
        >
            <path d="M12 5a3 3 0 1 0-5.997.125 4 4 0 0 0-2.526 5.77 4 4 0 0 0 .556 6.588A4 4 0 1 0 12 18Z" />
            <path d="M12 5a3 3 0 1 1 5.997.125 4 4 0 0 1 2.526 5.77 4 4 0 0 1-.556 6.588A4 4 0 1 1 12 18Z" />
            <path d="M15 13a4.5 4.5 0 0 1-3-4 4.5 4.5 0 0 1-3 4" />
            <path d="M17.599 6.5a3 3 0 0 0 .399-1.375" />
            <path d="M6.003 5.125A3 3 0 0 0 6.401 6.5" />
            <path d="M3.477 10.896a4 4 0 0 1 .585-.396" />
            <path d="M19.938 10.5a4 4 0 0 1 .585.396" />
            <path d="M6 18a4 4 0 0 1-1.967-.516" />
            <path d="M19.967 17.484A4 4 0 0 1 18 18" />
        </svg>
    )
}

function ShimmerDot() {
    return (
        <span className="inline-block w-1.5 h-1.5 bg-current rounded-full animate-pulse" />
    )
}

function summarizeReasoning(text: string): string {
    return text
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line.length > 0)
        .join(' ')
}

/**
 * Renders individual reasoning message part content with markdown support.
 */
export const Reasoning: FC = () => {
    return (
        <MarkdownTextPrimitive
            remarkPlugins={MARKDOWN_PLUGINS}
            components={defaultComponents}
            className={cn('aui-reasoning-content min-w-0 max-w-full break-words text-xs text-[var(--app-hint)] opacity-80')}
        />
    )
}

/**
 * Wraps consecutive reasoning parts in a collapsible container.
 * Shows shimmer effect while reasoning is streaming.
 */
export const ReasoningGroup: FC<PropsWithChildren<ReasoningGroupProps>> = ({ children, startIndex, endIndex }) => {
    // Check if reasoning is still streaming
    const message = useMessage()
    const reasoningText = message.content
        .slice(startIndex, endIndex + 1)
        .filter((part): part is ReasoningMessagePart => part.type === 'reasoning' && typeof (part as ReasoningMessagePart).text === 'string')
        .map((part) => part.text)
        .join('\n')
    const preview = summarizeReasoning(reasoningText)
    const isStreaming = message.status?.type === 'running'
        && message.content.length > 0
        && message.content[message.content.length - 1]?.type === 'reasoning'
    const [isOpen, setIsOpen] = useState(isStreaming)
    const [showPreview, setShowPreview] = useState(!isStreaming)

    // Auto-expand while streaming
    useEffect(() => {
        if (isStreaming) {
            setShowPreview(false)
            setIsOpen(true)
        }
    }, [isStreaming])

    const toggleOpen = () => {
        setShowPreview(false)
        setIsOpen((current) => !current)
    }

    const handleCollapseTransitionEnd = (event: TransitionEvent<HTMLDivElement>) => {
        if (event.target !== event.currentTarget) return
        if (event.propertyName !== 'max-height') return
        if (!isOpen) {
            setShowPreview(true)
        }
    }

    return (
        <div className="aui-reasoning-group my-2">
            <button
                type="button"
                onClick={toggleOpen}
                className={cn(
                    'flex w-full min-w-0 items-center gap-1.5 text-left',
                    'transition-colors cursor-pointer select-none'
                )}
            >
                <span className="shrink-0 text-[var(--app-hint)]">
                    <BrainIcon className="h-3 w-3" />
                </span>
                <span className="shrink-0 text-[var(--app-hint)]">
                    <ChevronIcon open={isOpen} />
                </span>
                <span className="min-w-0 flex flex-1 items-baseline gap-2">
                    <span className="shrink-0 text-sm text-[var(--app-hint)] opacity-90">Reasoning</span>
                    {!isOpen && showPreview && preview ? (
                        <span className="min-w-0 flex-1 truncate whitespace-nowrap font-mono text-xs text-[var(--app-hint)] opacity-60">
                            {preview}
                        </span>
                    ) : null}
                </span>
                {isStreaming && (
                    <span className="ml-1 flex items-center gap-1 text-[var(--app-hint)]">
                        <ShimmerDot />
                    </span>
                )}
            </button>

            <div
                onTransitionEnd={handleCollapseTransitionEnd}
                className={cn(
                    'overflow-hidden transition-all duration-200 ease-in-out',
                    isOpen ? 'max-h-[5000px] opacity-100' : 'max-h-0 opacity-0'
                )}
            >
                <div className="ml-0.5 border-l-2 border-[var(--app-border)] pl-4 pt-2">
                    {children}
                </div>
            </div>
        </div>
    )
}
