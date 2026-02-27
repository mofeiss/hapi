import type { ReactNode } from 'react'
import type { ToolViewProps } from '@/components/ToolCard/views/_all'
import { parseAskUserQuestionInput } from '@/components/ToolCard/askUserQuestion'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

type AnswersFormat = Record<string, string[]> | Record<string, { answers: string[] }>

function normalizeAnswers(answers: AnswersFormat | undefined): Record<string, string[]> | undefined {
    if (!answers) return undefined
    const result: Record<string, string[]> = {}
    for (const [key, value] of Object.entries(answers)) {
        if (Array.isArray(value)) {
            result[key] = value
        } else if (value && typeof value === 'object' && 'answers' in value) {
            result[key] = value.answers
        }
    }
    return result
}

function getSelectedLabels(
    answers: Record<string, string[]> | undefined,
    questionIdx: number
): string[] {
    if (!answers) return []
    const questionAnswers = answers[String(questionIdx)]
    if (!questionAnswers || !Array.isArray(questionAnswers)) return []
    return questionAnswers.map(a => a.trim()).filter(a => a.length > 0)
}

export function AskUserQuestionView(props: ToolViewProps) {
    const parsed = parseAskUserQuestionInput(props.block.tool.input)
    const questions = parsed.questions
    const rawAnswers = props.block.tool.permission?.answers ?? undefined
    const answers = normalizeAnswers(rawAnswers)
    const hasAnswers = answers && Object.keys(answers).length > 0

    // No questions and no answers — nothing to show
    if (questions.length === 0 && !hasAnswers) return null

    // Freeform fallback (no questions but has answers)
    if (questions.length === 0 && hasAnswers && answers) {
        const selected = getSelectedLabels(answers, 0)
        if (selected.length === 0) return null
        return (
            <div className="text-sm text-[var(--app-fg)]">
                {selected.join(', ')}
            </div>
        )
    }

    // --- Single question ---
    if (questions.length === 1) {
        const q = questions[0]
        const selected = getSelectedLabels(answers, 0)

        return (
            <div className="rounded-md border border-[var(--app-border)] bg-[var(--app-bg)] p-3">
                {q.question ? (
                    <div className="text-sm font-medium text-[var(--app-fg)] break-words">
                        {q.question}
                    </div>
                ) : null}
                {hasAnswers && selected.length > 0 ? (
                    <div className="mt-1.5 text-sm text-[var(--app-fg)]">
                        {selected.join(', ')}
                    </div>
                ) : null}
            </div>
        )
    }

    // --- Multi-question ---
    return (
        <div className="mt-1.5 rounded-lg border border-[var(--app-border)] bg-[var(--app-bg)] p-3">
            {questions.map((q, qIdx) => {
                const selected = getSelectedLabels(answers, qIdx)

                return (
                    <div key={qIdx} className={cn(qIdx > 0 && 'mt-3')}>
                        <div className="flex items-start gap-2 px-2 py-1">
                            {q.header ? (
                                <Badge variant="default" className="shrink-0">{q.header}</Badge>
                            ) : null}
                            <span className="text-sm font-medium text-[var(--app-fg)] break-words min-w-0">
                                {q.question}
                            </span>
                        </div>
                        {hasAnswers && selected.length > 0 ? (
                            <div className="ml-3 px-2 text-sm text-[var(--app-fg)]">
                                {selected.join(', ')}
                            </div>
                        ) : !hasAnswers ? null : (
                            <div className="ml-3 px-2 text-sm text-[var(--app-hint)] italic">
                                (no answer)
                            </div>
                        )}
                    </div>
                )
            })}
        </div>
    )
}
