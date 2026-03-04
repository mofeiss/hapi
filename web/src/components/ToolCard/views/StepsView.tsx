import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { isObject } from '@hapi/protocol'
import type { ApiClient } from '@/api/client'
import type { ToolCallBlock } from '@/chat/types'
import type { SessionMetadataSummary } from '@/types/api'
import { CodeBlock } from '@/components/CodeBlock'
import { getToolFullViewComponent, type ToolViewComponent } from '@/components/ToolCard/views/_all'
import { renderToolInputContent } from '@/components/ToolCard/views/_input'
import { PermissionFooter } from '@/components/ToolCard/PermissionFooter'
import { AskUserQuestionFooter } from '@/components/ToolCard/AskUserQuestionFooter'
import { RequestUserInputFooter } from '@/components/ToolCard/RequestUserInputFooter'
import {
    formatAskUserQuestionAnswersForDisplay,
    isAskUserQuestionToolName,
    parseAskUserQuestionInput
} from '@/components/ToolCard/askUserQuestion'
import { isRequestUserInputToolName } from '@/components/ToolCard/requestUserInput'
import { getToolResultViewComponent } from '@/components/ToolCard/views/_results'
import { getToolPresentation } from '@/components/ToolCard/knownTools'
import { useTranslation } from '@/lib/use-translation'
import { cn } from '@/lib/utils'

type FlatQuestionAnswers = Record<string, string[]>
const OPTION_SNAPSHOT_LIMIT = 4

function normalizeQuestionAnswers(answers: unknown): FlatQuestionAnswers {
    if (!answers || typeof answers !== 'object') return {}
    const out: FlatQuestionAnswers = {}
    for (const [key, value] of Object.entries(answers)) {
        if (Array.isArray(value)) {
            out[key] = value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
            continue
        }
        if (!value || typeof value !== 'object') continue
        const nested = (value as { answers?: unknown }).answers
        if (Array.isArray(nested)) {
            out[key] = nested.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
        }
    }
    return out
}

function TaggedTextRow(props: { tag: string | null; text: string }) {
    return (
        <div className="min-w-0 w-full max-w-full rounded-md bg-[var(--app-code-bg)] pl-0 pr-2 py-0.5">
            <div className="font-mono text-xs leading-4 text-[var(--app-fg)] break-all">
                {props.tag ? (
                    <span className="inline-flex items-center rounded-sm bg-[var(--app-bg)] px-1 text-[10px] font-semibold uppercase tracking-[0.06em] text-[var(--app-hint)]">
                        {props.tag}
                    </span>
                ) : null}
                <span className={props.tag ? 'ml-2' : ''}>
                    {props.text}
                </span>
            </div>
        </div>
    )
}

function OptionSnapshotRow(props: { tag: string; text: string; fullText: string }) {
    return (
        <div className="min-w-0 w-full max-w-full rounded-md bg-[var(--app-code-bg)] pl-0 pr-2 py-0.5" title={props.fullText}>
            <div className="min-w-0 flex items-center gap-2 font-mono text-xs leading-4 text-[var(--app-fg)]">
                <span className="inline-flex items-center rounded-sm bg-[var(--app-bg)] px-1 text-[10px] font-semibold uppercase tracking-[0.06em] text-[var(--app-hint)]">
                    {props.tag}
                </span>
                <span className="min-w-0 flex-1 whitespace-nowrap overflow-hidden text-ellipsis" title={props.fullText}>
                    {props.text}
                </span>
            </div>
        </div>
    )
}

function buildOptionSnapshot(options: string[]): { preview: string; full: string } {
    const fullTokens = options.map((label) => label)
    const previewTokens = options
        .slice(0, OPTION_SNAPSHOT_LIMIT)
        .map((label) => label)
    if (options.length > OPTION_SNAPSHOT_LIMIT) {
        previewTokens.push(`+${options.length - OPTION_SNAPSHOT_LIMIT}`)
    }
    return {
        preview: previewTokens.join(' / '),
        full: fullTokens.join(' / ')
    }
}

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

function StepNodeDetails(props: {
    block: ToolCallBlock
    metadata: SessionMetadataSummary | null
    api?: ApiClient
    sessionId?: string
    disabled?: boolean
    onDone?: () => void
}) {
    const { t, locale } = useTranslation()
    const toolName = props.block.tool.name
    const FullToolView = getToolFullViewComponent(toolName)
    const ResultToolView = getToolResultViewComponent(toolName)
    const isAskUserQuestion = isAskUserQuestionToolName(toolName)
    const isRequestUserInput = isRequestUserInputToolName(toolName)
    const isQuestionTool = isAskUserQuestion || isRequestUserInput
    const isQuestionToolWithAnswers = Boolean(
        isQuestionTool
        && props.block.tool.permission?.answers
        && Object.keys(props.block.tool.permission.answers).length > 0
    )
    const askQuestions = useMemo(() => {
        if (!isAskUserQuestion) return []
        return parseAskUserQuestionInput(props.block.tool.input).questions
    }, [isAskUserQuestion, props.block.tool.input])
    const normalizedAskAnswers = useMemo(
        () => normalizeQuestionAnswers(props.block.tool.permission?.answers),
        [props.block.tool.permission?.answers]
    )
    const isAskUserQuestionMalformed = Boolean(
        isAskUserQuestion
        && askQuestions.length === 0
    )
    const isQuestionToolWithStructuredAnswers = Boolean(
        isQuestionToolWithAnswers
        && !isAskUserQuestionMalformed
    )
    const useAskUserQuestionPendingLayout = Boolean(
        isAskUserQuestion
        && props.block.tool.permission?.status === 'pending'
        && askQuestions.length > 0
        && props.api
        && props.sessionId
        && props.onDone
    )
    const useAskUserQuestionViewLayout = Boolean(
        isAskUserQuestion
        && isQuestionToolWithStructuredAnswers
        && askQuestions.length > 0
    )

    return (
        <div className="tool-io-scope space-y-2">
            {useAskUserQuestionPendingLayout ? (
                <AskUserQuestionFooter
                    api={props.api as ApiClient}
                    sessionId={props.sessionId as string}
                    tool={props.block.tool}
                    disabled={props.disabled ?? false}
                    onDone={props.onDone as () => void}
                />
            ) : useAskUserQuestionViewLayout ? (
                askQuestions.map((question, idx) => {
                    const optionLabels = question.options
                        .map((option) => option.label.trim())
                        .filter((label) => label.length > 0)
                    const optionSnapshot = optionLabels.length > 0
                        ? buildOptionSnapshot(optionLabels)
                        : null
                    const answerValues = normalizedAskAnswers[String(idx)] ?? []
                    const displayAnswerValues = formatAskUserQuestionAnswersForDisplay(
                        question,
                        answerValues,
                        locale === 'zh-CN' ? 'zh-CN' : 'en'
                    )

                    return (
                        <div key={idx} className="space-y-2">
                            <div>
                                <div className="mb-1 text-[11px] font-medium text-[var(--app-hint)]">
                                    {locale === 'zh-CN' ? '问题' : 'Questions'}
                                </div>
                                <TaggedTextRow
                                    tag={question.header}
                                    text={question.question.trim()}
                                />
                                {optionSnapshot ? (
                                    <div className="mt-1">
                                        <OptionSnapshotRow
                                            tag={locale === 'zh-CN' ? '选项' : 'Options'}
                                            text={optionSnapshot.preview}
                                            fullText={optionSnapshot.full}
                                        />
                                    </div>
                                ) : null}
                            </div>
                            <div>
                                <div className="mb-1 text-[11px] font-medium text-[var(--app-hint)]">
                                    {locale === 'zh-CN' ? '回答' : 'Answers'}
                                </div>
                                {displayAnswerValues.length > 0 ? (
                                    <CodeBlock code={displayAnswerValues.join(' / ')} language="text" />
                                ) : (
                                    <div className="text-sm text-[var(--app-hint)]">(no output)</div>
                                )}
                            </div>
                        </div>
                    )
                })
            ) : (
                <>
                    <div>
                        <div className="mb-1 text-[11px] font-medium text-[var(--app-hint)]">
                            {isQuestionToolWithStructuredAnswers ? t('tool.questionsAnswers') : t('tool.input')}
                        </div>
                        {FullToolView && !isAskUserQuestionMalformed && !isAskUserQuestion ? (
                            <FullToolView
                                block={props.block}
                                metadata={props.metadata}
                                api={props.api}
                                sessionId={props.sessionId}
                                disabled={props.disabled}
                                onDone={props.onDone}
                            />
                        ) : (
                            renderToolInputContent(props.block, props.metadata)
                        )}
                    </div>
                    {!isQuestionToolWithStructuredAnswers ? (
                        <div>
                            <div className="mb-1 text-[11px] font-medium text-[var(--app-hint)]">{t('tool.result')}</div>
                            <ResultToolView block={props.block} metadata={props.metadata} />
                        </div>
                    ) : null}
                </>
            )}
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
                    <StepNodeDetails
                        block={props.block}
                        metadata={props.metadata}
                        api={props.api}
                        sessionId={props.sessionId}
                        disabled={props.disabled}
                        onDone={props.onDone}
                    />

                    {(() => {
                        if (!props.api || !props.sessionId || !props.onDone) return null

                        const permission = props.block.tool.permission
                        const toolName = props.block.tool.name
                        const isAskUserQuestion = isAskUserQuestionToolName(toolName)
                        const isRequestUserInput = isRequestUserInputToolName(toolName)
                        const askQuestions = isAskUserQuestion
                            ? parseAskUserQuestionInput(props.block.tool.input).questions
                            : []
                        const askPendingHandledInDetails = Boolean(
                            isAskUserQuestion
                            && permission?.status === 'pending'
                            && askQuestions.length > 0
                        )
                        const shouldRenderPermissionFooter = Boolean(
                            permission && (
                                permission.status === 'pending'
                                || ((permission.status === 'denied' || permission.status === 'canceled') && Boolean(permission.reason))
                            )
                        )
                        if (!shouldRenderPermissionFooter || askPendingHandledInDetails) return null

                        let content: ReactNode = null

                        if (isAskUserQuestion && permission?.status === 'pending' && askQuestions.length > 0) {
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
