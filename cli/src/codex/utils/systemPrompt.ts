import { trimIdent } from '@/utils/trimIdent'
import type { SessionTriggerMetadata } from '@/api/types'
import {
    buildScheduleCreationSection,
    buildScheduledOutcomeReportingSection,
    buildScheduledPermissionControlSection,
    buildScheduledSessionEnvironmentSection
} from '@/prompt/systemPromptSections'

export const TITLE_INSTRUCTION = trimIdent(`
    ## Title Management

    Based on this message, call functions.hapi__change_title to change chat session title that would represent the current task. If chat idea would change dramatically - call this function again to update the title.
`)

export function buildCodexSystemPrompt(trigger?: SessionTriggerMetadata): string {
    const tools = {
        scheduleCreate: 'functions.hapi__schedule_create',
        scheduleList: 'functions.hapi__schedule_list',
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
