import type { ToolViewProps } from '@/components/ToolCard/views/_all'
import { isObject } from '@hapi/protocol'
import { DiffView } from '@/components/DiffView'
import { ToolParamField } from '@/components/ToolCard/ToolParamField'

export function EditView(props: ToolViewProps) {
    const input = props.block.tool.input
    if (!isObject(input)) return null

    const filePath = typeof input.file_path === 'string'
        ? input.file_path
        : typeof input.path === 'string'
            ? input.path
            : null
    const replaceAll = typeof input.replace_all === 'boolean' ? input.replace_all : null

    const oldString = typeof input.old_string === 'string' ? input.old_string : null
    const newString = typeof input.new_string === 'string' ? input.new_string : null
    if (oldString === null || newString === null) return null

    return (
        <div className="space-y-2">
            <div className="space-y-0">
                {filePath ? (
                    <ToolParamField name="file_path" value={filePath} />
                ) : null}
                {replaceAll !== null ? (
                    <ToolParamField name="replace_all" value={String(replaceAll)} />
                ) : null}
            </div>
            <DiffView
                oldString={oldString}
                newString={newString}
                variant="inline"
            />
        </div>
    )
}
