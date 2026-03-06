import {
    extractMcpResourceServerGroups,
    shouldUseGroupedMcpResourceListLayout
} from '@/components/ToolCard/views/_results'

const RESULT_ONLY_TOOLS = new Set<string>([
    'EnterPlanMode',
    'enter_plan_mode',
    'ExitPlanMode',
    'exit_plan_mode'
])

export function isResultOnlyToolName(toolName: string, input?: unknown, result?: unknown): boolean {
    if (RESULT_ONLY_TOOLS.has(toolName)) return true

    if (toolName === 'ListMcpResourcesTool') {
        return shouldUseGroupedMcpResourceListLayout(input) && extractMcpResourceServerGroups(result) !== null
    }

    return false
}
