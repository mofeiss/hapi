import type { ScheduledTask, ScheduledTaskRun } from '@hapi/protocol'
import {
  readRunnerSchedulerState,
  writeRunnerSchedulerState,
  type RunnerSchedulerPersistedState
} from '@/persistence'

export class RunnerSchedulerStore {
  async read(): Promise<RunnerSchedulerPersistedState> {
    return await readRunnerSchedulerState()
  }

  async write(state: RunnerSchedulerPersistedState): Promise<void> {
    await writeRunnerSchedulerState(state)
  }

  async listTasks(): Promise<ScheduledTask[]> {
    const state = await this.read()
    return state.tasks
  }

  async listRuns(): Promise<ScheduledTaskRun[]> {
    const state = await this.read()
    return state.runs
  }

  async update(
    updater: (state: RunnerSchedulerPersistedState) => RunnerSchedulerPersistedState | Promise<RunnerSchedulerPersistedState>
  ): Promise<RunnerSchedulerPersistedState> {
    const current = await this.read()
    const next = await updater(current)
    await this.write(next)
    return next
  }
}

