import { isObject } from '@hapi/protocol'
import type { ChatBlock, ToolCallBlock } from '@/chat/types'
import { getStandardToolTitle, getToolPresentation } from '@/components/ToolCard/knownTools'
import type { Locale } from '@/lib/i18n-context'
import type { SessionMetadataSummary } from '@/types/api'

export type AssistantCopyPart = {
    type: string
    text?: string
    toolName?: string
    artifact?: unknown
}

type AssistantCopyOptions = {
    metadata: SessionMetadataSummary | null
    locale: Locale
    includeToolJson?: boolean
}

function isTextPart(part: AssistantCopyPart): part is AssistantCopyPart & { type: 'text'; text: string } {
    return part.type === 'text' && typeof part.text === 'string'
}

function isReasoningPart(part: AssistantCopyPart): part is AssistantCopyPart & { type: 'reasoning'; text: string } {
    return part.type === 'reasoning' && typeof part.text === 'string'
}

function isToolCallPart(part: AssistantCopyPart): part is AssistantCopyPart & { type: 'tool-call' } {
    return part.type === 'tool-call'
}

function isToolCallBlock(value: unknown): value is ToolCallBlock {
    if (!isObject(value)) return false
    if (value.kind !== 'tool-call') return false
    if (typeof value.id !== 'string') return false
    if (!Array.isArray(value.children)) return false
    if (!isObject(value.tool)) return false
    if (typeof value.tool.name !== 'string') return false
    return true
}

function formatFence(label: string, content: string): string {
    const trimmed = content.trim()
    if (!trimmed) return ''
    return [
        `\`\`\`${label}`,
        trimmed,
        '```'
    ].join('\n')
}

function stringifyToolPayload(value: unknown): string {
    if (value === undefined) return 'undefined'

    const serialized = JSON.stringify(value, null, 2)
    if (typeof serialized === 'string') return serialized
    return 'null'
}

function formatToolPayloadTag(tag: 'Input' | 'Result', value: unknown): string {
    return [
        `<${tag}>`,
        stringifyToolPayload(value),
        `</${tag}>`
    ].join('\n')
}

function formatReasoningSection(text: string): string {
    const trimmed = text.trim()
    if (!trimmed) return ''
    return formatFence('Reasoning', trimmed)
}

function collapseToSingleLine(text: string): string {
    return text
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line.length > 0)
        .join(' ')
}

function formatInlineReasoningSection(text: string): string {
    const summary = collapseToSingleLine(text)
    if (!summary) return ''
    return `- Reasoning: ${summary}`
}

function formatToolStatePrefix(state: ToolCallBlock['tool']['state']): string {
    if (state === 'completed') return '✓'
    if (state === 'error') return '✗'
    return '⋯'
}

function formatToolSummary(
    block: ToolCallBlock,
    metadata: SessionMetadataSummary | null,
    locale: Locale
): string {
    const presentation = getToolPresentation({
        toolName: block.tool.name,
        input: block.tool.input,
        result: block.tool.result,
        childrenCount: block.children.length,
        description: block.tool.description,
        metadata,
        locale
    })

    return presentation.subtitle
        ? `${presentation.title} | ${presentation.subtitle}`
        : presentation.title
}

function formatFallbackToolSummary(toolName: string | undefined): string {
    if (!toolName) return ''
    return getStandardToolTitle(toolName) ?? toolName
}

function formatVisibleAuxiliaryBlock(child: ChatBlock): string {
    if (child.kind === 'agent-text' || child.kind === 'cli-output') {
        return child.text.trim()
    }
    if (child.kind === 'agent-event') {
        if (isObject(child.event) && typeof child.event.type === 'string') {
            return child.event.type.trim()
        }
        return 'event'
    }
    return ''
}

function formatStepsChildren(
    children: ChatBlock[],
    metadata: SessionMetadataSummary | null,
    locale: Locale,
    includeToolJson: boolean
): string[] {
    const sections: string[] = []

    for (const child of children) {
        if (child.kind === 'agent-reasoning') {
            const reasoning = formatInlineReasoningSection(child.text)
            if (reasoning) sections.push(reasoning)
            continue
        }

        if (child.kind === 'tool-call') {
            const nested = formatToolBlockForCopy(child, metadata, locale, true, includeToolJson)
            if (nested) sections.push(nested)
            continue
        }

        const auxiliary = formatVisibleAuxiliaryBlock(child)
        if (auxiliary) sections.push(auxiliary)
    }

    return sections
}

function formatToolBlockForCopy(
    block: ToolCallBlock,
    metadata: SessionMetadataSummary | null,
    locale: Locale,
    nestedInSteps: boolean,
    includeToolJson: boolean
): string {
    const summary = formatToolSummary(block, metadata, locale)
    if (!summary) return ''

    if (block.tool.name !== 'Steps') {
        const prefixedSummary = `${formatToolStatePrefix(block.tool.state)} ${summary}`
        const heading = nestedInSteps ? `- ${prefixedSummary}` : prefixedSummary
        if (!includeToolJson) return heading

        return [
            heading,
            formatToolPayloadTag('Input', block.tool.input),
            formatToolPayloadTag('Result', block.tool.result)
        ].join('\n')
    }

    const childSections = formatStepsChildren(block.children, metadata, locale, includeToolJson)
    if (childSections.length === 0) return summary

    return [
        summary,
        ...childSections
    ].join('\n')
}

function formatToolPart(
    part: AssistantCopyPart & { type: 'tool-call' },
    metadata: SessionMetadataSummary | null,
    locale: Locale,
    includeToolJson: boolean
): string {
    if (isToolCallBlock(part.artifact)) {
        return formatToolBlockForCopy(part.artifact, metadata, locale, false, includeToolJson)
    }

    return formatFallbackToolSummary(part.toolName)
}

function isTopLevelStepsToolPart(
    parts: readonly (AssistantCopyPart & { type: 'tool-call' })[]
): ToolCallBlock | null {
    if (parts.length !== 1) return null
    const [first] = parts
    if (!isToolCallBlock(first.artifact)) return null
    if (first.artifact.tool.name !== 'Steps') return null
    return first.artifact
}

export function buildAssistantCopyText(
    parts: readonly AssistantCopyPart[],
    options: AssistantCopyOptions
): string {
    const sections: string[] = []
    let idx = 0

    while (idx < parts.length) {
        const part = parts[idx]
        if (isTextPart(part)) {
            const text = part.text.trim()
            if (text) sections.push(text)
            idx += 1
            continue
        }

        if (isReasoningPart(part)) {
            const reasoning = formatReasoningSection(part.text)
            if (reasoning) sections.push(reasoning)
            idx += 1
            continue
        }

        if (isToolCallPart(part)) {
            const toolParts: Array<AssistantCopyPart & { type: 'tool-call' }> = []
            const toolSections: string[] = []
            while (idx < parts.length) {
                const current = parts[idx]
                if (!isToolCallPart(current)) break
                toolParts.push(current)
                const tool = formatToolPart(current, options.metadata, options.locale, options.includeToolJson ?? false)
                if (tool) toolSections.push(tool)
                idx += 1
            }
            const topLevelSteps = isTopLevelStepsToolPart(toolParts)
            const toolBlock = topLevelSteps
                ? formatFence(
                    formatToolSummary(topLevelSteps, options.metadata, options.locale),
                    formatStepsChildren(topLevelSteps.children, options.metadata, options.locale, options.includeToolJson ?? false).join('\n')
                )
                : formatFence('Tool_Call', toolSections.join('\n'))
            if (toolBlock) sections.push(toolBlock)
            continue
        }

        idx += 1
    }

    return sections.join('\n\n').trim()
}
