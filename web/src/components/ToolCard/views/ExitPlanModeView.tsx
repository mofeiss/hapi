import type { ToolViewProps } from '@/components/ToolCard/views/_all'
import { isObject } from '@hapi/protocol'
import { MarkdownRenderer } from '@/components/MarkdownRenderer'
import { ToolParamField } from '@/components/ToolCard/ToolParamField'

function countLines(text: string): number {
    return text.split('\n').length
}

export function ExitPlanModeView(props: ToolViewProps) {
    const input = props.block.tool.input
    if (!isObject(input)) return null
    const plan = typeof input.plan === 'string' ? input.plan : null
    if (!plan) return null

    return (
        <div className="space-y-2">
            <ToolParamField name="plan" value={`${countLines(plan)} lines`} />
            <MarkdownRenderer content={plan} />
        </div>
    )
}
