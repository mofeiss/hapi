# Single Realtime Owner Per Tab

## 背景

这份文档用于沉淀一次围绕 Web 端实时订阅、Session 详情、多视图并存冲突的排障过程，并为后续架构级修复提供统一上下文。

当前目标不是继续做局部补丁，而是围绕一个明确方向推进正式改造：

**同一个浏览器标签页内，实时通道必须只有一个主控拥有者。**

也就是：

- 一个 tab 内只允许有一个最高权限的 SSE runtime
- 任何视图都不再直接各自订阅 SSE 获取实时数据
- 统一由 tab 级 realtime manager 建立 SSE
- manager 根据当前焦点视图和非焦点视图，做分级分发
- 焦点视图拿全量实时数据
- 非焦点视图只拿最小必要状态更新
- 非焦点视图重新激活时，再补齐缺失数据或主动刷新

## 历史脉络

这部分很重要，因为它解释了为什么当前问题并不是“原作者一开始就把多实例实时系统设计错了”，而是后续演化中逐步把单实例假设打破了。

项目是 fork 过来的。墨菲接手时，原始产品形态更接近下面这种模型：

- 当前激活哪个 session，就挂哪个 session 实例
- 切换到另一个 session 时，旧实例会被销毁
- 不保留旧详情视图的本地运行状态
- 因而原作者最初的设计，大概率天然更接近“单详情实例 / 单 SSE owner”

后来，出于真实且合理的产品需求，墨菲引入了 session keep-alive / 保活思路。目标并没有问题：

- 频繁切换 session 时，不想每次都重新加载
- 希望切换前后的详情状态、滚动位置、局部上下文尽量保留
- 希望浏览器在切换过程中不丢状态，提升操作流畅度

问题不在需求，而在于：

- 原本偏单实例前提下生长出来的实时系统，没有同步升级为真正支持多详情并存的架构
- keep-alive 把“旧详情实例继续留在树上”这件事变成了现实
- 但 SSE ownership、实时副作用、消息窗口、状态同步、滚动逻辑，仍然延续着更接近单实例时代的思路

之后又继续新增了 scheduler 系统。scheduler 一上来就被当作一种“另一套独特的 session / detail 运行时”去设计，而不是先做一次实时 ownership 的架构收口。结果就是：

- session detail 这套机制继续被沿用和复制
- scheduler detail 在其上继续迭代
- 新需求持续叠加
- 但没有在必要时做架构调整

最终，今天踩到的雷，本质上就是这种演化路径的结果：

- 合理的保活需求
- 合理的 scheduler 扩展需求
- 但缺少一次及时的 realtime ownership 重构

如果用更直白的话概括，这正是典型的 vibe coding 风险：

- 想到哪里做哪里
- 每一步局部都说得通
- 但没有在关键节点停下来做边界收敛和架构调整
- 最终多个局部合理的设计叠在一起，形成系统性冲突

## 用户原始问题摘要

用户最开始报告的是跨会话“打架”现象，后来确认其中一大类问题发生在**同一浏览器的不同标签页**，而在两个完全不同浏览器里不会复现。用户据此判断问题焦点应落在浏览器共享状态和 SSE 订阅冲突上，而不是后端 AI 请求本身。

随后，又发现了两个新的稳定复现 bug，这两个 bug 最终被用户认为可能与“一个标签页内多个实时详情运行时打架”同根同源：

### Bug 1: PC 双栏布局下，打开 Session 详情后整页爆卡

复现条件：

1. 打开全新隐私窗口，确保无网站缓存、无残留状态
2. 窗口调成 PC 双栏布局
3. 登录后，左侧是 Sessions List，右侧是 `Start a new session`
4. 此时页面正常
5. 点击任意一条 session，右侧开始加载详情
6. 详情一旦加载出来，页面开始极度卡顿，像 CPU 飙高、内存接近打满
7. 任何页面交互都变得迟滞，比如选中文字、拖滚动条
8. 如果再点击另一条 session，右侧会定死在 `Loading session...`，最终 Chrome 报告页面无响应
9. 该问题在移动端模式下不出现

### Bug 2: 移动端下，Session 详情与 Scheduler 详情互相打架

稳定复现特征：

- `session detail -> scheduler detail` 会死
- `scheduler detail -> session detail` 会死
- 但如果先进详情，再点击返回退回 list，然后再进入另一种详情，则正常
- 只有详情之间打架，list 与 list 之间切换没问题

用户后来补充：

- 这类问题和“多标签共享 localStorage / 订阅冲突”曾经有过前案
- 本次问题虽然表层症状不同，但用户怀疑底层仍然是 SSE ownership 不清晰导致的冲突

## 已确认的历史结论

在此前一次问题里，用户和 agent 已经确认过一个重要方向：

- 同一浏览器环境中，多个 session 如果各自建立自己的 SSE 订阅，容易发生订阅冲突、状态错位、页面假死、消息流空白、首条 prompt 丢失等现象
- 局部修复虽然可能缓解，但没有从架构上解决“多个实时拥有者并存”的问题

这次任务后期，用户再次明确提醒：

> 之前打架的根源是多个 SSE。

这是本次架构调整必须尊重的前提，不要把问题误解成“只是组件 keep-alive 太多”或者“只是某个 effect 写坏了”。

## 本轮排障中的证据链

### 1. 最近一次 SSE 修复提交不是主因

先定位到近期可疑提交：

- `630f8e2 fix(web): reduce duplicate session SSE subscriptions`

用户要求先不要读太多代码，而是直接把代码临时切回它的前一个版本验证。

已做操作：

- 临时切到 `0be0c4b` 供用户测试

用户测试反馈：

- 两个新 bug 仍然存在
- 多标签相关的旧问题没有随这次回退复现

结论：

- `630f8e2` 不是这两个新 bug 的直接来源
- 这两个新 bug 早于该提交就已经存在

### 2. 将 `RealtimeVoiceSession` 提升到全局单例后，无效

实验内容：

- 把 `RealtimeVoiceSession` 从每个 `SessionChat` 实例内部移到 `App` 顶层，只保留一份
- 涉及文件：
  - `web/src/App.tsx`
  - `web/src/components/SessionChat.tsx`

用户测试反馈：

- 两个场景均未命中修复

结论：

- 语音 realtime 这条重复实例，不是这次两个新 bug 的主炸点
- 但这不等于“多 SSE 不是问题”，只说明这次问题的主冲突不在语音这条通道上

### 3. 禁用 session workspace 的多实例 keep-alive 后，命中大头

实验内容：

在 `web/src/router.tsx` 里，把 session 详情的 keep-alive 策略从“最多缓存多个 session detail”改为“始终只保留当前一个 mounted session”。

具体效果：

- `mountedSessions` 不再保留多个 session id
- 打开新的 session 时只挂当前一个

用户测试反馈：

- PC 双栏卡死问题解决
- 移动端 `session -> scheduler` 打通
- 但 `scheduler -> session` 仍然会死

结论：

- “多个详情实例并存”确实是触发问题的重要条件
- 更准确地说：**多个详情实例并存，会带来多个实时运行时并存，进一步放大 SSE 和副作用链的冲突**
- 这个实验强烈说明：当前前端不适合让多个重型详情运行时在同一个 tab 内同时活着

### 4. 仅清理 scheduler 选择态，不足以解决剩余问题

实验内容：

在从 scheduler detail 打开 session 时，显式清空：

- `scheduledInteractiveSessionId`
- `selectedScheduledTaskId`
- `selectedScheduledRunId`
- `scheduledEditing`
- `scheduledEditState`
- `clearWorkspaceScheduledSelection()`

然后再 `openWorkspaceSession(sessionId, "chat")`

用户测试反馈：

- `scheduler -> session` 仍然会死

结论：

- 单纯清 UI 选择态，不足以消除底层冲突
- 剩余问题更可能在“scheduler detail 内嵌 session 详情链 + SSE ownership + effect 回写 + 视图未真正退场”这一层

## 当前最可靠的根因表述

请不要把根因写成下面这些简化版说法：

- “只是 keep-alive 有 bug”
- “只是 React effect 死循环”
- “只是 scheduler detail 没卸载”
- “只是某个 query invalidate 太频繁”

这些都可能是现象层或放大器，不是本次任务希望解决的根层问题。

当前最可靠、与历史问题能够对齐的表述应该是：

### 根因

**同一个浏览器标签页内，前端允许多个详情运行时各自拥有实时订阅能力。**

这会导致：

1. 同页并存多个 session/scheduler detail 实例
2. 每个实例各自拉自己的 SSE 或建立自己的实时副作用闭环
3. SSE 驱动 query invalidation、message window 更新、滚动锚点、乐观消息对账、状态同步
4. 多条实时链在同一 tab 内竞争同一份浏览器主线程、React 渲染预算和若干共享状态
5. 最终表现为卡死、假死、空白、`Loading session...` 卡住、切换详情秒死等现象

也就是说：

- `多实例并存` 更像触发条件
- `多条 SSE / 多个实时拥有者并存` 才是更底层的冲突源

## 用户确认的长期方案方向

用户已经明确给出了倾向方案，且这个方向经过讨论后被确认是合理的：

### Single Realtime Owner Per Tab

在**一个浏览器标签页**里，永远只有**一条最高权限的 SSE**。

无论当前是：

- PC 双栏布局
- 移动端布局
- Session 详情
- Scheduler 详情
- Session 内嵌 Session 的场景
- 同时挂载多个视图组件

都不允许每个视图自己去订阅 SSE。

而是：

- 由一个 tab 级、统一的 realtime runtime 持有 SSE
- 所有 SSE 数据统一先进入这一个 runtime
- runtime 再根据当前焦点视图、非焦点视图、列表视图，做不同等级的数据分发

### 焦点分发原则

用户希望的数据分发原则如下，这部分应当视为架构目标，而不是可随意修改的实现细节：

#### 焦点视图

焦点视图享受全量数据分发，例如：

- 实时消息流
- 增量 token 输出
- 流式状态变化
- 实时渲染所需的完整更新

#### 非焦点详情视图

非焦点详情视图只做最小 MVP 分发，例如：

- 活跃状态变化
- 概要状态变化
- 是否有新消息
- 是否需要刷新
- 轻量计数或时间戳变化

不要把全量实时消息流推给后台不在焦点的重型详情视图。

#### 视图重新激活时

当一个非焦点详情视图重新变成焦点时：

- 再一次性补齐它错过的数据
- 或者告诉它需要主动调用更新接口获取最新快照
- 然后再让浏览器真正渲染完整内容

用户原话的核心意思可以概括为：

> 不在焦点的视图，不值得持续吃完整实时流；等它激活时再补数据即可。

### 列表视图的例外

讨论中也补充了一个边界：

- “只有一个焦点视图”主要指的是**重型详情视图**
- 左侧 sessions list、scheduled list 这种导航/列表视图，仍然应该拿到轻量状态更新
- 也就是：列表可以继续更新排序、活跃状态、最新时间戳、未读计数等
- 但不应该像详情视图那样持有完整的实时渲染链路

## 为什么这个方向合理

这部分不是口号，而是设计方案时应该坚持的判断基线。

### 1. 与产品事实一致

一个浏览器标签页里，用户同一时刻只有一个真正关注的详情焦点。

如果架构允许每个详情都各自维持完整实时链路，就等于把“后台不可见视图”和“前台焦点视图”当成同等级公民，既浪费资源，也会制造冲突。

### 2. 与已验证事实一致

本轮实验已经证明：

- 只要减少同页并存的 session detail 实例，问题就显著缓解
- 这说明当前架构对“多活详情运行时”并不稳健
- 因此进一步收敛到 tab 级唯一实时拥有者，是合理延伸

### 3. 这比继续修局部竞态更有长期价值

如果不解决 ownership 问题，只继续在局部补：

- 清状态
- 挡 effect
- 限制某个组件挂载
- 某处 `enabled: false`

则未来每新增一个详情视图、内嵌 session、流式面板、对比面板，都可能重新踩中同类问题。

## 任务目标

这是一个**架构调整型重任务**，不要把目标误降级为“修一个具体复现 bug”。

### 主目标

在 Web 端实现 `Single Realtime Owner Per Tab` 的架构重构基础设施，消除“多个详情视图各自拥有 SSE/实时副作用”的设计。

### 子目标

1. 梳理当前所有实时入口
2. 明确哪些组件当前直接或间接拥有 SSE / realtime ownership
3. 设计 tab 级 realtime manager
4. 定义焦点视图与非焦点视图的数据分发边界
5. 将现有 Session / EmbeddedSessionView / Scheduler detail 从“自己订阅”改为“消费统一分发的数据”
6. 保证列表类视图仍能拿到轻量状态更新
7. 保证视图重新激活时能补齐缺失数据
8. 在不破坏现有功能的前提下，逐步收缩旧的 per-view realtime 入口

## 建议重点审查的代码区域

以下文件是本轮排障中高频命中的位置，应优先读：

- `web/src/router.tsx`
- `web/src/components/EmbeddedSessionView.tsx`
- `web/src/components/SessionChat.tsx`
- `web/src/hooks/useSSE.ts`
- `web/src/App.tsx`
- `web/src/lib/workspace-store.ts`
- `web/src/lib/message-window-store.ts`
- 与 scheduler detail 相关的 `ScheduledTaskDetailPanel` 所在逻辑

### 特别注意

`web/src/router.tsx` 中曾存在一个实验性改动：

- `mountedSessions` 被改成始终只保留当前一个 session

这个改动虽然不是最终架构解，但它已经被用户验证能解决部分问题。正式重构前，不应轻易丢掉这层已验证结论，除非新架构有更好的等价保证。

## 当前工作树状态提醒

本轮实验期间，曾修改过下面这些文件：

- `web/src/App.tsx`
- `web/src/components/SessionChat.tsx`
- `web/src/router.tsx`

这些改动来自本轮排障实验，包括：

- 语音 realtime 单例化实验
- `mountedSessions` 单实例实验
- 从 scheduler detail 打开 session 前清空 scheduler 选择态的实验

当前这些实验性代码改动已经从工作区清理掉，避免干扰后续正式实现。

但其中的结论仍然有效：

- `mountedSessions` 单实例实验已被用户确认有效，至少命中了 PC 双栏卡顿与一部分移动端问题
- 其余实验是否最终保留，需要基于完整架构方案重新判断

## 不建议重复的弯路

以下方向已经被本轮实验证明不是主解，至少不应再当作第一优先级：

1. 单独盯最近那次 `630f8e2` 提交
2. 把问题归因到语音 realtime 多实例
3. 只通过清理 scheduler 选择态来尝试修复 `scheduler -> session`
4. 把问题简单归为一个局部 effect 死循环

## 开始任务前的约束

请先阅读：

- `web/src/router.tsx`
- `web/src/components/EmbeddedSessionView.tsx`
- `web/src/components/SessionChat.tsx`
- `web/src/hooks/useSSE.ts`
- `web/src/App.tsx`
- `web/src/lib/workspace-store.ts`
- `web/src/lib/message-window-store.ts`

任务背景：

- 历史上已确认过“同一浏览器环境内多个 SSE 打架”这一根因方向
- 本轮又发现两个稳定复现 bug：
  - PC 双栏下，打开 session detail 后页面极度卡顿，切换 session 直接死在 `Loading session...`
  - 移动端下，session detail 和 scheduler detail 互相打架，只要不先退回 list，再进另一个 detail，就会直接卡死
- 回退最近的 `fix(web): reduce duplicate session SSE subscriptions` 提交后，这两个 bug 依然存在，说明不是那次提交单独引入
- 本轮实验已经验证：把 `mountedSessions` 改成一个 tab 内只保留当前一个 session detail 实例后，PC 双栏问题解决，移动端 `session -> scheduler` 解决，但 `scheduler -> session` 仍残留

必须基于下面这个架构目标来设计和落地，而不是继续做局部补丁：

### 架构目标

实现 `Single Realtime Owner Per Tab`：

- 一个浏览器标签页里只能有一个最高权限的 SSE / realtime owner
- 任何视图组件都不再自己直接持有 SSE ownership
- 统一由 tab 级 realtime manager 建立 SSE 并处理重连、排序、去重、事件路由
- 焦点详情视图拿全量实时流
- 非焦点详情视图只拿最小必要状态变化，不拿全量流式内容
- 列表视图继续拿轻量状态更新
- 非焦点详情重新激活时，应能补齐缺失数据或主动刷新

需要交付的不是一堆零散 patch，而是一套清晰、可演进的实现。

建议按以下顺序推进：

1. 列出当前 web 里所有 realtime/SSE ownership 入口，以及它们分别由哪些组件间接持有
2. 明确哪些入口必须被提升到 tab 级 manager，哪些只能保留为轻量 store 订阅
3. 给出新的 ownership 边界设计
4. 分阶段改造，优先保证：
   - 同一 tab 内不会再出现多个详情运行时各自持有实时链路
   - 已验证有效的 `mountedSessions` 单实例收益不要丢
5. 完成必要验证，优先验证：
   - PC 双栏打开 session detail 不再爆卡
   - 移动端 `session -> scheduler` 正常
   - 移动端 `scheduler -> session` 正常
   - 同一 tab 内切换不同 session 不再互相打架

要求：

- 证据优先，不要靠猜
- 不要把根因降级成“只是 keep-alive 太多”或“只是某个 effect 的问题”
- 需要尊重用户已经明确确认的方向：根层冲突是多个 SSE / 多个 realtime owner 并存
- 在正式改造前，先把方案说清楚，再做实现

## 结论

本轮工作最重要的产出，不是已经修完了问题，而是把问题的目标层次从“继续补竞态”提升到了“收敛 realtime ownership”。

后续工作的首要任务，不是继续局部试错，而是把这个方向真正落进代码架构。
