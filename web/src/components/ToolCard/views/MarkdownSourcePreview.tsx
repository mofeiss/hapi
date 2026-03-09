import { useEffect, useState } from 'react'
import { CodeBlock } from '@/components/CodeBlock'
import { MarkdownRenderer } from '@/components/MarkdownRenderer'
import { CheckIcon, CopyIcon } from '@/components/icons'
import { EyeIcon, TerminalIcon } from '@/components/ToolCard/icons'
import { useCopyToClipboard } from '@/hooks/useCopyToClipboard'
import { cn } from '@/lib/utils'
import { useTranslation } from '@/lib/use-translation'

type PreviewMode = 'source' | 'markdown'

function countVisibleLines(text: string): number {
    const normalized = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
    const lines = normalized.split('\n')
    while (lines.length > 1 && lines[lines.length - 1]?.trim().length === 0) {
        lines.pop()
    }
    return lines.length
}

function PreviewActions(props: {
    copyText: string
    mode: PreviewMode
    centered: boolean
    onToggleMode: () => void
}) {
    const { t } = useTranslation()
    const { copied, copy } = useCopyToClipboard()

    return (
        <div
            className={cn(
                'absolute right-1.5 z-10 flex items-center gap-0.5',
                props.centered ? 'top-1/2 -translate-y-1/2' : 'top-1.5'
            )}
        >
            <button
                type="button"
                onClick={props.onToggleMode}
                className="rounded p-1 text-[var(--app-hint)] hover:bg-[var(--app-subtle-bg)] hover:text-[var(--app-fg)] transition-colors"
                title={props.mode === 'source' ? t('tool.viewMarkdown') : t('tool.viewSource')}
                aria-label={props.mode === 'source' ? t('tool.viewMarkdown') : t('tool.viewSource')}
            >
                {props.mode === 'source' ? (
                    <EyeIcon className="h-3.5 w-3.5" />
                ) : (
                    <TerminalIcon className="h-3.5 w-3.5" />
                )}
            </button>
            <button
                type="button"
                onClick={() => copy(props.copyText)}
                className="rounded p-1 text-[var(--app-hint)] hover:bg-[var(--app-subtle-bg)] hover:text-[var(--app-fg)] transition-colors"
                title={t('code.copy')}
                aria-label={t('code.copy')}
            >
                {copied ? <CheckIcon className="h-3.5 w-3.5" /> : <CopyIcon className="h-3.5 w-3.5" />}
            </button>
        </div>
    )
}

export function MarkdownSourcePreview(props: {
    content: string
    sourceLanguage?: string
    defaultMode?: PreviewMode
}) {
    const [mode, setMode] = useState<PreviewMode>(props.defaultMode ?? 'source')

    useEffect(() => {
        setMode(props.defaultMode ?? 'source')
    }, [props.content, props.defaultMode])

    const centeredActions = countVisibleLines(props.content) <= 1

    return (
        <div className="relative min-w-0 max-w-full">
            <PreviewActions
                copyText={props.content}
                mode={mode}
                centered={mode === 'source' && centeredActions}
                onToggleMode={() => setMode((prev) => (prev === 'source' ? 'markdown' : 'source'))}
            />
            {mode === 'markdown' ? (
                <div className="tool-markdown-surface max-h-[48vh] overflow-auto rounded-md bg-[var(--app-bg)] p-3 pr-12">
                    <MarkdownRenderer content={props.content} />
                </div>
            ) : (
                <CodeBlock
                    code={props.content}
                    language={props.sourceLanguage ?? 'markdown'}
                    showLineNumbers={false}
                    showCopyButton={false}
                    contentRightPaddingClassName="pr-14"
                />
            )}
        </div>
    )
}
