import type { ToolCallBlock } from '@/chat/types'
import type { ApiClient } from '@/api/client'
import type { SessionMetadataSummary } from '@/types/api'
import { memo, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { CodeBlock } from '@/components/CodeBlock'
import { PermissionFooter } from '@/components/ToolCard/PermissionFooter'
import { AskUserQuestionFooter } from '@/components/ToolCard/AskUserQuestionFooter'
import { RequestUserInputFooter } from '@/components/ToolCard/RequestUserInputFooter'
import {
    extractAskUserQuestionResultText,
    formatAskUserQuestionAnswersForDisplay,
    isAskUserQuestionToolName,
    parseAskUserQuestionInput
} from '@/components/ToolCard/askUserQuestion'
import { isRequestUserInputToolName } from '@/components/ToolCard/requestUserInput'
import { getToolPresentation } from '@/components/ToolCard/knownTools'
import { getToolFullViewComponent, getToolViewComponent } from '@/components/ToolCard/views/_all'
import { renderToolInputContent } from '@/components/ToolCard/views/_input'
import { getToolResultViewComponent } from '@/components/ToolCard/views/_results'
import { isResultOnlyToolName } from '@/components/ToolCard/toolRenderModes'
import { usePointerFocusRing } from '@/hooks/usePointerFocusRing'
import { truncate } from '@/lib/toolInputUtils'
import { cn } from '@/lib/utils'
import { useTranslation } from '@/lib/use-translation'
import type { Locale } from '@/lib/i18n-context'

const ELAPSED_INTERVAL_MS = 1000

function ElapsedView(props: { from: number; active: boolean }) {
    const [now, setNow] = useState(() => Date.now())

    useEffect(() => {
        if (!props.active) return
        const id = setInterval(() => setNow(Date.now()), ELAPSED_INTERVAL_MS)
        return () => clearInterval(id)
    }, [props.active])

    if (!props.active) return null

    const elapsed = (now - props.from) / 1000
    if (!Number.isFinite(elapsed)) return null

    return (
        <span className="font-mono text-xs text-[var(--app-hint)]">
            {elapsed.toFixed(1)}s
        </span>
    )
}

function formatTaskChildLabel(child: ToolCallBlock, metadata: SessionMetadataSummary | null, locale: Locale): string {
    const presentation = getToolPresentation({
        toolName: child.tool.name,
        input: child.tool.input,
        result: child.tool.result,
        childrenCount: child.children.length,
        description: child.tool.description,
        metadata,
        locale
    })

    if (presentation.subtitle) {
        return truncate(`${presentation.title}: ${presentation.subtitle}`, 140)
    }

    return presentation.title
}

function TaskStateIcon(props: { state: ToolCallBlock['tool']['state'] }) {
    if (props.state === 'completed') {
        return <span className="text-emerald-600">✓</span>
    }
    if (props.state === 'error') {
        return <span className="text-red-600">✕</span>
    }
    if (props.state === 'pending') {
        return <span className="text-amber-600">🔐</span>
    }
    return <span className="text-amber-600 animate-pulse">●</span>
}

function getTaskSummaryChildren(block: ToolCallBlock): { visible: ToolCallBlock[]; remaining: number } | null {
    if (block.tool.name !== 'Task') return null

    const children = block.children
        .filter((child): child is ToolCallBlock => child.kind === 'tool-call')
        .filter((child) => child.tool.state === 'pending' || child.tool.state === 'running' || child.tool.state === 'completed' || child.tool.state === 'error')

    if (children.length === 0) return null

    const visible = children.slice(-3)
    return { visible, remaining: children.length - visible.length }
}

function hasPendingPermissionInTree(block: ToolCallBlock): boolean {
    if (block.tool.permission?.status === 'pending') return true
    return block.children.some((child) => child.kind === 'tool-call' && hasPendingPermissionInTree(child))
}

function renderTaskSummary(block: ToolCallBlock, metadata: SessionMetadataSummary | null, locale: Locale): ReactNode | null {
    const summary = getTaskSummaryChildren(block)
    if (!summary) return null

    const visible = summary.visible
    const remaining = summary.remaining

    return (
        <div className="flex flex-col gap-1 px-1">
            <div className="flex flex-col gap-1">
                {visible.map((child) => (
                    <div key={child.id} className="flex items-center gap-2">
                        <div className="min-w-0 flex-1 font-mono text-xs text-[var(--app-hint)]">
                            <span className="mr-2 inline-block w-4 text-center align-middle">
                                <TaskStateIcon state={child.tool.state} />
                            </span>
                            <span className="align-middle break-all">
                                {formatTaskChildLabel(child, metadata, locale)}
                            </span>
                        </div>
                    </div>
                ))}
                {remaining > 0 ? (
                    <div className="text-xs text-[var(--app-hint)] italic">
                        (+{remaining} more)
                    </div>
                ) : null}
            </div>
        </div>
    )
}

function StatusIcon(props: { state: ToolCallBlock['tool']['state'] }) {
    if (props.state === 'completed') {
        return (
            <svg className="h-3 w-3" viewBox="0 0 16 16" fill="none">
                <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.5" />
                <path d="M5.2 8.3l1.8 1.8 3.8-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
        )
    }
    if (props.state === 'error') {
        return (
            <svg className="h-3 w-3" viewBox="0 0 16 16" fill="none">
                <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.5" />
                <path d="M5.6 5.6l4.8 4.8M10.4 5.6l-4.8 4.8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
        )
    }
    if (props.state === 'pending') {
        return (
            <svg className="h-3 w-3" viewBox="0 0 16 16" fill="none">
                <rect x="4.5" y="7" width="7" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
                <path d="M6 7V5.8a2 2 0 0 1 4 0V7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
        )
    }
    return (
        <svg className="h-3 w-3 animate-spin" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2.5" opacity="0.25" />
            <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" opacity="0.75" />
        </svg>
    )
}

function statusColorClass(state: ToolCallBlock['tool']['state']): string {
    if (state === 'completed') return 'text-emerald-600'
    if (state === 'error') return 'text-red-600'
    if (state === 'pending') return 'text-amber-600'
    return 'text-[var(--app-hint)]'
}

function ExpandIcon(props: { expanded: boolean }) {
    return (
        <svg
            className={cn('h-4 w-4 transition-transform', props.expanded ? 'rotate-180' : 'rotate-0')}
            viewBox="0 0 16 16"
            fill="none"
        >
            <path d="M3.5 6l4.5 4 4.5-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    )
}

type ToolCardProps = {
    api: ApiClient
    sessionId: string
    metadata: SessionMetadataSummary | null
    disabled: boolean
    onDone: () => void
    block: ToolCallBlock
}

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

function QuestionRow(props: { header: string | null; question: string }) {
    return <TaggedTextRow tag={props.header} text={props.question} />
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

function ToolCardInner(props: ToolCardProps) {
    const { t, locale } = useTranslation()
    const presentation = useMemo(() => getToolPresentation({
        toolName: props.block.tool.name,
        input: props.block.tool.input,
        result: props.block.tool.result,
        childrenCount: props.block.children.length,
        description: props.block.tool.description,
        metadata: props.metadata,
        locale
    }), [
        props.block.tool.name,
        props.block.tool.input,
        props.block.tool.result,
        props.block.children.length,
        props.block.tool.description,
        props.metadata,
        locale
    ])

    const toolName = props.block.tool.name
    const toolTitle = presentation.title
    const subtitle = presentation.subtitle ?? props.block.tool.description
    const taskSummary = renderTaskSummary(props.block, props.metadata, locale)
    const runningFrom = props.block.tool.startedAt ?? props.block.tool.createdAt
    const showInline = !presentation.minimal && toolName !== 'Task'
    const isResultOnlyTool = isResultOnlyToolName(toolName, props.block.tool.input, props.block.tool.result)
    const CompactToolView = !isResultOnlyTool && showInline ? getToolViewComponent(toolName) : null
    const FullToolView = !isResultOnlyTool ? getToolFullViewComponent(toolName) : null
    const ResultToolView = getToolResultViewComponent(toolName)
    const permission = props.block.tool.permission
    const hasPendingPermission = useMemo(
        () => hasPendingPermissionInTree(props.block),
        [props.block]
    )
    const isAskUserQuestion = isAskUserQuestionToolName(toolName)
    const isRequestUserInput = isRequestUserInputToolName(toolName)
    const isQuestionTool = isAskUserQuestion || isRequestUserInput
    const defaultExpanded = Boolean(
        isAskUserQuestion
        || (isQuestionTool && permission?.status === 'pending')
        || hasPendingPermission
        || toolName === 'Steps'
    )
    const [expanded, setExpanded] = useState(defaultExpanded)
    const cardRef = useRef<HTMLDivElement | null>(null)
    const prevHasPendingPermissionRef = useRef(hasPendingPermission)
    const hasInlineDetails = showInline || taskSummary !== null || toolName !== 'Task'
    const showsPermissionFooter = Boolean(permission && (
        permission.status === 'pending'
        || ((permission.status === 'denied' || permission.status === 'canceled') && Boolean(permission.reason))
    ))
    const hasBody = expanded && (hasInlineDetails || showsPermissionFooter)
    const canExpand = hasInlineDetails || showsPermissionFooter
    const stateColor = statusColorClass(props.block.tool.state)
    const { suppressFocusRing, onTriggerPointerDown, onTriggerKeyDown, onTriggerBlur } = usePointerFocusRing()

    useEffect(() => {
        setExpanded(defaultExpanded)
    }, [props.block.id, defaultExpanded])

    useEffect(() => {
        if (hasPendingPermission && !prevHasPendingPermissionRef.current) {
            setExpanded(true)
        }
        prevHasPendingPermissionRef.current = hasPendingPermission
    }, [hasPendingPermission])

    const toggleExpanded = () => {
        if (!canExpand) return
        const next = !expanded
        const cardEl = cardRef.current
        const viewport = cardEl?.closest('[data-chat-viewport="true"]') as HTMLElement | null
        const wasAtBottom = viewport
            ? (viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight) <= 2
            : false
        const anchorTopBefore = cardEl?.getBoundingClientRect().top ?? null

        setExpanded(next)

        if (wasAtBottom && cardEl && viewport) {
            viewport?.dispatchEvent(new CustomEvent('hapi:disable-auto-scroll'))
            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    if (!cardRef.current) return
                    if (!viewport.isConnected) return
                    if (anchorTopBefore === null) return
                    const anchorTopAfter = cardRef.current.getBoundingClientRect().top
                    const delta = anchorTopAfter - anchorTopBefore
                    if (Math.abs(delta) > 0.5) {
                        viewport.scrollTop += delta
                    }
                })
            })
        }
    }

    const header = (
        <div className="flex items-center justify-between gap-3">
            <div className="min-w-0 flex items-center gap-2">
                <div className="shrink-0 flex h-3.5 w-3.5 items-center justify-center text-[var(--app-hint)] leading-none">
                    {presentation.icon}
                </div>
                <span className={cn('shrink-0', stateColor)}>
                    <StatusIcon state={props.block.tool.state} />
                </span>
                <div className="min-w-0 flex items-baseline gap-1.5 overflow-hidden">
                    <CardTitle className="shrink-0 text-sm font-medium leading-tight">
                        {toolTitle}
                    </CardTitle>
                    {subtitle ? (
                        <span
                            className="min-w-0 truncate font-mono text-xs leading-tight text-[var(--app-hint)] opacity-80"
                            title={subtitle}
                        >
                            {truncate(subtitle, 160)}
                        </span>
                    ) : null}
                </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
                <ElapsedView from={runningFrom} active={props.block.tool.state === 'running'} />
                {canExpand ? (
                    <span className="text-[var(--app-hint)]">
                        <ExpandIcon expanded={expanded} />
                    </span>
                ) : null}
            </div>
        </div>
    )

    const isQuestionToolWithAnswers = Boolean(
        isQuestionTool
        && permission?.answers
        && Object.keys(permission.answers).length > 0
    )
    const askQuestions = useMemo(() => {
        if (!isAskUserQuestion) return []
        return parseAskUserQuestionInput(props.block.tool.input).questions
    }, [isAskUserQuestion, props.block.tool.input])
    const normalizedAskAnswers = useMemo(
        () => normalizeQuestionAnswers(permission?.answers),
        [permission?.answers]
    )
    const hasAnyAskAnswers = useMemo(
        () => Object.keys(normalizedAskAnswers).length > 0,
        [normalizedAskAnswers]
    )
    const askResultText = useMemo(
        () => (isAskUserQuestion ? extractAskUserQuestionResultText(props.block.tool.result) : null),
        [isAskUserQuestion, props.block.tool.result]
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
        && permission?.status === 'pending'
        && askQuestions.length > 0
    )
    const useAskUserQuestionViewLayout = Boolean(
        isAskUserQuestion
        && askQuestions.length > 0
        && (
            permission?.status === 'approved'
            || permission?.status === 'denied'
            || permission?.status === 'canceled'
        )
    )
    const hideAskUserQuestionReasonFooter = Boolean(
        isAskUserQuestion
        && askQuestions.length > 0
        && permission
        && permission.status !== 'pending'
    )

    return (
        <Card ref={cardRef} className="overflow-hidden shadow-sm">
            <CardHeader className="px-3 pt-3 pb-1.5 space-y-0">
                {canExpand ? (
                    <button
                        type="button"
                        className={cn(
                            'w-full text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--app-link)]',
                            suppressFocusRing && 'focus-visible:ring-0'
                        )}
                        onClick={toggleExpanded}
                        onPointerDown={onTriggerPointerDown}
                        onKeyDown={onTriggerKeyDown}
                        onBlur={onTriggerBlur}
                    >
                        {header}
                    </button>
                ) : (
                    <div>{header}</div>
                )}
            </CardHeader>

            {hasBody ? (
                <CardContent className="tool-io-scope px-3 pb-3 pt-0">
                    {taskSummary ? (
                        <div className="mt-1">
                            {taskSummary}
                        </div>
                    ) : null}

                    {isResultOnlyTool ? (
                        <div className="mt-1.5">
                            <ResultToolView block={props.block} metadata={props.metadata} />
                        </div>
                    ) : showInline ? (
                        CompactToolView ? (
                            <div className="mt-1.5">
                                <CompactToolView
                                    block={props.block}
                                    metadata={props.metadata}
                                    api={props.api}
                                    sessionId={props.sessionId}
                                    disabled={props.disabled}
                                    onDone={props.onDone}
                                />
                            </div>
                        ) : (
                            <div className="mt-1.5 flex flex-col gap-3">
                                <div>
                                    <div className="mb-1 text-[11px] font-medium text-[var(--app-hint)]">{t('tool.input')}</div>
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
                            </div>
                        )
                    ) : toolName !== 'Task' ? (
                        <div className="mt-1.5 flex flex-col gap-3">
                            {useAskUserQuestionPendingLayout ? (
                                <AskUserQuestionFooter
                                    api={props.api}
                                    sessionId={props.sessionId}
                                    tool={props.block.tool}
                                    disabled={props.disabled}
                                    onDone={props.onDone}
                                />
                            ) : useAskUserQuestionViewLayout ? (
                                (() => {
                                    const showSharedInterruptedAnswer = Boolean(
                                        askQuestions.length > 1
                                        && !hasAnyAskAnswers
                                        && askResultText
                                    )
                                    const questionsLabel = locale === 'zh-CN' ? '问题' : 'Questions'
                                    const answersLabel = locale === 'zh-CN' ? '回答' : 'Answers'
                                    const optionsLabel = locale === 'zh-CN' ? '选项' : 'Options'

                                    if (showSharedInterruptedAnswer) {
                                        return (
                                            <>
                                                <div>
                                                    <div className="mb-1 text-[11px] font-medium text-[var(--app-hint)]">
                                                        {questionsLabel}
                                                    </div>
                                                    <div className="space-y-0">
                                                        {askQuestions.map((question, idx) => {
                                                            const optionLabels = question.options
                                                                .map((option) => option.label.trim())
                                                                .filter((label) => label.length > 0)
                                                            const optionSnapshot = optionLabels.length > 0
                                                                ? buildOptionSnapshot(optionLabels)
                                                                : null

                                                            return (
                                                                <div key={idx} className="space-y-0">
                                                                    <QuestionRow
                                                                        header={question.header}
                                                                        question={question.question.trim()}
                                                                    />
                                                                    {optionSnapshot ? (
                                                                        <OptionSnapshotRow
                                                                            tag={optionsLabel}
                                                                            text={optionSnapshot.preview}
                                                                            fullText={optionSnapshot.full}
                                                                        />
                                                                    ) : null}
                                                                </div>
                                                            )
                                                        })}
                                                    </div>
                                                </div>
                                                <div>
                                                    <div className="mb-1 text-[11px] font-medium text-[var(--app-hint)]">
                                                        {answersLabel}
                                                    </div>
                                                    <CodeBlock code={askResultText as string} language="text" />
                                                </div>
                                            </>
                                        )
                                    }

                                    return (
                                        <>
                                            {askQuestions.map((question, idx) => {
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
                                                const answerDisplayText = displayAnswerValues.length > 0
                                                    ? displayAnswerValues.join(' / ')
                                                    : (!hasAnyAskAnswers ? askResultText : null)

                                                return (
                                                    <div key={idx} className="space-y-0">
                                                        <div>
                                                            <div className="mb-1 text-[11px] font-medium text-[var(--app-hint)]">
                                                                {questionsLabel}
                                                            </div>
                                                            <QuestionRow
                                                                header={question.header}
                                                                question={question.question.trim()}
                                                            />
                                                            {optionSnapshot ? (
                                                                <div className="mt-0">
                                                                    <OptionSnapshotRow
                                                                        tag={optionsLabel}
                                                                        text={optionSnapshot.preview}
                                                                        fullText={optionSnapshot.full}
                                                                    />
                                                                </div>
                                                            ) : null}
                                                        </div>
                                                        <div>
                                                            <div className="mb-1 text-[11px] font-medium text-[var(--app-hint)]">
                                                                {answersLabel}
                                                            </div>
                                                            {answerDisplayText ? (
                                                                <CodeBlock code={answerDisplayText} language="text" />
                                                            ) : (
                                                                <div className="text-sm text-[var(--app-hint)]">(no output)</div>
                                                            )}
                                                        </div>
                                                    </div>
                                                )
                                            })}
                                        </>
                                    )
                                })()
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
                    ) : null}

                    {useAskUserQuestionPendingLayout ? null : isAskUserQuestion && permission?.status === 'pending' && !isAskUserQuestionMalformed ? (
                        <AskUserQuestionFooter
                            api={props.api}
                            sessionId={props.sessionId}
                            tool={props.block.tool}
                            disabled={props.disabled}
                            onDone={props.onDone}
                        />
                    ) : isRequestUserInput && permission?.status === 'pending' ? (
                        <RequestUserInputFooter
                            api={props.api}
                            sessionId={props.sessionId}
                            tool={props.block.tool}
                            disabled={props.disabled}
                            onDone={props.onDone}
                        />
                    ) : hideAskUserQuestionReasonFooter ? null : (
                        <PermissionFooter
                            api={props.api}
                            sessionId={props.sessionId}
                            metadata={props.metadata}
                            tool={props.block.tool}
                            disabled={props.disabled}
                            onDone={props.onDone}
                        />
                    )}
                </CardContent>
            ) : null}
        </Card>
    )
}

export const ToolCard = memo(ToolCardInner)
