import type { ToolViewComponent } from '@/components/ToolCard/views/_all'
import { ToolParamField, getToolParamFieldContainerClass } from '@/components/ToolCard/ToolParamField'
import { MarkdownSourcePreview } from '@/components/ToolCard/views/MarkdownSourcePreview'
import { CodeBlock } from '@/components/CodeBlock'
import { safeStringify } from '@hapi/protocol'
import { extractAgentPrompt, extractAgentTopic } from '@/lib/agentTool'
import { cn } from '@/lib/utils'

function PromptPreview(props: { prompt: string; hasTopic: boolean }) {
    return (
        <div className={cn(getToolParamFieldContainerClass(props.hasTopic ? 'last' : 'single'), 'pr-0')}>
            <div className="mb-1 font-mono text-xs leading-4 text-[var(--app-fg)] break-all">
                <span className="inline-flex items-center rounded-sm bg-[var(--app-bg)] px-1 text-[10px] font-semibold uppercase tracking-[0.06em] text-[var(--app-hint)]">
                    prompt
                </span>
            </div>
            <MarkdownSourcePreview content={props.prompt} sourceLanguage="markdown" />
        </div>
    )
}

export const AgentView: ToolViewComponent = (props) => {
    const topic = extractAgentTopic(props.block.tool.input)
    const prompt = extractAgentPrompt(props.block.tool.input)

    if (!topic && !prompt) {
        return <CodeBlock code={safeStringify(props.block.tool.input)} language="json" />
    }

    return (
        <div className="space-y-0">
            {topic ? (
                <ToolParamField
                    name="topic"
                    value={topic}
                    position={prompt ? 'first' : 'single'}
                />
            ) : null}
            {prompt ? <PromptPreview prompt={prompt} hasTopic={Boolean(topic)} /> : null}
        </div>
    )
}
