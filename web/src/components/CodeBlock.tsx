import { useCopyToClipboard } from '@/hooks/useCopyToClipboard'
import { useShikiHighlighter } from '@/lib/shiki'
import { CopyIcon, CheckIcon } from '@/components/icons'
import { useTranslation } from '@/lib/use-translation'

export function CodeBlock(props: {
    code: string
    language?: string
    showCopyButton?: boolean
    showLineNumbers?: boolean
}) {
    const { t } = useTranslation()
    const showCopyButton = props.showCopyButton ?? true
    const showLineNumbers = props.showLineNumbers ?? false
    const { copied, copy } = useCopyToClipboard()
    const highlighted = useShikiHighlighter(props.code, props.language)
    const normalizedCode = props.code.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
    const lines = normalizedCode.split('\n')
    const displayLines = [...lines]
    while (displayLines.length > 1 && displayLines[displayLines.length - 1].trim().length === 0) {
        displayLines.pop()
    }

    return (
        <div className="relative min-w-0 max-w-full">
            {showCopyButton ? (
                <button
                    type="button"
                    onClick={() => copy(props.code)}
                    className="absolute right-1.5 top-1.5 rounded p-1 text-[var(--app-hint)] hover:bg-[var(--app-subtle-bg)] hover:text-[var(--app-fg)] transition-colors"
                    title={t('code.copy')}
                >
                    {copied ? <CheckIcon className="h-3.5 w-3.5" /> : <CopyIcon className="h-3.5 w-3.5" />}
                </button>
            ) : null}

            {showLineNumbers ? (
                <div
                    data-codeblock-scroll="true"
                    dir="ltr"
                    style={{ direction: 'ltr' }}
                    className="min-w-0 w-full max-w-full overflow-x-auto overflow-y-hidden rounded-md bg-[var(--app-code-bg)]"
                >
                    <div className="min-w-0 w-full pr-8 text-xs font-mono leading-5" style={{ direction: 'ltr' }}>
                        {displayLines.map((line, index) => (
                            <div key={index} className="flex items-start" style={{ direction: 'ltr' }}>
                                <span className="w-7 shrink-0 select-none border-r border-[var(--app-border)] bg-[var(--app-subtle-bg)] pl-0.5 pr-1 text-right tabular-nums text-[var(--app-hint)] opacity-55">
                                    {index + 1}
                                </span>
                                <code className="block min-w-0 flex-1 whitespace-pre-wrap break-words pl-1.5 text-left text-[var(--app-fg)]">
                                    {line.length > 0 ? line : ' '}
                                </code>
                            </div>
                        ))}
                    </div>
                </div>
            ) : (
                <div
                    data-codeblock-scroll="true"
                    className="min-w-0 w-full max-w-full overflow-x-auto overflow-y-hidden rounded-md bg-[var(--app-code-bg)]"
                >
                    <pre className="shiki m-0 w-max min-w-full p-2 pr-8 text-xs font-mono">
                        <code className="block">{highlighted ?? props.code}</code>
                    </pre>
                </div>
            )}
        </div>
    )
}
