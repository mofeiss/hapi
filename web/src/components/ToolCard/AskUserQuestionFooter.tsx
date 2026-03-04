import { useEffect, useMemo, useRef, useState } from 'react'
import type { ApiClient } from '@/api/client'
import type { ChatToolCall } from '@/chat/types'
import { Button } from '@/components/ui/button'
import { isAskUserQuestionToolName, parseAskUserQuestionInput, type AskUserQuestionQuestion } from '@/components/ToolCard/askUserQuestion'
import { cn } from '@/lib/utils'
import { usePlatform } from '@/hooks/usePlatform'
import { Spinner } from '@/components/Spinner'
import { useTranslation } from '@/lib/use-translation'

type HoveredOption = number | null

type QuestionOptionState = {
    selectedOptionIndices: number[]
    otherSelected: boolean
    otherText: string
    hoveredOptionIndex: HoveredOption
}

function buildInitialState(questions: AskUserQuestionQuestion[]): QuestionOptionState[] {
    return questions.map((question) => ({
        selectedOptionIndices: question.options.length > 0 ? [0] : [],
        otherSelected: false,
        otherText: '',
        hoveredOptionIndex: null
    }))
}

function ensureDefaultSelection(question: AskUserQuestionQuestion, state: QuestionOptionState): QuestionOptionState {
    if (question.options.length === 0) return state
    if (state.otherSelected) return state
    if (state.selectedOptionIndices.length > 0) return state
    return {
        ...state,
        selectedOptionIndices: [0]
    }
}

function QuestionRow(props: { tag: string | null; text: string }) {
    return (
        <div className="min-w-0 w-full max-w-full rounded-md bg-[var(--app-code-bg)] pl-0 pr-2 py-0.5">
            <div className="font-mono text-xs leading-4 text-[var(--app-fg)] break-all">
                {props.tag ? (
                    <span className="inline-flex items-center rounded-sm bg-[var(--app-bg)] px-1 text-[10px] font-semibold uppercase tracking-[0.06em] text-[var(--app-hint)]">
                        {props.tag}
                    </span>
                ) : null}
                <span className={props.tag ? 'ml-2' : ''}>{props.text}</span>
            </div>
        </div>
    )
}

function OptionChip(props: {
    selected: boolean
    disabled: boolean
    label: string
    title?: string
    onClick: () => void
    onHover: () => void
    onLeave: () => void
}) {
    return (
        <button
            type="button"
            disabled={props.disabled}
            onClick={props.onClick}
            onMouseEnter={props.onHover}
            onMouseLeave={props.onLeave}
            title={props.title ?? props.label}
            className={cn(
                'shrink-0 rounded-md border px-1.5 py-0.5 text-[11px] font-mono leading-4 transition-colors disabled:opacity-50',
                props.selected
                    ? 'border-[var(--app-button)] bg-[var(--app-button)] text-[var(--app-button-text)]'
                    : 'border-[var(--app-border)] bg-[var(--app-bg)] text-[var(--app-hint)] hover:text-[var(--app-fg)]'
            )}
        >
            {props.label}
        </button>
    )
}

function computeAnswersForQuestion(
    question: AskUserQuestionQuestion,
    selectedOptionIndices: number[],
    otherSelected: boolean,
    otherText: string
): string[] {
    const answers: string[] = []

    for (const idx of selectedOptionIndices) {
        const opt = question.options[idx]
        if (!opt) continue
        const label = opt.label.trim()
        if (label.length > 0) answers.push(label)
    }

    const other = otherText.trim()
    if (otherSelected && other.length > 0) {
        answers.push(other)
    }

    return answers
}

function resolveDescription(question: AskUserQuestionQuestion, state: QuestionOptionState): string | null {
    const hoveredOption = state.hoveredOptionIndex
    if (hoveredOption !== null) {
        const hoveredDescription = question.options[hoveredOption]?.description?.trim()
        if (hoveredDescription) return hoveredDescription
    }

    for (const idx of state.selectedOptionIndices) {
        const selectedDescription = question.options[idx]?.description?.trim()
        if (selectedDescription) return selectedDescription
    }

    return null
}

export function AskUserQuestionFooter(props: {
    api: ApiClient
    sessionId: string
    tool: ChatToolCall
    disabled: boolean
    onDone: () => void
}) {
    const { t, locale } = useTranslation()
    const { haptic } = usePlatform()
    const permission = props.tool.permission
    const parsed = useMemo(() => parseAskUserQuestionInput(props.tool.input), [props.tool.input])
    const questions = parsed.questions

    const [fallbackText, setFallbackText] = useState('')
    const [stateByQuestion, setStateByQuestion] = useState<QuestionOptionState[]>(() => buildInitialState(questions))
    const otherInputRefs = useRef<Array<HTMLInputElement | null>>([])

    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        setFallbackText('')
        setStateByQuestion(buildInitialState(questions))
        otherInputRefs.current = []
        setLoading(false)
        setError(null)
    }, [props.tool.id, questions])

    if (!permission || permission.status !== 'pending') return null
    if (!isAskUserQuestionToolName(props.tool.name)) return null

    const run = async (action: () => Promise<void>, hapticType: 'success' | 'error') => {
        if (props.disabled) return
        setError(null)
        try {
            await action()
            haptic.notification(hapticType)
            props.onDone()
        } catch (e) {
            haptic.notification('error')
            setError(e instanceof Error ? e.message : t('dialog.error.default'))
        }
    }

    const validateQuestion = (idx: number): string[] | null => {
        if (questions.length === 0) {
            const text = fallbackText.trim()
            return text.length > 0 ? [text] : null
        }

        const question = questions[idx]
        const questionState = stateByQuestion[idx]
        if (!question || !questionState) return null

        if (question.options.length === 0) {
            const text = questionState.otherText.trim()
            return text.length > 0 ? [text] : null
        }

        const answers = computeAnswersForQuestion(
            question,
            questionState.selectedOptionIndices,
            questionState.otherSelected,
            questionState.otherText
        )

        return answers.length > 0 ? answers : null
    }

    const submit = async () => {
        if (loading) return

        const answers: Record<string, string[]> = {}
        if (questions.length === 0) {
            const a0 = validateQuestion(0)
            if (!a0) {
                setError(t('tool.selectOption'))
                return
            }
            answers['0'] = a0
        } else {
            for (let i = 0; i < questions.length; i += 1) {
                const a = validateQuestion(i)
                if (!a) {
                    setError(t('tool.selectOption'))
                    return
                }
                answers[String(i)] = a
            }
        }

        setLoading(true)
        await run(() => props.api.approvePermission(props.sessionId, permission.id, { answers }), 'success')
        setLoading(false)
    }

    const updateQuestionState = (questionIdx: number, updater: (prev: QuestionOptionState) => QuestionOptionState) => {
        setStateByQuestion((prev) => {
            if (!prev[questionIdx]) return prev
            const next = prev.slice()
            next[questionIdx] = updater(prev[questionIdx])
            return next
        })
    }

    const toggleOption = (qIdx: number, optIdx: number) => {
        const q = questions[qIdx]
        if (!q) return
        haptic.selection()
        setError(null)

        updateQuestionState(qIdx, (prev) => {
            if (q.multiSelect) {
                const selectedSet = new Set(prev.selectedOptionIndices)
                if (selectedSet.has(optIdx)) selectedSet.delete(optIdx)
                else selectedSet.add(optIdx)
                return ensureDefaultSelection(q, {
                    ...prev,
                    selectedOptionIndices: Array.from(selectedSet).sort((a, b) => a - b)
                })
            }

            return ensureDefaultSelection(q, {
                ...prev,
                selectedOptionIndices: [optIdx],
                otherSelected: false
            })
        })
    }

    const setHoveredOption = (qIdx: number, optIdx: number | null) => {
        updateQuestionState(qIdx, (prev) => ({
            ...prev,
            hoveredOptionIndex: optIdx
        }))
    }

    const toggleOther = (qIdx: number) => {
        const q = questions[qIdx]
        if (!q) return
        haptic.selection()
        setError(null)
        let shouldFocusInput = false

        updateQuestionState(qIdx, (prev) => {
            if (q.options.length === 0) {
                shouldFocusInput = true
                return { ...prev, otherSelected: true }
            }

            if (!q.multiSelect) {
                const next = {
                    ...prev,
                    selectedOptionIndices: [],
                    otherSelected: !prev.otherSelected
                }
                shouldFocusInput = next.otherSelected
                return ensureDefaultSelection(q, next)
            }

            const next = {
                ...prev,
                otherSelected: !prev.otherSelected
            }
            shouldFocusInput = next.otherSelected
            return ensureDefaultSelection(q, next)
        })

        if (shouldFocusInput) {
            requestAnimationFrame(() => {
                const input = otherInputRefs.current[qIdx]
                if (!input) return
                input.focus()
            })
        }
    }

    const updateOtherText = (qIdx: number, value: string) => {
        updateQuestionState(qIdx, (prev) => ({
            ...prev,
            otherText: value,
            otherSelected: value.trim().length > 0 ? true : prev.otherSelected
        }))
    }

    const labelQuestions = locale === 'zh-CN' ? '问题' : 'Questions'
    const labelAnswers = locale === 'zh-CN' ? '回答' : 'Answers'
    const labelOptions = locale === 'zh-CN' ? '选项' : 'Options'
    const labelOther = locale === 'zh-CN' ? '自定义' : 'Other'
    const labelInput = locale === 'zh-CN' ? '输入' : 'Input'

    if (questions.length === 0) {
        return (
            <div className="space-y-2">
                {error ? (
                    <div className="text-xs text-red-600">{error}</div>
                ) : null}

                <div>
                    <div className="mb-1 text-[11px] font-medium text-[var(--app-hint)]">{labelAnswers}</div>
                    <textarea
                        value={fallbackText}
                        onChange={(e) => setFallbackText(e.target.value)}
                        disabled={props.disabled || loading}
                        placeholder={t('tool.askUserQuestion.placeholder')}
                        className="w-full min-h-[72px] resize-y rounded-md border border-[var(--app-border)] bg-[var(--app-bg)] px-2 py-1.5 text-xs font-mono text-[var(--app-fg)] placeholder:text-[var(--app-hint)] focus:outline-none focus:ring-2 focus:ring-[var(--app-button)] focus:border-transparent disabled:opacity-50"
                    />
                </div>

                <div className="flex items-center justify-start">
                    <Button
                        type="button"
                        variant="default"
                        size="sm"
                        disabled={props.disabled || loading}
                        onClick={submit}
                        aria-busy={loading}
                        className="gap-2"
                    >
                        {loading ? (
                            <>
                                <Spinner size="sm" label={null} className="text-[var(--app-button-text)]" />
                                {t('tool.submitting')}
                            </>
                        ) : (
                            t('tool.submit')
                        )}
                    </Button>
                </div>
            </div>
        )
    }

    return (
        <div className="space-y-3">
            {error ? (
                <div className="text-xs text-red-600">{error}</div>
            ) : null}

            {questions.map((question, qIdx) => {
                const questionState = stateByQuestion[qIdx]
                if (!questionState) return null

                const hasQuestionText = question.question.trim().length > 0
                const description = resolveDescription(question, questionState)
                const selectedLabels = questionState.selectedOptionIndices
                    .map((idx) => question.options[idx]?.label?.trim() ?? '')
                    .filter((label) => label.length > 0)
                const summaryText = description
                    ?? (selectedLabels.length > 0 ? selectedLabels.join(' / ') : labelOptions)

                return (
                    <div key={qIdx} className={cn('space-y-2', qIdx > 0 && 'pt-2 border-t border-[var(--app-border)]')}>
                        <div>
                            <div className="mb-1 text-[11px] font-medium text-[var(--app-hint)]">{labelQuestions}</div>
                            {hasQuestionText ? (
                                <QuestionRow tag={question.header} text={question.question.trim()} />
                            ) : question.header ? (
                                <QuestionRow tag={question.header} text={locale === 'zh-CN' ? '（无问题文本）' : '(empty question)'} />
                            ) : null}
                        </div>

                        <div>
                            <div className="mb-1 text-[11px] font-medium text-[var(--app-hint)]">{labelAnswers}</div>

                            {question.options.length > 0 ? (
                                <>
                                    <div className="min-w-0 flex items-center gap-1 overflow-x-auto whitespace-nowrap">
                                        {question.options.map((opt, optIdx) => {
                                            const selected = questionState.selectedOptionIndices.includes(optIdx)

                                            return (
                                                <OptionChip
                                                    key={optIdx}
                                                    selected={selected}
                                                    disabled={props.disabled || loading}
                                                    label={opt.label}
                                                    title={opt.description ? `${opt.label} - ${opt.description}` : opt.label}
                                                    onClick={() => toggleOption(qIdx, optIdx)}
                                                    onHover={() => setHoveredOption(qIdx, optIdx)}
                                                    onLeave={() => setHoveredOption(qIdx, null)}
                                                />
                                            )
                                        })}
                                        <OptionChip
                                            selected={questionState.otherSelected}
                                            disabled={props.disabled || loading}
                                            label={labelOther}
                                            title={labelOther}
                                            onClick={() => toggleOther(qIdx)}
                                            onHover={() => setHoveredOption(qIdx, null)}
                                            onLeave={() => setHoveredOption(qIdx, null)}
                                        />
                                    </div>
                                    {!questionState.otherSelected ? (
                                        <div className="mt-1 min-h-4 min-w-0">
                                            <div
                                                className="rounded-md bg-[var(--app-code-bg)] px-2 py-0.5 font-mono text-xs text-[var(--app-hint)] whitespace-nowrap overflow-hidden text-ellipsis"
                                                title={summaryText}
                                            >
                                                {summaryText}
                                            </div>
                                        </div>
                                    ) : null}
                                </>
                            ) : null}

                            {(question.options.length === 0 || questionState.otherSelected) ? (
                                <div className="mt-1 min-w-0 w-full max-w-full rounded-md bg-[var(--app-code-bg)] pl-0 pr-2 py-0.5">
                                    <div className="flex items-center gap-2 font-mono text-xs leading-4 text-[var(--app-fg)]">
                                        <span className="inline-flex items-center rounded-sm bg-[var(--app-bg)] px-1 text-[10px] font-semibold uppercase tracking-[0.06em] text-[var(--app-hint)]">
                                            {labelInput}
                                        </span>
                                        <input
                                            type="text"
                                            value={questionState.otherText}
                                            ref={(el) => {
                                                otherInputRefs.current[qIdx] = el
                                            }}
                                            onChange={(e) => updateOtherText(qIdx, e.target.value)}
                                            onClick={(e) => {
                                                e.stopPropagation()
                                                if (!questionState.otherSelected) {
                                                    toggleOther(qIdx)
                                                }
                                            }}
                                            disabled={props.disabled || loading}
                                            placeholder={t('tool.askUserQuestion.otherPlaceholder')}
                                            className="min-w-0 flex-1 bg-transparent text-xs text-[var(--app-fg)] placeholder:text-[var(--app-hint)] focus:outline-none disabled:opacity-50"
                                        />
                                    </div>
                                </div>
                            ) : null}
                        </div>
                    </div>
                )
            })}

            <div className="flex items-center justify-start">
                <Button
                    type="button"
                    variant="default"
                    size="sm"
                    disabled={props.disabled || loading}
                    onClick={submit}
                    aria-busy={loading}
                    className="gap-2"
                >
                    {loading ? (
                        <>
                            <Spinner size="sm" label={null} className="text-[var(--app-button-text)]" />
                            {t('tool.submitting')}
                        </>
                    ) : (
                        t('tool.submit')
                    )}
                </Button>
            </div>
        </div>
    )
}
