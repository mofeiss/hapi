import type { ReactNode } from "react";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useTranslation } from "@/lib/use-translation";
import type { ScheduledTask, ScheduledTaskRun, SessionSummary } from "@/types/api";
import type { DeskView } from "@/lib/workspace-store";

export const DEFAULT_DESK_ITEM_ID = "approval-btc";

export type DeskItemKind =
  | "approval"
  | "strategy-alert"
  | "session-intervention"
  | "brief"
  | "account-overview"
  | "account-risk"
  | "account-positions"
  | "account-connections";

export type DeskItem = {
  id: string;
  view: DeskView;
  kind: DeskItemKind;
  title: string;
  subtitle: string;
  summary: string;
  priority: "critical" | "high" | "medium";
  status: string;
  sourceLabel: string;
  sourceSessionId: string | null;
  sourceTaskId: string | null;
  sourceRunId: string | null;
  whyNow: string;
  nextAction: string;
  riskLines: string[];
  planRows: Array<[string, string]>;
};

type Copy = {
  title: string;
  subtitle: string;
  listTitleOverview: string;
  listTitleAccounts: string;
  viewOverview: string;
  viewAccounts: string;
  detailTitleOverview: string;
  detailTitleAccounts: string;
  detail: {
    emptyTitle: string;
    emptyBody: string;
    summary: string;
    whyNow: string;
    plan: string;
    risk: string;
    nextAction: string;
    sourceLinks: string;
    openSession: string;
    openStrategy: string;
    openRun: string;
    unavailable: string;
  };
  groups: {
    approval: string;
    strategyAlert: string;
    handoff: string;
    brief: string;
    account: string;
  };
};

function getCopy(locale: string): Copy {
  if (locale === "zh-CN") {
    return {
      title: "Desk",
      subtitle: "把待处理动作和账户状态放回同一个工作台。",
      listTitleOverview: "Action Queue",
      listTitleAccounts: "Accounts",
      viewOverview: "总览",
      viewAccounts: "账户",
      detailTitleOverview: "动作详情",
      detailTitleAccounts: "账户详情",
      detail: {
        emptyTitle: "从左侧选一项开始",
        emptyBody: "Desk 负责分诊与决策摘要，真正执行仍回到 Sessions / Scheduled。",
        summary: "背景",
        whyNow: "Why now",
        plan: "关键信息",
        risk: "风险检查",
        nextAction: "下一步",
        sourceLinks: "来源入口",
        openSession: "打开来源会话",
        openStrategy: "打开来源策略",
        openRun: "查看来源 Run",
        unavailable: "当前没有可跳转的来源对象",
      },
      groups: {
        approval: "待审批",
        strategyAlert: "策略异常",
        handoff: "待接管",
        brief: "摘要",
        account: "账户项目",
      },
    };
  }

  return {
    title: "Desk",
    subtitle: "Keep pending actions and account state in one operator workspace.",
    listTitleOverview: "Action Queue",
    listTitleAccounts: "Accounts",
    viewOverview: "Overview",
    viewAccounts: "Accounts",
    detailTitleOverview: "Action Detail",
    detailTitleAccounts: "Account Detail",
    detail: {
      emptyTitle: "Pick an item from the list",
      emptyBody: "Desk is the triage layer. Execution still drops back into Sessions or Scheduled.",
      summary: "Context",
      whyNow: "Why now",
      plan: "Key Data",
      risk: "Risk Check",
      nextAction: "Next Action",
      sourceLinks: "Source Links",
      openSession: "Open Source Session",
      openStrategy: "Open Source Strategy",
      openRun: "Inspect Source Run",
      unavailable: "No linked source object available",
    },
    groups: {
      approval: "Approvals",
      strategyAlert: "Strategy Alerts",
      handoff: "Needs Handoff",
      brief: "Briefs",
      account: "Account Items",
    },
  };
}

export function getDeskItems(
  locale: string,
  sessions: SessionSummary[],
  scheduledTasks: ScheduledTask[],
  scheduledRuns: ScheduledTaskRun[],
): DeskItem[] {
  const firstSession = sessions[0] ?? null;
  const secondSession = sessions[1] ?? firstSession;
  const firstTask = scheduledTasks[0] ?? null;
  const secondTask = scheduledTasks[1] ?? firstTask;
  const firstTaskRun = firstTask
    ? scheduledRuns.find((run) => run.taskId === firstTask.id) ?? null
    : null;

  if (locale === "zh-CN") {
    return [
      {
        id: DEFAULT_DESK_ITEM_ID,
        view: "overview",
        kind: "approval",
        title: "批准 BTC 趋势多单",
        subtitle: "BTC 趋势策略 · 高置信度 · 需要人工拍板",
        summary: "这是一张未来 trade intent 的占位卡。Desk 先把动作解释清楚，再把你送回真实会话或策略对象。",
        priority: "critical",
        status: "待审批",
        sourceLabel: firstTask?.title ?? "来源策略暂未接入",
        sourceSessionId: firstSession?.id ?? null,
        sourceTaskId: firstTask?.id ?? null,
        sourceRunId: firstTaskRun?.id ?? null,
        whyNow:
          "BTC 完成 4H 趋势恢复后的首次回踩确认，当前组合净多头还没超预算，但批准后会显著提高 BTC 暴露，所以不适合自动执行。",
        nextAction:
          "先打开来源会话确认 reasoning，再切到账户视角确认 BTC / ETH 暴露，最后决定是否批准。",
        riskLines: [
          "单笔风险预计 1.8%，低于策略上限 2.0%。",
          "批准后组合风险占用将从 41% 升到 46%。",
          "与现有 ETH 多头同向，相关性上升，需要人工确认。",
        ],
        planRows: [
          ["标的", "BTCUSDT"],
          ["方向", "Long"],
          ["计划仓位", "$48,000"],
          ["止损", "83,180"],
          ["目标", "86,700"],
        ],
      },
      {
        id: "strategy-alert-1",
        view: "overview",
        kind: "strategy-alert",
        title: "Alt Rotation 连续两次失效",
        subtitle: "策略异常 · 需要看最近 run 与 prompt",
        summary: "这不是一条普通消息，而是一个 scheduler 侧的运营对象。",
        priority: "high",
        status: "异常",
        sourceLabel: secondTask?.title ?? "Alt Rotation",
        sourceSessionId: secondSession?.id ?? null,
        sourceTaskId: secondTask?.id ?? null,
        sourceRunId: null,
        whyNow:
          "热点轮动策略近两次 run 都没有产出有效动作，继续运行会消耗注意力和风控预算。",
        nextAction: "跳到 Scheduled 看最近 runs，再决定暂停、改 prompt 还是缩风险。",
        riskLines: [
          "未必直接亏钱，但会持续制造低质量噪声动作。",
          "如果继续自动运行，容易挤占主流资产策略注意力。",
          "第一版先把它作为运营告警，而不是自动停机。",
        ],
        planRows: [
          ["最近状态", "2 次 weak / failed outcome"],
          ["建议动作", "检查 runs + prompt"],
          ["优先级", "高"],
        ],
      },
      {
        id: "session-handoff-1",
        view: "overview",
        kind: "session-intervention",
        title: "ETH 保护利润动作待接管",
        subtitle: "需要进入真实会话确认参数后执行",
        summary: "Desk 不是终点，它的职责之一就是告诉你现在该不该深入真实 session。",
        priority: "high",
        status: "待接管",
        sourceLabel:
          firstSession?.metadata?.name
          ?? firstSession?.metadata?.summary?.text
          ?? "来源会话",
        sourceSessionId: firstSession?.id ?? null,
        sourceTaskId: null,
        sourceRunId: null,
        whyNow:
          "ETH 已经形成浮盈，但止损上移参数仍需人工确认，继续停留在 Desk 不足以完成这类精细动作。",
        nextAction: "直接进入来源会话接管执行。",
        riskLines: [
          "这是保护利润动作，不会增加净方向暴露。",
          "如果久拖不处理，回撤空间会继续扩大。",
        ],
        planRows: [
          ["动作", "上调止损到保本上方"],
          ["当前仓位", "$96,800"],
          ["预期效果", "锁定已得利润"],
        ],
      },
      {
        id: "brief-1",
        view: "overview",
        kind: "brief",
        title: "今日晨报已生成",
        subtitle: "摘要 · 盘前主结论已经整理完成",
        summary: "Desk 也要容纳 brief 这种帮助用户进入状态的对象，但它仍然以 item 的形式存在。",
        priority: "medium",
        status: "已就绪",
        sourceLabel: "系统摘要",
        sourceSessionId: firstSession?.id ?? null,
        sourceTaskId: firstTask?.id ?? null,
        sourceRunId: firstTaskRun?.id ?? null,
        whyNow:
          "用户打开工作台后，需要先快速知道今天系统的主判断，再进入审批与接管。",
        nextAction: "读完摘要，再回待处理队列处理真正需要决策的事项。",
        riskLines: [
          "摘要本身不触发执行。",
          "它的价值在于帮助用户迅速建立今日交易心智。",
        ],
        planRows: [
          ["主方向", "BTC 优先，ETH 观察，Meme 降权"],
          ["节奏", "主流资产优先"],
        ],
      },
      {
        id: "account-overview",
        view: "accounts",
        kind: "account-overview",
        title: "账户总览",
        subtitle: "先看资金面，再决定要不要批准新的动作",
        summary: "账户总览回答的是资金是否健康、风险预算是否还够、今天的权益曲线是否仍在计划区间。",
        priority: "high",
        status: "主账户",
        sourceLabel: "Portfolio snapshot / mock",
        sourceSessionId: null,
        sourceTaskId: null,
        sourceRunId: null,
        whyNow:
          "在交易产品里，账户健康不是二级信息。任何审批动作前都应该先确认总权益、可用余额和日内回撤。",
        nextAction: "确认风险占用和可用余额后，再回总览决定是否批准新的 trade intent。",
        riskLines: [
          "当前账户级风险占用为 41%，仍在当日预算内。",
          "今日权益曲线维持上行，但不适合同时放大 BTC 和 ETH 两个主流多头。",
        ],
        planRows: [
          ["总权益", "¥ 1,284,300"],
          ["可用余额", "¥ 412,900"],
          ["当日 PnL", "+ ¥ 43,820"],
          ["风险占用", "41%"],
        ],
      },
      {
        id: "account-risk",
        view: "accounts",
        kind: "account-risk",
        title: "风险暴露",
        subtitle: "净方向、集中度、相关性都应该一眼可见",
        summary: "这个 item 专门回答账户当前承担了什么风险，而不是再去重复审批队列。",
        priority: "high",
        status: "风险监控",
        sourceLabel: "Risk engine / mock",
        sourceSessionId: null,
        sourceTaskId: null,
        sourceRunId: null,
        whyNow:
          "如果不把账户风险单独拉成一个详情对象，用户就很难判断某一笔新动作到底该不该放行。",
        nextAction: "重点检查 BTC + ETH 的相关性上升，再决定是否批准新增主流多头。",
        riskLines: [
          "净方向偏多，保护利润类动作优先于新增追涨。",
          "BTC + ETH 合计占总风险 71%，集中度偏高。",
          "自动执行目前只适合低风险保护动作。",
        ],
        planRows: [
          ["净方向", "偏多"],
          ["集中度", "BTC + ETH = 71%"],
          ["相关性", "偏高"],
          ["自动执行", "仅保护类动作"],
        ],
      },
      {
        id: "account-positions",
        view: "accounts",
        kind: "account-positions",
        title: "持仓与订单",
        subtitle: "把当前仓位、计划单和保护动作放进同一个明细对象",
        summary: "这里展示账户已经持有什么、有哪些订单在排队、以及哪些动作还需要你回到 Session 接管。",
        priority: "medium",
        status: "仓位面板",
        sourceLabel: "Exchange positions / mock",
        sourceSessionId: firstSession?.id ?? null,
        sourceTaskId: null,
        sourceRunId: null,
        whyNow:
          "账户 item 不该只是几张 KPI 卡片，它也需要承接真实交易对象，比如持仓和待执行订单。",
        nextAction: "优先处理 ETH 保护利润动作，其次再审视 WIF 减仓是否要继续。",
        riskLines: [
          "BTC 与 ETH 都是盈利状态，主要任务是保护利润。",
          "WIF 仍在回撤，适合作为风险收缩对象。",
        ],
        planRows: [
          ["BTCUSDT", "Long / $182,400 / +3.42%"],
          ["ETHUSDT", "Long / $96,800 / +1.08%"],
          ["WIFUSDT", "Trim / $18,400 / -2.31%"],
        ],
      },
      {
        id: "account-connections",
        view: "accounts",
        kind: "account-connections",
        title: "交易所连接",
        subtitle: "连接状态必须是一等对象，因为系统最终会接真实 API",
        summary: "这个 item 负责回答交易权限是否可用、哪些交易所是只读、哪些还没有接入。",
        priority: "medium",
        status: "API 连接",
        sourceLabel: "Exchange adapters / mock",
        sourceSessionId: null,
        sourceTaskId: null,
        sourceRunId: null,
        whyNow:
          "当产品从 mock 走向真实交易时，连接与权限状态会直接决定哪些动作能自动执行。",
        nextAction: "先确保主交易所具备 trade 权限，次级交易所保持只读用于对账。",
        riskLines: [
          "交易所断连时，Desk 应该先降级成只读风控台。",
          "高权限 API 不应该在没有人工确认的前提下被隐式使用。",
        ],
        planRows: [
          ["Binance", "已连接 / 可交易"],
          ["Bybit", "已连接 / 只读"],
          ["OKX", "未连接"],
        ],
      },
    ];
  }

  return [
    {
      id: DEFAULT_DESK_ITEM_ID,
      view: "overview",
      kind: "approval",
      title: "Approve BTC trend long",
      subtitle: "BTC trend strategy · high confidence · user approval required",
      summary: "This is the placeholder for a future trade intent card. Desk should explain the action before sending you into the real session or strategy surface.",
      priority: "critical",
      status: "Pending approval",
      sourceLabel: firstTask?.title ?? "Strategy source not connected",
      sourceSessionId: firstSession?.id ?? null,
      sourceTaskId: firstTask?.id ?? null,
      sourceRunId: firstTaskRun?.id ?? null,
      whyNow:
        "BTC completed its first meaningful pullback after a 4H trend recovery. Portfolio long exposure is still within budget, but approval would materially raise BTC concentration.",
      nextAction:
        "Inspect the source session for reasoning quality, then switch to Accounts to confirm BTC / ETH exposure before approving.",
      riskLines: [
        "Planned single-trade risk stays near 1.8%, below the 2.0% strategy cap.",
        "Portfolio risk usage would move from 41% to 46% after approval.",
        "It aligns with the existing ETH long, so correlation rises and should be user-approved.",
      ],
      planRows: [
        ["Symbol", "BTCUSDT"],
        ["Direction", "Long"],
        ["Planned Size", "$48,000"],
        ["Stop", "83,180"],
        ["Target", "86,700"],
      ],
    },
    {
      id: "strategy-alert-1",
      view: "overview",
      kind: "strategy-alert",
      title: "Alt Rotation degraded twice in a row",
      subtitle: "Strategy alert · inspect the latest runs and prompt",
      summary: "This is not a regular message. It is a scheduler-side operating object.",
      priority: "high",
      status: "Alert",
      sourceLabel: secondTask?.title ?? "Alt Rotation",
      sourceSessionId: secondSession?.id ?? null,
      sourceTaskId: secondTask?.id ?? null,
      sourceRunId: null,
      whyNow:
        "The rotation strategy produced weak outcomes across the latest runs. Continuing blindly will keep consuming attention and risk budget.",
      nextAction:
        "Jump into Scheduled, inspect recent runs, then decide whether to pause, tighten risk, or rewrite the prompt.",
      riskLines: [
        "It may not cause direct loss, but it can create low-quality action noise.",
        "If it keeps running, it can steal attention from core majors strategies.",
        "V1 treats it as an operator alert, not an auto-stop event.",
      ],
      planRows: [
        ["Recent State", "2 weak / failed outcomes"],
        ["Suggested Move", "Inspect runs + prompt"],
        ["Priority", "High"],
      ],
    },
    {
      id: "session-handoff-1",
      view: "overview",
      kind: "session-intervention",
      title: "ETH profit protection needs handoff",
      subtitle: "Move into the live session to confirm execution parameters",
      summary: "Desk is not the end point. One of its jobs is to make it obvious when you need the real session surface.",
      priority: "high",
      status: "Needs handoff",
      sourceLabel:
        firstSession?.metadata?.name
        ?? firstSession?.metadata?.summary?.text
        ?? "Source session",
      sourceSessionId: firstSession?.id ?? null,
      sourceTaskId: null,
      sourceRunId: null,
      whyNow:
        "ETH already built floating profit, but the stop-adjustment details still need a human check. Staying in Desk is no longer enough.",
      nextAction: "Open the source session and take over the live action.",
      riskLines: [
        "This is a profit-protection move, not a new exposure increase.",
        "If delayed too long, the unrealized cushion can decay quickly.",
      ],
      planRows: [
        ["Action", "Raise stop above breakeven"],
        ["Position", "$96,800"],
        ["Expected Effect", "Lock in profit quality"],
      ],
    },
    {
      id: "brief-1",
      view: "overview",
      kind: "brief",
      title: "Daily brief is ready",
      subtitle: "Brief · pre-market operating picture already summarized",
      summary: "Desk should also hold brief objects that help the operator enter the day, but they still live as items in the list.",
      priority: "medium",
      status: "Ready",
      sourceLabel: "System brief",
      sourceSessionId: firstSession?.id ?? null,
      sourceTaskId: firstTask?.id ?? null,
      sourceRunId: firstTaskRun?.id ?? null,
      whyNow:
        "When the user opens the workspace, they first need the day's operating picture before diving into approvals and handoffs.",
      nextAction: "Read the brief, then return to the queue for the actual decisions.",
      riskLines: [
        "A brief should never directly trigger execution.",
        "Its value is helping the operator establish today's trading context quickly.",
      ],
      planRows: [
        ["Primary Bias", "BTC first, ETH watch, Meme de-prioritized"],
        ["Operating Tempo", "Majors first"],
      ],
    },
    {
      id: "account-overview",
      view: "accounts",
      kind: "account-overview",
      title: "Account overview",
      subtitle: "Check capital health before approving new actions",
      summary: "The overview answers whether capital is healthy, whether risk budget is still available, and whether today's equity curve remains inside plan.",
      priority: "high",
      status: "Primary account",
      sourceLabel: "Portfolio snapshot / mock",
      sourceSessionId: null,
      sourceTaskId: null,
      sourceRunId: null,
      whyNow:
        "In a trading product, account health is not secondary information. You should confirm total equity, available balance, and daily drawdown before approving anything.",
      nextAction: "Confirm risk usage and available balance, then return to Overview to decide on the next trade intent.",
      riskLines: [
        "Account-level risk usage is 41%, still inside today's budget.",
        "The daily equity curve remains constructive, but this is not the moment to enlarge both BTC and ETH longs together.",
      ],
      planRows: [
        ["Total Equity", "¥ 1,284,300"],
        ["Available Balance", "¥ 412,900"],
        ["Daily PnL", "+ ¥ 43,820"],
        ["Risk Usage", "41%"],
      ],
    },
    {
      id: "account-risk",
      view: "accounts",
      kind: "account-risk",
      title: "Risk exposure",
      subtitle: "Net bias, concentration, and correlation should be visible at a glance",
      summary: "This item exists to answer what the account is currently exposed to, not to repeat the approval queue.",
      priority: "high",
      status: "Risk monitor",
      sourceLabel: "Risk engine / mock",
      sourceSessionId: null,
      sourceTaskId: null,
      sourceRunId: null,
      whyNow:
        "If account risk is not promoted into its own detail object, it becomes hard to judge whether a new action should really be approved.",
      nextAction: "Check the BTC + ETH correlation lift first, then decide whether a new majors long should be allowed.",
      riskLines: [
        "Net bias is long. Protective actions are more important than new momentum adds.",
        "BTC + ETH consume 71% of total risk, so concentration is elevated.",
        "Automation should stay limited to low-risk protective actions for now.",
      ],
      planRows: [
        ["Net Bias", "Long-biased"],
        ["Concentration", "BTC + ETH = 71%"],
        ["Correlation", "Elevated"],
        ["Automation", "Protective only"],
      ],
    },
    {
      id: "account-positions",
      view: "accounts",
      kind: "account-positions",
      title: "Positions & orders",
      subtitle: "Keep current exposure, planned orders, and protective actions in one detail object",
      summary: "This item shows what the account already holds, which orders are queued, and which actions still require you to take over in Session.",
      priority: "medium",
      status: "Position panel",
      sourceLabel: "Exchange positions / mock",
      sourceSessionId: firstSession?.id ?? null,
      sourceTaskId: null,
      sourceRunId: null,
      whyNow:
        "Account items should not be reduced to KPI cards. They also need to carry real trading objects such as positions and pending orders.",
      nextAction: "Handle the ETH profit-protection action first, then re-evaluate whether the WIF trim should continue.",
      riskLines: [
        "BTC and ETH are both green, so the main job is profit protection.",
        "WIF remains the clearest candidate for risk compression.",
      ],
      planRows: [
        ["BTCUSDT", "Long / $182,400 / +3.42%"],
        ["ETHUSDT", "Long / $96,800 / +1.08%"],
        ["WIFUSDT", "Trim / $18,400 / -2.31%"],
      ],
    },
    {
      id: "account-connections",
      view: "accounts",
      kind: "account-connections",
      title: "Exchange connections",
      subtitle: "Connection state must be first-class because the product eventually talks to real APIs",
      summary: "This item answers whether trading permissions are available, which exchanges are read-only, and which ones are still disconnected.",
      priority: "medium",
      status: "API connectivity",
      sourceLabel: "Exchange adapters / mock",
      sourceSessionId: null,
      sourceTaskId: null,
      sourceRunId: null,
      whyNow:
        "As the product moves from mock into real trading, connectivity and permission state will directly decide what can be automated.",
      nextAction: "Keep the main venue trade-enabled and leave secondary venues read-only until reconciliation is stable.",
      riskLines: [
        "When an exchange disconnects, Desk should degrade into a read-only risk console first.",
        "High-permission APIs should never be used implicitly without explicit human approval.",
      ],
      planRows: [
        ["Binance", "Connected / Trade enabled"],
        ["Bybit", "Connected / Read-only"],
        ["OKX", "Not connected"],
      ],
    },
  ];
}

export function getDeskItemsForView(items: DeskItem[], view: DeskView): DeskItem[] {
  return items.filter((item) => item.view === view);
}

export function getDeskDefaultItemId(items: DeskItem[], view: DeskView): string | null {
  return getDeskItemsForView(items, view)[0]?.id ?? null;
}

export function getDeskSelectedItem(
  items: DeskItem[],
  view: DeskView,
  selectedItemId: string | null,
): DeskItem | null {
  const viewItems = getDeskItemsForView(items, view);
  return viewItems.find((item) => item.id === selectedItemId) ?? viewItems[0] ?? null;
}

function isDeskView(value: string): value is DeskView {
  return value === "overview" || value === "accounts";
}

function toneClass(priority: DeskItem["priority"]): string {
  if (priority === "critical") {
    return "border-[color:color-mix(in_srgb,var(--app-orange-base)_70%,transparent)] bg-[color:color-mix(in_srgb,var(--app-orange-base)_14%,transparent)] text-[var(--app-fg)]";
  }
  if (priority === "high") {
    return "border-[color:color-mix(in_srgb,#ef4444_40%,transparent)] bg-[color:color-mix(in_srgb,#ef4444_12%,transparent)] text-[var(--app-fg)]";
  }
  return "border-[var(--app-border)] bg-[var(--app-secondary-bg)] text-[var(--app-hint)]";
}

function groupLabel(copy: Copy, item: DeskItem): string {
  if (item.view === "accounts") {
    return copy.groups.account;
  }

  if (item.kind === "approval") return copy.groups.approval;
  if (item.kind === "strategy-alert") return copy.groups.strategyAlert;
  if (item.kind === "session-intervention") return copy.groups.handoff;
  return copy.groups.brief;
}

function glyphForItem(locale: string, item: DeskItem): string {
  const zh = locale === "zh-CN";

  switch (item.kind) {
    case "approval":
      return zh ? "批" : "A";
    case "strategy-alert":
      return zh ? "警" : "!";
    case "session-intervention":
      return zh ? "接" : "H";
    case "brief":
      return zh ? "报" : "B";
    case "account-overview":
      return zh ? "总" : "O";
    case "account-risk":
      return zh ? "风" : "R";
    case "account-positions":
      return zh ? "仓" : "P";
    case "account-connections":
      return zh ? "交" : "C";
    default:
      return item.title.slice(0, 1).toUpperCase();
  }
}

function SummaryCard(props: { label: string; value: string; hint: string }) {
  return (
    <div className="rounded-[22px] border border-[var(--app-border)] bg-[var(--app-secondary-bg)] px-4 py-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
      <div className="text-[11px] uppercase tracking-[0.18em] text-[var(--app-hint)]">{props.label}</div>
      <div className="mt-3 text-[28px] font-semibold leading-none tracking-[-0.03em] text-[var(--app-fg)]">{props.value}</div>
      <div className="mt-2 text-xs leading-5 text-[var(--app-hint)]">{props.hint}</div>
    </div>
  );
}

function SurfaceCard(props: { title: string; subtitle?: string; children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-[26px] border border-[var(--app-border)] bg-[var(--app-bg)] px-5 py-5 shadow-[0_16px_40px_rgba(15,23,42,0.06)] ${props.className ?? ""}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-[17px] font-semibold tracking-[-0.02em] text-[var(--app-fg)]">{props.title}</h3>
          {props.subtitle ? <p className="mt-1 text-sm leading-6 text-[var(--app-hint)]">{props.subtitle}</p> : null}
        </div>
      </div>
      <div className="mt-4">{props.children}</div>
    </section>
  );
}

function DeskViewSwitcher(props: {
  view: DeskView;
  onSelectView: (view: DeskView) => void;
  compact?: boolean;
}) {
  const { locale } = useTranslation();
  const copy = getCopy(locale);

  return (
    <ToggleGroup
      value={props.view}
      onValueChange={(value) => {
        if (isDeskView(value)) {
          props.onSelectView(value);
        }
      }}
      aria-label="Desk view switcher"
      className={props.compact ? "flex-col rounded-2xl p-1" : "w-full justify-start rounded-2xl p-1"}
    >
      <ToggleGroupItem
        value="overview"
        className={props.compact ? "h-7 w-7 rounded-xl px-0" : "rounded-xl px-3 py-2 text-sm"}
        aria-label={copy.viewOverview}
      >
        {props.compact ? (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M3 12h7" />
            <path d="M3 18h13" />
            <path d="M3 6h18" />
          </svg>
        ) : (
          copy.viewOverview
        )}
      </ToggleGroupItem>
      <ToggleGroupItem
        value="accounts"
        className={props.compact ? "h-7 w-7 rounded-xl px-0" : "rounded-xl px-3 py-2 text-sm"}
        aria-label={copy.viewAccounts}
      >
        {props.compact ? (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M3 7h18" />
            <path d="M3 12h18" />
            <path d="M3 17h18" />
            <path d="M19 7v10" />
          </svg>
        ) : (
          copy.viewAccounts
        )}
      </ToggleGroupItem>
    </ToggleGroup>
  );
}

function DeskListItemButton(props: {
  item: DeskItem;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={props.onClick}
      className={`w-full rounded-[20px] border px-4 py-3 text-left transition-colors ${props.active ? "border-[var(--app-orange-base)] bg-[color:color-mix(in_srgb,var(--app-orange-base)_10%,var(--app-bg))]" : "border-[var(--app-border)] bg-[var(--app-secondary-bg)] hover:bg-[var(--app-subtle-bg)]"}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold text-[var(--app-fg)]">{props.item.title}</div>
          <div className="mt-1 text-xs leading-5 text-[var(--app-hint)]">{props.item.subtitle}</div>
        </div>
        <span className={`inline-flex shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-medium ${toneClass(props.item.priority)}`}>
          {props.item.status}
        </span>
      </div>
      <div className="mt-2 truncate text-[11px] uppercase tracking-[0.14em] text-[var(--app-hint)]">{props.item.sourceLabel}</div>
    </button>
  );
}

export function DeskSidebar(props: {
  items: DeskItem[];
  selectedItemId: string | null;
  view: DeskView;
  onSelectItem: (itemId: string) => void;
  onSelectView: (view: DeskView) => void;
}) {
  const { locale } = useTranslation();
  const copy = getCopy(locale);
  const groups = Array.from(new Set(props.items.map((item) => groupLabel(copy, item))));

  return (
    <div className="mx-auto flex h-full min-h-0 w-full max-w-full flex-col px-3 py-3 lg:max-w-content">
      <div className="rounded-[24px] border border-[var(--app-border)] bg-[var(--app-bg)] px-4 py-4 shadow-[0_10px_24px_rgba(15,23,42,0.05)]">
        <div className="text-[11px] uppercase tracking-[0.18em] text-[var(--app-orange-base)]">Desk / mock</div>
        <div className="mt-2 text-[20px] font-semibold tracking-[-0.03em] text-[var(--app-fg)]">
          {props.view === "accounts" ? copy.listTitleAccounts : copy.listTitleOverview}
        </div>
        <div className="mt-3">
          <DeskViewSwitcher view={props.view} onSelectView={props.onSelectView} />
        </div>
      </div>

      <div className="mt-3 min-h-0 flex-1 overflow-y-auto rounded-[24px] border border-[var(--app-border)] bg-[var(--app-bg)] shadow-[0_10px_24px_rgba(15,23,42,0.05)] desktop-scrollbar-left">
        <div className="px-3 py-3">
          {groups.map((label) => {
            const groupItems = props.items.filter((item) => groupLabel(copy, item) === label);
            return (
              <div key={label} className="mb-4 last:mb-0">
                <div className="px-1 pb-2 text-[11px] uppercase tracking-[0.18em] text-[var(--app-hint)]">{label}</div>
                <div className="space-y-2">
                  {groupItems.map((item) => (
                    <DeskListItemButton
                      key={item.id}
                      item={item}
                      active={props.selectedItemId === item.id}
                      onClick={() => props.onSelectItem(item.id)}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export function DeskCompactRail(props: {
  items: DeskItem[];
  selectedItemId: string | null;
  view: DeskView;
  onSelectItem: (itemId: string) => void;
  onSelectView: (view: DeskView) => void;
}) {
  const { locale } = useTranslation();

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="px-2 py-1.5 shrink-0 flex flex-col items-center gap-1.5">
        <DeskViewSwitcher view={props.view} onSelectView={props.onSelectView} compact />
      </div>
      <div className="mx-2 h-px bg-[var(--app-divider)] shrink-0" />
      <div className="flex-1 min-h-0 overflow-y-auto py-1 desktop-scrollbar-left">
        {props.items.map((item) => {
          const selected = item.id === props.selectedItemId;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => props.onSelectItem(item.id)}
              title={item.title}
              className={`flex w-full items-center justify-center px-1 py-1 transition-colors hover:bg-[var(--app-subtle-bg)] ${selected ? "bg-[var(--app-secondary-bg)]" : ""}`}
            >
              <span
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-[13px] font-semibold leading-none ${selected ? "border-[var(--app-orange-base)] bg-[color:color-mix(in_srgb,var(--app-orange-base)_12%,transparent)] text-[var(--app-fg)]" : "border-[var(--app-border)] bg-[var(--app-subtle-bg)] text-[var(--app-hint)]"}`}
              >
                {glyphForItem(locale, item)}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function OverviewDetail(props: {
  item: DeskItem;
  copy: Copy;
  onOpenSession: (sessionId: string) => void;
  onOpenTask: (taskId: string, runId?: string | null) => void;
}) {
  return (
    <div className="space-y-4">
      <SurfaceCard title={props.copy.detail.summary}>
        <p className="text-sm leading-7 text-[var(--app-fg)]">{props.item.summary}</p>
      </SurfaceCard>

      <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <SurfaceCard title={props.copy.detail.whyNow}>
          <p className="text-sm leading-7 text-[var(--app-fg)]">{props.item.whyNow}</p>
        </SurfaceCard>

        <SurfaceCard title={props.copy.detail.nextAction}>
          <p className="text-sm leading-7 text-[var(--app-fg)]">{props.item.nextAction}</p>
        </SurfaceCard>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
        <SurfaceCard title={props.copy.detail.plan}>
          <div className="space-y-2">
            {props.item.planRows.map(([label, value]) => (
              <div
                key={label}
                className="flex items-start justify-between gap-4 rounded-2xl border border-[var(--app-border)] bg-[var(--app-secondary-bg)] px-3 py-3 text-sm"
              >
                <span className="text-[var(--app-hint)]">{label}</span>
                <span className="font-medium text-[var(--app-fg)] text-right">{value}</span>
              </div>
            ))}
          </div>
        </SurfaceCard>

        <SurfaceCard title={props.copy.detail.risk}>
          <div className="space-y-2">
            {props.item.riskLines.map((line) => (
              <div
                key={line}
                className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-secondary-bg)] px-3 py-3 text-sm leading-6 text-[var(--app-hint)]"
              >
                {line}
              </div>
            ))}
          </div>
        </SurfaceCard>
      </div>

      <SurfaceCard title={props.copy.detail.sourceLinks}>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => props.item.sourceSessionId && props.onOpenSession(props.item.sourceSessionId)}
            disabled={!props.item.sourceSessionId}
            className="inline-flex items-center justify-center rounded-full border border-[var(--app-border)] bg-[var(--app-secondary-bg)] px-3 py-2 text-sm font-medium text-[var(--app-fg)] disabled:cursor-not-allowed disabled:opacity-40"
          >
            {props.copy.detail.openSession}
          </button>
          <button
            type="button"
            onClick={() => props.item.sourceTaskId && props.onOpenTask(props.item.sourceTaskId, null)}
            disabled={!props.item.sourceTaskId}
            className="inline-flex items-center justify-center rounded-full border border-[var(--app-border)] bg-[var(--app-secondary-bg)] px-3 py-2 text-sm font-medium text-[var(--app-fg)] disabled:cursor-not-allowed disabled:opacity-40"
          >
            {props.copy.detail.openStrategy}
          </button>
          <button
            type="button"
            onClick={() => props.item.sourceTaskId && props.onOpenTask(props.item.sourceTaskId, props.item.sourceRunId)}
            disabled={!props.item.sourceTaskId || !props.item.sourceRunId}
            className="inline-flex items-center justify-center rounded-full border border-[var(--app-border)] bg-[var(--app-secondary-bg)] px-3 py-2 text-sm font-medium text-[var(--app-fg)] disabled:cursor-not-allowed disabled:opacity-40"
          >
            {props.copy.detail.openRun}
          </button>
        </div>
        {!props.item.sourceSessionId && !props.item.sourceTaskId ? (
          <div className="mt-3 text-xs text-[var(--app-hint)]">{props.copy.detail.unavailable}</div>
        ) : null}
      </SurfaceCard>
    </div>
  );
}

function AccountDetail(props: { item: DeskItem; locale: string }) {
  const zh = props.locale === "zh-CN";

  if (props.item.id === "account-overview") {
    return (
      <div className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <SummaryCard label={zh ? "总权益" : "Total Equity"} value="¥ 1,284,300" hint={zh ? "mock 总权益，未来由 PortfolioSnapshot 提供" : "Mock total equity, later backed by PortfolioSnapshot"} />
          <SummaryCard label={zh ? "可用余额" : "Available Balance"} value="¥ 412,900" hint={zh ? "当前可用余额" : "Currently available balance"} />
          <SummaryCard label={zh ? "当日 PnL" : "Daily PnL"} value="+ ¥ 43,820" hint={zh ? "今日已实现 + 未实现综合表现" : "Combined realized and unrealized daily performance"} />
          <SummaryCard label={zh ? "风险占用" : "Risk Usage"} value="41%" hint={zh ? "账户级风险预算占用" : "Account-level risk budget usage"} />
        </div>

        <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
          <SurfaceCard title={zh ? "近 7 日权益曲线" : "7D Equity Curve"} subtitle={zh ? "第一版先用静态曲线占位，未来接真实账户快照。" : "Static placeholder for V1. Real account snapshots plug in later."}>
            <div className="flex h-44 items-end gap-2 rounded-[20px] border border-[var(--app-border)] bg-[var(--app-secondary-bg)] px-4 py-4">
              {[28, 36, 34, 44, 48, 56, 61].map((height, index) => (
                <div key={index} className="flex min-w-0 flex-1 flex-col justify-end gap-2">
                  <div className="rounded-t-[14px] bg-[linear-gradient(180deg,color-mix(in_srgb,var(--app-orange-base)_82%,white),var(--app-orange-base))]" style={{ height: `${height * 2}px` }} />
                  <div className="text-center text-[11px] text-[var(--app-hint)]">D{index + 1}</div>
                </div>
              ))}
            </div>
          </SurfaceCard>

          <SurfaceCard title={zh ? "账户说明" : "Account Notes"}>
            <div className="space-y-3 text-sm leading-7 text-[var(--app-hint)]">
              <p>{props.item.summary}</p>
              <p>{props.item.whyNow}</p>
              <p className="text-[var(--app-fg)]">{props.item.nextAction}</p>
            </div>
          </SurfaceCard>
        </div>
      </div>
    );
  }

  if (props.item.id === "account-risk") {
    return (
      <div className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {props.item.planRows.map(([label, value]) => (
            <SummaryCard key={label} label={label} value={value} hint={zh ? "账户级风险视图" : "Account-level risk view"} />
          ))}
        </div>
        <div className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
          <SurfaceCard title={zh ? "风险观察项" : "Risk Watchlist"}>
            <div className="space-y-2">
              {props.item.riskLines.map((line) => (
                <div key={line} className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-secondary-bg)] px-4 py-3 text-sm leading-6 text-[var(--app-hint)]">{line}</div>
              ))}
            </div>
          </SurfaceCard>
          <SurfaceCard title={zh ? "当前判断" : "Current Call"}>
            <div className="space-y-3 text-sm leading-7 text-[var(--app-hint)]">
              <p>{props.item.summary}</p>
              <p>{props.item.whyNow}</p>
              <p className="text-[var(--app-fg)]">{props.item.nextAction}</p>
            </div>
          </SurfaceCard>
        </div>
      </div>
    );
  }

  if (props.item.id === "account-positions") {
    return (
      <div className="space-y-4">
        <SurfaceCard title={zh ? "当前持仓" : "Open Positions"}>
          <div className="overflow-hidden rounded-[20px] border border-[var(--app-border)]">
            <table className="w-full border-collapse text-left text-sm">
              <thead className="bg-[var(--app-secondary-bg)] text-[11px] uppercase tracking-[0.16em] text-[var(--app-hint)]">
                <tr>
                  <th className="px-4 py-3 font-medium">{zh ? "标的" : "Symbol"}</th>
                  <th className="px-4 py-3 font-medium">{zh ? "方向" : "Side"}</th>
                  <th className="px-4 py-3 font-medium">{zh ? "仓位" : "Notional"}</th>
                  <th className="px-4 py-3 font-medium">PnL</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ["BTCUSDT", "Long", "$182,400", "+3.42%"],
                  ["ETHUSDT", "Long", "$96,800", "+1.08%"],
                  ["WIFUSDT", zh ? "减仓中" : "Trim", "$18,400", "-2.31%"],
                ].map(([symbol, side, size, pnl]) => (
                  <tr key={symbol} className="border-t border-[var(--app-divider)]">
                    <td className="px-4 py-3 font-medium text-[var(--app-fg)]">{symbol}</td>
                    <td className="px-4 py-3 text-[var(--app-hint)]">{side}</td>
                    <td className="px-4 py-3 text-[var(--app-hint)]">{size}</td>
                    <td className={`px-4 py-3 ${String(pnl).startsWith("-") ? "text-rose-500" : "text-emerald-600"}`}>{pnl}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SurfaceCard>

        <div className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
          <SurfaceCard title={zh ? "订单与动作" : "Orders & Actions"}>
            <div className="space-y-3">
              {[
                zh ? "BTC 计划单待批准后进入执行队列" : "BTC planned order enters execution queue after approval",
                zh ? "ETH 止损上调单已准备就绪，等待接管确认" : "ETH protective stop adjustment is ready, waiting for handoff confirmation",
                zh ? "WIF 减仓单是 mock 占位，用于承接未来真实订单对象" : "WIF trim order is mock data standing in for future order objects",
              ].map((line) => (
                <div key={line} className="rounded-[18px] border border-[var(--app-border)] bg-[var(--app-secondary-bg)] px-4 py-3 text-sm leading-6 text-[var(--app-hint)]">{line}</div>
              ))}
            </div>
          </SurfaceCard>
          <SurfaceCard title={zh ? "仓位说明" : "Position Notes"}>
            <div className="space-y-3 text-sm leading-7 text-[var(--app-hint)]">
              <p>{props.item.summary}</p>
              <p>{props.item.whyNow}</p>
              <p className="text-[var(--app-fg)]">{props.item.nextAction}</p>
            </div>
          </SurfaceCard>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <SurfaceCard title={zh ? "交易所连接" : "Exchange Connections"}>
        <div className="space-y-3">
          {props.item.planRows.map(([name, state]) => (
            <div key={name} className="flex items-center justify-between gap-3 rounded-[18px] border border-[var(--app-border)] bg-[var(--app-secondary-bg)] px-4 py-3">
              <div>
                <div className="font-medium text-[var(--app-fg)]">{name}</div>
                <div className="mt-1 text-xs text-[var(--app-hint)]">{state}</div>
              </div>
              <span className="inline-flex rounded-full border border-[var(--app-border)] px-2.5 py-1 text-[11px] text-[var(--app-hint)]">mock</span>
            </div>
          ))}
        </div>
      </SurfaceCard>

      <div className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
        <SurfaceCard title={zh ? "权限与降级策略" : "Permissions & Fallback"}>
          <div className="space-y-2">
            {props.item.riskLines.map((line) => (
              <div key={line} className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-secondary-bg)] px-4 py-3 text-sm leading-6 text-[var(--app-hint)]">{line}</div>
            ))}
          </div>
        </SurfaceCard>
        <SurfaceCard title={zh ? "运维说明" : "Operational Notes"}>
          <div className="space-y-3 text-sm leading-7 text-[var(--app-hint)]">
            <p>{props.item.summary}</p>
            <p>{props.item.whyNow}</p>
            <p className="text-[var(--app-fg)]">{props.item.nextAction}</p>
          </div>
        </SurfaceCard>
      </div>
    </div>
  );
}

export function DeskWorkspace(props: {
  item: DeskItem | null;
  view: DeskView;
  showViewToggle?: boolean;
  onSelectView: (view: DeskView) => void;
  onOpenSession: (sessionId: string) => void;
  onOpenTask: (taskId: string, runId?: string | null) => void;
}) {
  const { locale } = useTranslation();
  const copy = getCopy(locale);
  const detailTitle = props.view === "accounts" ? copy.detailTitleAccounts : copy.detailTitleOverview;

  return (
    <div className="flex h-full min-h-0 flex-col overflow-x-hidden bg-[var(--app-bg)]">
      <div className="border-b border-[var(--app-border)] bg-[var(--app-bg)] pt-[env(safe-area-inset-top)]">
        <div className="mx-auto flex w-full max-w-content flex-col gap-4 px-3 py-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <div className="text-[11px] uppercase tracking-[0.2em] text-[var(--app-orange-base)]">Desk / {detailTitle}</div>
              <h1 className="mt-2 text-[28px] font-semibold tracking-[-0.04em] text-[var(--app-fg)] lg:text-[38px]">
                {props.item?.title ?? copy.detail.emptyTitle}
              </h1>
              <p className="mt-2 max-w-3xl text-sm leading-7 text-[var(--app-hint)]">
                {props.item?.subtitle ?? copy.detail.emptyBody}
              </p>
            </div>
            <div className="flex items-center gap-3">
              {props.showViewToggle ? (
                <DeskViewSwitcher view={props.view} onSelectView={props.onSelectView} />
              ) : null}
              {props.item ? (
                <span className={`inline-flex rounded-full border px-3 py-1.5 text-sm font-medium ${toneClass(props.item.priority)}`}>
                  {props.item.status}
                </span>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto flex w-full max-w-content flex-col gap-4 px-3 py-4">
          {props.item ? (
            props.view === "overview" ? (
              <OverviewDetail
                item={props.item}
                copy={copy}
                onOpenSession={props.onOpenSession}
                onOpenTask={props.onOpenTask}
              />
            ) : (
              <AccountDetail item={props.item} locale={locale} />
            )
          ) : (
            <SurfaceCard title={copy.detail.emptyTitle}>
              <p className="text-sm leading-7 text-[var(--app-hint)]">{copy.detail.emptyBody}</p>
            </SurfaceCard>
          )}
        </div>
      </div>
    </div>
  );
}
