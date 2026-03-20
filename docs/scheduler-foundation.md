# Scheduler Foundation

状态：当前基础事实

## Summary

Scheduler 用于在指定机器上创建和管理定时执行的 agent 任务。

当前模型遵循以下原则：

- task 表示一份可调度配置
- run 表示一次具体执行记录
- outcome 表示该次执行的业务结果
- display status 表示任务列表与概览中的主展示状态
- task phase 表示该配置是否继续参与未来调度

这些层彼此独立，不应混用。

## Core Objects

### ScheduledTask

`ScheduledTask` 表示一份调度配置。

它包含：

- 标题与 prompt
- 目标机器与目录
- agent flavor 与 model
- 调度类型与时间信息
- 调度权限
- 配置生命周期 phase

### ScheduledTaskRun

`ScheduledTaskRun` 表示某个 task 的一次执行。

它包含：

- 归属 task
- 调度触发时间与实际执行时间
- run 执行状态
- 关联 session
- 可选错误信息
- 可选业务 outcome

### ScheduledTaskOutcome

`ScheduledTaskOutcome` 表示某次 run 的业务结果。

它不是 task phase，也不是 run.status。

它回答的是：这次执行从业务角度看完成得怎么样。

## Task Phase

`task.phase` 表示该 task 配置是否还参与未来调度。

```ts
type ScheduledTaskPhase =
    | 'enabled'
    | 'paused'
    | 'archived'
```

含义：

- `enabled`：继续参与未来调度
- `paused`：暂时停止，之后可恢复
- `archived`：不再参与未来调度，但保留记录

允许流转：

- create -> `enabled`
- `enabled` -> `paused`
- `paused` -> `enabled`
- `enabled` -> `archived`
- `paused` -> `archived`

`archived` 是终态。

`delete` 不是 phase。删除表示物理移除 task、runs，以及与 run 关联的派生 session 记录。

## Schedule Types

当前支持两种调度类型：

```ts
type ScheduledTaskType = 'once' | 'cron'
```

### Once

`once` 表示单次执行。

可通过两种方式定义执行时间：

- `runAt`：绝对时间戳
- `delay`：相对延迟

同一个 `once` task 必须二选一，不能同时提供。

### Cron

`cron` 表示循环执行。

必须提供合法 cron 表达式。

## Once Consumption

`consumed` 是派生事实，不是持久 phase。

规则：

```ts
consumed = task.scheduleType === 'once' && runs.length > 0
```

补充说明：

- run 成功还是失败，都算 consumed
- `once` task 一旦 consumed，会自动进入 `archived`

## Run Status

`run.status` 只描述这次 run 本身是否成功完成执行链路。

```ts
type ScheduledTaskRunStatus =
    | 'succeeded'
    | 'failed'
```

它不表示：

- task phase
- 业务 outcome
- 列表 display status

## Outcome Status

`outcome.status` 只描述业务结果。

```ts
type ScheduledTaskOutcomeStatus =
    | 'completed'
    | 'partial'
    | 'blocked'
    | 'abandoned'
```

含义：

- `completed`：业务目标已完成
- `partial`：有有效进展，但目标未完全完成
- `blocked`：受外部条件、缺失信息或依赖阻塞
- `abandoned`：继续执行不再值得，或预期只会重复失败

scheduled session 必须使用 `schedule_report_outcome` 上报最终 outcome。

## Display Status

`displayStatus` 用于 Scheduler 列表与 Overview 的主展示状态。

它是 task 的展示层状态，不等同于 task phase，也不等同于 outcome。

```ts
type ScheduledTaskDisplayStatus =
    | 'ready'
    | 'succeeded'
    | 'completed'
    | 'healthy'
    | 'failed'
```

当前派生规则：

- 没有任何 run：`ready`
- `once` task：
  - latest run 为 `failed`：`failed`
  - latest run 为 `succeeded` 且尚未上报 outcome：`succeeded`
  - latest run 为 `succeeded` 且已上报 outcome：`completed`
- `cron` task：
  - latest run 为 `succeeded`：`healthy`
  - latest run 为 `failed`：`failed`

说明：

- `succeeded` 表示调度器和 session 交付链路已成功完成
- `succeeded` 不表示业务任务已经完成
- `completed` 表示一次 `once` run 已成功并且已有 outcome 上报

## Display Separation

Scheduler UI 采用分层展示：

- 列表主状态：`displayStatus`
- 配置生命周期：`task.phase`
- Runs 区域：`run.status` 与 `outcome.status`

这些字段允许同时表达不同事实。

示例：

- 最新一次 cron run 失败，但 task 仍为 `paused`
  - display status：`failed`
  - task phase：`paused`

- once task 已成功启动 session，但该 session 还未上报业务 outcome
  - display status：`succeeded`
  - task phase：`archived`

## Permissions

scheduled session 当前支持三档权限：

```ts
type ScheduledSessionPermission =
    | 'aware'
    | 'self_control'
    | 'system_control'
```

含义：

- `aware`：知道自己是 scheduled session，但不能控制 scheduler
- `self_control`：只能管理自己的 task
- `system_control`：可以管理整个 scheduler

默认权限为 `aware`。

## Tool Surface

当前 Scheduler MCP 工具集：

- `schedule_create`
- `schedule_list`
- `schedule_get`
- `schedule_edit`
- `schedule_pause`
- `schedule_resume`
- `schedule_archive`
- `schedule_delete`
- `schedule_run_list`
- `schedule_run_get`
- `schedule_report_outcome`

所有工具返回统一结构：

```ts
type SchedulerToolResult<T> = {
    ok: boolean
    code: string
    message: string
    data?: T
}
```

查询型工具支持：

```ts
view?: 'basic' | 'full'
```

## Error Codes

当前结构化错误码：

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

前端与 agent 应优先依据结构化字段和错误码判断，不依赖自然语言推断。

## Time Rules

Scheduler 当前统一使用 `Asia/Shanghai` 作为默认时区基准。

创建与编辑时：

- 绝对时间使用 `runAt`
- 相对时间优先使用 `delay`
- cron 使用 `cron + timezone`

## Deletion Semantics

删除 task 时：

- 删除 task 本身
- 删除所有相关 run 记录
- 删除由这些 run 派生的 session
- 保留原始创建 task 的 creator session

## Current UI Facts

当前 Web 侧 Scheduler 视图遵循以下事实：

- 列表按 `phase` 和创建时间排序
- Scheduled task detail 支持 Overview、Runs、Session 等子视图
- Scheduler Session 进入时默认以 review 场景为主，优先保持顶部阅读语义
- `once` 成功但未上报 outcome 时，UI 需要明确提示“已成功交付，不代表已完成”
