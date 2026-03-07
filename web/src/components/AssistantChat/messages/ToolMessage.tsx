import type { ToolCallMessagePartProps } from '@assistant-ui/react'
import type { ChatBlock } from '@/chat/types'
import type { ToolCallBlock } from '@/chat/types'
import { useState } from 'react'
import { isObject, safeStringify } from '@hapi/protocol'
import { getEventPresentation } from '@/chat/presentation'
import { CodeBlock } from '@/components/CodeBlock'
import { DisclosureChevron, DisclosureInlineRail, DisclosureRail } from '@/components/Disclosure'
import { MarkdownRenderer } from '@/components/MarkdownRenderer'
import { LazyRainbowText } from '@/components/LazyRainbowText'
import { MessageStatusIndicator } from '@/components/AssistantChat/messages/MessageStatusIndicator'
import { ApiErrorNotice, isApiErrorText } from '@/components/AssistantChat/messages/ApiErrorNotice'
import { ToolCard } from '@/components/ToolCard/ToolCard'
import { getStandardToolTitle } from '@/components/ToolCard/knownTools'
import { useHappyChatContext } from '@/components/AssistantChat/context'
import { CliOutputBlock } from '@/components/CliOutputBlock'
import { cn } from '@/lib/utils'
import { useTranslation } from '@/lib/use-translation'

function isToolCallBlock(value: unknown): value is ToolCallBlock {
    if (!isObject(value)) return false
    if (value.kind !== 'tool-call') return false
    if (typeof value.id !== 'string') return false
    if (value.localId !== null && typeof value.localId !== 'string') return false
    if (typeof value.createdAt !== 'number') return false
    if (!Array.isArray(value.children)) return false
    if (!isObject(value.tool)) return false
    if (typeof value.tool.name !== 'string') return false
    if (!('input' in value.tool)) return false
    if (value.tool.description !== null && typeof value.tool.description !== 'string') return false
    if (value.tool.state !== 'pending' && value.tool.state !== 'running' && value.tool.state !== 'completed' && value.tool.state !== 'error') return false
    return true
}

function isPendingPermissionBlock(block: ChatBlock): boolean {
    return block.kind === 'tool-call' && block.tool.permission?.status === 'pending'
}

function splitToolChildren(block: ToolCallBlock): { pending: ChatBlock[]; rest: ChatBlock[] } {
    const pending: ChatBlock[] = []
    const rest: ChatBlock[] = []

    for (const child of block.children) {
        if (isPendingPermissionBlock(child)) {
            pending.push(child)
        } else {
            rest.push(child)
        }
    }

    return { pending, rest }
}

function getToolDetailsLabel(
    toolName: string,
    count: number,
    t: (key: string, params?: Record<string, string | number>) => string
): string {
    if (toolName === 'Task') return t('event.taskDetails', { count })
    return t('event.toolDetails', { count })
}

function getFallbackStatusTone(statusType: ToolCallMessagePartProps['status']['type'], isError: boolean): string {
    if (isError || statusType === 'incomplete') return 'text-red-600'
    if (statusType === 'complete') return 'text-emerald-600'
    if (statusType === 'requires-action') return 'text-amber-600'
    return 'text-[var(--app-hint)]'
}

function getFallbackStatusGlyph(statusType: ToolCallMessagePartProps['status']['type'], isError: boolean): string {
    if (isError || statusType === 'incomplete') return '✕'
    if (statusType === 'complete') return '✓'
    if (statusType === 'requires-action') return '🔐'
    return '●'
}

function FallbackToolCallMessage(props: {
    displayToolName: string
    argsText: string
    hasArgsText: boolean
    hasResult: boolean
    result: ToolCallMessagePartProps['result']
    resultText: string
    status: ToolCallMessagePartProps['status']
    isError: boolean
}) {
    const { t } = useTranslation()
    const [expanded, setExpanded] = useState(false)
    const canExpand = props.hasArgsText || props.hasResult
    const statusTone = getFallbackStatusTone(props.status.type, props.isError)
    const statusLabel = props.isError
        ? t('event.toolError')
        : props.status.type === 'running' && !props.hasResult
            ? t('event.toolRunning')
            : null

    return (
        <div className="py-1 min-w-0 max-w-full overflow-x-hidden">
            {canExpand ? (
                <button
                    type="button"
                    className="flex w-full min-w-0 items-center gap-1.5 text-left transition-colors cursor-pointer select-none"
                    onClick={() => setExpanded((current) => !current)}
                >
                    <div className="flex min-w-0 flex-1 items-center gap-1.5">
                        <span className="shrink-0 text-[var(--app-hint)]">
                            <DisclosureChevron open={expanded} />
                        </span>
                        <span className={cn('shrink-0 font-mono text-xs', statusTone)}>
                            {getFallbackStatusGlyph(props.status.type, props.isError)}
                        </span>
                        <div className="min-w-0 flex items-baseline gap-1.5 overflow-hidden">
                            <span className="shrink-0 text-sm font-medium text-[var(--app-fg)]">
                                {props.displayToolName}
                            </span>
                            {statusLabel ? (
                                <span className="min-w-0 truncate font-mono text-xs text-[var(--app-hint)] opacity-80">
                                    {statusLabel}
                                </span>
                            ) : null}
                        </div>
                    </div>
                </button>
            ) : (
                <div className="flex min-w-0 items-center gap-1.5">
                    <span className={cn('shrink-0 font-mono text-xs', statusTone)}>
                        {getFallbackStatusGlyph(props.status.type, props.isError)}
                    </span>
                    <div className="min-w-0 flex items-baseline gap-1.5 overflow-hidden">
                        <span className="shrink-0 text-sm font-medium text-[var(--app-fg)]">
                            {props.displayToolName}
                        </span>
                        {statusLabel ? (
                            <span className="min-w-0 truncate font-mono text-xs text-[var(--app-hint)] opacity-80">
                                {statusLabel}
                            </span>
                        ) : null}
                    </div>
                </div>
            )}

            {canExpand ? (
                <div
                    className={cn(
                        'overflow-hidden transition-all duration-200 ease-in-out',
                        expanded ? 'max-h-[5000px] opacity-100' : 'max-h-0 opacity-0'
                    )}
                >
                    <DisclosureRail level="outer">
                        <div className="tool-io-scope flex flex-col gap-3 pb-1">
                            {props.hasArgsText ? (
                                <div>
                                    <div className="mb-1 text-[11px] font-medium text-[var(--app-hint)]">{t('tool.input')}</div>
                                    <CodeBlock code={props.argsText} language="json" />
                                </div>
                            ) : null}

                            {props.hasResult ? (
                                <div>
                                    <div className="mb-1 text-[11px] font-medium text-[var(--app-hint)]">{t('tool.result')}</div>
                                    <CodeBlock code={props.resultText} language={typeof props.result === 'string' ? 'text' : 'json'} />
                                </div>
                            ) : null}
                        </div>
                    </DisclosureRail>
                </div>
            ) : null}
        </div>
    )
}

function ToolChildren(props: {
    block: ToolCallBlock
    t: (key: string, params?: Record<string, string | number>) => string
}) {
    const [restOpen, setRestOpen] = useState(false)

    if (props.block.tool.name === 'Steps') return null
    if (props.block.children.length === 0) return null

    const children = splitToolChildren(props.block)

    return (
        <>
            {children.pending.length > 0 ? (
                <div className="mt-2 pl-3">
                    <HappyNestedBlockList blocks={children.pending} />
                </div>
            ) : null}
            {children.rest.length > 0 ? (
                <div className="mt-2 space-y-2">
                    <button
                        type="button"
                        className="flex w-full items-center gap-1.5 rounded px-1 py-0.5 text-left hover:bg-[var(--app-subtle-bg)]"
                        onClick={() => setRestOpen((current) => !current)}
                        aria-expanded={restOpen}
                    >
                        <span className="shrink-0 text-[var(--app-hint)]">
                            <DisclosureChevron open={restOpen} />
                        </span>
                        <span className="text-xs text-[var(--app-hint)]">
                            {getToolDetailsLabel(props.block.tool.name, children.rest.length, props.t)}
                        </span>
                    </button>
                    {restOpen ? (
                        <div className="pl-3">
                            <HappyNestedBlockList blocks={children.rest} />
                        </div>
                    ) : null}
                </div>
            ) : null}
        </>
    )
}

function HappyNestedBlockList(props: {
    blocks: ChatBlock[]
}) {
    const ctx = useHappyChatContext()
    const { t } = useTranslation()

    return (
        <div className="flex flex-col gap-3">
            {props.blocks.map((block) => {
                if (block.kind === 'user-text') {
                    const userBubbleClass = 'w-fit max-w-[92%] ml-auto rounded-xl bg-[var(--app-secondary-bg)] px-3 py-2 text-[var(--app-fg)] shadow-sm'
                    const status = block.status
                    const canRetry = status === 'failed' && typeof block.localId === 'string' && Boolean(ctx.onRetryMessage)
                    const onRetry = canRetry ? () => ctx.onRetryMessage!(block.localId!) : undefined

                    return (
                        <div key={`user:${block.id}`} className={userBubbleClass}>
                            <div className="flex items-end gap-2">
                                <div className="flex-1">
                                    <LazyRainbowText text={block.text} />
                                </div>
                                {status ? (
                                    <div className="shrink-0 self-end pb-0.5">
                                        <MessageStatusIndicator status={status} onRetry={onRetry} />
                                    </div>
                                ) : null}
                            </div>
                        </div>
                    )
                }

                if (block.kind === 'agent-text') {
                    const text = block.text.trim()
                    if (isApiErrorText(text)) {
                        return (
                            <div key={`agent:${block.id}`} className="px-1">
                                <ApiErrorNotice text={text} />
                            </div>
                        )
                    }
                    return (
                        <div key={`agent:${block.id}`} className="px-1">
                            <MarkdownRenderer content={block.text} />
                        </div>
                    )
                }

                if (block.kind === 'cli-output') {
                    const alignClass = block.source === 'user' ? 'ml-auto w-full max-w-[92%]' : ''
                    return (
                        <div key={`cli:${block.id}`} className="px-1 min-w-0 max-w-full overflow-x-hidden">
                            <div className={alignClass}>
                                <CliOutputBlock text={block.text} />
                            </div>
                        </div>
                    )
                }

                if (block.kind === 'agent-event') {
                    const presentation = getEventPresentation(block.event, t)
                    const alignCls = presentation.source === 'user'
                        ? 'ml-auto w-fit max-w-[92%] text-right'
                        : 'max-w-[92%]'
                    return (
                        <div key={`event:${block.id}`} className="py-1">
                            <div className={`${alignCls} text-xs text-[var(--app-hint)]`}>
                                <DisclosureInlineRail level="inner">
                                    <span className="opacity-80">{presentation.text}</span>
                                </DisclosureInlineRail>
                            </div>
                        </div>
                    )
                }

                if (block.kind === 'tool-call') {
                    return (
                        <div key={`tool:${block.id}`} className="py-1">
                            <ToolCard
                                api={ctx.api}
                                sessionId={ctx.sessionId}
                                metadata={ctx.metadata}
                                disabled={ctx.disabled}
                                onDone={ctx.onRefresh}
                                block={block}
                                disclosureLevel="inner"
                            />
                            <ToolChildren block={block} t={t} />
                        </div>
                    )
                }

                return null
            })}
        </div>
    )
}

export function HappyToolMessage(props: ToolCallMessagePartProps) {
    const ctx = useHappyChatContext()
    const { t } = useTranslation()
    const artifact = props.artifact
    const displayToolName = getStandardToolTitle(props.toolName) ?? props.toolName

    if (!isToolCallBlock(artifact)) {
        const argsText = typeof props.argsText === 'string' ? props.argsText.trim() : ''
        const hasArgsText = argsText.length > 0
        const hasResult = props.result !== undefined
        const resultText = hasResult ? safeStringify(props.result) : ''
        return (
            <FallbackToolCallMessage
                displayToolName={displayToolName}
                argsText={argsText}
                hasArgsText={hasArgsText}
                hasResult={hasResult}
                result={props.result}
                resultText={resultText}
                status={props.status}
                isError={Boolean(props.isError)}
            />
        )
    }

    const block = artifact

    return (
        <div className="py-1 min-w-0 max-w-full overflow-x-hidden">
            <ToolCard
                api={ctx.api}
                sessionId={ctx.sessionId}
                metadata={ctx.metadata}
                disabled={ctx.disabled}
                onDone={ctx.onRefresh}
                block={block}
            />
            <ToolChildren block={block} t={t} />
        </div>
    )
}
