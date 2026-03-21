import { trimIdent } from '@/utils/trimIdent'
import type { SessionTriggerMetadata } from '@/api/types'
import {
    buildScheduleCreationSection,
    buildScheduledOutcomeReportingSection,
    buildScheduledPermissionControlSection,
    buildScheduledSessionEnvironmentSection
} from '@/prompt/systemPromptSections'
import { shouldIncludeCoAuthoredBy } from './claudeSettings'

const TITLE_SYSTEM_PROMPT = trimIdent(`
    <title_management>
    ## Title Management
    ALWAYS when you start a new chat - you must call a tool "mcp__hapi__change_title" to set a chat title. When you think chat title is not relevant anymore - call the tool again to change it. When chat name is too generic and you have a change to make it more specific - call the tool again to change it. This title is needed to easily find the chat in the future. Help human.
    </title_management>
`)

const CO_AUTHORED_CREDITS = trimIdent(`
    <commit_credits>
    ## Commit Credits
    When making commit messages, you SHOULD also give credit to HAPI like so:
    <main commit message>
    via [HAPI](https://hapi.run)
    Co-Authored-By: HAPI <noreply@hapi.run>
    </commit_credits>
`)

export function shouldInjectTitlePrompt(trigger?: SessionTriggerMetadata): boolean {
    return trigger?.type !== 'scheduled-task'
}

export function buildClaudeSystemPrompt(trigger?: SessionTriggerMetadata): string {
    const includeCoAuthored = shouldIncludeCoAuthoredBy()
    const sections: string[] = []
    const tools = {
        scheduleCreate: 'mcp__hapi__schedule_create',
        scheduleList: 'mcp__hapi__schedule_list',
        scheduleGet: 'mcp__hapi__schedule_get',
        scheduleEdit: 'mcp__hapi__schedule_edit',
        schedulePause: 'mcp__hapi__schedule_pause',
        scheduleResume: 'mcp__hapi__schedule_resume',
        scheduleArchive: 'mcp__hapi__schedule_archive',
        scheduleDelete: 'mcp__hapi__schedule_delete',
        scheduleRunList: 'mcp__hapi__schedule_run_list',
        scheduleRunGet: 'mcp__hapi__schedule_run_get',
        scheduleReportOutcome: 'mcp__hapi__schedule_report_outcome'
    } as const

    if (shouldInjectTitlePrompt(trigger)) {
        sections.push(TITLE_SYSTEM_PROMPT)
    }

    sections.push(buildScheduleCreationSection(tools))

    if (trigger?.type === 'scheduled-task') {
        sections.push(buildScheduledSessionEnvironmentSection(trigger))
        sections.push(buildScheduledOutcomeReportingSection(tools))
        sections.push(buildScheduledPermissionControlSection(trigger, tools))
    }

    if (includeCoAuthored) {
        sections.push(CO_AUTHORED_CREDITS)
    }

    return sections.join('\n\n')
}

export const systemPrompt = buildClaudeSystemPrompt()
