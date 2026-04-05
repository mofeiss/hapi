# Trader Workspace Design History

状态：当前产品方向底稿 + 历史演进记录
分支：`product/trader-workspace`
最后更新：2026-03-25

## Purpose

这份文件不是最终 PRD，也不是一次性设计稿。

它承担两个职责：

- 固化当前阶段对虚拟币交易产品的方向性判断，避免每次重新从零讨论。
- 像史官一样记录演进背景、决策原因、阶段性妥协、以及当时没有继续深挖的真实上下文，方便以后回溯。

后续如果产品方向发生变化，不覆盖旧判断，优先追加记录。

## Current Context

当前背景事实：

- `main` 继续作为 HAPI 通用基建层。
- 虚拟币交易产品探索从 `product/trader-workspace` 分支展开。
- 当前仓库里已经成熟存在的一等对象主要是 `Session`、`ScheduledTask`、`ScheduledTaskRun`。
- 当前仓库里还没有成熟的交易域对象，例如 `TradingAccount`、`Position`、`Order`、`PortfolioSnapshot`、`RiskSnapshot`。
- 因此第一阶段产品探索必须允许大量 mock 数据存在，先验证产品形态，再决定底层交易域数据结构。

## Honest Iteration Note

这一轮设计不是在完整心流状态下完成的。

真实背景：

- 用户当前没有进入适合长时间精细讨论的状态。
- 用户明确希望快速跳过深讨论，尽快看到一个非常直观的 MVP 页面。
- 当前阶段允许产品判断先行，允许设计文件只定方向和大概，不追求细枝末节。
- 当前阶段允许页面全部采用 mock 数据。

这不是设计缺陷，而是本轮迭代的真实约束。后续继续细化时，必须保留这条背景，不应把本轮结论伪装成“已经充分讨论后的终局方案”。

## Product Positioning

当前方向：

- HAPI 不再只是 agent hub 的外壳。
- 对交易产品来说，HAPI 是底层会话、调度、远程接管、同步、审计与通知基础设施。
- 用户最终面对的是一个更高层的交易工作台产品，而不是单纯的聊天界面。

一句话定义：

> 这是一个建立在 HAPI 之上的交易指挥台 / 交易运营台，而不是给 Claude/Codex 套一个币圈皮肤。

## Current Product Shape

当前建议的产品骨架如下：

### Top-level Workspace

顶层工作区建议为：

- `Desk`
- `Sessions`
- `Scheduled`

含义：

- `Desk`：默认首页。值班、分诊、审批、资产查看。
- `Sessions`：深度接管区。查看完整上下文、继续对话、人工操作。
- `Scheduled`：策略运营区。管理策略、查看 run、处理调度问题。

### Why Desk Must Be In The Same Workspace

当前结论已经明确：

- 不应把交易 dashboard 做成独立网页。
- 不应要求用户再开一个标签页看 dashboard，另一个标签页看 hub。
- `Desk` 必须和现有 `Sessions` / `Scheduled` 长在同一套 workspace shell 里。

原因：

- 当前 HAPI web 已经是统一 shell，不是多页面站点。
- `Sessions` 和 `Scheduled` 已经是成熟的一等工作区。
- 交易产品正确的升级路径不是重做壳，而是在现有 shell 上扩出更高层的产品入口。

## Role Boundaries

### Desk

`Desk` 负责：

- 今天有什么值得处理
- 哪些动作待审批
- 哪些策略异常
- 哪些会话需要人工接管
- 当前账户与风险处于什么状态

`Desk` 不负责：

- 展示完整会话全文
- 充当完整策略编辑器
- 承担所有交易所级深度操作

### Sessions

`Sessions` 负责：

- 深入查看完整 agent 上下文
- 继续与 agent 对话
- 人工接管具体执行过程
- 查看文件、终端、完整消息流

### Scheduled

`Scheduled` 负责：

- 策略配置与运行管理
- run 结果回看
- 调度健康度与暂停/恢复
- 从策略视角运营整个系统

## Desk Internal Split

当前建议：`Desk` 本身不应只有一个单薄首页。

它至少应分成两个一级视角：

- `Overview`
- `Accounts`

### Desk > Overview

这是值班视角，回答的是：

- 现在我该处理什么？
- 系统有哪些待审批动作？
- 哪些策略或会话现在值得我介入？

它更像：

- 分诊台
- 运营首页
- 每日待处理消息箱

### Desk > Accounts

这是资产视角，回答的是：

- 现在账户到底是什么状态？
- 风险是否已经偏高？
- 哪些仓位和订单真正暴露在市场里？

它更像：

- 账户总控台
- 资产 dashboard
- 风险驾驶舱

因此，账户 dashboard 的定位不是独立第四个顶层 tab，而是 `Desk` 的核心内部分屏。

## Desk > Overview Information Shape

第一版建议承载的对象：

- `approval`：待批准或拒绝的动作
- `strategy-alert`：策略异常、失败、暂停、待关注
- `session-intervention`：需要人工接管的会话
- `brief`：晨报、复盘、日内摘要

每个对象都必须可追溯来源：

- 来源 `session`
- 来源 `scheduled task`
- 来源 `run`

第一版重点不是数据丰富，而是工作流清晰：

- 在 `Desk` 看摘要
- 需要深挖时跳 `Sessions`
- 需要改策略时跳 `Scheduled`

## Desk > Accounts Information Shape

第一版账户 dashboard 建议至少有五块：

### 1. Account Summary

- 总权益
- 可用余额
- 已用保证金 / 风险占用
- 当日 PnL
- 近 7 日权益曲线

### 2. Exchange Connections

- 已连接交易所
- API 状态
- 只读 / 可交易 权限
- 最近同步时间
- 风控总开关状态

### 3. Positions

- 标的
- 方向
- 仓位价值
- 未实现盈亏
- 风险占用
- 来源策略 / 来源会话

### 4. Orders & Fills

- 当前活动订单
- 最近成交
- 是否由 agent 发起
- 是否经过人工批准

### 5. Risk View

- 净方向暴露
- 单资产集中度
- 相关性风险
- 回撤阈值
- 自动执行暂停状态

这五块足够支撑第一版“这是交易系统而不是消息系统”的感知。

## Layout Guidance

`Desk` 不能脱离现有 workspace 的三种布局语法独立设计。

### Desktop Expanded

形态：

- 左侧为 index / queue
- 右侧为 detail

`Desk` 在这里应该更像：

- 左侧待处理队列
- 右侧当前选中项详情

推荐行为：

## 2026-03-25 Implementation Note

- 已把仓库级大块 `AGENTS.md` 拆成根级最小常驻规则 + `cli` / `hub` / `web` / `shared` / `docs` 目录级规则。
- 已把低频长流程下沉到项目级 skills，并补上各层 `CLAUDE.md` 兼容入口。
- 这轮属于实现与协作基础设施整理，不改变 trader workspace 的产品骨架判断。
- `Desk` / `Sessions` / `Scheduled` 的顶层结构、`Desk > Overview` / `Accounts` 的拆分、以及 mock-first 的阶段假设保持不变。

## 2026-03-25 Web Layout Simplification

- 已移除 web 里的 widescreen 切换能力，不再提供窄版 / 宽版两种模式。
- 当前 web 统一默认使用满宽工作区布局。
- 这轮属于界面模式收敛，不改变 trader workspace 的产品信息架构与角色划分。

- 默认自动选中最高优先级事项
- `Overview` 与 `Accounts` 都服从主从布局

## 2026-04-06 Permission Request Realtime Fix

- 已修复 Codex 权限请求到达后，Session 视图未及时进入可审批状态、必须手动刷新后才出现审批 UI 的问题。
- 本轮实现补齐了 web 端对 `session-updated` 的实时缓存合并，正确响应 `agentState` 与 `pendingRequestsCount`，并在请求清空时同步把待审批计数归零。
- 同时修复了点击 `permission required / Waiting for approval…` 提示时的重复导航路径，避免在已打开目标 Session 时再次触发页面异常刷新。
- 这轮属于现有 workspace 审批流修复，不改变 trader workspace 的 IA、角色边界或 mock-first 阶段假设。

### Desktop Collapsed

形态：

- 左侧退化成窄 strip
- 右侧仍是主详情画布

`Desk` 在这里应该更像：

- 保留 item 切换能力的 compact rail
- 让用户在不展开侧边栏的情况下仍能切换待处理项与账户项

推荐行为：

- 左侧 strip 不能空白
- strip 内必须保留 item 入口，而不只是顶层 tab
- 右侧继续承接当前 item detail

### Mobile / Narrow

形态：

- 单栏 drill-down
- 列表与详情互斥

`Desk` 在这里应该更像：

- 事件流
- 审批流
- 单手操作的值班消息箱

推荐行为：

- 首屏先看 `Action Queue` / item list
- 点击 item 后进入详情页
- 左上返回按钮与手势返回都回到 item list
- 详情页再跳 `Sessions` 或 `Scheduled`

## MVP Direction

当前阶段的正确目标不是“先接真实交易所”。

当前阶段的正确目标是：

- 先做一个非常直观的 MVP 页面
- 完整接入现有 workspace 形态
- 所有数据都允许 mock
- 优先把产品心智立住

第一版 MVP 应满足：

- 用户一打开就能知道这是交易工作台
- 用户能看见 `Overview` 和 `Accounts` 两个核心视角
- 用户能感受到它和 `Sessions` / `Scheduled` 是一体的，不是外挂页
- 用户能直观看到未来交易域对象会如何承载在这个界面里

## Recommended MVP Scope

建议第一版 MVP 范围：

- 在现有 web shell 内落一个 mock 的 `Desk` 工作区
- `Desk` 内先做 mock 的 `Overview` 与 `Accounts` 切换
- 所有账户、仓位、订单、风险、策略状态全部使用 mock 数据
- 跳转按钮只需要完成视觉和交互闭环，不必接真实交易 API

当前不建议第一版就做：

- 真实下单
- 真实持仓同步
- 多交易所权限管理
- 完整风控引擎
- 从零重写 agent runtime

## Future Domain Model Seed

后续如果要进入真实交易能力阶段，建议逐步引入这些基础对象：

- `ExchangeConnection`
- `TradingAccount`
- `AccountBalance`
- `Position`
- `Order`
- `Fill`
- `PortfolioSnapshot`
- `RiskSnapshot`
- `TradeIntent`
- `ApprovalDecision`
- `ExecutionRecord`

这批对象更适合先在 `shared` / `hub` 层打基础，再把 UI 接上。

## Non-goals In This Stage

当前阶段明确不做：

- 把 HAPI 改造成从零构建 agent 的新 runtime
- 为了抽象而提前做过重的 heartbeat session 底层设计
- 在还没确认交易产品形态前就接真实交易所
- 让 `Desk` 吞掉 `Sessions` 或 `Scheduled` 的职责

## Historical Log

### 2026-03-24 / Branch Split

事实：

- 交易产品探索正式从 `main` 分流到 `product/trader-workspace`。
- `main` 后续主要承担 HAPI 通用基建层职责。
- 在分流前，测试基线与支持口径已完成一次收口。

判断：

- 交易产品将显著改变信息架构和产品叙事，不适合继续直接堆在 `main`。

### 2026-03-24 / Desk First Pass

第一版判断：

- 不做独立 dashboard 站点。
- `Desk` 必须与现有 `Sessions` / `Scheduled` 合并进同一 workspace。
- `Desk` 不只是消息箱，也必须容纳账户视角。

修正后的结论：

- `Desk` 应拆成 `Overview` 与 `Accounts` 两个一级视角。
- `Overview` 看事情。
- `Accounts` 看资产。

### 2026-03-24 / Desk Shell Integration Iteration

事实：

- `Desk` 已真正接入现有 workspace shell，不再只是独立 demo。
- 移动端确认采用 `item list -> detail -> back` 的 drill-down。
- PC 折叠侧边栏确认采用 compact rail，保留 item 切换入口。
- `Overview` 与 `Accounts` 都统一为左侧 item list、右侧 detail。

判断：

- 这一轮用户对直观效果满意，方向被确认。
- 当前仍然全部采用 mock 数据，尚未进入真实交易域接线。

未改变：

- `Desk` 仍是和 `Sessions` / `Scheduled` 并列的一等 workspace tab。
- 真实交易所、账户同步、下单执行仍不是这一阶段目标。

### 2026-03-24 / Current User State

本轮还必须记录一个非技术事实：

- 用户明确表示当前不在适合深度协作讨论的心流状态。
- 用户希望快速跳过设计细化，优先拿到一个非常直观、全部使用 mock 数据的 MVP 页面。
- 因此本轮产出的文件更偏方向定稿与历史记录，而不是最终产品规格书。

这是合理的阶段性取舍，后续细化时不应遗忘。

## Update Protocol

后续更新这份文件时，遵循以下规则：

- 不删除历史阶段判断，优先追加新条目。
- 每次产品方向、信息架构、工作流、MVP 范围发生变化，都要记录。
- 每次执行与交易产品探索相关的 `cp` 前，都要确认本文件已同步更新。
- 如果本轮是“为了推进节奏而跳过深讨论”，要如实写入，不美化、不伪装成充分论证结果。
- 如果本轮只是代码实现，没有方向变化，也要补一条简短记录，说明这次落地了什么，未改变什么。

推荐每次追加记录时包含：

- 日期
- 分支
- 本轮目标
- 核心决定
- 被放弃的方向
- 当前残留问题
- 下一步建议

## Immediate Next Step

当前最符合节奏的下一步是：

- 在 `product/trader-workspace` 分支里直接做一个 mock 的 MVP 页面
- 重点体现 `Desk > Overview` 与 `Desk > Accounts`
- 页面追求直观、完整、可感知的产品形态
- 暂不接任何真实交易所数据
