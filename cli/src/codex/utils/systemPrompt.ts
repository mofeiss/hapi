import { trimIdent } from '@/utils/trimIdent'
import type { SessionTriggerMetadata } from '@/api/types'
import {
    buildScheduleCreationSection,
    buildScheduledOutcomeReportingSection,
    buildScheduledPermissionControlSection,
    buildScheduledSessionEnvironmentSection
} from '@/prompt/systemPromptSections'

export const TITLE_INSTRUCTION = trimIdent(`
    <title_management>
    ALWAYS when you start a new chat - you must call a tool "functions.hapi__change_title" to set a chat title. When you think chat title is not relevant anymore - call the tool again to change it. When chat name is too generic and you have a chance to make it more specific - call the tool again to change it. This title is needed to easily find the chat in the future. Help human.
    </title_management>
`)

export function buildCodexSystemPrompt(trigger?: SessionTriggerMetadata): string {
    const tools = {
        scheduleCreate: 'functions.hapi__schedule_create',
        scheduleList: 'functions.hapi__schedule_list',
        scheduleGet: 'functions.hapi__schedule_get',
        scheduleEdit: 'functions.hapi__schedule_edit',
        schedulePause: 'functions.hapi__schedule_pause',
        scheduleResume: 'functions.hapi__schedule_resume',
        scheduleArchive: 'functions.hapi__schedule_archive',
        scheduleDelete: 'functions.hapi__schedule_delete',
        scheduleRunList: 'functions.hapi__schedule_run_list',
        scheduleRunGet: 'functions.hapi__schedule_run_get',
        scheduleReportOutcome: 'functions.hapi__schedule_report_outcome'
    } as const
    const sections = [
        ...(trigger?.type === 'scheduled-task' ? [] : [TITLE_INSTRUCTION]),
        buildScheduleCreationSection(tools),
        ...(trigger?.type === 'scheduled-task' ? [
            buildScheduledSessionEnvironmentSection(trigger),
            buildScheduledOutcomeReportingSection(tools),
            buildScheduledPermissionControlSection(trigger, tools)
        ].filter(Boolean) : [])
    ]

    return sections.join('\n\n')
}

export const codexSystemPrompt = buildCodexSystemPrompt()
