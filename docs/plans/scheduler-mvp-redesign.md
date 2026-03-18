# Scheduler MVP Redesign

状态：迭代中

## Summary

我们因为现有 Scheduler 已经出现明显的状态语义混乱，导致前端展示、MCP 工具返回、任务系统行为之间互相打架，最终决定重做一套收敛后的 Scheduler MVP 模型。

接下来决定这样做：

- 把 task、run、outcome、session、display status 明确拆层
- 把 task 重新收敛为 config 语义
- 把 `once` 的“已消费”改为派生事实，而不是持久 phase
- 把前端展示状态与 task phase 解耦
- 把 MCP 工具改成职责清晰、输入输出明确、错误码可判定的接口集合

这份文件同时承担两部分内容：

- 说明为什么现在要重做 Scheduler
- 记录已经拍板的 MVP 设计结论

保持精简；后续只在新小节确认后再继续追加。

## 0. Background

这次工作起点不是一次普通 bug 修复，而是 Scheduler 语义已经出现了明显混乱。

触发背景来自一个真实问题：

- 一个 `once` 任务已经执行过
- 后来又被手动点了暂停
- 再尝试恢复时，前端交互和 MCP 工具反馈都开始失真

暴露出来的典型现象包括：

- 一个真实存在的 task，MCP 却返回 `Scheduled task not found`
- 一个未来才会执行、还没有跑过的 `once` 任务，在界面里显示成 `Running`
- 一个已经执行完成的 `once` 任务，在界面里却显示成 `Active`

这些现象说明当前系统已经不只是单点 bug，而是多个层级的状态语义开始互相污染。

当前真正的痛点在于，下面几类信息没有被严格拆开：

- task/config 自己的生命周期
- run 的执行状态
- run 的 business outcome
- session 本身的状态
- 前端列表项需要给用户看的主状态

这次重做的核心目标不是补丁式修复，而是把 Scheduler 收敛成一套足够小、但表达准确的 MVP 模型。

整体方向：

- task 更偏 config，而不是 job instance
- config 生命周期需要与 run 结果解耦
- 前端列表项左侧和右侧分成两个状态区
- 左侧展示 run 视角的主状态
- 右侧展示 task/config 的 phase
- runs 区域独立展示 `run.status` 和 `outcome.status`
- `once` 任务一旦出现 run 记录，就视为已消费，并结束其调度生命周期

这次设计刻意不追求：

- 为 run 增加大量中间过程态
- 为 task 加入很多长线审计型状态
- 为当前没有明确需求的动作预埋复杂恢复路径
- 用一个状态字段同时解决配置态、执行态、展示态、业务态

## 1. Task Phase

`task.phase` 面向 config 语义。
它只回答一件事：这个 task config 现在是否还参与未来调度。

```ts
type ScheduledTaskPhase =
    | 'enabled'
    | 'paused'
    | 'archived'
```

含义：

- `enabled`：参与未来调度
- `paused`：临时停止；后续可以恢复参与调度
- `archived`：不再参与未来调度，但保留记录用于查看和对比

建议展示文案：

- `enabled`：启用
- `paused`：暂停
- `archived`：归档

说明：

- `deleted` 不是 phase
- `delete` 表示物理删除 task + runs + 子 sessions
- task 更应该被视为 config，而不是 job instance

## 2. Task Phase Transitions

允许流转：

- create -> `enabled`
- `enabled` -> `paused`
- `paused` -> `enabled`
- `enabled` -> `archived`
- `paused` -> `archived`

规则：

- create 后只能进入 `enabled`，不提供直接创建为 `paused` 的入口
- `archived` 是终态
- 当前不支持 duplicate / restore

## 3. Once Consumption

`consumed` 不是持久化的 task phase。
它是 `once` task 的一个派生事实。

规则：

- 对 `once` task 来说，只要至少存在 1 条 run 记录，就视为 consumed

```ts
consumed = task.scheduleType === 'once' && runs.length > 0
```

补充规则：

- run 成功还是失败，不影响 consumed 判定
- once 一旦 consumed，task 应自动进入 `archived`

## 4. Run Status

`run.status` 只描述 run 本身。
它不描述 task phase，不描述 session state，也不描述 business outcome。

```ts
type ScheduledTaskRunStatus =
    | 'succeeded'
    | 'failed'
```

规则：

- run status 保持最小化
- 当前不加入 `queued` / `starting` / `running` / `canceled`
- session state 单独处理
- outcome status 单独处理

## 5. Display Status

`displayStatus` 是 Scheduler 列表项和 Overview 左侧展示的状态。
它是 run 视角，不是 task/config 视角。

```ts
type ScheduledTaskDisplayStatus =
    | 'ready'
    | 'completed'
    | 'healthy'
    | 'failed'
```

规则：

- `displayStatus` 与 `task.phase` 解耦
- `task.phase` 在右侧单独展示
- `displayStatus` 不从 session state 派生
- `displayStatus` 不从 outcome status 派生

当前已确认的派生规则：

- 没有任何 run 记录 -> `ready`
- `once` task 只要已有 run：
  - latest / only run 为 `succeeded` -> `completed`
  - latest / only run 为 `failed` -> `failed`
- `cron` task 有 run 历史时：
  - latest run 为 `succeeded` -> `healthy`
  - latest run 为 `failed` -> `failed`

建议展示文案：

- `ready`：就绪
- `completed`：已完成
- `healthy`：正常
- `failed`：失败

优先级说明：

- Scheduler 列表项左侧的 `displayStatus` 与右侧的 `task.phase` 可以刻意不同
- 例：cron 最新一次 run 失败，但 task.phase 为 `paused` -> 左侧显示 `failed`，右侧显示 `paused`

## 6. Separation Of Concerns

Scheduler 列表项：

- 左侧：`displayStatus`
- 右侧：`task.phase`

Overview：

- 全量展示 `displayStatus`
- 全量展示 `task.phase`
- 建议字段名：`Display Status`、`Task Phase`
- `Copy details` 按相同分层完整输出

Runs 区域：

- 展示 `run.status`
- 展示 `outcome.status`

规则：

- `displayStatus` 只跟随 run-level state
- `task.phase` 只跟随 config lifecycle
- `outcome.status` 只在 runs 区域展示，不反向改变列表项 `displayStatus`

## 7. Canonical Schema

### 7.1 ScheduledTask

```ts
type ScheduledTask = {
    id: string
    title: string
    prompt: string
    machineId: string
    createdBySessionId?: string

    agentFlavor: 'claude' | 'codex'
    model?: string
    targetDirectory: string

    scheduleType: 'once' | 'cron'
    runAt?: number
    cron?: string
    timezone: string

    phase: 'enabled' | 'paused' | 'archived'
    scheduledSessionPermission: 'aware' | 'self_control' | 'system_control'

    createdAt: number
    updatedAt: number
}
```

### 7.2 ScheduledTaskDerived

```ts
type ScheduledTaskDerived = {
    consumed: boolean
    runCount: number
    lastRunAt?: number
    nextRunAt?: number
    latestRunId?: string
    latestRunStatus?: 'succeeded' | 'failed'
    latestRunOutcomeStatus?: 'completed' | 'partial' | 'blocked' | 'abandoned'
}
```

### 7.3 ScheduledTaskRun

```ts
type ScheduledTaskRun = {
    id: string
    taskId: string
    machineId: string

    status: 'succeeded' | 'failed'

    scheduledFor: number
    triggeredAt?: number
    startedAt?: number
    finishedAt?: number

    sessionId?: string
    resultSummary?: string
    errorMessage?: string

    outcome?: {
        status: 'completed' | 'partial' | 'blocked' | 'abandoned'
        summary: string
        needsUserIntervention?: boolean
        permanentFailureLikely?: boolean
        reportedAt: number
    }
}
```

### 7.4 ScheduledTaskDisplayStatus

```ts
type ScheduledTaskDisplayStatus =
    | 'ready'
    | 'completed'
    | 'healthy'
    | 'failed'
```

## 8. MCP Tools

所有 Scheduler MCP 工具返回统一结构：

```ts
type SchedulerToolResult<T> = {
    ok: boolean
    code: string
    message: string
    data?: T
}
```

查询型 MCP 工具统一支持：

```ts
view?: 'basic' | 'full'
```

规则：

- 默认使用 `basic`
- `basic` 只返回当前工具的必要数据
- `full` 返回与前端 Overview / Runs 对齐的完整可读信息
- 纯视觉渲染字段不进入 MCP

### 8.1 `schedule_list`

```ts
input: {
    view?: 'basic' | 'full'
}

output: {
    tasks: Array<{
        id: string
        title: string
        scheduleType: 'once' | 'cron'
        phase: 'enabled' | 'paused' | 'archived'
    }>
}
```

### 8.2 `schedule_get`

```ts
input: {
    taskId: string
    view?: 'basic' | 'full'
}

output: {
    taskId: string
    title: string
    prompt: string
    scheduleType: 'once' | 'cron'
    phase: 'enabled' | 'paused' | 'archived'
    createdBySessionId?: string
    scheduledSessionPermission: 'aware' | 'self_control' | 'system_control'
    targetDirectory: string
    agentFlavor: 'claude' | 'codex'
    model?: string
    timezone: string
    runAt?: number
    cron?: string

    consumed?: boolean
    displayStatus?: 'ready' | 'completed' | 'healthy' | 'failed'
    latestRunId?: string
    latestRunStatus?: 'succeeded' | 'failed'
    latestRunOutcomeStatus?: 'completed' | 'partial' | 'blocked' | 'abandoned'
    runCount?: number
    lastRunAt?: number
    nextRunAt?: number
}
```

### 8.3 `schedule_create`

```ts
input: {
    title: string
    prompt: string
    agentFlavor: 'claude' | 'codex'
    model?: string
    scheduleType: 'once' | 'cron'
    runAt?: number | string
    cron?: string
    targetDirectory: string
    timezone?: string
    scheduledSessionPermission?: 'aware' | 'self_control' | 'system_control'
}

output: {
    taskId: string
    title: string
    scheduleType: 'once' | 'cron'
    phase: 'enabled'
    scheduledSessionPermission: 'aware' | 'self_control' | 'system_control'
    runAt?: number
    cron?: string
    timezone: string
    nextRunAt?: number
}
```

### 8.4 `schedule_edit`

```ts
input: {
    taskId: string
    title?: string
    prompt?: string
    agentFlavor?: 'claude' | 'codex'
    model?: string
    scheduleType?: 'once' | 'cron'
    runAt?: number | string
    cron?: string
    targetDirectory?: string
    timezone?: string
    scheduledSessionPermission?: 'aware' | 'self_control' | 'system_control'
}

output: {
    taskId: string
    updatedAt: number
    scheduleType: 'once' | 'cron'
    scheduledSessionPermission: 'aware' | 'self_control' | 'system_control'
    runAt?: number
    cron?: string
    timezone: string
    nextRunAt?: number
}
```

### 8.5 `schedule_pause`

```ts
input: {
    taskId: string
}

output: {
    taskId: string
    phase: 'paused'
    updatedAt: number
}
```

### 8.6 `schedule_resume`

```ts
input: {
    taskId: string
}

output: {
    taskId: string
    phase: 'enabled'
    updatedAt: number
    nextRunAt?: number
}
```

### 8.7 `schedule_archive`

```ts
input: {
    taskId: string
}

output: {
    taskId: string
    phase: 'archived'
    updatedAt: number
}
```

### 8.8 `schedule_delete`

```ts
input: {
    taskId: string
}

output: {
    taskId: string
    deleted: true
}
```

### 8.9 `schedule_run_list`

```ts
input: {
    view?: 'basic' | 'full'
    taskId?: string
}

output: {
    runs: Array<{
        id: string
        taskId: string
        status: 'succeeded' | 'failed'
        scheduledFor: number
        sessionId?: string
        outcomeStatus?: 'completed' | 'partial' | 'blocked' | 'abandoned'

        triggeredAt?: number
        startedAt?: number
        finishedAt?: number
        resultSummary?: string
        errorMessage?: string
        outcome?: {
            status: 'completed' | 'partial' | 'blocked' | 'abandoned'
            summary: string
            needsUserIntervention?: boolean
            permanentFailureLikely?: boolean
            reportedAt: number
        }
    }>
}
```

### 8.10 `schedule_run_get`

```ts
input: {
    runId: string
    view?: 'basic' | 'full'
}

output: {
    runId: string
    taskId: string
    status: 'succeeded' | 'failed'
    scheduledFor: number
    triggeredAt?: number
    startedAt?: number
    finishedAt?: number
    sessionId?: string
    resultSummary?: string
    errorMessage?: string
    outcome?: {
        status: 'completed' | 'partial' | 'blocked' | 'abandoned'
        summary: string
        needsUserIntervention?: boolean
        permanentFailureLikely?: boolean
        reportedAt: number
    }
}
```

### 8.11 `schedule_report_outcome`

```ts
input: {
    status: 'completed' | 'partial' | 'blocked' | 'abandoned'
    summary: string
    needsUserIntervention?: boolean
    permanentFailureLikely?: boolean
}

output: {
    runId: string
    outcome: {
        status: 'completed' | 'partial' | 'blocked' | 'abandoned'
        summary: string
        needsUserIntervention?: boolean
        permanentFailureLikely?: boolean
        reportedAt: number
    }
}
```

### 8.12 Error Codes

```ts
type SchedulerErrorCode =
    | 'schedule.task_not_found'
    | 'schedule.run_not_found'
    | 'schedule.invalid_input'
    | 'schedule.invalid_transition'
    | 'schedule.once_consumed'
    | 'schedule.phase_archived'
    | 'schedule.permission_denied'
    | 'schedule.self_control_forbidden'
    | 'schedule.outcome_report_forbidden'
    | 'schedule.internal_error'
```

```ts
schedule_list:
    - schedule.permission_denied
    - schedule.internal_error

schedule_get:
    - schedule.task_not_found
    - schedule.permission_denied
    - schedule.internal_error

schedule_create:
    - schedule.invalid_input
    - schedule.permission_denied
    - schedule.internal_error

schedule_edit:
    - schedule.task_not_found
    - schedule.invalid_input
    - schedule.phase_archived
    - schedule.permission_denied
    - schedule.self_control_forbidden
    - schedule.internal_error

schedule_pause:
    - schedule.task_not_found
    - schedule.invalid_transition
    - schedule.once_consumed
    - schedule.phase_archived
    - schedule.permission_denied
    - schedule.self_control_forbidden
    - schedule.internal_error

schedule_resume:
    - schedule.task_not_found
    - schedule.invalid_transition
    - schedule.once_consumed
    - schedule.phase_archived
    - schedule.permission_denied
    - schedule.self_control_forbidden
    - schedule.internal_error

schedule_archive:
    - schedule.task_not_found
    - schedule.invalid_transition
    - schedule.permission_denied
    - schedule.self_control_forbidden
    - schedule.internal_error

schedule_delete:
    - schedule.task_not_found
    - schedule.permission_denied
    - schedule.self_control_forbidden
    - schedule.internal_error

schedule_run_list:
    - schedule.task_not_found
    - schedule.permission_denied
    - schedule.internal_error

schedule_run_get:
    - schedule.run_not_found
    - schedule.permission_denied
    - schedule.internal_error

schedule_report_outcome:
    - schedule.run_not_found
    - schedule.outcome_report_forbidden
    - schedule.permission_denied
    - schedule.internal_error
```

## 9. Prompt Updates

基于当前 `cli/src/prompt/systemPromptSections.ts` 的现有设计，Scheduler 相关提示词需要按下面方向收拢。

### 9.1 Schedule Creation Section

保留现有原则：

- 明确区分“任务创建成功”和“任务执行成功”
- 创建成功后，应优先基于 tool 返回结果向用户汇报
- 不要因为 `once` 已执行完就擅自重建任务

需要修改：

- 不再要求创建前必须显式确定 `scheduledSessionPermission`
- `aware` 作为默认权限，允许直接采用
- 只有当用户明确表达更高权限意图时，才使用 `self_control` 或 `system_control`
- 如果用户没有给出权限相关要求，不再强制追问
- 创建成功后的汇报内容应基于 `schedule_create` 的新 output schema
- 不再鼓励创建后额外调用 `schedule_list` 来补状态

### 9.2 Scheduled Session Environment Section

保留现有原则：

- 明确当前 session 是由 scheduled task 自动启动
- 明确当前 run 处于无人值守环境
- 明确 taskId / runId / scheduleType / permission 信息

需要修改：

- 文案应避免再使用旧的 task 状态心智，例如 pending / completed / active 这类混合表达
- 对 `once` task，应让 agent 理解“是否已消费”来自 run 事实，而不是来自 task 自身状态字段

### 9.3 Scheduled Permission Control Section

保留现有三档权限：

- `aware`
- `self_control`
- `system_control`

需要修改：

- `self_control` 文案里的例子要把旧的 `cancel` 改成 `archive`
- 权限说明里涉及 task 控制动作时，应改用新的 MCP 工具集合：
  - `schedule_get`
  - `schedule_list`
  - `schedule_edit`
  - `schedule_pause`
  - `schedule_resume`
  - `schedule_archive`
  - `schedule_delete`
  - `schedule_run_list`
  - `schedule_run_get`
- 不再提及 `schedule_update` / `schedule_cancel` / `schedule_duplicate`

### 9.4 Outcome Reporting Section

保留现有原则：

- scheduled session 必须使用 `schedule_report_outcome`
- outcome 描述的是业务结果，不是 task phase，不是 run.status
- `schedule_report_outcome` 应作为 run 的最终结果上报工具

需要修改：

- 文案里要进一步强调：`run.status` 与 `outcome.status` 是两层含义，不能混用
- agent 不应把 `outcome.status=completed` 理解成 task phase 的 `archived` 或 displayStatus 的 `completed`

### 9.5 Tool-Usage Constraints

需要新增的通用约束：

- 对 Scheduler 工具返回结果，优先依据结构化字段和错误码判断，不依赖自然语言猜测
- 不允许把“状态不允许”误报成 `not found`
- `schedule_list` 只用于读取最小 task 列表；需要详情时改用 `schedule_get`
- `schedule_run_list` 只用于读取 run 列表；需要详情时改用 `schedule_run_get`
- 对 `once` task，如果已经有 run 记录，不应再尝试 `resume`

## 10. Implementation Order

按下面顺序落地：

1. shared

- 更新 Scheduler 相关类型定义
- 更新 `task.phase` / `run.status` / `displayStatus` / `consumed` 派生逻辑

2. runner store / service

- 更新 task/run 持久结构
- 落地 once consumed -> archived 自动迁移
- 更新 task phase 流转规则

3. MCP tools

- 替换旧工具集合为新工具集合
- 对齐每个工具的 input / output schema
- 对齐结构化错误码返回

4. prompt

- 更新 scheduler 相关系统提示词
- 删除旧工具名和旧权限决策强制逻辑
- 对齐新的 tool 使用边界

5. web

- 对齐新的 canonical schema
- 前端本地派生 `displayStatus`
- 对齐 Scheduler 列表、Overview、Runs 展示

6. tests

- 更新 shared / runner / MCP / prompt 相关测试
- 删除旧状态模型与旧工具名的断言
