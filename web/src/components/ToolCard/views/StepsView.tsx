import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { isObject, safeStringify } from '@hapi/protocol'
import type { ApiClient } from '@/api/client'
import type { ToolCallBlock } from '@/chat/types'
import type { SessionMetadataSummary } from '@/types/api'
import type { ToolViewComponent } from '@/components/ToolCard/views/_all'
import { CodeBlock } from '@/components/CodeBlock'
import { MarkdownRenderer } from '@/components/MarkdownRenderer'
import { PermissionFooter } from '@/components/ToolCard/PermissionFooter'
import { AskUserQuestionFooter } from '@/components/ToolCard/AskUserQuestionFooter'
import { RequestUserInputFooter } from '@/components/ToolCard/RequestUserInputFooter'
import { isAskUserQuestionToolName } from '@/components/ToolCard/askUserQuestion'
import { isRequestUserInputToolName } from '@/components/ToolCard/requestUserInput'
import { sanitizeReadResultText } from '@/components/ToolCard/views/_results'
import { getToolPresentation } from '@/components/ToolCard/knownTools'
import { extractSkillReadData } from '@/lib/skillRead'
import { useTranslation } from '@/lib/use-translation'

function hasPendingPermissionInSubtree(block: ToolCallBlock): boolean {
    if (block.tool.permission?.status === 'pending') return true
    return block.children.some((child) => child.kind === 'tool-call' && hasPendingPermissionInSubtree(child))
}

function StepStatusIcon(props: { state: ToolCallBlock['tool']['state'] }) {
    if (props.state === 'completed') {
        return (
            <svg className="h-3.5 w-3.5 text-emerald-600" viewBox="0 0 16 16" fill="none">
                <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.5" />
                <path d="M5.2 8.3l1.8 1.8 3.8-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
        )
    }
    if (props.state === 'error') {
        return (
            <svg className="h-3.5 w-3.5 text-red-600" viewBox="0 0 16 16" fill="none">
                <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.5" />
                <path d="M5.6 5.6l4.8 4.8M10.4 5.6l-4.8 4.8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
        )
    }
    if (props.state === 'pending') {
        return (
            <svg className="h-3.5 w-3.5 text-amber-600" viewBox="0 0 16 16" fill="none">
                <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.5" />
            </svg>
        )
    }
    return (
        <svg className="h-3.5 w-3.5 animate-spin text-amber-600" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2.5" opacity="0.25" />
            <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" opacity="0.75" />
        </svg>
    )
}

function StepNodeChevron(props: { open: boolean }) {
    return (
        <svg
            className={`h-3.5 w-3.5 transition-transform ${props.open ? 'rotate-90' : 'rotate-0'}`}
            viewBox="0 0 16 16"
            fill="none"
        >
            <path d="M6 3l5 5-5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    )
}

function extractReadResultContent(result: unknown): string | null {
    if (typeof result === 'string') {
        return sanitizeReadResultText(result)
    }
    if (!isObject(result)) return null

    const file = isObject(result.file) ? result.file : null
    if (file && typeof file.content === 'string') {
        return sanitizeReadResultText(file.content)
    }

    if (typeof result.content === 'string') {
        return sanitizeReadResultText(result.content)
    }

    return null
}

function StepNodeDetails(props: { block: ToolCallBlock }) {
    const { t } = useTranslation()

    if (props.block.tool.name === 'SkillRead') {
        const data = extractSkillReadData(props.block.tool.input, props.block.tool.result)
        if (data?.content) {
            return (
                <div className="tool-io-scope rounded-md bg-[var(--app-bg)] p-2">
                    <MarkdownRenderer content={data.content} />
                </div>
            )
        }
    }

    const isReadLikeTool = props.block.tool.name === 'Read' || props.block.tool.name === 'NotebookRead'
    if (isReadLikeTool) {
        const readContent = extractReadResultContent(props.block.tool.result)
        if (typeof readContent === 'string') {
            return (
                <div className="tool-io-scope space-y-2">
                    <div>
                        <div className="mb-1 text-[11px] font-medium text-[var(--app-hint)]">{t('tool.input')}</div>
                        <CodeBlock code={safeStringify(props.block.tool.input)} language="json" />
                    </div>
                    <div>
                        <div className="mb-1 text-[11px] font-medium text-[var(--app-hint)]">{t('tool.result')}</div>
                        {readContent.trim().length > 0 ? (
                            <CodeBlock code={readContent} language="text" />
                        ) : (
                            <div className="text-sm text-[var(--app-hint)]">(no output)</div>
                        )}
                    </div>
                </div>
            )
        }
    }

    return (
        <div className="tool-io-scope space-y-2">
            <div>
                <div className="mb-1 text-[11px] font-medium text-[var(--app-hint)]">{t('tool.input')}</div>
                <CodeBlock code={safeStringify(props.block.tool.input)} language="json" />
            </div>
            <div>
                <div className="mb-1 text-[11px] font-medium text-[var(--app-hint)]">{t('tool.result')}</div>
                <CodeBlock
                    code={safeStringify(props.block.tool.result ?? 'No result')}
                    language={typeof props.block.tool.result === 'string' ? 'text' : 'json'}
                />
            </div>
        </div>
    )
}

function StepNode(props: {
    block: ToolCallBlock
    metadata: SessionMetadataSummary | null
    api?: ApiClient
    sessionId?: string
    disabled?: boolean
    onDone?: () => void
}) {
    const { locale } = useTranslation()
    const shouldAutoOpen = hasPendingPermissionInSubtree(props.block)
    const [open, setOpen] = useState(shouldAutoOpen)
    const nodeRef = useRef<HTMLDivElement | null>(null)
    const prevShouldAutoOpenRef = useRef(shouldAutoOpen)
    const presentation = useMemo(() => getToolPresentation({
        toolName: props.block.tool.name,
        input: props.block.tool.input,
        result: props.block.tool.result,
        childrenCount: props.block.children.length,
        description: props.block.tool.description,
        metadata: props.metadata ?? null,
        locale
    }), [props.block, props.metadata, locale])

    const childTools = props.block.children.filter((child): child is ToolCallBlock => child.kind === 'tool-call')
    const otherChildren = props.block.children.filter((child) => child.kind !== 'tool-call')

    useEffect(() => {
        if (shouldAutoOpen && !prevShouldAutoOpenRef.current) {
            setOpen(true)
        }
        prevShouldAutoOpenRef.current = shouldAutoOpen
    }, [shouldAutoOpen])

    const toggleOpen = () => {
        const next = !open
        const nodeEl = nodeRef.current
        const viewport = nodeEl?.closest('[data-chat-viewport="true"]') as HTMLElement | null
        const wasAtBottom = viewport
            ? (viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight) <= 2
            : false
        const anchorTopBefore = nodeEl?.getBoundingClientRect().top ?? null

        setOpen(next)

        if (wasAtBottom && nodeEl && viewport) {
            viewport?.dispatchEvent(new CustomEvent('hapi:disable-auto-scroll'))
            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    if (!nodeRef.current) return
                    if (!viewport.isConnected) return
                    if (anchorTopBefore === null) return
                    const anchorTopAfter = nodeRef.current.getBoundingClientRect().top
                    const delta = anchorTopAfter - anchorTopBefore
                    if (Math.abs(delta) > 0.5) {
                        viewport.scrollTop += delta
                    }
                })
            })
        }
    }

    return (
        <div ref={nodeRef} className="space-y-0.5">
            <button
                type="button"
                className="flex w-full items-center gap-1.5 rounded px-1 py-0.5 text-left hover:bg-[var(--app-subtle-bg)]"
                onClick={toggleOpen}
            >
                <span className="shrink-0 text-[var(--app-hint)]">
                    <StepNodeChevron open={open} />
                </span>
                <span className="shrink-0">
                    <StepStatusIcon state={props.block.tool.state} />
                </span>
                <span className="min-w-0 flex-1 truncate whitespace-nowrap">
                    <span className="text-sm text-[var(--app-fg)]">{presentation.title}</span>
                    {presentation.subtitle ? (
                        <span className="ml-2 font-mono text-xs text-[var(--app-hint)]">
                            {presentation.subtitle}
                        </span>
                    ) : null}
                </span>
            </button>

            {open ? (
                <div className="ml-5 border-l border-[var(--app-border)] pl-2.5 space-y-1">
                    <StepNodeDetails block={props.block} />

                    {(() => {
                        if (!props.api || !props.sessionId || !props.onDone) return null

                        const permission = props.block.tool.permission
                        const toolName = props.block.tool.name
                        const isAskUserQuestion = isAskUserQuestionToolName(toolName)
                        const isRequestUserInput = isRequestUserInputToolName(toolName)
                        const shouldRenderPermissionFooter = Boolean(
                            permission && (
                                permission.status === 'pending'
                                || ((permission.status === 'denied' || permission.status === 'canceled') && Boolean(permission.reason))
                            )
                        )
                        if (!shouldRenderPermissionFooter) return null

                        let content: ReactNode = null

                        if (isAskUserQuestion && permission?.status === 'pending') {
                            content = (
                                <AskUserQuestionFooter
                                    api={props.api}
                                    sessionId={props.sessionId}
                                    tool={props.block.tool}
                                    disabled={props.disabled ?? false}
                                    onDone={props.onDone}
                                />
                            )
                        } else if (isRequestUserInput && permission?.status === 'pending') {
                            content = (
                                <RequestUserInputFooter
                                    api={props.api}
                                    sessionId={props.sessionId}
                                    tool={props.block.tool}
                                    disabled={props.disabled ?? false}
                                    onDone={props.onDone}
                                />
                            )
                        } else {
                            content = (
                                <PermissionFooter
                                    api={props.api}
                                    sessionId={props.sessionId}
                                    metadata={props.metadata}
                                    tool={props.block.tool}
                                    disabled={props.disabled ?? false}
                                    onDone={props.onDone}
                                />
                            )
                        }

                        if (!content) return null

                        return <div className="mt-1 rounded-md border border-[var(--app-border)] bg-[var(--app-subtle-bg)] px-2 py-1.5">{content}</div>
                    })()}

                    {otherChildren.map((child) => {
                        if (child.kind === 'agent-text') {
                            return (
                                <div key={child.id} className="text-xs text-[var(--app-hint)]">
                                    {child.text}
                                </div>
                            )
                        }
                        if (child.kind === 'agent-event') {
                            return (
                                <div key={child.id} className="text-xs text-[var(--app-hint)]">
                                    {isObject(child.event) && typeof child.event.type === 'string'
                                        ? child.event.type
                                        : 'event'}
                                </div>
                            )
                        }
                        return null
                    })}

                    {childTools.length > 0 ? (
                        <div className="space-y-0.5">
                            {childTools.map((child) => (
                                <StepNode
                                    key={child.id}
                                    block={child}
                                    metadata={props.metadata}
                                    api={props.api}
                                    sessionId={props.sessionId}
                                    disabled={props.disabled}
                                    onDone={props.onDone}
                                />
                            ))}
                        </div>
                    ) : null}
                </div>
            ) : null}
        </div>
    )
}

export const StepsView: ToolViewComponent = (props) => {
    const children = props.block.children.filter((child): child is ToolCallBlock => child.kind === 'tool-call')

    if (children.length === 0) {
        return null
    }

    return (
        <div className="space-y-0.5">
            {children.map((child) => (
                <StepNode
                    key={child.id}
                    block={child}
                    metadata={props.metadata}
                    api={props.api}
                    sessionId={props.sessionId}
                    disabled={props.disabled}
                    onDone={props.onDone}
                />
            ))}
        </div>
    )
}
