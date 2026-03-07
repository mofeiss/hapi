import type { ToolViewProps } from '@/components/ToolCard/views/_all'
import { isObject } from '@hapi/protocol'
import { DiffView } from '@/components/DiffView'
import { getToolParamFieldPosition, ToolParamField } from '@/components/ToolCard/ToolParamField'

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
    const rows = [
        filePath ? { name: 'file_path', value: filePath } : null,
        replaceAll !== null ? { name: 'replace_all', value: String(replaceAll) } : null
    ].filter((row): row is { name: string; value: string } => row !== null)

    return (
        <div className="space-y-2">
            <div className="space-y-0">
                {rows.map((row, idx) => (
                    <ToolParamField
                        key={row.name}
                        name={row.name}
                        value={row.value}
                        position={getToolParamFieldPosition(idx, rows.length)}
                    />
                ))}
            </div>
            <DiffView
                oldString={oldString}
                newString={newString}
                variant="inline"
            />
        </div>
    )
}
