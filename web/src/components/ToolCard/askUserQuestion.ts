import { isObject } from '@hapi/protocol'

export type AskUserQuestionOption = {
    label: string
    description: string | null
}

export type AskUserQuestionQuestion = {
    header: string | null
    question: string
    options: AskUserQuestionOption[]
    multiSelect: boolean
}

export type AskUserQuestionQuestionInfo = {
    header: string | null
    question: string | null
}

type AskUserQuestionDisplayLocale = 'zh-CN' | 'en'
const TOOL_USE_ERROR_REGEX = /<tool_use_error>(.*?)<\/tool_use_error>/s
const SYSTEM_REMINDER_BLOCK_REGEX = /<system-reminder>[\s\S]*?<\/system-reminder>/gi

export function isAskUserQuestionToolName(toolName: string): boolean {
    return toolName === 'AskUserQuestion' || toolName === 'ask_user_question'
}

export function parseAskUserQuestionInput(input: unknown): { questions: AskUserQuestionQuestion[] } {
    if (!isObject(input)) return { questions: [] }

    const rawQuestions = input.questions
    if (!Array.isArray(rawQuestions)) return { questions: [] }

    const questions: AskUserQuestionQuestion[] = []
    for (const raw of rawQuestions) {
        if (!isObject(raw)) continue

        const question = typeof raw.question === 'string' ? raw.question.trim() : ''
        const header = typeof raw.header === 'string' ? raw.header.trim() : ''
        const multiSelect = typeof raw.multiSelect === 'boolean' ? raw.multiSelect : false

        const rawOptions = Array.isArray(raw.options) ? raw.options : []
        const options: AskUserQuestionOption[] = []
        for (const opt of rawOptions) {
            if (!isObject(opt)) continue
            const label = typeof opt.label === 'string' ? opt.label.trim() : ''
            if (!label) continue
            const description = typeof opt.description === 'string' ? opt.description.trim() : null
            options.push({ label, description })
        }

        if (!question && options.length === 0) continue

        questions.push({
            header: header.length > 0 ? header : null,
            question,
            options,
            multiSelect
        })
    }

    return { questions }
}

export function extractAskUserQuestionQuestionsInfo(input: unknown): AskUserQuestionQuestionInfo[] | null {
    if (!isObject(input)) return null
    const raw = input.questions
    if (!Array.isArray(raw)) return null

    const questions: AskUserQuestionQuestionInfo[] = []
    for (const q of raw) {
        if (!isObject(q)) continue
        const header = typeof q.header === 'string' ? q.header.trim() : null
        const question = typeof q.question === 'string' ? q.question.trim() : null
        questions.push({
            header: header && header.length > 0 ? header : null,
            question: question && question.length > 0 ? question : null
        })
    }
    return questions
}

function customInputLabel(locale: AskUserQuestionDisplayLocale): string {
    return locale === 'zh-CN' ? '自行输入' : 'custom input'
}

export function formatAskUserQuestionAnswersForDisplay(
    question: AskUserQuestionQuestion,
    answers: string[],
    locale: AskUserQuestionDisplayLocale
): string[] {
    const optionDescriptionByLabel = new Map<string, string | null>()
    for (const option of question.options) {
        const key = option.label.trim()
        if (!key) continue
        const desc = option.description?.trim() ?? null
        optionDescriptionByLabel.set(key, desc && desc.length > 0 ? desc : null)
    }

    const formatted: string[] = []
    for (const rawAnswer of answers) {
        const answer = rawAnswer.trim()
        if (!answer) continue

        if (!optionDescriptionByLabel.has(answer)) {
            formatted.push(`${answer} (${customInputLabel(locale)})`)
            continue
        }

        const desc = optionDescriptionByLabel.get(answer)
        if (desc) {
            formatted.push(`${answer} (${desc})`)
            continue
        }

        formatted.push(answer)
    }

    return formatted
}

function sanitizeAskUserQuestionResultText(text: string): string {
    const matched = text.match(TOOL_USE_ERROR_REGEX)
    const unwrapped = matched && typeof matched[1] === 'string' ? matched[1].trim() : text

    return unwrapped
        .replace(SYSTEM_REMINDER_BLOCK_REGEX, '')
        .replace(/\n[ \t]*\n[ \t]*\n+/g, '\n\n')
        .replace(/^[ \t]*\n/, '')
        .replace(/\n[ \t]*$/, '')
}

function extractTextFromContentBlock(block: unknown): string | null {
    if (typeof block === 'string') return block
    if (!isObject(block)) return null
    if (block.type === 'text' && typeof block.text === 'string') return block.text
    if (typeof block.text === 'string') return block.text
    return null
}

export function extractAskUserQuestionResultText(result: unknown): string | null {
    if (result === null || result === undefined) return null

    if (typeof result === 'string') {
        const text = sanitizeAskUserQuestionResultText(result)
        return text.trim().length > 0 ? text : null
    }

    if (Array.isArray(result)) {
        const parts = result
            .map(extractTextFromContentBlock)
            .filter((part): part is string => typeof part === 'string' && part.trim().length > 0)
        if (parts.length === 0) return null
        const text = sanitizeAskUserQuestionResultText(parts.join('\n'))
        return text.trim().length > 0 ? text : null
    }

    if (!isObject(result)) return null

    const directFields = [result.content, result.text, result.output, result.error, result.message]
    for (const field of directFields) {
        if (typeof field !== 'string') continue
        const text = sanitizeAskUserQuestionResultText(field)
        if (text.trim().length > 0) return text
    }

    const contentArray = Array.isArray(result.content) ? result.content : null
    if (contentArray) {
        const parts = contentArray
            .map(extractTextFromContentBlock)
            .filter((part): part is string => typeof part === 'string' && part.trim().length > 0)
        if (parts.length > 0) {
            const text = sanitizeAskUserQuestionResultText(parts.join('\n'))
            if (text.trim().length > 0) return text
        }
    }

    return null
}
