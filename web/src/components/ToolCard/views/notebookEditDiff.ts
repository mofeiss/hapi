import { isObject } from '@hapi/protocol'
import { getInputStringAny } from '@/lib/toolInputUtils'

export type NotebookEditDiffData = {
    oldSource: string | null
    newSource: string | null
    notebookPath: string | null
}

function extractNotebookCellSource(fileContent: string, cellId: string | null): string | null {
    try {
        const parsed = JSON.parse(fileContent) as unknown
        if (!isObject(parsed) || !Array.isArray(parsed.cells)) return null

        const cells = parsed.cells.filter(isObject)
        let target = null as Record<string, unknown> | null

        if (cellId) {
            target = cells.find((cell) => typeof cell.id === 'string' && cell.id === cellId) ?? null
        }
        if (!target) {
            target = cells.find((cell) => cell.cell_type === 'code') ?? cells[0] ?? null
        }
        if (!target) return null

        const source = target.source
        if (typeof source === 'string') return source
        if (Array.isArray(source)) {
            return source
                .filter((line): line is string => typeof line === 'string')
                .join('')
        }
        return null
    } catch {
        return null
    }
}

export function resolveNotebookEditDiffData(input: unknown, result: unknown): NotebookEditDiffData {
    const inputObj = isObject(input) ? input : null
    const resultObj = isObject(result) ? result : null

    const cellId = getInputStringAny(inputObj, ['cell_id'])
        ?? getInputStringAny(resultObj, ['cell_id'])
        ?? null

    const notebookPath = getInputStringAny(inputObj, ['notebook_path', 'path', 'file_path'])
        ?? getInputStringAny(resultObj, ['notebook_path', 'path', 'file_path'])
        ?? null

    let oldSource = getInputStringAny(inputObj, ['old_source'])
        ?? getInputStringAny(resultObj, ['old_source'])
        ?? null
    let newSource = getInputStringAny(inputObj, ['new_source', 'source'])
        ?? getInputStringAny(resultObj, ['new_source', 'source'])
        ?? null

    if ((!oldSource || !newSource) && resultObj) {
        const originalFile = getInputStringAny(resultObj, ['original_file'])
        const updatedFile = getInputStringAny(resultObj, ['updated_file'])

        if (!oldSource && originalFile) {
            oldSource = extractNotebookCellSource(originalFile, cellId)
        }
        if (!newSource && updatedFile) {
            newSource = extractNotebookCellSource(updatedFile, cellId)
        }
    }

    return { oldSource, newSource, notebookPath }
}
