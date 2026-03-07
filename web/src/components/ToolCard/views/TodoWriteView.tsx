import type { ToolViewProps } from '@/components/ToolCard/views/_all'
import { TodoList } from '@/components/TodoPanel'
import { extractToolTodos } from '@/lib/todos'

export function TodoWriteView(props: ToolViewProps) {
    const todos = extractToolTodos(props.block.tool.input, props.block.tool.result)
    if (todos.length === 0) return null

    return (
        <TodoList todos={todos} variant="inline" />
    )
}
