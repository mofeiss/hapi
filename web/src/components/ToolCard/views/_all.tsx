import type { ComponentType } from 'react'
import type { ApiClient } from '@/api/client'
import type { ToolCallBlock } from '@/chat/types'
import type { SessionMetadataSummary } from '@/types/api'
import { CodexDiffCompactView, CodexDiffFullView } from '@/components/ToolCard/views/CodexDiffView'
import { CodexPatchView } from '@/components/ToolCard/views/CodexPatchView'
import { EditView } from '@/components/ToolCard/views/EditView'
import { AgentView } from '@/components/ToolCard/views/AgentView'
import { AskUserQuestionView } from '@/components/ToolCard/views/AskUserQuestionView'
import { RequestUserInputView } from '@/components/ToolCard/views/RequestUserInputView'
import { MultiEditFullView, MultiEditView } from '@/components/ToolCard/views/MultiEditView'
import { TodoWriteView } from '@/components/ToolCard/views/TodoWriteView'
import { WriteView } from '@/components/ToolCard/views/WriteView'
import { StepsView } from '@/components/ToolCard/views/StepsView'

export type ToolViewProps = {
    block: ToolCallBlock
    metadata: SessionMetadataSummary | null
    api?: ApiClient
    sessionId?: string
    disabled?: boolean
    onDone?: () => void
}

export type ToolViewComponent = ComponentType<ToolViewProps>

export const toolViewRegistry: Record<string, ToolViewComponent> = {
    Agent: AgentView,
    Edit: EditView,
    MultiEdit: MultiEditView,
    Write: WriteView,
    TodoWrite: TodoWriteView,
    'functions.update_plan': TodoWriteView,
    update_plan: TodoWriteView,
    CodexDiff: CodexDiffCompactView,
    AskUserQuestion: AskUserQuestionView,
    Steps: StepsView,
    ask_user_question: AskUserQuestionView,
    request_user_input: RequestUserInputView
}

export const toolFullViewRegistry: Record<string, ToolViewComponent> = {
    Agent: AgentView,
    Edit: EditView,
    MultiEdit: MultiEditFullView,
    Write: WriteView,
    TodoWrite: TodoWriteView,
    'functions.update_plan': TodoWriteView,
    update_plan: TodoWriteView,
    CodexDiff: CodexDiffFullView,
    CodexPatch: CodexPatchView,
    apply_patch: CodexPatchView,
    AskUserQuestion: AskUserQuestionView,
    Steps: StepsView,
    ask_user_question: AskUserQuestionView,
    request_user_input: RequestUserInputView
}

export function getToolViewComponent(toolName: string): ToolViewComponent | null {
    return toolViewRegistry[toolName] ?? null
}

export function getToolFullViewComponent(toolName: string): ToolViewComponent | null {
    return toolFullViewRegistry[toolName] ?? null
}
