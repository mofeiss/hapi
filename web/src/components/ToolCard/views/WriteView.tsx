import type { ToolViewProps } from '@/components/ToolCard/views/_all'
import { isObject } from '@hapi/protocol'
import { DiffView } from '@/components/DiffView'
import { ToolParamField } from '@/components/ToolCard/ToolParamField'

export function WriteView(props: ToolViewProps) {
    const input = props.block.tool.input
    if (!isObject(input)) return null

    const filePath = typeof input.file_path === 'string'
        ? input.file_path
        : typeof input.path === 'string'
            ? input.path
            : null

    const content = typeof input.content === 'string' ? input.content : typeof input.text === 'string' ? input.text : null
    if (content === null) return null

    return (
        <div className="space-y-2">
            {filePath ? (
                <ToolParamField name="file_path" value={filePath} />
            ) : null}
            <DiffView
                oldString=""
                newString={content}
                variant="inline"
            />
        </div>
    )
}
