import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
    clearWorkspaceScheduledSelection,
    clearWorkspaceSessionSelection,
    getWorkspaceState,
    openWorkspaceScheduledTask,
    openWorkspaceSession,
    resetWorkspaceState,
    selectWorkspaceOverlay,
    selectWorkspaceTab,
} from './workspace-store'

describe('workspace-store', () => {
    beforeEach(() => {
        sessionStorage.clear()
        resetWorkspaceState()
    })

    afterEach(() => {
        sessionStorage.clear()
        resetWorkspaceState()
    })

    it('clears persisted overlays when opening a session detail', () => {
        selectWorkspaceTab('sessions')
        selectWorkspaceOverlay('newSession')

        openWorkspaceSession('session-123', 'chat')

        expect(getWorkspaceState()).toMatchObject({
            tab: 'sessions',
            overlay: 'none',
            selectedSessionId: 'session-123',
            sessionSubview: 'chat',
        })
    })

    it('clears persisted overlays when opening a scheduled task detail', () => {
        selectWorkspaceTab('scheduled')
        selectWorkspaceOverlay('newTask')

        openWorkspaceScheduledTask('task-123', 'run-9')

        expect(getWorkspaceState()).toMatchObject({
            tab: 'scheduled',
            overlay: 'none',
            selectedScheduledTaskId: 'task-123',
            selectedScheduledRunId: 'run-9',
        })
    })

    it('keeps clear helpers focused on selection state only', () => {
        openWorkspaceSession('session-123', 'files')
        clearWorkspaceSessionSelection()
        expect(getWorkspaceState()).toMatchObject({
            selectedSessionId: null,
            sessionSubview: 'chat',
        })

        openWorkspaceScheduledTask('task-123', 'run-9')
        clearWorkspaceScheduledSelection()
        expect(getWorkspaceState()).toMatchObject({
            selectedScheduledTaskId: null,
            selectedScheduledRunId: null,
        })
    })
})
