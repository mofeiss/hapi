const RESULT_ONLY_TOOLS = new Set<string>([
    'EnterPlanMode',
    'enter_plan_mode',
    'ExitPlanMode',
    'exit_plan_mode'
])

export function isResultOnlyToolName(toolName: string): boolean {
    return RESULT_ONLY_TOOLS.has(toolName)
}
