import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { CronExpressionParser } from "cron-parser";
import {
  Link,
  Navigate,
  Outlet,
  createRootRoute,
  createRoute,
  createRouter,
  useLocation,
  useNavigate,
  useParams,
} from "@tanstack/react-router";
import { App } from "@/App";
import { SessionChat } from "@/components/SessionChat";
import { EmbeddedSessionView } from "@/components/EmbeddedSessionView";
import { AgentFlavorStatusIcon } from "@/components/AgentFlavorStatusIcon";
import { HeaderActionGroup } from "@/components/HeaderActionGroup";
import { ClockIcon } from "@/components/icons";
import { ChevronDownIcon } from "@/components/icons";
import {
  SessionList,
  groupSessionsByHost,
  getSessionTitle,
} from "@/components/SessionList";
import { NewSession } from "@/components/NewSession";
import { LoadingState } from "@/components/LoadingState";
import { SessionActionMenu } from "@/components/SessionActionMenu";
import { ScheduledTaskActionMenu } from "@/components/ScheduledTaskActionMenu";
import { RenameSessionDialog } from "@/components/RenameSessionDialog";
import { useAppContext } from "@/lib/app-context";
import { useAppGoBack } from "@/hooks/useAppGoBack";
import { isTelegramApp } from "@/hooks/useTelegram";
import { useWidescreen } from "@/hooks/useWidescreen";
import { useLongPress } from "@/hooks/useLongPress";
import { usePlatform } from "@/hooks/usePlatform";
import { useAppKeyboardShortcuts } from "@/hooks/useAppKeyboardShortcuts";
import { useMessages } from "@/hooks/queries/useMessages";
import { useMachines } from "@/hooks/queries/useMachines";
import { useSession } from "@/hooks/queries/useSession";
import { useSessions } from "@/hooks/queries/useSessions";
import { useScheduledTasks } from "@/hooks/queries/useScheduledTasks";
import { useSlashCommands } from "@/hooks/queries/useSlashCommands";
import { useSkills } from "@/hooks/queries/useSkills";
import { useSendMessage } from "@/hooks/mutations/useSendMessage";
import { useScheduledTaskActions } from "@/hooks/mutations/useScheduledTaskActions";
import { useSessionActions } from "@/hooks/mutations/useSessionActions";
import { queryKeys } from "@/lib/query-keys";
import { useToast } from "@/lib/toast-context";
import { useTranslation } from "@/lib/use-translation";
import { useTheme } from "@/hooks/useTheme";
import { useCopyToClipboard } from "@/hooks/useCopyToClipboard";
import { ApiError } from "@/api/client";
import { useSessionTitleOverride } from "@/lib/session-title-override-store";
import {
  getScheduledRunFillClassName,
  getScheduledRunStatusToneClassName,
} from "@/lib/scheduled-run-status";
import {
  canScheduledTaskTogglePaused,
  getScheduledTaskPauseValidationCode,
  hasScheduledTaskExecuted,
  isScheduledTaskPauseLocked,
} from "@/lib/scheduled-task-compat";
import { formatTimestamp } from "@/lib/dateTime";
import { normalizeProjectPath } from "@/utils/path";
import type {
  AttachmentMetadata,
  Machine,
  PermissionMode,
  ScheduledTask,
  ScheduledTaskRun,
  SessionSummary,
  UserMessageMeta,
} from "@/types/api";
import {
  fetchLatestMessages,
  seedMessageWindowFromSession,
  clearMessageWindow,
} from "@/lib/message-window-store";
import {
  clearPendingSessionInitialMessage,
  peekPendingSessionInitialMessage,
  setPendingSessionInitialMessage,
} from "@/lib/pending-session-initial-message-store";
import { resolveDraftAttachmentMetadata } from "@/lib/draftAttachments";
import {
  readStorageItem,
  readStorageJson,
  writeStorageItem,
  writeStorageJson,
} from "@/lib/storage";
import {
  clearPendingSessionMode,
  setPendingSessionMode,
  usePendingSessionMode,
} from "@/lib/pending-session-mode-store";
import FilesPage, { FilesPanel } from "@/routes/sessions/files";
import FilePage from "@/routes/sessions/file";
import TerminalPage, { TerminalPanel } from "@/routes/sessions/terminal";
import { SettingsPanel } from "@/routes/settings";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  clearWorkspaceSessionSelection,
  clearWorkspaceScheduledSelection,
  openWorkspaceScheduledTask,
  openWorkspaceSession,
  selectWorkspaceOverlay,
  selectWorkspaceScheduledRun,
  selectWorkspaceTab,
  useWorkspaceState,
} from "@/lib/workspace-store";

function BackIcon(props: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="currentColor"
      className={props.className}
    >
      <path d="M15.41 16.59L10.83 12l4.58-4.59L14 6l-6 6 6 6z" />
    </svg>
  );
}

function ScheduledTaskIcon(props: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={props.className}
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7.5v5l3.5 2.25" />
    </svg>
  );
}

function ScheduledRunsEmptyIcon(props: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={props.className}
    >
      <path d="M4 7h16" />
      <path d="M7 4v6" />
      <path d="M17 4v6" />
      <rect x="4" y="6" width="16" height="14" rx="3" />
      <path d="M8 12h4" />
      <path d="M8 16h8" />
    </svg>
  );
}

function EmptySelectionIcon(props: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={props.className}
    >
      <rect x="4" y="5" width="16" height="14" rx="3" />
      <path d="M8 9h8" />
      <path d="M8 13h5" />
      <circle cx="17" cy="13" r="1.5" fill="currentColor" stroke="none" />
    </svg>
  );
}

function SessionTabIcon(props: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={props.className}
    >
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}

function EmptyListState(props: {
  icon: React.ReactNode;
  title: string;
  description?: string;
  descriptionNode?: React.ReactNode;
  actionLabel?: string;
  onAction?: () => void;
}) {
  const hasDescription = Boolean(props.description || props.descriptionNode);

  return (
    <div className="flex h-full min-h-[320px] w-full items-center justify-center overflow-visible px-6 py-10">
      <div className="mx-auto flex max-w-sm flex-col items-center text-center">
        <div className="relative mb-5 flex h-20 w-20 items-center justify-center overflow-hidden rounded-full bg-[var(--app-secondary-bg)] text-[var(--app-hint)] shadow-[inset_0_1px_0_rgba(255,255,255,0.18)]">
          <div className="flex h-14 w-14 items-center justify-center rounded-full border border-[color:color-mix(in_srgb,var(--app-border)_72%,transparent)] bg-[color:color-mix(in_srgb,var(--app-bg)_90%,var(--app-secondary-bg))] opacity-95">
            <div className="opacity-60">{props.icon}</div>
          </div>
        </div>
        <div className="flex flex-col items-center gap-3">
          <h3 className="text-[15px] font-semibold leading-[1.15] tracking-[-0.01em] text-[var(--app-fg)]">
            {props.title}
          </h3>
          {props.descriptionNode ? props.descriptionNode : props.description ? (
            <p className="text-sm leading-6 text-[var(--app-hint)]">
              {props.description}
            </p>
          ) : null}
          {props.actionLabel && props.onAction ? (
            <button
              type="button"
              onClick={props.onAction}
              className="relative mt-1 inline-flex h-10 items-center justify-center overflow-hidden rounded-xl border border-[var(--app-border)] bg-[var(--app-secondary-bg)] px-4 text-sm font-semibold text-[var(--app-fg)] shadow-[inset_0_1px_0_rgba(255,255,255,0.26)] transition-colors hover:bg-[var(--app-bg)] active:bg-[var(--app-subtle-bg)]"
            >
              <span
                aria-hidden="true"
                className="pointer-events-none absolute left-3 right-3 top-0 h-px rounded-full bg-[linear-gradient(90deg,transparent,var(--app-liquid-line),transparent)] opacity-90"
              />
              <span className="relative z-[1]">{props.actionLabel}</span>
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function ScheduledRunsEmptyState(props: {
  title: string;
  description: string;
  hint: string;
}) {
  return (
    <div className="flex min-h-[280px] w-full items-center justify-center px-4 py-8">
      <div className="mx-auto flex max-w-md flex-col items-center text-center">
        <div className="relative mb-5 flex h-20 w-20 items-center justify-center overflow-hidden rounded-full bg-[var(--app-secondary-bg)] text-[var(--app-hint)] shadow-[inset_0_1px_0_rgba(255,255,255,0.18)]">
          <div className="flex h-14 w-14 items-center justify-center rounded-full border border-[color:color-mix(in_srgb,var(--app-border)_72%,transparent)] bg-[color:color-mix(in_srgb,var(--app-bg)_90%,var(--app-secondary-bg))] opacity-95">
            <ScheduledRunsEmptyIcon className="h-7 w-7 opacity-60" />
          </div>
        </div>
        <div className="space-y-3">
          <h3 className="text-[15px] font-semibold leading-[1.15] tracking-[-0.01em] text-[var(--app-fg)]">
            {props.title}
          </h3>
          <p className="text-sm leading-6 text-[var(--app-hint)]">
            {props.description}
          </p>
          <div className="inline-flex max-w-full items-center justify-center rounded-2xl border border-dashed border-[color:color-mix(in_srgb,var(--app-border)_85%,transparent)] bg-[color:color-mix(in_srgb,var(--app-secondary-bg)_72%,transparent)] px-4 py-3 text-left text-sm italic leading-6 text-[var(--app-hint)]">
            {props.hint}
          </div>
        </div>
      </div>
    </div>
  );
}

function EditIcon(props: { className?: string }) {
  return (
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
      className={props.className}
    >
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.12 2.12 0 1 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  );
}

function PauseIcon(props: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="currentColor"
      className={props.className}
    >
      <rect x="6" y="4" width="4" height="16" rx="1" />
      <rect x="14" y="4" width="4" height="16" rx="1" />
    </svg>
  );
}

function PlayIcon(props: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="currentColor"
      className={props.className}
    >
      <path d="M8 5.14v13.72a1 1 0 0 0 1.5.86l10-6.86a1 1 0 0 0 0-1.72l-10-6.86A1 1 0 0 0 8 5.14Z" />
    </svg>
  );
}

function StopIcon(props: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={props.className}
    >
      <circle cx="12" cy="12" r="10" />
      <path d="m15 9-6 6" />
      <path d="m9 9 6 6" />
    </svg>
  );
}

function TrashIcon(props: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={props.className}
    >
      <path d="M3 6h18" />
      <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
      <path d="M8 6V4c0-1 1-2 2-2h4c1 0 1 2 2 2v2" />
      <line x1="10" x2="10" y1="11" y2="17" />
      <line x1="14" x2="14" y1="11" y2="17" />
    </svg>
  );
}

function SidebarExpandIcon(props: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={props.className}
    >
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M9 3v18" />
      <path d="m14 9 3 3-3 3" />
    </svg>
  );
}

const MAX_CACHED_SESSIONS = 3;
const SWIPE_NARROW_BREAKPOINT_PX = 1024;
const SWIPE_WHEEL_TRIGGER_PX = 140;
const SWIPE_WHEEL_CANCEL_PX = 24;
const SWIPE_WHEEL_IDLE_RESET_MS = 220;
const SWIPE_WHEEL_RELEASE_MS = 50;
const SWIPE_WHEEL_UNLOCK_MS = 280;
const DESKTOP_SIDEBAR_MIN_WIDTH = 375;
type SwipeAction = "back" | "forward";
type SwipeDirection = -1 | 0 | 1;

function toSwipeDirection(value: number): SwipeDirection {
  if (value > 0) return 1;
  if (value < 0) return -1;
  return 0;
}

function BatchArchiveIcon(props: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={props.className}
    >
      <rect width="20" height="5" x="2" y="3" rx="1" />
      <path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8" />
      <path d="M10 12h4" />
    </svg>
  );
}

function BatchTrashIcon(props: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={props.className}
    >
      <path d="M3 6h18" />
      <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
      <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
    </svg>
  );
}

function BatchCheckIcon(props: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={props.className}
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function BatchXIcon(props: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={props.className}
    >
      <circle cx="12" cy="12" r="10" />
      <path d="m4.9 4.9 14.2 14.2" />
    </svg>
  );
}

function InlineEditableText(props: {
  value: string;
  onChange?: (value: string) => void;
  className?: string;
  readOnly?: boolean;
  style?: React.CSSProperties;
}) {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element || props.readOnly) {
      return;
    }
    if (element.textContent !== props.value) {
      element.textContent = props.value;
    }
  }, [props.readOnly, props.value]);

  if (props.readOnly) {
    return <div className={props.className} style={props.style}>{props.value}</div>;
  }

  return (
    <div
      ref={ref}
      contentEditable
      suppressContentEditableWarning
      role="textbox"
      aria-multiline="false"
      spellCheck={false}
      className={props.className}
      style={props.style}
      onInput={(event) => {
        props.onChange?.(event.currentTarget.textContent ?? "");
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.preventDefault();
        }
      }}
    />
  );
}

function BatchSelectAllIcon(props: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={props.className}
    >
      <rect width="18" height="18" x="3" y="3" rx="2" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}

function BatchDeselectAllIcon(props: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={props.className}
    >
      <rect width="18" height="18" x="3" y="3" rx="2" />
      <path d="M9 12h6" />
    </svg>
  );
}

function OnlineFilterIcon(props: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={props.className}
    >
      <path d="M4.9 19.1C1 15.2 1 8.8 4.9 4.9" />
      <path d="M7.8 16.2c-2.3-2.3-2.3-6.1 0-8.5" />
      <circle cx="12" cy="12" r="2" />
      <path d="M16.2 7.8c2.3 2.3 2.3 6.1 0 8.5" />
      <path d="M19.1 4.9C23 8.8 23 15.1 19.1 19" />
    </svg>
  );
}

function SearchIcon(props: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={props.className}
    >
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.35-4.35" />
    </svg>
  );
}

function SearchClearIcon(props: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.25"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={props.className}
    >
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  );
}

function ChevronIcon(props: { className?: string; collapsed?: boolean }) {
  const className =
    (props.className ?? "") +
    " transition-transform duration-200 " +
    (props.collapsed ? "" : "rotate-90");
  return (
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
      className={className}
    >
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}

type ScheduledTitleEditState = {
  title: string;
};

function getScheduledPathDisplayName(path: string): string {
  const parts = path.split(/[\/]+/).filter(Boolean);
  if (parts.length === 0) return path;
  if (parts.length === 1) return parts[0];
  return parts[parts.length - 2] + "/" + parts[parts.length - 1];
}

function formatScheduledRelativeTime(value: number): string {
  const ms = value < 1_000_000_000_000 ? value * 1000 : value;
  if (!Number.isFinite(ms)) return "";
  const delta = Date.now() - ms;
  if (delta < 60_000) return "just now";
  const minutes = Math.floor(delta / 60_000);
  if (minutes < 60) return minutes + "m ago";
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return hours + "h ago";
  const days = Math.floor(hours / 24);
  if (days < 7) return days + "d ago";
  return new Date(ms).toLocaleDateString();
}

function getMachineTitle(machine: Machine | null | undefined): string {
  if (machine?.metadata?.displayName) return machine.metadata.displayName;
  if (machine?.metadata?.host) return machine.metadata.host;
  if (machine?.id) return machine.id.slice(0, 8);
  return "Unknown machine";
}

function formatScheduledDateTime(value: number | undefined): string {
  if (!value) return "-";
  return new Date(value).toLocaleString();
}

function buildScheduledTitleEditState(task: ScheduledTask): ScheduledTitleEditState {
  return {
    title: task.title,
  };
}

type MachineTaskGroup = {
  machineId: string;
  title: string;
  tasks: ScheduledTask[];
  latestAt: number;
};

function groupTasksByMachine(
  tasks: ScheduledTask[],
  machines: Machine[],
): MachineTaskGroup[] {
  const machineMap = new Map(machines.map((machine) => [machine.id, machine]));
  const groups = new Map<string, ScheduledTask[]>();

  for (const task of tasks) {
    if (!groups.has(task.machineId)) {
      groups.set(task.machineId, []);
    }
    groups.get(task.machineId)?.push(task);
  }

  return Array.from(groups.entries())
    .map(([machineId, machineTasks]) => {
      const sortedTasks = [...machineTasks].sort((left, right) => {
        const leftTime = left.nextRunAt ?? left.lastRunAt ?? left.createdAt;
        const rightTime = right.nextRunAt ?? right.lastRunAt ?? right.createdAt;
        return rightTime - leftTime;
      });
      const latestAt = sortedTasks.reduce(
        (max, task) =>
          Math.max(max, task.nextRunAt ?? task.lastRunAt ?? task.createdAt),
        0,
      );
      return {
        machineId,
        title: getMachineTitle(machineMap.get(machineId) ?? null),
        tasks: sortedTasks,
        latestAt,
      };
    })
    .sort((left, right) => right.latestAt - left.latestAt);
}

function ScheduledRunStatusBadge(props: {
  status: ScheduledTaskRun["status"];
}) {
  const { t } = useTranslation();
  const className = getScheduledRunStatusToneClassName(props.status);

  return (
    <span
      className={
        "inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-medium " + className
      }
    >
      {t(`scheduled.runStatus.${props.status}`)}
    </span>
  );
}

function getScheduledRunTimelineStatusClassName(
  status: ScheduledTaskRun["status"],
): string {
  return getScheduledRunFillClassName(status);
}

function getScheduledTaskStatusTag(task: ScheduledTask): {
  label: string;
  className: string;
} {
  if (task.paused) {
    return {
      label: "scheduled.list.status.paused",
      className: "bg-amber-500/12 text-amber-700 dark:text-amber-300",
    };
  }

  if (task.status === "active") {
    return {
      label: "scheduled.list.status.running",
      className: "bg-emerald-500/12 text-emerald-700 dark:text-emerald-300",
    };
  }

  return {
    label: "scheduled.list.status.active",
    className: "bg-[var(--app-subtle-bg)] text-[var(--app-fg)]",
  };
}

function getScheduledTaskStatusText(
  task: ScheduledTask,
  t: ReturnType<typeof useTranslation>["t"],
): string {
  return t(getScheduledTaskStatusTag(task).label);
}

function ScheduledTaskStatusTag(props: {
  task: ScheduledTask;
  labelOverride?: string;
  icon?: React.ReactNode;
}) {
  const { t } = useTranslation();
  const taskStatusTag = getScheduledTaskStatusTag(props.task);

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium ${taskStatusTag.className}`}
    >
      {props.icon}
      <span>{props.labelOverride ?? t(taskStatusTag.label)}</span>
    </span>
  );
}

function getScheduledRunSortTime(run: ScheduledTaskRun): number {
  return run.triggeredAt ?? run.scheduledFor ?? run.finishedAt ?? 0;
}

function getScheduledRunResultSummaryLabel(
  resultSummary: string,
  t: ReturnType<typeof useTranslation>["t"],
): string {
  const summaryKey = `scheduled.runResult.${resultSummary}`;
  const translated = t(summaryKey);
  return translated === summaryKey ? resultSummary : translated;
}

type ScheduledDetailMode = "overview" | "runs" | "session";
type ScheduledSessionSubMode = "view" | "active";
const SCHEDULED_DETAIL_MODE_STORAGE_KEY = "hapi:scheduled-detail-mode";
const SCHEDULED_SESSION_SUB_MODE_STORAGE_KEY = "hapi:scheduled-session-sub-mode";

function getScheduledSessionPermissionLabel(
  permission: ScheduledTask["scheduledSessionPermission"],
  t: ReturnType<typeof useTranslation>["t"],
): string {
  return t(`scheduled.permission.${permission}`);
}

function getScheduledTaskOutcomeStatusLabel(
  status: NonNullable<ScheduledTaskRun["taskOutcome"]>["status"],
  t: ReturnType<typeof useTranslation>["t"],
): string {
  return t(`scheduled.outcomeStatus.${status}`);
}

function getScheduledTaskOutcomeToneClassName(
  status: NonNullable<ScheduledTaskRun["taskOutcome"]>["status"],
): string {
  if (status === "completed") {
    return "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300";
  }

  if (status === "partial") {
    return "bg-sky-500/10 text-sky-700 dark:text-sky-300";
  }

  if (status === "blocked") {
    return "bg-amber-500/10 text-amber-700 dark:text-amber-300";
  }

  return "bg-rose-500/10 text-rose-700 dark:text-rose-300";
}

function getScheduledNextRunTipMessage(
  task: ScheduledTask,
  t: ReturnType<typeof useTranslation>["t"],
): string {
  if (typeof task.nextRunAt === "number") {
    return `${t("scheduled.detail.nextRun")}: ${formatScheduledDateTime(task.nextRunAt)}`;
  }

  if (task.paused) {
    return t("scheduled.detail.nextRunTipPaused");
  }

  if (task.scheduleType === "once") {
    return t("scheduled.detail.nextRunTipOnceFinished");
  }

  return t("scheduled.detail.nextRunTipUnavailable");
}

function ScheduledRunsPager(props: {
  task: ScheduledTask;
  runs: ScheduledTaskRun[];
  selectedRunId: string | null;
  onSelectRun: (runId: string) => void;
}) {
  const { t } = useTranslation();
  const middleButtonRefs = useRef(new Map<string, HTMLButtonElement>());
  const nextRunTipRef = useRef<HTMLDivElement | null>(null);
  const [nextRunTipOpen, setNextRunTipOpen] = useState(false);
  const runSquareClassName = "relative flex h-8 w-8 shrink-0 items-center justify-center bg-[var(--app-bg)]";
  const navButtonClassName = "flex h-8 w-8 shrink-0 items-center justify-center bg-[var(--app-secondary-bg)] text-[var(--app-fg)] disabled:cursor-not-allowed disabled:opacity-35";

  const sortedRuns = useMemo(
    () => [...props.runs].sort((left, right) => getScheduledRunSortTime(right) - getScheduledRunSortTime(left)),
    [props.runs],
  );

  const selectedIndex = sortedRuns.findIndex((run) => run.id === props.selectedRunId);
  const effectiveSelectedIndex = selectedIndex >= 0 ? selectedIndex : 0;
  const effectiveSelectedRun = sortedRuns[effectiveSelectedIndex] ?? null;
  const canGoPrevious = effectiveSelectedIndex > 0;
  const canGoNext = effectiveSelectedIndex >= 0 && effectiveSelectedIndex < sortedRuns.length - 1;

  useEffect(() => {
    const selectedRun = effectiveSelectedRun;
    if (!selectedRun) {
      return;
    }

    const button = middleButtonRefs.current.get(selectedRun.id);
    if (!button) {
      return;
    }

    button.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
      inline: "center",
    });
  }, [effectiveSelectedRun]);

  useEffect(() => {
    if (!nextRunTipOpen) {
      return;
    }

    const handlePointerDown = (event: MouseEvent) => {
      if (!nextRunTipRef.current?.contains(event.target as Node)) {
        setNextRunTipOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setNextRunTipOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [nextRunTipOpen]);

  const nextRunTipMessage = getScheduledNextRunTipMessage(props.task, t);

  if (sortedRuns.length === 0) {
    return (
      <div className="space-y-3">
        <div className="flex items-center overflow-visible rounded-2xl border border-[var(--app-border)]">
          <button
            type="button"
            disabled
            className={`${navButtonClassName} overflow-hidden rounded-l-2xl border-r border-[var(--app-border)]`}
            aria-label={t("scheduled.detail.previousRun")}
            title={t("scheduled.detail.previousRun")}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.25"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
              className="h-4 w-4"
            >
              <path d="m15 18-6-6 6-6" />
            </svg>
          </button>

          <div className="min-w-0 flex-1 overflow-hidden">
            <div className="flex h-8 min-w-full items-center overflow-hidden bg-[var(--app-bg)]" />
          </div>

          <button
            type="button"
            disabled
            className={`${navButtonClassName} border-l border-[var(--app-border)]`}
            aria-label={t("scheduled.detail.nextRunRecord")}
            title={t("scheduled.detail.nextRunRecord")}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.25"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
              className="h-4 w-4"
            >
              <path d="m9 18 6-6-6-6" />
            </svg>
          </button>

          <div
            ref={nextRunTipRef}
            className="relative rounded-r-2xl border-l border-[var(--app-border)]"
          >
            <button
              type="button"
              onClick={() => setNextRunTipOpen((open) => !open)}
              className={`${navButtonClassName} overflow-hidden rounded-r-2xl`}
              aria-label={t("scheduled.detail.nextRun")}
              aria-expanded={nextRunTipOpen}
            >
              <ClockIcon className="h-4 w-4" />
            </button>
            {nextRunTipOpen ? (
              <div className="absolute right-0 top-[calc(100%+8px)] z-20 w-64 rounded-2xl border border-[var(--app-border)] bg-[var(--app-bg)] p-3 text-sm leading-6 text-[var(--app-fg)] shadow-[0_18px_48px_rgba(15,23,42,0.14)]">
                {nextRunTipMessage}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center overflow-visible rounded-2xl border border-[var(--app-border)]">
        <button
          type="button"
          onClick={() => {
            const targetRun = sortedRuns[effectiveSelectedIndex - 1];
            if (targetRun) {
              props.onSelectRun(targetRun.id);
            }
          }}
          disabled={!canGoPrevious}
          className={`${navButtonClassName} overflow-hidden rounded-l-2xl border-r border-[var(--app-border)]`}
          aria-label={t("scheduled.detail.previousRun")}
          title={t("scheduled.detail.previousRun")}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.25"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            className="h-4 w-4"
          >
            <path d="m15 18-6-6 6-6" />
          </svg>
        </button>

        <div
          className="min-w-0 flex-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          <div className="flex min-w-max items-center">
            {sortedRuns.map((run, index) => {
              const selected = run.id === effectiveSelectedRun?.id;
              const isLast = index === sortedRuns.length - 1;
              return (
                <button
                  key={run.id}
                  ref={(node) => {
                    if (node) {
                      middleButtonRefs.current.set(run.id, node);
                    } else {
                      middleButtonRefs.current.delete(run.id);
                    }
                  }}
                  type="button"
                  onClick={() => props.onSelectRun(run.id)}
                  className={`${runSquareClassName} ${!isLast ? "border-r border-[var(--app-border)]" : ""}`}
                  aria-label={t("scheduled.detail.runNumber", { n: index + 1 })}
                  title={`${t("scheduled.detail.runNumber", { n: index + 1 })}: ${formatScheduledDateTime(getScheduledRunSortTime(run))}`}
                >
                  <span
                    aria-hidden="true"
                    className={`flex h-full w-full items-center justify-center ${selected ? "bg-[var(--app-session-active-bg)]" : "bg-transparent"}`}
                  >
                    <span
                      className={`block h-3 w-3 rounded-[2px] ${getScheduledRunTimelineStatusClassName(run.status)}`}
                    />
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            const targetRun = sortedRuns[effectiveSelectedIndex + 1];
            if (targetRun) {
              props.onSelectRun(targetRun.id);
            }
          }}
          disabled={!canGoNext}
          className={`${navButtonClassName} border-l border-[var(--app-border)]`}
          aria-label={t("scheduled.detail.nextRunRecord")}
          title={t("scheduled.detail.nextRunRecord")}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.25"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            className="h-4 w-4"
          >
            <path d="m9 18 6-6-6-6" />
          </svg>
        </button>

        <div
          ref={nextRunTipRef}
          className="relative rounded-r-2xl border-l border-[var(--app-border)]"
        >
          <button
            type="button"
            onClick={() => setNextRunTipOpen((open) => !open)}
            className={`${navButtonClassName} overflow-hidden rounded-r-2xl`}
            aria-label={t("scheduled.detail.nextRun")}
            aria-expanded={nextRunTipOpen}
          >
            <ClockIcon className="h-4 w-4" />
          </button>
          {nextRunTipOpen ? (
            <div className="absolute right-0 top-[calc(100%+8px)] z-20 w-64 rounded-2xl border border-[var(--app-border)] bg-[var(--app-bg)] p-3 text-sm leading-6 text-[var(--app-fg)] shadow-[0_18px_48px_rgba(15,23,42,0.14)]">
              {nextRunTipMessage}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function getScheduledResumeValidationMessage(
  task: ScheduledTask,
  t: (key: string, params?: Record<string, string | number>) => string,
): string | null {
  if (!task.paused) {
    return null;
  }

  const pauseValidationCode = getScheduledTaskPauseValidationCode(task);
  if (pauseValidationCode === "once_already_consumed") {
    return t("scheduled.validation.onceAlreadyConsumed");
  }
  if (pauseValidationCode === "once_expired") {
    return t("scheduled.validation.onceExpired");
  }
  if (pauseValidationCode === "unknown") {
    return t("scheduled.validation.unknown");
  }

  if (task.scheduleType === "once") {
    return null;
  }

  const expression = task.scheduleSpec?.cron?.trim();
  if (!expression) {
    return t("scheduled.validation.cronInvalid");
  }

  try {
    CronExpressionParser.parse(expression, {
      currentDate: Date.now(),
      tz: task.timezone,
    }).next();
    return null;
  } catch {
    return t("scheduled.validation.cronInvalid");
  }
}

function getScheduledPauseValidationMessage(
  task: ScheduledTask,
  t: (key: string, params?: Record<string, string | number>) => string,
): string | null {
  if (task.paused) {
    return null;
  }

  const pauseValidationCode = getScheduledTaskPauseValidationCode(task);
  if (pauseValidationCode === "once_already_consumed") {
    return t("scheduled.validation.onceAlreadyConsumed");
  }
  if (pauseValidationCode === "once_expired") {
    return t("scheduled.validation.onceExpiredPause");
  }
  if (pauseValidationCode === "unknown") {
    return t("scheduled.validation.unknown");
  }

  return null;
}

function formatScheduledFieldForCopy(label: string, value: string | null | undefined): string {
  return `${label}: ${value && value.trim().length > 0 ? value : "-"}`;
}

function buildScheduledOverviewCopyText(
  task: ScheduledTask,
  machineTitle: string,
  createdAtLabel: string | null,
  createdBySessionTitle: string | null,
  createdBySessionFlavor: string | null,
  t: (key: string, params?: Record<string, string | number>) => string,
): string {
  const lines = [
    "<scheduled-task-overview>",
    formatScheduledFieldForCopy(t("scheduled.detail.status"), getScheduledTaskStatusText(task, t)),
    formatScheduledFieldForCopy(t("scheduled.detail.machine"), machineTitle),
    formatScheduledFieldForCopy(`${t("scheduled.detail.agent")} / ${t("scheduled.detail.model")}`, `${task.agentFlavor} / ${task.model ?? "-"}`),
    formatScheduledFieldForCopy(t("scheduled.detail.prompt"), task.prompt),
    formatScheduledFieldForCopy(t("scheduled.detail.directory"), task.targetDirectory),
    formatScheduledFieldForCopy(t("scheduled.detail.permission"), getScheduledSessionPermissionLabel(task.scheduledSessionPermission, t)),
    formatScheduledFieldForCopy(t("scheduled.detail.scheduleType"), task.scheduleType === "cron" ? t("scheduled.list.kind.cron") : t("scheduled.list.kind.once")),
    formatScheduledFieldForCopy(task.scheduleType === "cron" ? t("scheduled.detail.cron") : t("scheduled.detail.runAt"), task.scheduleType === "cron" ? (task.scheduleSpec?.cron ?? "-") : (formatScheduledDateTime(task.scheduleSpec?.runAt) ?? "-")),
    formatScheduledFieldForCopy(t("scheduled.detail.created"), createdAtLabel),
    formatScheduledFieldForCopy(t("scheduled.detail.taskId"), task.id),
    formatScheduledFieldForCopy(t("scheduled.detail.createdFromSession"), task.createdBySessionId ? (createdBySessionTitle ?? `SESSION ID ${task.createdBySessionId}`) : t("scheduled.detail.createdFromSessionMissing")),
  ]

  if (task.createdBySessionId) {
    lines.push(formatScheduledFieldForCopy(`${t("scheduled.detail.createdFromSession")} ID`, task.createdBySessionId))
  }

  if (task.createdBySessionId && createdBySessionFlavor) {
    lines.push(formatScheduledFieldForCopy(`${t("scheduled.detail.createdFromSession")} Flavor`, createdBySessionFlavor))
  }

  lines.push("</scheduled-task-overview>")

  return lines.join("\n")
}

function buildScheduledRunsCopyText(
  taskRuns: ScheduledTaskRun[],
  selectedRun: ScheduledTaskRun | null,
  t: (key: string, params?: Record<string, string | number>) => string,
): string {
  const total = taskRuns.length
  const succeeded = taskRuns.filter((run) => run.status === "succeeded").length
  const failed = taskRuns.filter((run) => run.status === "failed").length
  const lines = [
    "<scheduled-task-runs>",
    "<runs-summary>",
    formatScheduledFieldForCopy(t("scheduled.detail.runs"), `${total}`),
    formatScheduledFieldForCopy(`${t("scheduled.runStatus.succeeded")}`, `${succeeded}`),
    formatScheduledFieldForCopy(`${t("scheduled.runStatus.failed")}`, `${failed}`),
    "</runs-summary>",
  ]

  if (!selectedRun) {
    lines.push("</scheduled-task-runs>")
    return lines.join("\n")
  }

  lines.push("")
  lines.push("<selected-run>")
  lines.push(formatScheduledFieldForCopy(t("scheduled.detail.selectedRun"), t(`scheduled.runStatus.${selectedRun.status}`)))
  lines.push(formatScheduledFieldForCopy(t("scheduled.detail.triggered"), formatScheduledDateTime(selectedRun.triggeredAt) ?? "-"))
  lines.push(formatScheduledFieldForCopy(t("scheduled.detail.runId"), selectedRun.id))
  lines.push(formatScheduledFieldForCopy(t("scheduled.detail.finished"), formatScheduledDateTime(selectedRun.finishedAt) ?? "-"))
  lines.push(formatScheduledFieldForCopy(t("scheduled.detail.session"), selectedRun.sessionId ?? "-"))

  if (selectedRun.error) {
    lines.push(formatScheduledFieldForCopy("Error", selectedRun.error))
  }

  if (selectedRun.resultSummary) {
    lines.push(formatScheduledFieldForCopy("Result", getScheduledRunResultSummaryLabel(selectedRun.resultSummary, t)))
  }

  if (selectedRun.taskOutcome) {
    lines.push(formatScheduledFieldForCopy(t("scheduled.detail.outcomeStatus"), getScheduledTaskOutcomeStatusLabel(selectedRun.taskOutcome.status, t)))
    lines.push(formatScheduledFieldForCopy(t("scheduled.detail.outcome"), selectedRun.taskOutcome.summary))
    lines.push(formatScheduledFieldForCopy(t("scheduled.detail.outcomeReportedAt"), formatScheduledDateTime(selectedRun.taskOutcome.reportedAt) ?? "-"))
    lines.push(formatScheduledFieldForCopy(t("scheduled.detail.needsUserIntervention"), selectedRun.taskOutcome.needsUserIntervention ? t("common.yes") : t("common.no")))
    lines.push(formatScheduledFieldForCopy(t("scheduled.detail.permanentFailureLikely"), selectedRun.taskOutcome.permanentFailureLikely ? t("common.yes") : t("common.no")))
  }

  lines.push("</selected-run>")
  lines.push("</scheduled-task-runs>")

  return lines.join("\n")
}

function buildScheduledDetailCopyText(
  overviewText: string,
  runsText: string,
): string {
  return [
    "<scheduled-task-detail>",
    overviewText,
    "",
    runsText,
    "</scheduled-task-detail>",
  ].join("\n")
}

function getScheduledErrorMessage(
  error: unknown,
  t: (key: string, params?: Record<string, string | number>) => string,
): string {
  if (error instanceof ApiError) {
    if (error.code === "scheduled.once_already_consumed") {
      return t("scheduled.validation.onceAlreadyConsumed");
    }
    if (error.code === "scheduled.once_expired") {
      return t("scheduled.validation.onceExpired");
    }
    if (error.code === "scheduled.cron_invalid") {
      return t("scheduled.validation.cronInvalid");
    }
    if (error.code === "scheduled.invalid_state") {
      return t("scheduled.validation.unknown");
    }
    if (error.message) {
      return error.message;
    }
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  return t("dialog.error.default");
}

function ScheduledTaskListRow(props: {
  task: ScheduledTask;
  latestRun: ScheduledTaskRun | undefined;
  selected: boolean;
  rowBackgroundClass: string;
  rowStyle: React.CSSProperties;
  typeText: string;
  statusText: string;
  createdAtLabel: string | null;
  iconToneClass: string;
  isPending: boolean;
  onSelect: () => void;
  onTogglePaused: () => void;
  onCancelTask: () => void;
  onDeleteTask: () => void;
}) {
  const { t } = useTranslation();
  const { haptic } = usePlatform();
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuAnchorPoint, setMenuAnchorPoint] = useState({ x: 0, y: 0 });

  const longPressHandlers = useLongPress({
    onLongPress: (point) => {
      haptic.impact("medium");
      setMenuAnchorPoint(point);
      setMenuOpen(true);
    },
    onClick: () => {
      if (!menuOpen) {
        props.onSelect();
      }
    },
    threshold: 500,
    disabled: props.isPending,
  });

  return (
    <>
      <button
        type="button"
        {...longPressHandlers}
        className={
          "session-list-item flex w-full flex-col gap-0.5 px-3 py-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--app-link)] select-none " +
          props.rowBackgroundClass
        }
        style={props.rowStyle}
        aria-current={props.selected ? "page" : undefined}
      >
        <div className="flex items-center justify-between gap-1.5">
          <div className="flex min-w-0 items-center gap-1">
            <span
              className={
                "inline-flex h-4 w-4 shrink-0 items-center justify-center " +
                props.iconToneClass
              }
              aria-label={t("scheduled.list.iconLabel")}
            >
              <ScheduledTaskStatusIcon
                task={props.task}
                latestRun={props.latestRun}
                className="h-3.5 w-3.5"
              />
            </span>
            <div
              className={`truncate text-base leading-none ${
                props.selected
                  ? "font-semibold text-[var(--app-fg)]"
                  : "font-medium text-[var(--app-fg)]"
              }`}
            >
              {props.task.title}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1 text-sm">
            <span
              className={
                props.task.paused
                  ? "text-amber-600"
                  : props.latestRun?.status === "failed"
                    ? "text-red-600"
                    : props.latestRun?.status === "succeeded"
                        ? "text-emerald-600"
                        : "text-[var(--app-hint)]"
              }
            >
              {props.statusText}
            </span>
          </div>
        </div>
        <div
          className="flex items-center gap-x-2 text-sm text-[var(--app-hint)] overflow-hidden whitespace-nowrap"
          style={{
            opacity: "var(--app-session-subtitle-opacity)",
          }}
        >
          <span className="inline-flex shrink-0 items-center gap-1">
            <ScheduledTaskIcon className="h-3.5 w-3.5" />
            <span>{props.typeText}</span>
          </span>
          <span className="truncate">{normalizeProjectPath(props.task.targetDirectory)}</span>
          {props.createdAtLabel ? (
            <span className="inline-flex shrink-0 items-center gap-1">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
              <span>{props.createdAtLabel}</span>
            </span>
          ) : null}
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[var(--app-subtle-bg)] px-2 py-0.5 text-[11px] text-[var(--app-hint)]">
            <span>{getScheduledSessionPermissionLabel(props.task.scheduledSessionPermission, t)}</span>
          </span>
        </div>
      </button>

      <ScheduledTaskActionMenu
        isOpen={menuOpen}
        onClose={() => setMenuOpen(false)}
        paused={Boolean(props.task.paused)}
        canTogglePaused={canScheduledTaskTogglePaused(props.task) && !props.isPending}
        togglePausedTitle={props.task.paused
          ? (getScheduledResumeValidationMessage(props.task, t) ?? t("scheduled.action.resume"))
          : (getScheduledPauseValidationMessage(props.task, t) ?? t("scheduled.action.pause"))}
        canCancel={props.task.phase !== "archived" && !props.isPending}
        onTogglePaused={props.onTogglePaused}
        onCancel={props.onCancelTask}
        onDelete={props.onDeleteTask}
        anchorPoint={menuAnchorPoint}
      />
    </>
  );
}

function ScheduledTaskStatusIcon(props: {
  task: ScheduledTask;
  latestRun: ScheduledTaskRun | undefined;
  className?: string;
}) {
  const pauseLocked = isScheduledTaskPauseLocked(props.task);

  if (props.latestRun?.status === "failed") {
    return (
      <svg
        className={props.className}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <circle cx="12" cy="12" r="10" />
        <path d="m15 9-6 6" />
        <path d="m9 9 6 6" />
      </svg>
    );
  }

  if (props.latestRun?.status === "succeeded") {
    return (
      <svg
        className={props.className}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M20 6 9 17l-5-5" />
      </svg>
    );
  }

  if (pauseLocked && props.task.scheduleType === "once") {
    return (
      <svg
        className={props.className}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M20 6 9 17l-5-5" />
      </svg>
    );
  }

  if (props.task.paused) {
    return (
      <svg
        className={props.className}
        viewBox="0 0 24 24"
        fill="currentColor"
        aria-hidden="true"
      >
        <rect x="6" y="5" width="4" height="14" rx="1" />
        <rect x="14" y="5" width="4" height="14" rx="1" />
      </svg>
    );
  }

  return (
    <svg
      className={props.className}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="4" />
    </svg>
  );
}

function ScheduledTaskHeader(props: {
  task: ScheduledTask;
  latestRun: ScheduledTaskRun | undefined;
  iconToneClass: string;
  isEditing: boolean;
  editState: ScheduledTitleEditState | null;
  isPending: boolean;
  onEditStateChange: React.Dispatch<
    React.SetStateAction<ScheduledTitleEditState | null>
  >;
  onSetEditing: React.Dispatch<React.SetStateAction<boolean>>;
  onTogglePaused: () => Promise<unknown> | void;
  onCancelTask: (taskId: string) => Promise<unknown> | void;
  onDeleteTask: (taskId: string) => Promise<unknown> | void;
  onUpdateTask: (body: Record<string, unknown>) => Promise<unknown> | void;
}) {
  const { t } = useTranslation();
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const headerIconButtonClassName =
    "flex h-[30px] w-[30px] items-center justify-center rounded-full text-[var(--app-hint)] transition-colors hover:bg-[var(--app-secondary-bg)] hover:text-[var(--app-fg)] disabled:cursor-not-allowed disabled:opacity-50";
  const headerCompactButtonClassName =
    "inline-flex h-[30px] items-center rounded-lg border border-[var(--app-border)] px-2.5 text-xs text-[var(--app-fg)] disabled:opacity-50";
  const trimmedEditedTitle = props.editState?.title.trim() ?? "";
  const titleChanged = trimmedEditedTitle.length > 0 && trimmedEditedTitle !== props.task.title;
  const canTogglePaused = canScheduledTaskTogglePaused(props.task);
  const pauseLocked = !canTogglePaused;
  const showConsumedOnceIcon =
    pauseLocked &&
    props.task.scheduleType === "once" &&
    hasScheduledTaskExecuted(props.task);
  const pauseDisabledReason = props.task.paused
    ? getScheduledResumeValidationMessage(props.task, t)
    : getScheduledPauseValidationMessage(props.task, t);
  const pauseButtonTitle = pauseLocked
    ? (pauseDisabledReason ?? t("scheduled.validation.unknown"))
    : props.task.paused
      ? t("scheduled.action.resume")
      : t("scheduled.action.pause");

  return (
    <div className="bg-[var(--app-bg)] pt-[env(safe-area-inset-top)]">
      <div className="mx-auto flex w-full max-w-content items-center gap-2 px-3 py-[8px]">
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-2 overflow-hidden">
            <span
              className={"inline-flex h-4 w-4 shrink-0 items-center justify-center " + props.iconToneClass}
              aria-label={t("scheduled.list.iconLabel")}
            >
              <ScheduledTaskStatusIcon
                task={props.task}
                latestRun={props.latestRun}
                className="h-3.5 w-3.5"
              />
            </span>
            <div className="min-w-0 flex-1">
              {props.isEditing && props.editState ? (
                <input
                  autoFocus
                  value={props.editState.title}
                  onChange={(event) =>
                    props.onEditStateChange((current) =>
                      current
                        ? { ...current, title: event.target.value }
                        : current,
                    )
                  }
                  className="w-full border-0 bg-transparent p-0 text-base font-semibold leading-normal text-[var(--app-fg)] outline-none focus:outline-none focus:ring-0"
                />
              ) : (
                <div className="min-w-0 truncate text-base font-semibold leading-normal">
                  {props.task.title}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-0.5">
          {!props.isEditing ? (
            <>
              <button
                type="button"
                disabled={props.isPending}
                onClick={() => props.onSetEditing(true)}
                className={headerIconButtonClassName}
                title={t("scheduled.action.edit")}
                aria-label={t("scheduled.action.edit")}
              >
                <EditIcon className="h-4 w-4" />
              </button>
              <div className="mx-0.5 h-4 w-px bg-[var(--app-divider)]" />
              <button
                type="button"
                disabled={props.isPending || pauseLocked}
                onClick={() => {
                  void props.onTogglePaused();
                }}
                className={headerIconButtonClassName}
                title={pauseButtonTitle}
                aria-label={pauseButtonTitle}
              >
                {showConsumedOnceIcon ? (
                  <svg
                    className="h-[17px] w-[17px]"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M20 6 9 17l-5-5" />
                  </svg>
                ) : props.task.paused ? (
                  <PlayIcon className="h-[17px] w-[17px]" />
                ) : (
                  <PauseIcon className="h-[17px] w-[17px]" />
                )}
              </button>
              <button
                type="button"
                disabled={
                  props.isPending ||
                  props.task.status !== "active" ||
                  props.task.paused
                }
                onClick={() => void props.onCancelTask(props.task.id)}
                className={headerIconButtonClassName}
                title={t("scheduled.action.cancel")}
                aria-label={t("scheduled.action.cancel")}
              >
                <StopIcon className="h-4 w-4" />
              </button>
              <button
                type="button"
                disabled={props.isPending}
                onClick={() => setDeleteConfirmOpen(true)}
                className={headerIconButtonClassName}
                title={t("scheduled.action.delete")}
                aria-label={t("scheduled.action.delete")}
              >
                <TrashIcon className="h-4 w-4" />
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                disabled={props.isPending || !props.editState || !titleChanged}
                onClick={() => {
                  if (!props.editState) return;
                  const body: Record<string, unknown> = {
                    taskId: props.task.id,
                    title: trimmedEditedTitle,
                  };
                  void Promise.resolve(props.onUpdateTask(body)).then(() => {
                    props.onSetEditing(false);
                  });
                }}
                className={headerCompactButtonClassName}
              >
                {t("scheduled.action.save")}
              </button>
              <button
                type="button"
                disabled={props.isPending}
                onClick={() => {
                  props.onEditStateChange(buildScheduledTitleEditState(props.task));
                  props.onSetEditing(false);
                }}
                className={headerCompactButtonClassName}
              >
                {t("button.cancel")}
              </button>
            </>
          )}
        </div>
      </div>
      <div className="border-t border-[var(--app-border)]" />
      <ConfirmDialog
        isOpen={deleteConfirmOpen}
        onClose={() => setDeleteConfirmOpen(false)}
        title={t("scheduled.deleteDialog.title")}
        description={t("scheduled.deleteDialog.description", {
          name: props.task.title,
        })}
        confirmLabel={t("scheduled.deleteDialog.confirm")}
        confirmingLabel={t("scheduled.deleteDialog.confirming")}
        onConfirm={async () => {
          await props.onDeleteTask(props.task.id);
        }}
        isPending={props.isPending}
        destructive
      />
    </div>
  );
}

function ScheduledTaskDetailPanel({
  task,
  machineTitle,
  createdBySessionTitle,
  createdBySessionFlavor,
  selectedRun,
  taskRuns,
  latestRun,
  isEditing,
  editState,
  isPending,
  onEditStateChange,
  onSetEditing,
  onTogglePaused,
  onCancelTask,
  onDeleteTask,
  onUpdateTask,
  onSelectRun,
  onSetRunSessionInteractive,
  scheduledSessionInteractive,
  onOpenCreatedBySession,
}: {
  task: ScheduledTask;
  machineTitle: string;
  createdBySessionTitle: string | null;
  createdBySessionFlavor: string | null;
  selectedRun: ScheduledTaskRun | null;
  taskRuns: ScheduledTaskRun[];
  latestRun: ScheduledTaskRun | undefined;
  isEditing: boolean;
  editState: ScheduledTitleEditState | null;
  isPending: boolean;
  onEditStateChange: React.Dispatch<
    React.SetStateAction<ScheduledTitleEditState | null>
  >;
  onSetEditing: React.Dispatch<React.SetStateAction<boolean>>;
  onTogglePaused: () => Promise<unknown> | void;
  onCancelTask: (taskId: string) => Promise<unknown> | void;
  onDeleteTask: (taskId: string) => Promise<unknown> | void;
  onUpdateTask: (body: Record<string, unknown>) => Promise<unknown> | void;
  onSelectRun: (runId: string | null) => void;
  onSetRunSessionInteractive: (sessionId: string, interactive: boolean) => void;
  scheduledSessionInteractive: boolean;
  onOpenCreatedBySession: (sessionId: string) => void;
}) {
  const { t } = useTranslation();
  const [promptExpanded, setPromptExpanded] = useState(false);
  const [outcomeExpanded, setOutcomeExpanded] = useState(false);
  const [detailMode, setDetailMode] = useState<ScheduledDetailMode>(() => {
    const stored = readStorageItem("session", SCHEDULED_DETAIL_MODE_STORAGE_KEY);
    return stored === "overview" || stored === "runs" || stored === "session"
      ? stored
      : "overview";
  });
  const [sessionSubMode, setSessionSubMode] = useState<ScheduledSessionSubMode>(() => {
    const stored = readStorageItem("session", SCHEDULED_SESSION_SUB_MODE_STORAGE_KEY);
    return stored === "view" || stored === "active" ? stored : "view";
  });
  const [runSummaryTipOpen, setRunSummaryTipOpen] = useState(false);
  const runSummaryTipRef = useRef<HTMLDivElement | null>(null);
  const { copied, copy } = useCopyToClipboard();
  const configValueSlotClassName =
    "min-w-0 flex-[0_1_62%] text-right text-sm leading-[19px] text-[var(--app-fg)]";
  const configReadOnlyValueClassName =
    "block min-h-[19px] w-full overflow-hidden whitespace-nowrap text-right text-sm leading-[19px] text-[var(--app-fg)]";
  const sessionModeDisabled = !selectedRun?.sessionId;
  const createdAtLabel = useMemo(
    () => formatTimestamp(task.createdAt),
    [task.createdAt],
  );
  const scheduledTaskIconToneClassName = task.paused
    ? "text-amber-600"
    : latestRun?.status === "failed"
        ? "text-red-600"
        : latestRun?.status === "succeeded"
          ? "text-emerald-600"
          : "text-[var(--app-hint)]";

  useEffect(() => {
    if (detailMode !== "session") {
      return;
    }

    // On refresh, detail mode restores before the selected run finishes
    // rehydrating. Avoid downgrading the remembered Session tab during that gap.
    if (!selectedRun) {
      if (taskRuns.length === 0) {
        setDetailMode("overview");
      }
      return;
    }

    if (sessionModeDisabled) {
      setDetailMode(taskRuns.length > 0 ? "runs" : "overview");
    }
  }, [detailMode, selectedRun, sessionModeDisabled, taskRuns.length]);

  useEffect(() => {
    writeStorageItem("session", SCHEDULED_DETAIL_MODE_STORAGE_KEY, detailMode);
  }, [detailMode]);

  useEffect(() => {
    writeStorageItem("session", SCHEDULED_SESSION_SUB_MODE_STORAGE_KEY, sessionSubMode);
  }, [sessionSubMode]);

  useEffect(() => {
    setOutcomeExpanded(false);
  }, [selectedRun?.id]);

  useEffect(() => {
    if (sessionSubMode !== "active") {
      return;
    }

    // On refresh, the remembered sub-mode may restore before the selected run
    // rehydrates. Keep Active during that gap instead of forcing a fallback.
    if (!selectedRun) {
      if (taskRuns.length === 0) {
        setSessionSubMode("view");
      }
      return;
    }

    if (!selectedRun.sessionId) {
      setSessionSubMode("view");
    }
  }, [selectedRun, sessionSubMode, taskRuns.length]);

  useEffect(() => {
    if (detailMode !== "session") {
      return;
    }

    if (!selectedRun?.sessionId) {
      return;
    }

    const shouldBeInteractive = sessionSubMode === "active";
    if (scheduledSessionInteractive !== shouldBeInteractive) {
      onSetRunSessionInteractive(selectedRun.sessionId, shouldBeInteractive);
    }
  }, [
    detailMode,
    onSetRunSessionInteractive,
    scheduledSessionInteractive,
    selectedRun?.sessionId,
    sessionSubMode,
  ]);

  useEffect(() => {
    if (!runSummaryTipOpen) {
      return;
    }

    const handlePointerDown = (event: MouseEvent) => {
      if (!runSummaryTipRef.current?.contains(event.target as Node)) {
        setRunSummaryTipOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setRunSummaryTipOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [runSummaryTipOpen]);

  const handleSelectRun = useCallback((runId: string | null) => {
    onSelectRun(runId);
    if (runId && detailMode === "overview") {
      setDetailMode("runs");
    }
  }, [detailMode, onSelectRun]);

  const overviewCopyText = useMemo(
    () => buildScheduledOverviewCopyText(
      task,
      machineTitle,
      createdAtLabel,
      createdBySessionTitle,
      createdBySessionFlavor,
      t,
    ),
    [task, machineTitle, createdAtLabel, createdBySessionTitle, createdBySessionFlavor, t],
  );

  const runsCopyText = useMemo(
    () => buildScheduledRunsCopyText(taskRuns, selectedRun, t),
    [taskRuns, selectedRun, t],
  );

  const detailCopyText = useMemo(
    () => buildScheduledDetailCopyText(overviewCopyText, runsCopyText),
    [overviewCopyText, runsCopyText],
  );

  const handleCopyDetails = useCallback(() => {
    void copy(detailCopyText);
  }, [copy, detailCopyText]);

  return (
    <div className="relative flex h-full min-h-0 min-w-0 w-full flex-1 flex-col overflow-x-hidden bg-[var(--app-bg)]">
      <ScheduledTaskHeader
        task={task}
        latestRun={latestRun}
        iconToneClass={scheduledTaskIconToneClassName}
        isEditing={isEditing}
        editState={editState}
        isPending={isPending}
        onEditStateChange={onEditStateChange}
        onSetEditing={onSetEditing}
        onTogglePaused={onTogglePaused}
        onCancelTask={onCancelTask}
        onDeleteTask={onDeleteTask}
        onUpdateTask={onUpdateTask}
      />

      <div className={`min-h-0 min-w-0 flex-1 overflow-x-hidden ${detailMode === "session" ? "overflow-y-hidden" : "overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"}`}>
        <div className={`mx-auto flex w-full min-w-0 max-w-content flex-col gap-4 px-3 py-3 ${detailMode === "session" ? "h-full min-h-0" : ""}`}>
          <div className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-bg)] px-4 py-3">
            <div className="flex min-w-0 items-center gap-3 overflow-hidden">
              <ToggleGroup
                value={detailMode}
                onValueChange={(value) => {
                  if (value === "session" && sessionModeDisabled) {
                    return;
                  }
                  setDetailMode(value as ScheduledDetailMode);
                }}
                aria-label={t("scheduled.detail.modeSwitcher")}
                className="min-w-0 shrink-0 rounded-xl"
              >
                <ToggleGroupItem value="overview" className="rounded-lg px-2.5 py-1.5">
                  {t("scheduled.detail.mode.overview")}
                </ToggleGroupItem>
                <ToggleGroupItem value="runs" className="rounded-lg px-2.5 py-1.5">
                  {t("scheduled.detail.mode.runs")}
                </ToggleGroupItem>
                <ToggleGroupItem
                  value="session"
                  className={`rounded-lg px-2.5 py-1.5 ${sessionModeDisabled ? "opacity-50 cursor-not-allowed" : ""}`}
                >
                  {t("scheduled.detail.mode.session")}
                </ToggleGroupItem>
              </ToggleGroup>

              {detailMode === "session" && !sessionModeDisabled ? (
                <ToggleGroup
                  value={sessionSubMode}
                  onValueChange={(value) => {
                    setSessionSubMode(value as ScheduledSessionSubMode);
                  }}
                  aria-label="Scheduled session mode"
                  className="min-w-0 shrink-0 overflow-hidden rounded-xl"
                >
                  <ToggleGroupItem value="view" className="rounded-lg px-2.5 py-1.5">
                    View
                  </ToggleGroupItem>
                  <ToggleGroupItem value="active" className="rounded-lg px-2.5 py-1.5">
                    Active
                  </ToggleGroupItem>
                </ToggleGroup>
              ) : null}

              <div className="min-w-0 flex-1 truncate text-right text-sm text-[var(--app-hint)] whitespace-nowrap">
                {detailMode === "overview"
                  ? t("scheduled.detail.mode.overviewHint")
                  : detailMode === "runs"
                    ? t("scheduled.detail.mode.runsHint")
                    : sessionModeDisabled
                      ? t("scheduled.detail.mode.sessionDisabled")
                      : t("scheduled.detail.mode.sessionHint")}
              </div>

              {(detailMode === "overview" || detailMode === "runs") ? (
                <button
                  type="button"
                  onClick={handleCopyDetails}
                  className="inline-flex min-w-0 shrink-0 items-center justify-center rounded-full border border-[var(--app-border)] bg-[var(--app-secondary-bg)] px-2.5 py-1.5 text-xs font-medium text-[var(--app-hint)] hover:bg-[var(--app-subtle-bg)] hover:text-[var(--app-fg)]"
                  title={copied ? t("scheduled.detail.copied") : t("scheduled.detail.copy")}
                  aria-label={copied ? t("scheduled.detail.copied") : t("scheduled.detail.copy")}
                >
                  {copied ? t("scheduled.detail.copied") : t("scheduled.detail.copy")}
                </button>
              ) : null}
            </div>
          </div>

          {detailMode === "overview" ? (
          <div className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-bg)] px-4 py-2">
            <div>
              <div>
                {[
                  {
                    key: "machine",
                    label: t("scheduled.detail.machine"),
                    value: machineTitle,
                  },
                  {
                    key: "agent-model",
                    label: `${t("scheduled.detail.agent")} / ${t("scheduled.detail.model")}`,
                    valueNode: (
                      <span className={configReadOnlyValueClassName}>
                        <span className="inline-flex max-w-full items-center justify-end gap-1.5 align-top">
                          <AgentFlavorStatusIcon
                            flavor={task.agentFlavor}
                            active
                            sizeClassName="h-3.5 w-3.5"
                          />
                          <span className="truncate">{`${task.agentFlavor} / ${task.model ?? "-"}`}</span>
                        </span>
                      </span>
                    ),
                  },
                  {
                    key: "prompt",
                    label: t("scheduled.detail.prompt"),
                    valueNode: (
                      <button
                        type="button"
                        onClick={() => setPromptExpanded((current) => !current)}
                        className="ml-auto flex max-w-full items-center justify-end gap-1 text-right text-sm leading-[19px] text-[var(--app-fg)]"
                        title={promptExpanded ? t("button.close") : t("chat.prompt.expand")}
                        aria-label={promptExpanded ? t("button.close") : t("chat.prompt.expand")}
                      >
                        {!promptExpanded ? (
                          <>
                            <span className="truncate">{task.prompt}</span>
                            <ChevronDownIcon
                              className="h-3 w-3 shrink-0 text-[var(--app-hint)] transition-transform"
                              aria-hidden="true"
                            />
                          </>
                        ) : (
                          <ChevronDownIcon
                            className="h-3 w-3 shrink-0 text-[var(--app-hint)] rotate-180 transition-transform"
                            aria-hidden="true"
                          />
                        )}
                      </button>
                    ),
                  },
                  {
                    key: "directory",
                    label: t("scheduled.detail.directory"),
                    value: task.targetDirectory,
                    multiline: true,
                  },
                  {
                    key: "permission",
                    label: t("scheduled.detail.permission"),
                    value: getScheduledSessionPermissionLabel(
                      task.scheduledSessionPermission,
                      t,
                    ),
                  },
                  {
                    key: "schedule-type",
                    label: t("scheduled.detail.scheduleType"),
                    value:
                      task.scheduleType === "cron"
                        ? t("scheduled.list.kind.cron")
                        : t("scheduled.list.kind.once"),
                  },
                  {
                    key: "schedule-detail",
                    label:
                      task.scheduleType === "cron"
                        ? t("scheduled.detail.cron")
                        : t("scheduled.detail.runAt"),
                    value:
                      task.scheduleType === "cron"
                        ? (task.scheduleSpec?.cron ?? "-")
                        : formatScheduledDateTime(task.scheduleSpec?.runAt),
                  },
                  {
                    key: "created",
                    label: t("scheduled.detail.created"),
                    value: createdAtLabel ?? "-",
                  },
                  {
                    key: "task-id",
                    label: t("scheduled.detail.taskId"),
                    value: task.id,
                  },
                  {
                    key: "created-by-session",
                    label: t("scheduled.detail.createdFromSession"),
                    valueNode: task.createdBySessionId ? (
                      <button
                        type="button"
                        onClick={() => onOpenCreatedBySession(task.createdBySessionId as string)}
                        className="ml-auto inline-flex max-w-full items-center justify-end gap-1.5 text-right text-sm leading-[19px] text-[var(--app-link)] underline decoration-[color:color-mix(in_srgb,var(--app-link)_65%,transparent)] underline-offset-2 hover:decoration-[color:var(--app-link)]"
                        title={task.createdBySessionId}
                      >
                        <AgentFlavorStatusIcon
                          flavor={createdBySessionFlavor}
                          active
                          sizeClassName="h-3.5 w-3.5"
                        />
                        <span className="block min-w-0 truncate">
                          {createdBySessionTitle ?? `SESSION ID ${task.createdBySessionId}`}
                        </span>
                      </button>
                    ) : (
                      <span className={configReadOnlyValueClassName}>
                        {t("scheduled.detail.createdFromSessionMissing")}
                      </span>
                    ),
                  },
                ].map((item, index) => (
                  <>
                    <div
                      key={`config-definition-${item.key}`}
                      className={`flex items-start justify-between gap-4 py-2 text-sm ${index > 0 ? "border-t border-dashed border-[color:color-mix(in_srgb,var(--app-divider)_55%,transparent)]" : ""}`}
                    >
                      <div className="shrink-0 text-xs uppercase tracking-[0.12em] text-[var(--app-hint)]">
                        {item.label}
                      </div>
                      <div
                        className={`${configValueSlotClassName} ${item.valueNode ? "" : "truncate"}`}
                      >
                        {item.valueNode ?? item.value}
                      </div>
                    </div>

                    {item.key === "prompt" && promptExpanded ? (
                      <div key="config-definition-prompt-expanded" className="pb-2 text-sm leading-6 text-[var(--app-fg)] whitespace-pre-wrap break-words">
                        {task.prompt}
                      </div>
                    ) : null}
                  </>
                ))}
              </div>
            </div>
          </div>
          ) : null}

          {detailMode === "runs" ? (
            <>
              <ScheduledRunsPager
                task={task}
                runs={taskRuns}
                selectedRunId={selectedRun?.id ?? null}
                onSelectRun={handleSelectRun}
              />

              <div className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-bg)] px-4 py-4">
                {!selectedRun ? (
                  <ScheduledRunsEmptyState
                    title={t("scheduled.detail.runsEmpty")}
                    description={t("scheduled.detail.pickRun")}
                    hint={`\"${t("scheduled.list.examplePrompt")}\"`}
                  />
                ) : (
                  <div>
                    {[
                      {
                        key: "run-status",
                        label: t("scheduled.detail.status"),
                        valueNode: (
                          <div className="flex items-center justify-end">
                            {selectedRun.resultSummary ? (
                              <div ref={runSummaryTipRef} className="relative">
                                <button
                                  type="button"
                                  onClick={() => setRunSummaryTipOpen((open) => !open)}
                                  className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium ${getScheduledRunStatusToneClassName(selectedRun.status)}`}
                                  aria-label={t("scheduled.detail.selectedRun")}
                                  aria-expanded={runSummaryTipOpen}
                                >
                                  <span>{t(`scheduled.runStatus.${selectedRun.status}`)}</span>
                                  <span className="inline-flex h-3 w-3 items-center justify-center rounded-full border border-current text-[7px] leading-none opacity-80">
                                    !
                                  </span>
                                </button>
                                {runSummaryTipOpen ? (
                                  <div className="absolute right-0 top-[calc(100%+8px)] z-20 w-64 rounded-2xl border border-[var(--app-border)] bg-[var(--app-bg)] p-3 text-left text-sm leading-6 text-[var(--app-fg)] whitespace-normal break-words shadow-[0_18px_48px_rgba(15,23,42,0.14)]">
                                    {getScheduledRunResultSummaryLabel(selectedRun.resultSummary, t)}
                                  </div>
                                ) : null}
                              </div>
                            ) : (
                              <ScheduledRunStatusBadge status={selectedRun.status} />
                            )}
                          </div>
                        ),
                      },
                      {
                        key: "triggered",
                        label: t("scheduled.detail.triggered"),
                        value: formatScheduledDateTime(selectedRun.triggeredAt),
                      },
                      {
                        key: "run-id",
                        label: t("scheduled.detail.runId"),
                        value: selectedRun.id,
                      },
                      {
                        key: "finished",
                        label: t("scheduled.detail.finished"),
                        value: formatScheduledDateTime(selectedRun.finishedAt),
                      },
                      {
                        key: "session",
                        label: t("scheduled.detail.session"),
                        value: selectedRun.sessionId ?? "-",
                      },
                      ...(selectedRun.error
                        ? [{
                            key: "run-error",
                            label: "Error",
                            value: selectedRun.error,
                            toneClassName: getScheduledRunStatusToneClassName(selectedRun.status),
                          }]
                        : []),
                    ].map((item, index) => (
                      <div
                        key={item.key}
                        className={`flex items-start justify-between gap-4 py-2 text-sm ${index > 0 ? "border-t border-dashed border-[color:color-mix(in_srgb,var(--app-divider)_55%,transparent)]" : ""} ${item.key === "run-status" && runSummaryTipOpen ? "relative z-10 overflow-visible" : ""}`}
                      >
                        <div className="shrink-0 text-xs uppercase tracking-[0.12em] text-[var(--app-hint)]">
                          {item.label}
                        </div>
                        <div
                          className={`${configValueSlotClassName} ${"multiline" in item && item.multiline ? "whitespace-pre-wrap break-words" : "truncate"} ${item.toneClassName ? `rounded-xl px-3 py-2 ${item.toneClassName}` : ""} ${item.key === "run-status" && runSummaryTipOpen ? "overflow-visible" : ""}`}
                        >
                          {item.valueNode ?? item.value}
                        </div>
                      </div>
                    ))}

                    {selectedRun.taskOutcome ? (
                      <div className="space-y-0 pt-2">
                        {(() => {
                          const taskOutcome = selectedRun.taskOutcome;
                          return (
                            <>
                        <div className="border-t border-dashed border-[color:color-mix(in_srgb,var(--app-divider)_55%,transparent)]" />
                        {[
                          {
                            key: "outcome-status",
                            label: t("scheduled.detail.outcomeStatus"),
                            valueNode: (
                              <span
                                className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-medium ${getScheduledTaskOutcomeToneClassName(taskOutcome.status)}`}
                              >
                                {getScheduledTaskOutcomeStatusLabel(
                                  taskOutcome.status,
                                  t,
                                )}
                              </span>
                            ),
                          },
                          {
                            key: "outcome-summary",
                            label: t("scheduled.detail.outcome"),
                            multiline: true,
                            valueNode: (
                              <button
                                type="button"
                                onClick={() => setOutcomeExpanded((current) => !current)}
                                className="ml-auto flex max-w-full items-center justify-end gap-1 text-right text-sm leading-[19px] text-[var(--app-fg)]"
                                title={outcomeExpanded ? t("button.close") : t("chat.prompt.expand")}
                                aria-label={outcomeExpanded ? t("button.close") : t("chat.prompt.expand")}
                              >
                                {!outcomeExpanded ? (
                                  <>
                                    <span className="truncate">{taskOutcome.summary}</span>
                                    <ChevronDownIcon
                                      className="h-3 w-3 shrink-0 text-[var(--app-hint)] transition-transform"
                                      aria-hidden="true"
                                    />
                                  </>
                                ) : (
                                  <ChevronDownIcon
                                    className="h-3 w-3 shrink-0 rotate-180 text-[var(--app-hint)] transition-transform"
                                    aria-hidden="true"
                                  />
                                )}
                              </button>
                            ),
                          },
                          {
                            key: "outcome-reported-at",
                            label: t("scheduled.detail.outcomeReportedAt"),
                            value: formatScheduledDateTime(taskOutcome.reportedAt),
                          },
                          {
                            key: "needs-user-intervention",
                            label: t("scheduled.detail.needsUserIntervention"),
                            value: taskOutcome.needsUserIntervention
                              ? t("common.yes")
                              : t("common.no"),
                          },
                          {
                            key: "permanent-failure-likely",
                            label: t("scheduled.detail.permanentFailureLikely"),
                            value: taskOutcome.permanentFailureLikely
                              ? t("common.yes")
                              : t("common.no"),
                          },
                        ].map((item) => (
                          <>
                            <div
                              key={item.key}
                              className="flex items-start justify-between gap-4 border-t border-dashed border-[color:color-mix(in_srgb,var(--app-divider)_55%,transparent)] py-2 text-sm"
                            >
                              <div className="shrink-0 text-xs uppercase tracking-[0.12em] text-[var(--app-hint)]">
                                {item.label}
                              </div>
                              <div
                                className={`${configValueSlotClassName} ${item.multiline ? "whitespace-pre-wrap break-words" : "truncate"}`}
                              >
                                {item.valueNode ?? item.value}
                              </div>
                            </div>

                            {item.key === "outcome-summary" && outcomeExpanded ? (
                              <div key="outcome-summary-expanded" className="pb-2 text-sm leading-6 text-[var(--app-fg)] whitespace-pre-wrap break-words">
                                {taskOutcome.summary}
                              </div>
                            ) : null}
                          </>
                        ))}
                            </>
                          );
                        })()}
                      </div>
                    ) : null}
                  </div>
                )}
              </div>
            </>
          ) : null}

          {detailMode === "session" ? (
            <div className="min-h-0 flex flex-1 flex-col overflow-hidden rounded-2xl border border-[var(--app-border)] bg-[var(--app-bg)]">
              {!selectedRun?.sessionId ? (
                <div className="px-4 py-6 text-sm text-[var(--app-hint)]">
                  {t("scheduled.detail.mode.sessionDisabled")}
                </div>
              ) : (
                <>
                  <div className="min-h-0 min-w-0 flex-1 bg-[var(--app-bg)]">
                    <EmbeddedSessionView
                      sessionId={selectedRun.sessionId as string}
                      onBack={() => handleSelectRun(null)}
                      headerTitleOverride={`SESSION ID ${selectedRun.sessionId}`}
                      headerTitleClassName="text-xs font-medium text-[var(--app-hint)]"
                      headerHideQuickNewButton
                      headerHideWidescreenButton
                      headerHideSubtitleRow
                      streamOnly={!scheduledSessionInteractive}
                      initialScrollAnchor="top"
                    />
                  </div>
                </>
              )}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function matchesSessionSearch(
  session: SessionSummary,
  search: string,
): boolean {
  if (!search) {
    return true;
  }

  const haystack = [
    getSessionTitle(session),
    session.metadata?.summary?.text,
    session.metadata?.path,
    session.metadata?.host,
    session.metadata?.flavor,
  ]
    .filter(Boolean)
    .join("\n")
    .toLowerCase();

  return haystack.includes(search);
}

function getSessionInitial(title: string): string {
  const firstChar = Array.from(title.trim())[0];
  return firstChar ? firstChar.toUpperCase() : "N";
}

function CollapsedSessionItem({
  session,
  selected,
  api,
  onSelect,
  menuEnabled,
}: {
  session: SessionSummary;
  selected: boolean;
  api: ReturnType<typeof useAppContext>["api"];
  onSelect: (sessionId: string) => void;
  menuEnabled: boolean;
}) {
  const { t } = useTranslation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuAnchorPoint, setMenuAnchorPoint] = useState({ x: 0, y: 0 });
  const [renameOpen, setRenameOpen] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [isArchiving, setIsArchiving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const sessionName =
    useSessionTitleOverride(session.id) ?? getSessionTitle(session);
  const sessionInitial = getSessionInitial(sessionName);

  const { archiveSession, renameSession, deleteSession, isPending } =
    useSessionActions(api, session.id, session.metadata?.flavor ?? null);

  const skipArchiveConfirm = (() => {
    try {
      return localStorage.getItem("hapi:skip-confirm:archive") === "1";
    } catch {
      return false;
    }
  })();
  const skipDeleteConfirm = (() => {
    try {
      return localStorage.getItem("hapi:skip-confirm:delete") === "1";
    } catch {
      return false;
    }
  })();

  useEffect(() => {
    if (!session.active) {
      setIsArchiving(false);
    }
  }, [session.active]);

  const runArchive = useCallback(() => {
    if (isArchiving) {
      return;
    }
    setIsArchiving(true);
    void archiveSession().catch(() => {
      setIsArchiving(false);
    });
  }, [archiveSession, isArchiving]);

  const runDelete = useCallback(async () => {
    if (isDeleting) {
      return;
    }
    setIsDeleting(true);
    try {
      await deleteSession();
    } catch (error) {
      setIsDeleting(false);
      throw error;
    }
  }, [deleteSession, isDeleting]);

  const longPressHandlers = useLongPress({
    onLongPress: (point) => {
      if (!menuEnabled) {
        return;
      }
      setMenuAnchorPoint(point);
      setMenuOpen(true);
    },
    onClick: () => {
      onSelect(session.id);
    },
    threshold: 500,
    disabled: !menuEnabled,
  });

  return (
    <>
      <button
        type="button"
        {...longPressHandlers}
        className={`flex items-center justify-center w-full py-1 px-1 transition-colors hover:bg-[var(--app-subtle-bg)] ${selected ? "bg-[var(--app-secondary-bg)]" : ""}`}
        title={sessionName}
      >
        <span
          className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[14px] font-medium leading-none select-none ${
            session.active && session.thinking
              ? "bg-[var(--app-orange-base)] text-white"
              : session.active
                ? "bg-[var(--app-subtle-bg)] text-emerald-500"
                : "bg-[var(--app-subtle-bg)] text-[var(--app-hint)]"
          }`}
        >
          {sessionInitial}
        </span>
      </button>

      <SessionActionMenu
        isOpen={menuEnabled && menuOpen}
        onClose={() => setMenuOpen(false)}
        sessionActive={session.active}
        onRename={() => setRenameOpen(true)}
        onArchive={() =>
          skipArchiveConfirm ? runArchive() : setArchiveOpen(true)
        }
        onDelete={() =>
          skipDeleteConfirm
            ? void runDelete().catch(() => {})
            : setDeleteOpen(true)
        }
        anchorPoint={menuAnchorPoint}
      />

      <RenameSessionDialog
        isOpen={renameOpen}
        onClose={() => setRenameOpen(false)}
        currentName={sessionName}
        onRename={renameSession}
        isPending={isPending}
      />

      <ConfirmDialog
        isOpen={archiveOpen}
        onClose={() => setArchiveOpen(false)}
        title={t("dialog.archive.title")}
        description={t("dialog.archive.description", { name: sessionName })}
        confirmLabel={t("dialog.archive.confirm")}
        confirmingLabel={t("dialog.archive.confirming")}
        onConfirm={runArchive}
        isPending={isPending}
        destructive
        dontAskAgainKey="hapi:skip-confirm:archive"
      />

      <ConfirmDialog
        isOpen={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        title={t("dialog.delete.title")}
        description={t("dialog.delete.description", { name: sessionName })}
        confirmLabel={t("dialog.delete.confirm")}
        confirmingLabel={t("dialog.delete.confirming")}
        onConfirm={runDelete}
        isPending={isPending}
        destructive
        dontAskAgainKey="hapi:skip-confirm:delete"
      />
    </>
  );
}

function CollapsedScheduledItem(props: {
  task: ScheduledTask;
  selected: boolean;
  latestRun: ScheduledTaskRun | undefined;
  isPending: boolean;
  onSelect: (taskId: string, runId?: string | null) => void;
  onTogglePaused: () => void;
  onCancelTask: () => void;
  onDeleteTask: () => void;
}) {
  const { t } = useTranslation();
  const { haptic } = usePlatform();
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuAnchorPoint, setMenuAnchorPoint] = useState({ x: 0, y: 0 });
  const title = props.task.title.trim();
  const initial = getSessionInitial(title || "S");
  const pauseLocked = isScheduledTaskPauseLocked(props.task);
  const toneClass = props.task.paused
    ? "bg-amber-500/15 text-amber-600"
    : pauseLocked
      ? "bg-slate-500/15 text-slate-500"
    : props.latestRun?.status === "failed"
        ? "bg-red-500/15 text-red-600"
        : props.latestRun?.status === "succeeded"
          ? "bg-emerald-500/15 text-emerald-600"
          : "bg-[var(--app-subtle-bg)] text-[var(--app-hint)]";

  const longPressHandlers = useLongPress({
    onLongPress: (point) => {
      haptic.impact("medium");
      setMenuAnchorPoint(point);
      setMenuOpen(true);
    },
    onClick: () => {
      if (!menuOpen) {
        props.onSelect(props.task.id, props.latestRun?.id ?? null);
      }
    },
    threshold: 500,
    disabled: props.isPending,
  });

  return (
    <>
      <button
        type="button"
        {...longPressHandlers}
        className={`flex w-full items-center justify-center px-1 py-1 hover:bg-[var(--app-subtle-bg)] ${props.selected ? "bg-[var(--app-secondary-bg)]" : ""}`}
        title={title}
      >
        <span
          className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[14px] font-medium leading-none select-none ${toneClass}`}
        >
          {initial}
        </span>
      </button>

      <ScheduledTaskActionMenu
        isOpen={menuOpen}
        onClose={() => setMenuOpen(false)}
        paused={Boolean(props.task.paused)}
        canTogglePaused={!pauseLocked && !props.isPending}
        togglePausedTitle={props.task.paused
          ? (getScheduledResumeValidationMessage(props.task, t) ?? t("scheduled.action.resume"))
          : (getScheduledPauseValidationMessage(props.task, t) ?? t("scheduled.action.pause"))}
        canCancel={props.task.phase !== "archived" && !props.isPending}
        onTogglePaused={props.onTogglePaused}
        onCancel={props.onCancelTask}
        onDelete={props.onDeleteTask}
        anchorPoint={menuAnchorPoint}
      />
    </>
  );
}

function SessionsPage() {
  const { api } = useAppContext();
  const navigate = useNavigate();
  const workspace = useWorkspaceState();
  const { t } = useTranslation();
  const { addToast } = useToast();
  const { isDark, toggleTheme } = useTheme();
  const { sessions, isLoading, error, refetch } = useSessions(api);
  const { machines } = useMachines(api, true);
  const {
    tasks: scheduledTasks,
    runs: scheduledRuns,
    isLoading: scheduledLoading,
    error: scheduledError,
  } = useScheduledTasks(api);
  const {
    archiveScheduledTask,
    deleteScheduledTask,
    updateScheduledTask,
    isPending: scheduledPending,
  } = useScheduledTaskActions(api);

  const [filterOnlineOnly, setFilterOnlineOnly] = useState(() => {
    try {
      return localStorage.getItem("hapi:filter:onlineOnly") === "1";
    } catch {
      return false;
    }
  });
  const [sessionSearch, setSessionSearch] = useState("");
  const [scheduledSearch, setScheduledSearch] = useState("");
  const [selectedScheduledTaskId, setSelectedScheduledTaskId] = useState<
    string | null
  >(null);
  const [selectedScheduledRunId, setSelectedScheduledRunId] = useState<
    string | null
  >(null);
  const [scheduledInteractiveSessionId, setScheduledInteractiveSessionId] =
    useState<string | null>(null);
  const lastScheduledTaskIdRef = useRef<string | null>(null);
  const [scheduledDeleteTarget, setScheduledDeleteTarget] = useState<
    ScheduledTask | null
  >(null);
  const [scheduledEditing, setScheduledEditing] = useState(false);
  const [scheduledEditState, setScheduledEditState] =
    useState<ScheduledTitleEditState | null>(null);
  const [newSessionMachineId, setNewSessionMachineId] = useState<string | null>(
    null,
  );
  const [newSessionInitialPrompt, setNewSessionInitialPrompt] = useState("");
  const [scheduledGroupCollapseOverrides, setScheduledGroupCollapseOverrides] =
    useState<Map<string, boolean>>(() => {
      const stored = readStorageJson<[string, boolean][]>(
        "session",
        "hapi:panel:scheduled-group-collapsed",
      );
      if (stored) return new Map(stored);
      return new Map();
    });

  const toggleFilterOnline = useCallback(() => {
    setFilterOnlineOnly((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("hapi:filter:onlineOnly", next ? "1" : "0");
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  const normalizedSessionSearch = sessionSearch.trim().toLowerCase();
  const hasSessionSearch = sessionSearch.length > 0;
  const hasAnySessions = sessions.length > 0;
  const showSessionsEmptyState =
    !isLoading &&
    !error &&
    !normalizedSessionSearch &&
    !filterOnlineOnly &&
    !hasAnySessions;

  const displaySessions = useMemo(() => {
    return sessions.filter((session) => {
      if (filterOnlineOnly && !session.active) {
        return false;
      }
      return matchesSessionSearch(session, normalizedSessionSearch);
    });
  }, [filterOnlineOnly, normalizedSessionSearch, sessions]);

  const collapsedGroups = useMemo(
    () => groupSessionsByHost(displaySessions),
    [displaySessions],
  );

  const handleRefresh = useCallback(() => {
    void refetch();
  }, [refetch]);

  const normalizedScheduledSearch = scheduledSearch.trim().toLowerCase();
  const filteredScheduledTasks = useMemo(() => {
    if (!normalizedScheduledSearch) {
      return scheduledTasks;
    }
    return scheduledTasks.filter((task) => {
      const haystack = [
        task.title,
        task.prompt,
        task.targetDirectory,
        task.agentFlavor,
        task.model,
        task.scheduleSpec?.cron,
        task.machineId,
      ]
        .filter(Boolean)
        .join("\n")
        .toLowerCase();
      return haystack.includes(normalizedScheduledSearch);
    });
  }, [normalizedScheduledSearch, scheduledTasks]);

  const scheduledGroups = useMemo(
    () => groupTasksByMachine(filteredScheduledTasks, machines),
    [filteredScheduledTasks, machines],
  );

  const selectedScheduledTask = useMemo(
    () =>
      filteredScheduledTasks.find(
        (task) => task.id === selectedScheduledTaskId,
      ) ?? null,
    [filteredScheduledTasks, selectedScheduledTaskId],
  );
  const selectedScheduledMachineTitle = useMemo(() => {
    if (!selectedScheduledTask) {
      return "Unknown machine";
    }
    const machine = machines.find(
      (entry) => entry.id === selectedScheduledTask.machineId,
    );
    return getMachineTitle(machine ?? null);
  }, [machines, selectedScheduledTask]);
  const selectedScheduledCreatedBySessionTitle = useMemo(() => {
    if (!selectedScheduledTask?.createdBySessionId) {
      return null;
    }
    const sourceSession = sessions.find(
      (session) => session.id === selectedScheduledTask.createdBySessionId,
    );
    return sourceSession ? getSessionTitle(sourceSession) : null;
  }, [selectedScheduledTask, sessions]);
  const selectedScheduledCreatedBySessionFlavor = useMemo(() => {
    if (!selectedScheduledTask?.createdBySessionId) {
      return null;
    }
    const sourceSession = sessions.find(
      (session) => session.id === selectedScheduledTask.createdBySessionId,
    );
    return sourceSession?.metadata?.flavor ?? null;
  }, [selectedScheduledTask, sessions]);

  const scheduledRunsByTaskId = useMemo(() => {
    const map = new Map<string, ScheduledTaskRun[]>();
    for (const run of scheduledRuns) {
      if (!map.has(run.taskId)) {
        map.set(run.taskId, []);
      }
      map.get(run.taskId)?.push(run);
    }
    for (const taskRuns of map.values()) {
      taskRuns.sort((left, right) => (right.triggeredAt ?? right.scheduledFor) - (left.triggeredAt ?? left.scheduledFor));
    }
    return map;
  }, [scheduledRuns]);

  const selectedScheduledTaskRuns = useMemo(
    () =>
      selectedScheduledTask
        ? (scheduledRunsByTaskId.get(selectedScheduledTask.id) ?? [])
        : [],
    [scheduledRunsByTaskId, selectedScheduledTask],
  );

  const selectedScheduledRun = useMemo(
    () =>
      selectedScheduledTaskRuns.find(
        (run) => run.id === selectedScheduledRunId,
      ) ?? null,
    [selectedScheduledRunId, selectedScheduledTaskRuns],
  );

  const latestScheduledRunByTaskId = useMemo(() => {
    const map = new Map<string, ScheduledTaskRun>();
    for (const run of scheduledRuns) {
      const existing = map.get(run.taskId);
      if (!existing || (run.triggeredAt ?? run.scheduledFor) > (existing.triggeredAt ?? existing.scheduledFor)) {
        map.set(run.taskId, run);
      }
    }
    return map;
  }, [scheduledRuns]);

  const isScheduledGroupCollapsed = (group: MachineTaskGroup): boolean => {
    const override = scheduledGroupCollapseOverrides.get(group.machineId);
    if (override !== undefined) return override;
    return false;
  };

  const toggleScheduledGroup = useCallback(
    (machineId: string, isCollapsed: boolean) => {
      setScheduledGroupCollapseOverrides((prev) => {
        const next = new Map(prev);
        next.set(machineId, !isCollapsed);
        writeStorageJson(
          "session",
          "hapi:panel:scheduled-group-collapsed",
          [...next.entries()],
        );
        return next;
      });
    },
    [],
  );

  const scheduledZebraTaskIds = useMemo(() => {
    const ids = new Set<string>();
    let visibleIndex = 0;

    for (const group of scheduledGroups) {
      const collapsed = isScheduledGroupCollapsed(group);
      if (collapsed) continue;

      for (const task of group.tasks) {
        if (visibleIndex % 2 === 1) {
          ids.add(task.id);
        }
        visibleIndex += 1;
      }
    }

    return ids;
  }, [scheduledGroupCollapseOverrides, scheduledGroups]);

  useEffect(() => {
    if (scheduledGroups.length === 0) return;
    setScheduledGroupCollapseOverrides((prev) => {
      if (prev.size === 0) return prev;
      const next = new Map(prev);
      const knownGroups = new Set(
        scheduledGroups.map((group) => group.machineId),
      );
      let changed = false;
      for (const machineId of next.keys()) {
        if (!knownGroups.has(machineId)) {
          next.delete(machineId);
          changed = true;
        }
      }
      if (changed) {
        writeStorageJson(
          "session",
          "hapi:panel:scheduled-group-collapsed",
          [...next.entries()],
        );
      }
      return changed ? next : prev;
    });
  }, [scheduledGroups]);

  useEffect(() => {
    if (selectedScheduledTaskRuns.length === 0) {
      setSelectedScheduledRunId(null);
      setScheduledInteractiveSessionId(null);
      lastScheduledTaskIdRef.current = selectedScheduledTaskId;
      return;
    }

    const taskChanged = lastScheduledTaskIdRef.current !== selectedScheduledTaskId;
    lastScheduledTaskIdRef.current = selectedScheduledTaskId;

    if (taskChanged || !selectedScheduledRunId) {
      setSelectedScheduledRunId(selectedScheduledTaskRuns[0]?.id ?? null);
      return;
    }

    const exists = selectedScheduledTaskRuns.some(
      (run) => run.id === selectedScheduledRunId,
    );
    if (!exists) {
      setSelectedScheduledRunId((current) => current ?? selectedScheduledTaskRuns[0]?.id ?? null);
    }
  }, [selectedScheduledRunId, selectedScheduledTaskId, selectedScheduledTaskRuns]);

  useEffect(() => {
    if (!scheduledInteractiveSessionId) {
      return;
    }

    const exists = selectedScheduledTaskRuns.some(
      (run) => run.sessionId === scheduledInteractiveSessionId,
    );

    if (!exists) {
      setScheduledInteractiveSessionId(null);
    }
  }, [scheduledInteractiveSessionId, selectedScheduledTaskRuns]);

  useEffect(() => {
    if (selectedScheduledTaskId && workspace.tab === "scheduled") {
      openWorkspaceScheduledTask(
        selectedScheduledTaskId,
        selectedScheduledRunId,
      );
    }
  }, [selectedScheduledRunId, selectedScheduledTaskId, workspace.tab]);

  useEffect(() => {
    if (!selectedScheduledTask) {
      setScheduledEditState(null);
      setScheduledEditing(false);
      return;
    }
    if (!scheduledEditing) {
      setScheduledEditState(buildScheduledTitleEditState(selectedScheduledTask));
    }
  }, [scheduledEditing, selectedScheduledTask]);

  const selectedSessionId = workspace.selectedSessionId;

  // Panel resize state (persisted to localStorage)
  const [panelWidth, setPanelWidth] = useState(() => {
    const stored = readStorageItem("session", "hapi:panel:leftWidth");
    return stored ? Math.max(DESKTOP_SIDEBAR_MIN_WIDTH, Number(stored)) : 420;
  });

  const [collapsed, setCollapsed] = useState(() => {
    return readStorageItem("session", "hapi:panel:collapsed") === "true";
  });

  const { widescreen } = useWidescreen();
  const [settingsOpen, setSettingsOpen] = useState(
    workspace.overlay === "settings",
  );
  const [newSessionOpen, setNewSessionOpen] = useState(
    workspace.overlay === "newSession",
  );
  const hasOverlay =
    settingsOpen || (workspace.tab === "sessions" && newSessionOpen);
  const [narrowViewport, setNarrowViewport] = useState(() =>
    typeof window !== "undefined"
      ? window.innerWidth < SWIPE_NARROW_BREAKPOINT_PX
      : false,
  );
  const restoreNewSessionAfterSettingsRef = useRef(false);
  const [swipeForwardSessionId, setSwipeForwardSessionId] = useState<
    string | null
  >(null);
  const wheelBackDirectionRef = useRef<SwipeDirection>(0);
  const wheelGestureRef = useRef<{
    accumX: number;
    accumY: number;
    eventCount: number;
    lastTs: number;
    action: SwipeAction | null;
    ready: boolean;
    wasReady: boolean;
    cancelled: boolean;
    direction: SwipeDirection;
    releaseTimer: ReturnType<typeof window.setTimeout> | null;
    releaseArmed: boolean;
    blocked: boolean;
    unlockTimer: ReturnType<typeof window.setTimeout> | null;
  }>({
    accumX: 0,
    accumY: 0,
    eventCount: 0,
    lastTs: 0,
    action: null,
    ready: false,
    wasReady: false,
    cancelled: false,
    direction: 0,
    releaseTimer: null,
    releaseArmed: false,
    blocked: false,
    unlockTimer: null,
  });
  const swipeCapabilityRef = useRef<{
    canBack: boolean;
    canForward: boolean;
    activeSessionId: string | null;
    backTarget: "session" | "scheduled" | "newSession" | null;
    forwardSessionId: string | null;
  }>({
    canBack: false,
    canForward: false,
    activeSessionId: null,
    backTarget: null,
    forwardSessionId: null,
  });

  // Batch mode state
  const queryClient = useQueryClient();
  const [batchMode, setBatchMode] = useState<"archive" | "delete" | null>(null);
  const [batchSelectedIds, setBatchSelectedIds] = useState<Set<string>>(
    new Set(),
  );
  const [batchArchivingIds, setBatchArchivingIds] = useState<Set<string>>(
    new Set(),
  );
  const [batchDeletingIds, setBatchDeletingIds] = useState<Set<string>>(
    new Set(),
  );
  const [batchConfirmOpen, setBatchConfirmOpen] = useState(false);
  const [batchPending, setBatchPending] = useState(false);
  const [toolbarMenuOpen, setToolbarMenuOpen] = useState(false);

  const handleEnterBatchMode = useCallback((mode: "archive" | "delete") => {
    setBatchMode(mode);
    setBatchSelectedIds(new Set());
    setSettingsOpen(false);
    setNewSessionOpen(false);
    selectWorkspaceOverlay("none");
    setToolbarMenuOpen(false);
  }, []);

  const handleExitBatchMode = useCallback(() => {
    setBatchMode(null);
    setBatchSelectedIds(new Set());
    setBatchConfirmOpen(false);
  }, []);

  const handleBatchToggleSelect = useCallback((sessionId: string) => {
    setBatchSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(sessionId)) {
        next.delete(sessionId);
      } else {
        next.add(sessionId);
      }
      return next;
    });
  }, []);

  const batchFilteredIds = useMemo(() => {
    if (!batchMode) return new Set<string>();
    return new Set(
      displaySessions
        .filter((s) => (batchMode === "archive" ? s.active : !s.active))
        .map((s) => s.id),
    );
  }, [displaySessions, batchMode]);

  const visibleArchivableCount = useMemo(
    () => displaySessions.filter((session) => session.active).length,
    [displaySessions],
  );
  const visibleDeletableCount = useMemo(
    () => displaySessions.filter((session) => !session.active).length,
    [displaySessions],
  );

  useEffect(() => {
    setBatchArchivingIds((prev) => {
      if (prev.size === 0) {
        return prev;
      }
      const activeIds = new Set(
        sessions
          .filter((session) => session.active)
          .map((session) => session.id),
      );
      let changed = false;
      const next = new Set<string>();
      for (const id of prev) {
        if (activeIds.has(id)) {
          next.add(id);
        } else {
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [sessions]);

  useEffect(() => {
    setBatchDeletingIds((prev) => {
      if (prev.size === 0) {
        return prev;
      }
      const existingIds = new Set(sessions.map((session) => session.id));
      let changed = false;
      const next = new Set<string>();
      for (const id of prev) {
        if (existingIds.has(id)) {
          next.add(id);
        } else {
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [sessions]);

  const handleBatchSelectAll = useCallback(() => {
    setBatchSelectedIds(new Set(batchFilteredIds));
  }, [batchFilteredIds]);

  useEffect(() => {
    if (!batchMode) {
      return;
    }

    setBatchSelectedIds((prev) => {
      let changed = false;
      const next = new Set<string>();
      for (const id of prev) {
        if (batchFilteredIds.has(id)) {
          next.add(id);
        } else {
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [batchFilteredIds, batchMode]);

  // Session keep-alive state
  const [activeSessionId, setActiveSessionId] = useState<string | null>(
    selectedSessionId,
  );
  const [mountedSessions, setMountedSessions] = useState<string[]>(
    selectedSessionId ? [selectedSessionId] : [],
  );
  const { session: activeSession } = useSession(api, activeSessionId);
  const [quickNewSessionPending, setQuickNewSessionPending] = useState(false);
  const activeSessionRef = useRef(activeSessionId);
  activeSessionRef.current = activeSessionId;

  useEffect(() => {
    if (typeof window === "undefined") return;
    const update = () => {
      setNarrowViewport(window.innerWidth < SWIPE_NARROW_BREAKPOINT_PX);
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  useEffect(() => {
    if (scheduledGroups.length === 0) {
      setSelectedScheduledTaskId(null);
      return;
    }
    const exists = scheduledGroups.some((group) =>
      group.tasks.some((task) => task.id === selectedScheduledTaskId),
    );
    if (!exists) {
      const fallbackTaskId =
        workspace.selectedScheduledTaskId &&
        scheduledGroups.some((group) =>
          group.tasks.some(
            (task) => task.id === workspace.selectedScheduledTaskId,
          ),
        )
          ? workspace.selectedScheduledTaskId
          : narrowViewport
            ? null
            : (scheduledGroups[0]?.tasks[0]?.id ?? null);
      setSelectedScheduledTaskId(fallbackTaskId);
    }
  }, [
    narrowViewport,
    scheduledGroups,
    selectedScheduledTaskId,
    workspace.selectedScheduledTaskId,
  ]);

  // Close toolbar menu on Escape
  useEffect(() => {
    if (!toolbarMenuOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setToolbarMenuOpen(false);
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [toolbarMenuOpen]);

  // Sync URL → state for browser back/forward
  useEffect(() => {
    if (selectedSessionId !== activeSessionRef.current) {
      if (selectedSessionId) {
        openWorkspaceSession(selectedSessionId, workspace.sessionSubview);
        setActiveSessionId(selectedSessionId);
        setMountedSessions((prev) => {
          const filtered = prev.filter((id) => id !== selectedSessionId);
          const next = [...filtered, selectedSessionId];
          return next.length > MAX_CACHED_SESSIONS
            ? next.slice(-MAX_CACHED_SESSIONS)
            : next;
        });
      } else {
        setActiveSessionId(null);
      }
    }
  }, [selectedSessionId, workspace.sessionSubview]);

  useEffect(() => {
    if (!swipeForwardSessionId) return;
    const exists = sessions.some(
      (session) => session.id === swipeForwardSessionId,
    );
    if (!exists) {
      setSwipeForwardSessionId(null);
    }
  }, [sessions, swipeForwardSessionId]);

  const openSession = useCallback(
    (sessionId: string, options?: { preserveForward?: boolean }) => {
      if (!options?.preserveForward) {
        setSwipeForwardSessionId(null);
      }
      openWorkspaceSession(sessionId, "chat");
      setActiveSessionId(sessionId);
      setMountedSessions((prev) => {
        const filtered = prev.filter((id) => id !== sessionId);
        const next = [...filtered, sessionId];
        return next.length > MAX_CACHED_SESSIONS
          ? next.slice(-MAX_CACHED_SESSIONS)
          : next;
      });
      setSettingsOpen(false);
      setNewSessionOpen(false);
    },
    [navigate],
  );

  const handleSelectSession = useCallback(
    (sessionId: string) => {
      openWorkspaceSession(sessionId, "chat");
      openSession(sessionId);
    },
    [openSession],
  );

  const handleSessionBack = useCallback(() => {
    if (activeSessionRef.current) {
      setSwipeForwardSessionId(activeSessionRef.current);
    }
    clearWorkspaceSessionSelection();
    selectWorkspaceTab("sessions");
    setActiveSessionId(null);
    navigate({ to: "/" });
  }, [navigate]);

  const handleSessionDeleted = useCallback(
    (deletedId: string) => {
      setMountedSessions((prev) => prev.filter((id) => id !== deletedId));
      setSwipeForwardSessionId((prev) => (prev === deletedId ? null : prev));
      if (activeSessionRef.current === deletedId) {
        setActiveSessionId(null);
        navigate({ to: "/" });
      }
    },
    [navigate],
  );

  const handleQuickNewSession = useCallback(async () => {
    if (!api || !activeSession || quickNewSessionPending) {
      return;
    }

    const machineId = activeSession.metadata?.machineId?.trim();
    const directory = activeSession.metadata?.path?.trim();
    if (!machineId || !directory) {
      addToast({
        title: t("sessions.quickNew.failedTitle"),
        body: t("sessions.quickNew.unavailable"),
        sessionId: activeSession.id,
        url: `/sessions/${activeSession.id}`,
      });
      return;
    }

    const permissionMode = activeSession.permissionMode ?? "default";
    const basePermissionMode =
      activeSession.basePermissionMode ??
      (permissionMode === "plan" ? "default" : permissionMode);
    const spawnSessionType = activeSession.metadata?.worktree
      ? "worktree"
      : "simple";
    const worktreeName =
      spawnSessionType === "worktree"
        ? activeSession.metadata?.worktree?.name?.trim() || undefined
        : undefined;
    const model = activeSession.metadata?.model?.trim() || undefined;

    setQuickNewSessionPending(true);
    try {
      const result = await api.spawnSession(
        machineId,
        directory,
        resolveSpawnAgent(activeSession.metadata?.flavor),
        model,
        activeSession.metadata?.reasoningEffort,
        permissionMode,
        basePermissionMode,
        spawnSessionType,
        worktreeName,
      );

      if (result.type !== "success") {
        throw new Error(result.message);
      }

      if (permissionMode !== "default") {
        setPendingSessionMode(result.sessionId, {
          permissionMode,
          basePermissionMode,
        });
      }

      void queryClient.invalidateQueries({ queryKey: queryKeys.sessions });
      handleSelectSession(result.sessionId);
    } catch (error) {
      const message =
        error instanceof Error && error.message
          ? error.message
          : t("dialog.error.default");
      addToast({
        title: t("sessions.quickNew.failedTitle"),
        body: message,
        sessionId: activeSession.id,
        url: `/sessions/${activeSession.id}`,
      });
    } finally {
      setQuickNewSessionPending(false);
    }
  }, [
    activeSession,
    addToast,
    api,
    handleSelectSession,
    queryClient,
    quickNewSessionPending,
    t,
  ]);

  const quickNewDisabled = !activeSession || quickNewSessionPending;
  const quickNewTitle = quickNewSessionPending
    ? t("sessions.quickNew.creating")
    : activeSession
      ? t("sessions.quickNew")
      : t("sessions.quickNew.unavailable");

  const handleScheduledTogglePaused = useCallback(
    async (task: ScheduledTask) => {
      const validationMessage = task.paused
        ? getScheduledResumeValidationMessage(task, t)
        : getScheduledPauseValidationMessage(task, t);
      if (validationMessage) {
        addToast({
          title: task.paused
            ? t("scheduled.action.resume")
            : t("scheduled.action.pause"),
          body: validationMessage,
          sessionId: "",
          url: "/scheduled",
        });
        return;
      }

      try {
        await updateScheduledTask({
          taskId: task.id,
          paused: !task.paused,
        });
      } catch (error) {
        const message = getScheduledErrorMessage(error, t);
        addToast({
          title: task.paused
            ? t("scheduled.action.resume")
            : t("scheduled.action.pause"),
          body: message,
          sessionId: "",
          url: "/scheduled",
        });
      }
    },
    [addToast, t, updateScheduledTask],
  );

  const executeBatchOperation = useCallback(() => {
    if (!api || batchSelectedIds.size === 0 || !batchMode) return;
    const mode = batchMode;
    const ids = [...batchSelectedIds];

    // Optimistic: immediately update UI and close dialog
    if (mode === "archive") {
      setBatchArchivingIds((prev) => {
        const next = new Set(prev);
        for (const id of ids) {
          next.add(id);
        }
        return next;
      });
    }
    if (mode === "delete") {
      setBatchDeletingIds((prev) => {
        const next = new Set(prev);
        for (const id of ids) {
          next.add(id);
        }
        return next;
      });
      const idSet = new Set(ids);
      setMountedSessions((prev) => prev.filter((sid) => !idSet.has(sid)));
      if (activeSessionId && idSet.has(activeSessionId)) {
        setActiveSessionId(null);
        navigate({ to: "/" });
      }
    }
    handleExitBatchMode();

    // Fire-and-forget: run API calls in background
    (async () => {
      for (const id of ids) {
        try {
          if (mode === "archive") {
            await api.archiveSession(id);
          } else {
            await api.deleteSession(id);
            clearMessageWindow(id);
            setBatchDeletingIds((prev) => {
              if (!prev.has(id)) {
                return prev;
              }
              const next = new Set(prev);
              next.delete(id);
              return next;
            });
          }
        } catch {
          if (mode === "archive") {
            setBatchArchivingIds((prev) => {
              if (!prev.has(id)) {
                return prev;
              }
              const next = new Set(prev);
              next.delete(id);
              return next;
            });
          }
          if (mode === "delete") {
            setBatchDeletingIds((prev) => {
              if (!prev.has(id)) {
                return prev;
              }
              const next = new Set(prev);
              next.delete(id);
              return next;
            });
          }
          // continue with remaining sessions
        }
      }
      queryClient.invalidateQueries({ queryKey: queryKeys.sessions });
    })();
  }, [
    api,
    batchMode,
    batchSelectedIds,
    activeSessionId,
    navigate,
    queryClient,
    handleExitBatchMode,
  ]);

  const handleBatchConfirmClick = useCallback(() => {
    if (batchSelectedIds.size === 0) return;
    const skipKey =
      batchMode === "archive"
        ? "hapi:skip-confirm:archive"
        : "hapi:skip-confirm:delete";
    const skip = (() => {
      try {
        return localStorage.getItem(skipKey) === "1";
      } catch {
        return false;
      }
    })();
    if (skip) {
      void executeBatchOperation();
    } else {
      setBatchConfirmOpen(true);
    }
  }, [batchMode, batchSelectedIds, executeBatchOperation]);

  const closeSettingsOverlay = useCallback(() => {
    const shouldRestoreNewSession = restoreNewSessionAfterSettingsRef.current;
    restoreNewSessionAfterSettingsRef.current = false;
    setSettingsOpen(false);
    setToolbarMenuOpen(false);
    setNewSessionOpen(shouldRestoreNewSession);
    selectWorkspaceOverlay(shouldRestoreNewSession ? "newSession" : "none");
  }, []);

  const toggleSettingsOverlay = useCallback(() => {
    if (settingsOpen) {
      closeSettingsOverlay();
      return;
    }

    restoreNewSessionAfterSettingsRef.current = newSessionOpen;
    setSettingsOpen(true);
    setNewSessionOpen(false);
    selectWorkspaceOverlay("settings");
    setToolbarMenuOpen(false);
  }, [closeSettingsOverlay, newSessionOpen, settingsOpen]);

  const openSettingsOverlay = useCallback(() => {
    restoreNewSessionAfterSettingsRef.current = newSessionOpen;
    setSettingsOpen(true);
    setNewSessionOpen(false);
    selectWorkspaceOverlay("settings");
    setToolbarMenuOpen(false);
  }, [newSessionOpen]);

  const toggleNewSessionOverlay = useCallback(() => {
    setSettingsOpen(false);
    setToolbarMenuOpen(false);
    setNewSessionMachineId(null);

    if (!narrowViewport) {
      setNewSessionOpen((prev) => {
        const next = !prev;
        if (next) {
          selectWorkspaceTab("sessions");
        }
        selectWorkspaceOverlay(next ? "newSession" : "none");
        return next;
      });
      setActiveSessionId(null);
      navigate({ to: "/" });
      return;
    }

    setNewSessionOpen((prev) => {
      const next = !prev;
      selectWorkspaceOverlay(next ? "newSession" : "none");
      return next;
    });
  }, [narrowViewport, navigate]);

  const openNewSessionOverlay = useCallback(() => {
    setSettingsOpen(false);
    setToolbarMenuOpen(false);
    setNewSessionMachineId(null);
    setNewSessionInitialPrompt("");
    selectWorkspaceTab("sessions");
    selectWorkspaceOverlay("newSession");

    if (!narrowViewport) {
      setNewSessionOpen(true);
      setActiveSessionId(null);
      navigate({ to: "/" });
      return;
    }

    setNewSessionOpen(true);
  }, [narrowViewport, navigate]);

  const openNewSessionOverlayWithPrompt = useCallback(
    (prompt: string) => {
      const trimmedPrompt = prompt.trim();
      setSettingsOpen(false);
      setToolbarMenuOpen(false);
      setNewSessionMachineId(null);
      setNewSessionInitialPrompt(trimmedPrompt);
      selectWorkspaceTab("sessions");
      selectWorkspaceOverlay("newSession");

      if (!narrowViewport) {
        setNewSessionOpen(true);
        setActiveSessionId(null);
        navigate({ to: "/" });
        return;
      }

      setNewSessionOpen(true);
    },
    [narrowViewport, navigate],
  );

  const openNewSessionForHost = useCallback(
    (host: string) => {
      const matchedMachine = machines.find((machine) => {
        const machineHost =
          machine.metadata?.displayName ?? machine.metadata?.host ?? "";
        return machineHost === host;
      });

      setSettingsOpen(false);
      setToolbarMenuOpen(false);
      setNewSessionMachineId(matchedMachine?.id ?? null);
      selectWorkspaceTab("sessions");
      selectWorkspaceOverlay("newSession");

      if (!narrowViewport) {
        setNewSessionOpen(true);
        setActiveSessionId(null);
        navigate({ to: "/" });
        return;
      }

      setNewSessionOpen(true);
    },
    [machines, narrowViewport, navigate],
  );

  useEffect(() => {
    setSettingsOpen(workspace.overlay === "settings");
    setNewSessionOpen(workspace.overlay === "newSession");
  }, [workspace.overlay]);

  useEffect(() => {
    const handleOpenSettingsOverlay = () => {
      openSettingsOverlay();
    };

    window.addEventListener(
      "hapi:open-settings-overlay",
      handleOpenSettingsOverlay,
    );
    return () =>
      window.removeEventListener(
        "hapi:open-settings-overlay",
        handleOpenSettingsOverlay,
      );
  }, [openSettingsOverlay]);

  const isScheduledTab = workspace.tab === "scheduled";
  const isSessionsTab = workspace.tab === "sessions";
  const visibleNewSessionOverlay = isSessionsTab && newSessionOpen;
  const swipeNavEnabled = narrowViewport;
  const isSubRoute =
    activeSessionId !== null && workspace.sessionSubview !== "chat";
  const isSessionsIndex = activeSessionId === null && !hasOverlay;
  const canSwipeBackFromSessionDetail =
    swipeNavEnabled &&
    isSessionsTab &&
    activeSessionId !== null &&
    !isSubRoute &&
    !hasOverlay;
  const canSwipeBackFromScheduledDetail =
    swipeNavEnabled &&
    isScheduledTab &&
    selectedScheduledTaskId !== null &&
    !hasOverlay;
  const canSwipeBackFromNewSession =
    swipeNavEnabled && visibleNewSessionOverlay;

  const canSwipeBackToList =
    canSwipeBackFromSessionDetail ||
    canSwipeBackFromScheduledDetail ||
    canSwipeBackFromNewSession;
  const canSwipeForwardToSession =
    swipeNavEnabled &&
    isSessionsIndex &&
    !hasOverlay &&
    Boolean(swipeForwardSessionId);

  swipeCapabilityRef.current = {
    canBack: canSwipeBackToList,
    canForward: canSwipeForwardToSession,
    activeSessionId,
    backTarget: canSwipeBackFromSessionDetail
      ? "session"
      : canSwipeBackFromScheduledDetail
        ? "scheduled"
        : canSwipeBackFromNewSession
          ? "newSession"
          : null,
    forwardSessionId: swipeForwardSessionId,
  };

  const clearWheelReleaseTimer = useCallback(() => {
    const timer = wheelGestureRef.current.releaseTimer;
    if (timer !== null) {
      window.clearTimeout(timer);
      wheelGestureRef.current.releaseTimer = null;
    }
    wheelGestureRef.current.releaseArmed = false;
  }, []);

  const clearWheelUnlockTimer = useCallback(() => {
    const timer = wheelGestureRef.current.unlockTimer;
    if (timer !== null) {
      window.clearTimeout(timer);
      wheelGestureRef.current.unlockTimer = null;
    }
  }, []);

  const scheduleWheelUnlock = useCallback(() => {
    clearWheelUnlockTimer();
    wheelGestureRef.current.unlockTimer = window.setTimeout(() => {
      wheelGestureRef.current.blocked = false;
      wheelGestureRef.current.unlockTimer = null;
    }, SWIPE_WHEEL_UNLOCK_MS);
  }, [clearWheelUnlockTimer]);

  const resetWheelGesture = useCallback(
    (options?: { keepBlock?: boolean }) => {
      clearWheelReleaseTimer();
      const blocked = options?.keepBlock
        ? wheelGestureRef.current.blocked
        : false;
      wheelGestureRef.current.accumX = 0;
      wheelGestureRef.current.accumY = 0;
      wheelGestureRef.current.eventCount = 0;
      wheelGestureRef.current.lastTs = 0;
      wheelGestureRef.current.action = null;
      wheelGestureRef.current.ready = false;
      wheelGestureRef.current.wasReady = false;
      wheelGestureRef.current.cancelled = false;
      wheelGestureRef.current.direction = 0;
      wheelGestureRef.current.releaseArmed = false;
      wheelGestureRef.current.blocked = blocked;
      if (!blocked) {
        clearWheelUnlockTimer();
      }
    },
    [clearWheelReleaseTimer, clearWheelUnlockTimer],
  );

  const performSwipeAction = useCallback(
    (action: SwipeAction): boolean => {
      const capability = swipeCapabilityRef.current;
      if (action === "back") {
        if (!capability.canBack || !capability.backTarget) {
          return false;
        }
        if (capability.backTarget === "session") {
          if (!capability.activeSessionId) {
            return false;
          }
          setSwipeForwardSessionId(capability.activeSessionId);
          clearWorkspaceSessionSelection();
          setActiveSessionId(null);
          navigate({ to: "/" });
        } else if (capability.backTarget === "newSession") {
          setNewSessionOpen(false);
          selectWorkspaceOverlay("none");
        } else {
          setSelectedScheduledTaskId(null);
          setSelectedScheduledRunId(null);
          setScheduledEditing(false);
          setScheduledEditState(null);
          clearWorkspaceScheduledSelection();
        }
        return true;
      }
      if (!capability.canForward || !capability.forwardSessionId) {
        return false;
      }
      openSession(capability.forwardSessionId, { preserveForward: true });
      return true;
    },
    [navigate, openSession],
  );

  const finalizeWheelGesture = useCallback(() => {
    const gesture = wheelGestureRef.current;
    const action = gesture.action;
    const shouldCommit = action !== null && gesture.ready && !gesture.cancelled;
    if (shouldCommit) {
      if (
        action === "back" &&
        wheelBackDirectionRef.current === 0 &&
        gesture.direction !== 0
      ) {
        wheelBackDirectionRef.current = gesture.direction;
      }
      if (performSwipeAction(action)) {
        wheelGestureRef.current.blocked = true;
        scheduleWheelUnlock();
      }
    }
    resetWheelGesture({ keepBlock: true });
  }, [performSwipeAction, resetWheelGesture, scheduleWheelUnlock]);

  const scheduleWheelRelease = useCallback(() => {
    if (wheelGestureRef.current.releaseTimer !== null) {
      return;
    }
    wheelGestureRef.current.releaseArmed = true;
    wheelGestureRef.current.releaseTimer = window.setTimeout(() => {
      finalizeWheelGesture();
    }, SWIPE_WHEEL_RELEASE_MS);
  }, [finalizeWheelGesture]);

  const hasHorizontalScrollableAncestor = useCallback(
    (target: EventTarget | null, deltaX: number) => {
      if (!(target instanceof Element)) {
        return false;
      }
      let el: Element | null = target;
      while (el && el !== document.body) {
        if (el instanceof HTMLElement) {
          const style = window.getComputedStyle(el);
          const overflowX = style.overflowX;
          const canOverflow = overflowX === "auto" || overflowX === "scroll";
          if (canOverflow && el.scrollWidth > el.clientWidth + 1) {
            const canScrollLeft = el.scrollLeft > 0;
            const canScrollRight =
              el.scrollLeft + el.clientWidth < el.scrollWidth - 1;
            if (
              (deltaX < 0 && canScrollRight) ||
              (deltaX > 0 && canScrollLeft)
            ) {
              return true;
            }
          }
        }
        el = el.parentElement;
      }
      return false;
    },
    [],
  );

  const handleRootWheel = useCallback(
    (event: React.WheelEvent<HTMLDivElement>) => {
      if (!swipeNavEnabled) {
        return;
      }

      const gesture = wheelGestureRef.current;
      if (gesture.blocked) {
        scheduleWheelUnlock();
        if (event.cancelable) {
          event.preventDefault();
        }
        return;
      }

      const now =
        typeof performance !== "undefined" ? performance.now() : Date.now();
      if (now - gesture.lastTs > SWIPE_WHEEL_IDLE_RESET_MS) {
        gesture.accumX = 0;
        gesture.accumY = 0;
        gesture.eventCount = 0;
        gesture.action = null;
        gesture.ready = false;
        gesture.wasReady = false;
        gesture.cancelled = false;
        gesture.direction = 0;
      }
      gesture.lastTs = now;

      const absX = Math.abs(event.deltaX);
      const absY = Math.abs(event.deltaY);
      if (absX <= absY * 1.2) {
        return;
      }

      if (hasHorizontalScrollableAncestor(event.target, event.deltaX)) {
        return;
      }

      const action: SwipeAction | null = canSwipeBackToList
        ? "back"
        : canSwipeForwardToSession
          ? "forward"
          : null;
      if (!action) {
        resetWheelGesture();
        return;
      }

      gesture.accumX += event.deltaX;
      gesture.accumY += event.deltaY;
      gesture.eventCount += 1;
      gesture.action = action;
      gesture.direction = toSwipeDirection(gesture.accumX);

      const learnedBackDirection = wheelBackDirectionRef.current;
      const expectedDirection: SwipeDirection =
        action === "back"
          ? learnedBackDirection
          : learnedBackDirection === 0
            ? 0
            : learnedBackDirection === 1
              ? -1
              : 1;
      const directionAligned =
        gesture.direction !== 0 &&
        (expectedDirection === 0 || gesture.direction === expectedDirection);

      const progressPx = directionAligned ? Math.abs(gesture.accumX) : 0;
      const horizontalBurst =
        gesture.eventCount >= 3 &&
        Math.abs(gesture.accumX) > Math.abs(gesture.accumY) * 1.2;
      const ready =
        directionAligned &&
        horizontalBurst &&
        progressPx >= SWIPE_WHEEL_TRIGGER_PX;
      if (ready) {
        gesture.wasReady = true;
      }
      gesture.cancelled =
        gesture.wasReady &&
        (progressPx <= SWIPE_WHEEL_CANCEL_PX || !directionAligned);
      gesture.ready = ready && !gesture.cancelled;

      if (event.cancelable) {
        event.preventDefault();
      }
      if (gesture.ready) {
        scheduleWheelRelease();
      } else if (gesture.releaseArmed) {
        clearWheelReleaseTimer();
      }
    },
    [
      canSwipeBackToList,
      canSwipeForwardToSession,
      clearWheelReleaseTimer,
      hasHorizontalScrollableAncestor,
      resetWheelGesture,
      scheduleWheelRelease,
      scheduleWheelUnlock,
      swipeNavEnabled,
    ],
  );

  useEffect(() => {
    resetWheelGesture();
  }, [
    activeSessionId,
    canSwipeBackToList,
    canSwipeForwardToSession,
    hasOverlay,
    isSubRoute,
    isSessionsIndex,
    newSessionOpen,
    selectedScheduledTaskId,
    resetWheelGesture,
  ]);

  useEffect(() => {
    return () => {
      clearWheelReleaseTimer();
      clearWheelUnlockTimer();
    };
  }, [clearWheelReleaseTimer, clearWheelUnlockTimer]);

  const handleDragStart = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      e.preventDefault();
      const startX = e.clientX;
      const startWidth = panelWidth;
      const el = e.currentTarget;
      el.setPointerCapture(e.pointerId);

      const onMove = (ev: PointerEvent) => {
        const delta = ev.clientX - startX;
        const maxW = window.innerWidth * 0.5;
        setPanelWidth(
          Math.round(
            Math.min(
              Math.max(startWidth + delta, DESKTOP_SIDEBAR_MIN_WIDTH),
              maxW,
            ),
          ),
        );
      };

      const onUp = (ev: PointerEvent) => {
        el.removeEventListener("pointermove", onMove);
        el.removeEventListener("pointerup", onUp);
        el.releasePointerCapture(ev.pointerId);
        const delta = ev.clientX - startX;
        const maxW = window.innerWidth * 0.5;
        const finalWidth = Math.round(
          Math.min(
            Math.max(startWidth + delta, DESKTOP_SIDEBAR_MIN_WIDTH),
            maxW,
          ),
        );
        writeStorageItem("session", "hapi:panel:leftWidth", String(finalWidth));
      };

      el.addEventListener("pointermove", onMove);
      el.addEventListener("pointerup", onUp);
    },
    [panelWidth],
  );

  const toggleCollapsed = useCallback(() => {
    setToolbarMenuOpen(false);
    setCollapsed((prev) => {
      const next = !prev;
      writeStorageItem("session", "hapi:panel:collapsed", String(next));
      return next;
    });
  }, []);

  const handleOpenScheduledTab = useCallback(() => {
    selectWorkspaceTab("scheduled");
  }, []);

  const handleScheduledDetailBack = useCallback(() => {
    setScheduledInteractiveSessionId(null);
    setSelectedScheduledTaskId(null);
    setSelectedScheduledRunId(null);
    setScheduledEditing(false);
    setScheduledEditState(null);
    clearWorkspaceScheduledSelection();
  }, []);

  const toggleMobileSessionPane = useCallback(() => {
    if (!narrowViewport || settingsOpen || isSubRoute) {
      return;
    }

    if (visibleNewSessionOverlay) {
      setNewSessionOpen(false);
      selectWorkspaceOverlay("none");
      return;
    }

    if (isSessionsTab && activeSessionRef.current) {
      setSwipeForwardSessionId(activeSessionRef.current);
      clearWorkspaceSessionSelection();
      setActiveSessionId(null);
      navigate({ to: "/" });
      return;
    }

    if (isScheduledTab && selectedScheduledTaskId) {
      handleScheduledDetailBack();
      return;
    }

    if (swipeForwardSessionId) {
      openSession(swipeForwardSessionId, { preserveForward: true });
    }
  }, [
    handleScheduledDetailBack,
    isSubRoute,
    isScheduledTab,
    isSessionsTab,
    narrowViewport,
    navigate,
    openSession,
    settingsOpen,
    selectedScheduledTaskId,
    swipeForwardSessionId,
    visibleNewSessionOverlay,
  ]);

  const mobileNewSessionVisible = narrowViewport && visibleNewSessionOverlay;
  const mobileSessionsDetailVisible =
    narrowViewport && isSessionsTab && activeSessionId !== null && !hasOverlay;
  const mobileScheduledDetailVisible =
    narrowViewport &&
    isScheduledTab &&
    Boolean(selectedScheduledTaskId) &&
    !hasOverlay;
  const mobileTabDetailVisible =
    mobileNewSessionVisible ||
    mobileSessionsDetailVisible ||
    mobileScheduledDetailVisible;

  useAppKeyboardShortcuts({
    isMobileViewport: narrowViewport,
    canToggleMobileSessionPane:
      narrowViewport &&
      !settingsOpen &&
      (visibleNewSessionOverlay ||
        (!isSubRoute &&
          ((isSessionsTab && activeSessionId !== null) ||
            (isScheduledTab && selectedScheduledTaskId !== null))) ||
        Boolean(swipeForwardSessionId)),
    onOpenNewSession: toggleNewSessionOverlay,
    onToggleSettings: toggleSettingsOverlay,
    onToggleDesktopSidebar: toggleCollapsed,
    onToggleMobileSessionPane: toggleMobileSessionPane,
  });

  const effectiveCollapsed = collapsed;
  const scheduledIndexVisible = !selectedScheduledTaskId;
  const leftPanelVisible = narrowViewport
    ? settingsOpen
      ? "hidden"
      : "flex"
    : effectiveCollapsed
      ? isSessionsIndex && !hasOverlay
        ? "flex lg:hidden"
        : "hidden"
      : isScheduledTab
        ? scheduledIndexVisible && !hasOverlay
          ? "flex"
          : "hidden lg:flex"
        : isSessionsIndex && !hasOverlay
          ? "flex"
          : "hidden lg:flex";
  const showDesktopNewSessionPane =
    !narrowViewport &&
    (visibleNewSessionOverlay ||
      (isSessionsTab && activeSessionId === null && !hasOverlay));
  const leftPanelContentScale = 1;
  const leftPanelContentStyle = {
    width: `${100 / leftPanelContentScale}%`,
    height: `${100 / leftPanelContentScale}%`,
    transform: `scale(${leftPanelContentScale})`,
    transformOrigin: "top left",
  };
  const showSidebarSearchRow = !effectiveCollapsed && !mobileTabDetailVisible;
  const showSidebarBatchActions = !effectiveCollapsed && isSessionsTab;
  const mobileLeftPanelVisible = leftPanelVisible.includes("flex");
  const showPinnedSidebarLogo = !narrowViewport || mobileLeftPanelVisible;
  const mobileLogoBackMode =
    narrowViewport &&
    !settingsOpen &&
    (visibleNewSessionOverlay ||
      (isSessionsTab && activeSessionId !== null) ||
      (isScheduledTab && Boolean(selectedScheduledTaskId)));
  const handlePinnedLogoClick = mobileLogoBackMode
    ? visibleNewSessionOverlay
      ? () => {
          setNewSessionOpen(false);
          selectWorkspaceOverlay("none");
        }
      : isSessionsTab && activeSessionId !== null
        ? handleSessionBack
        : isScheduledTab && selectedScheduledTaskId
            ? handleScheduledDetailBack
          : undefined
    : narrowViewport
      ? undefined
      : toggleCollapsed;
  const pinnedLogoTitle = mobileLogoBackMode
    ? "Back"
    : narrowViewport
      ? "HAPI"
      : effectiveCollapsed
        ? "Expand sidebar"
        : "Collapse sidebar";

  useEffect(() => {
    if (batchMode && !showSidebarBatchActions) {
      handleExitBatchMode();
    }
  }, [batchMode, handleExitBatchMode, showSidebarBatchActions]);

  return (
    <div className="relative flex h-full min-h-0" onWheel={handleRootWheel}>
      {showPinnedSidebarLogo && (
        <button
          type="button"
          onClick={handlePinnedLogoClick}
          className={`absolute left-[11px] top-[calc(env(safe-area-inset-top)+12px)] z-40 inline-flex h-8 w-8 items-center justify-center text-[var(--app-fg)] ${narrowViewport && !mobileLogoBackMode ? "pointer-events-none" : ""}`}
          title={pinnedLogoTitle}
          aria-label={pinnedLogoTitle}
        >
          {mobileLogoBackMode ? (
            <BackIcon className="h-7 w-7" />
          ) : (
            <img
              src="/icon.svg"
              alt="HAPI"
              className="block h-7 w-7 shrink-0"
            />
          )}
        </button>
      )}

      {/* Left panel */}
      <div
        className={`${leftPanelVisible} max-lg:!w-full shrink-0 flex-col overflow-hidden bg-[var(--app-bg)] lg:border-r lg:border-[var(--app-divider)]`}
        style={narrowViewport ? undefined : { width: panelWidth }}
      >
        <div className="flex h-full flex-col" style={leftPanelContentStyle}>
          <div className="bg-[var(--app-bg)] pt-[env(safe-area-inset-top)]">
            <div className="mx-auto w-full max-w-full lg:max-w-content px-3 pb-0 pt-2">
              <div className="flex items-end gap-2">
                <div className="h-8 w-8 shrink-0" aria-hidden="true" />

                <div className="min-w-0 flex-1 overflow-visible pt-1">
                  <div className="-ml-[5px] flex min-w-0 items-start gap-[7px] overflow-visible pl-[2px]">
                    <button
                      type="button"
                      onClick={() => selectWorkspaceTab("sessions")}
                      className={`group relative inline-flex shrink-0 -translate-x-[2px] items-center rounded-t-[12px] border border-b-0 px-3 text-base font-semibold ${isSessionsTab ? "liquid-line liquid-line-tab z-20 h-[35px] bg-[var(--app-bg)] text-[var(--app-fg)] border-[var(--app-border)]" : "z-30 h-[35px] border-transparent bg-transparent text-[var(--app-hint)] hover:text-[var(--app-fg)]"}`}
                      aria-pressed={isSessionsTab}
                    >
                      {isSessionsTab ? null : (
                        <span
                          aria-hidden="true"
                          className="absolute left-[-1px] -right-[4px] top-[-0.5px] bottom-[5.5px] rounded-[8px] bg-transparent transition-colors group-hover:bg-[var(--app-subtle-solid-bg)]"
                        />
                      )}
                      <span className="relative z-[1] inline-flex -translate-y-[2px] items-center gap-1.5">
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
                          className="h-4 w-4"
                        >
                          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                        </svg>
                        <span>{t("sessions.tab")}</span>
                      </span>
                      {isSessionsTab ? (
                        <>
                          <span
                            aria-hidden="true"
                            className="absolute -bottom-px left-0 right-0 h-[3px] bg-[var(--app-bg)]"
                          />
                          <span
                            aria-hidden="true"
                            className="absolute -bottom-px -left-[7px] h-[3px] w-[9px] bg-[var(--app-bg)]"
                          />
                          <span
                            aria-hidden="true"
                            className="absolute -bottom-px -right-[7px] h-[3px] w-[9px] bg-[var(--app-bg)]"
                          />
                          <span
                            aria-hidden="true"
                            className="absolute bottom-0 left-[-1px] h-[10px] w-[10px] bg-[var(--app-bg)]"
                          />
                          <span
                            aria-hidden="true"
                            className="absolute bottom-0 right-[-1px] h-[10px] w-[10px] bg-[var(--app-bg)]"
                          />
                          <span
                            aria-hidden="true"
                            className="absolute bottom-px -left-[9px] h-[8px] w-[10px] rotate-90 rounded-tr-[8px] border-r border-t border-[var(--app-border)] bg-[var(--app-bg)]"
                          />
                          <span
                            aria-hidden="true"
                            className="absolute bottom-px -right-[9px] h-[8px] w-[10px] -rotate-90 rounded-tl-[8px] border-l border-t border-[var(--app-border)] bg-[var(--app-bg)]"
                          />
                        </>
                      ) : null}
                    </button>
                    <button
                      type="button"
                      onClick={handleOpenScheduledTab}
                      className={`group relative inline-flex shrink-0 -translate-x-[2px] items-center rounded-t-[12px] border border-b-0 px-3 text-base font-semibold ${isScheduledTab ? "liquid-line liquid-line-tab z-20 h-[35px] bg-[var(--app-bg)] text-[var(--app-fg)] border-[var(--app-border)]" : "z-30 h-[35px] border-transparent bg-transparent text-[var(--app-hint)] hover:text-[var(--app-fg)]"}`}
                      aria-pressed={isScheduledTab}
                    >
                      {isScheduledTab ? null : (
                        <span
                          aria-hidden="true"
                          className="absolute -left-[4px] -right-[4px] top-[-0.5px] bottom-[5.5px] rounded-[8px] bg-transparent transition-colors group-hover:bg-[var(--app-subtle-solid-bg)]"
                        />
                      )}
                      <span className="relative z-[1] inline-flex -translate-y-[2px] items-center gap-1.5">
                        <ScheduledTaskIcon className="h-4 w-4" />
                        <span>{t("scheduled.tab")}</span>
                      </span>
                      {isScheduledTab ? (
                        <>
                          <span
                            aria-hidden="true"
                            className="absolute -bottom-px left-0 right-0 h-[3px] bg-[var(--app-bg)]"
                          />
                          <span
                            aria-hidden="true"
                            className="absolute -bottom-px -left-[7px] h-[3px] w-[9px] bg-[var(--app-bg)]"
                          />
                          <span
                            aria-hidden="true"
                            className="absolute -bottom-px -right-[7px] h-[3px] w-[9px] bg-[var(--app-bg)]"
                          />
                          <span
                            aria-hidden="true"
                            className="absolute bottom-0 left-[-1px] h-[10px] w-[10px] bg-[var(--app-bg)]"
                          />
                          <span
                            aria-hidden="true"
                            className="absolute bottom-0 right-[-1px] h-[10px] w-[10px] bg-[var(--app-bg)]"
                          />
                          <span
                            aria-hidden="true"
                            className="absolute bottom-px -left-[9px] h-[8px] w-[10px] rotate-90 rounded-tr-[8px] border-r border-t border-[var(--app-border)] bg-[var(--app-bg)]"
                          />
                          <span
                            aria-hidden="true"
                            className="absolute bottom-px -right-[9px] h-[8px] w-[10px] -rotate-90 rounded-tl-[8px] border-l border-t border-[var(--app-border)] bg-[var(--app-bg)]"
                          />
                        </>
                      ) : null}
                    </button>
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-0.5 self-center pl-1">
                  <HeaderActionGroup
                    api={api}
                    isDark={isDark}
                    onToggleTheme={toggleTheme}
                    onOpenSettings={toggleSettingsOverlay}
                    onOpenNewSession={toggleNewSessionOverlay}
                    onQuickNewSession={handleQuickNewSession}
                    quickNewSessionDisabled={quickNewDisabled}
                    quickNewSessionTitle={quickNewTitle}
                    className="flex items-center gap-0.5"
                    hideNewSessionButton
                    hideQuickNewButton
                    hideSettingsButton
                  />
                </div>
              </div>
            </div>
          </div>

          <div
            className={`mx-auto flex min-h-0 w-full max-w-full flex-1 flex-col px-3 pb-3 lg:max-w-content ${widescreen ? "widescreen-mode" : ""}`}
          >
            <div className="flex min-h-0 flex-1 flex-col pt-0">
              <div className="relative -mt-px flex min-h-0 flex-1 flex-col overflow-hidden rounded-[14px] border border-[var(--app-border)] bg-[var(--app-bg)] shadow-[0_10px_24px_rgba(15,23,42,0.04)]">
                <div
                  className={`min-h-0 flex-1 ${showSidebarSearchRow ? "" : "rounded-b-[14px]"}`}
                >
                  {mobileNewSessionVisible ? (
                    <div className="flex h-full min-h-0 flex-col overflow-hidden">
                      <NewSessionPanel
                        onClose={() => {
                          setNewSessionOpen(false);
                          setNewSessionInitialPrompt("");
                          selectWorkspaceOverlay("none");
                        }}
                        onOpenSettings={openSettingsOverlay}
                        initialMachineId={newSessionMachineId}
                        initialPrompt={newSessionInitialPrompt}
                      />
                    </div>
                  ) : mobileSessionsDetailVisible && activeSessionId ? (
                    <div className="flex h-full min-h-0 flex-col overflow-hidden">
                      <SessionView
                        sessionId={activeSessionId}
                        onBack={handleSessionBack}
                        onSessionDeleted={() =>
                          handleSessionDeleted(activeSessionId)
                        }
                        isDark={isDark}
                        onToggleTheme={toggleTheme}
                        onOpenSettings={() => {
                          toggleSettingsOverlay();
                        }}
                        onOpenNewSession={toggleNewSessionOverlay}
                      />
                    </div>
                  ) : mobileScheduledDetailVisible && selectedScheduledTask ? (
                    <ScheduledTaskDetailPanel
                      task={selectedScheduledTask}
                      machineTitle={selectedScheduledMachineTitle}
                      createdBySessionTitle={selectedScheduledCreatedBySessionTitle}
                      createdBySessionFlavor={selectedScheduledCreatedBySessionFlavor}
                      selectedRun={selectedScheduledRun}
                      taskRuns={selectedScheduledTaskRuns}
                      latestRun={latestScheduledRunByTaskId.get(selectedScheduledTask.id)}
                      isEditing={scheduledEditing}
                      editState={scheduledEditState}
                      isPending={scheduledPending}
                      onEditStateChange={setScheduledEditState}
                      onSetEditing={setScheduledEditing}
                      onTogglePaused={() => handleScheduledTogglePaused(selectedScheduledTask)}
                      onCancelTask={archiveScheduledTask}
                      onDeleteTask={deleteScheduledTask}
                      onUpdateTask={updateScheduledTask}
                      onSelectRun={(runId) => {
                        setSelectedScheduledRunId(runId);
                        selectWorkspaceScheduledRun(runId);
                      }}
                      onSetRunSessionInteractive={(sessionId, interactive) => {
                        setScheduledInteractiveSessionId(interactive ? sessionId : null);
                      }}
                      onOpenCreatedBySession={(sessionId) => {
                        openWorkspaceSession(sessionId, "chat");
                      }}
                      scheduledSessionInteractive={
                        selectedScheduledRun?.sessionId === scheduledInteractiveSessionId
                      }
                    />
                  ) : isScheduledTab ? (
                    <div className="flex h-full min-h-0 flex-col">
                      {scheduledError ? (
                        <div className="px-3 py-3">
                          <div className="text-sm text-red-600">
                            {scheduledError}
                          </div>
                        </div>
                      ) : null}
                      <div className="min-h-0 flex-1 overflow-y-auto">
                        <div className="mx-auto flex h-full min-h-0 w-full max-w-full flex-col px-3 py-3">
                          {scheduledLoading ? (
                            <div className="px-0 py-3 text-sm text-[var(--app-hint)]">
                              Loading scheduled tasks...
                            </div>
                          ) : null}
                          {!scheduledLoading &&
                          !scheduledError &&
                          scheduledGroups.length === 0 ? (
                            <EmptyListState
                              icon={<ScheduledTaskIcon className="h-8 w-8" />}
                              title={t("scheduled.list.emptyTitle")}
                              descriptionNode={
                                <button
                                  type="button"
                                  onClick={() =>
                                    openNewSessionOverlayWithPrompt(
                                      t("scheduled.list.examplePrompt"),
                                    )
                                  }
                                  className="text-sm italic leading-6 text-[var(--app-hint)] transition-colors hover:text-[var(--app-fg)]"
                                >
                                  "{t("scheduled.list.examplePrompt")}" 
                                </button>
                              }
                              actionLabel={t("scheduled.list.tryIt")}
                              onAction={() =>
                                openNewSessionOverlayWithPrompt(
                                  t("scheduled.list.examplePrompt"),
                                )
                              }
                            />
                          ) : null}
                          {scheduledGroups.length > 0 ? (
                            <div className="max-h-full min-h-0 overflow-hidden rounded-md border border-[var(--app-subtle-solid-bg)]">
                              <div className="max-h-full overflow-y-auto desktop-scrollbar-left">
                                {scheduledGroups.map((group, index) => {
                                  const isCollapsed =
                                    isScheduledGroupCollapsed(group);
                                  return (
                                    <div
                                      key={group.machineId}
                                      className={
                                        index > 0
                                          ? "border-t border-[var(--app-subtle-solid-bg)]"
                                          : ""
                                      }
                                    >
                                      <button
                                        type="button"
                                        onClick={() =>
                                          toggleScheduledGroup(
                                            group.machineId,
                                            isCollapsed,
                                          )
                                        }
                                        className="sticky top-0 z-10 flex w-full items-center gap-2 bg-[var(--app-subtle-solid-bg)] px-3 py-2 text-left"
                                      >
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
                                          className="h-4 w-4 shrink-0 text-[var(--app-hint)]"
                                          aria-hidden="true"
                                        >
                                          <rect
                                            x="2"
                                            y="2"
                                            width="20"
                                            height="8"
                                            rx="2"
                                            ry="2"
                                          />
                                          <rect
                                            x="2"
                                            y="14"
                                            width="20"
                                            height="8"
                                            rx="2"
                                            ry="2"
                                          />
                                          <line
                                            x1="6"
                                            y1="6"
                                            x2="6.01"
                                            y2="6"
                                          />
                                          <line
                                            x1="6"
                                            y1="18"
                                            x2="6.01"
                                            y2="18"
                                          />
                                        </svg>
                                        <ChevronIcon
                                          className="h-4 w-4 text-[var(--app-hint)]"
                                          collapsed={isCollapsed}
                                        />
                                        <div className="flex items-center gap-2 min-w-0 flex-1">
                                          <span className="break-words text-base font-medium">
                                            {group.title}
                                          </span>
                                          <span className="shrink-0 text-sm text-[var(--app-hint)]">
                                            ({group.tasks.length})
                                          </span>
                                        </div>
                                      </button>
                                      {!isCollapsed ? (
                                        <div className="flex flex-col divide-y divide-[var(--app-divider)]">
                                          {group.tasks.map((task) => {
                                            const latestRun =
                                              latestScheduledRunByTaskId.get(
                                                task.id,
                                              );
                                            const selected =
                                              task.id ===
                                              selectedScheduledTaskId;
                                            const rowBackgroundClass = selected
                                              ? "bg-[var(--app-session-active-bg)]"
                                              : scheduledZebraTaskIds.has(
                                                    task.id,
                                                  )
                                                ? "bg-[var(--app-session-zebra-bg)]"
                                                : "";
                                            const rowStyle = selected
                                              ? {
                                                  WebkitTouchCallout:
                                                    "none" as const,
                                                  boxShadow:
                                                    "inset 3px 0 0 var(--app-orange-base), inset 0 0 0 1px var(--app-border-on-subtle)",
                                                }
                                              : {
                                                  WebkitTouchCallout:
                                                    "none" as const,
                                                };
                                            const typeText =
                                              task.scheduleType === "cron"
                                                ? t("scheduled.list.kind.cron")
                                                : t("scheduled.list.kind.once");
                                            const statusText = getScheduledTaskStatusText(
                                              task,
                                              t,
                                            );
                                            const createdAtLabel =
                                              formatTimestamp(task.createdAt);
                                            const iconToneClass = task.paused
                                              ? "text-amber-600"
                                              : latestRun?.status === "failed"
                                                  ? "text-red-600"
                                                  : latestRun?.status ===
                                                      "succeeded"
                                                    ? "text-emerald-600"
                                                    : "text-[var(--app-hint)]";
                                            return (
                                              <ScheduledTaskListRow
                                                key={task.id}
                                                task={task}
                                                latestRun={latestRun}
                                                selected={selected}
                                                rowBackgroundClass={rowBackgroundClass}
                                                rowStyle={rowStyle}
                                                typeText={typeText}
                                                statusText={statusText}
                                                createdAtLabel={createdAtLabel}
                                                iconToneClass={iconToneClass}
                                                isPending={scheduledPending}
                                                onSelect={() => {
                                                  setSelectedScheduledTaskId(
                                                    task.id,
                                                  );
                                                  setSelectedScheduledRunId(
                                                    latestRun?.id ?? null,
                                                  );
                                                  openWorkspaceScheduledTask(
                                                    task.id,
                                                    latestRun?.id ?? null,
                                                  );
                                                }}
                                                onTogglePaused={() => void handleScheduledTogglePaused(task)}
                                                onCancelTask={() => {
                                                  void archiveScheduledTask(
                                                    task.id,
                                                  );
                                                }}
                                                onDeleteTask={() => {
                                                  setScheduledDeleteTarget(task);
                                                }}
                                              />
                                            );
                                          })}
                                        </div>
                                      ) : null}
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  ) : error ? (
                    <div className="px-3 py-3">
                      <div className="text-sm text-red-600">{error}</div>
                    </div>
                  ) : !error &&
                    !isLoading &&
                    normalizedSessionSearch &&
                    displaySessions.length === 0 ? (
                    <div className="mx-auto flex h-full min-h-0 w-full max-w-full flex-col px-3 py-3">
                      <div className="flex w-full items-start justify-center py-1 text-center text-sm text-[var(--app-hint)]">
                        {t("sessions.search.noMatch")}
                      </div>
                    </div>
                  ) : showSessionsEmptyState ? (
                    <div className="mx-auto flex h-full min-h-0 w-full max-w-full flex-col px-3 py-3">
                      <EmptyListState
                        icon={<SessionTabIcon className="h-8 w-8" />}
                        title={t("sessions.emptyTitle")}
                        description={t("sessions.empty")}
                        actionLabel={narrowViewport ? t("sessions.new") : undefined}
                        onAction={narrowViewport ? openNewSessionOverlay : undefined}
                      />
                    </div>
                  ) : (
                    <div className="flex h-full min-h-0 flex-col py-3">
                      <SessionList
                        sessions={displaySessions}
                        selectedSessionId={activeSessionId}
                        onSelect={handleSelectSession}
                        onNewSession={() => {
                          openNewSessionOverlay();
                        }}
                        onRefresh={handleRefresh}
                        isLoading={isLoading}
                        renderHeader={false}
                        fillHeight
                        api={api}
                        onNewSessionForHost={openNewSessionForHost}
                        batchMode={batchMode}
                        batchSelectedIds={batchSelectedIds}
                        archivingSessionIds={batchArchivingIds}
                        deletingSessionIds={batchDeletingIds}
                        onBatchToggleSelect={handleBatchToggleSelect}
                      />
                    </div>
                  )}
                </div>

                {showSidebarSearchRow ? (
                  <div className="border-t border-[var(--app-divider)] bg-[var(--app-bg)] px-4 py-3">
                    <div className="liquid-line flex items-center gap-2 rounded-[14px] border border-[var(--app-divider)] bg-[var(--app-bg)] px-3 py-2 shadow-[0_1px_0_rgba(255,255,255,0.35)_inset]">
                      <div className="flex h-4 w-4 shrink-0 items-center justify-center">
                        {(
                          isScheduledTab
                            ? scheduledSearch.length > 0
                            : hasSessionSearch
                        ) ? (
                          <button
                            type="button"
                            onClick={() => {
                              if (isScheduledTab) {
                                setScheduledSearch("");
                              } else {
                                setSessionSearch("");
                              }
                            }}
                            onMouseDown={(event) => event.preventDefault()}
                            className="flex h-4 w-4 items-center justify-center rounded-full text-[var(--app-hint)] transition-colors hover:bg-[var(--app-secondary-bg)] hover:text-[var(--app-fg)]"
                            title={
                              isScheduledTab
                                ? t("scheduled.search.clear")
                                : t("sessions.search.clear")
                            }
                            aria-label={
                              isScheduledTab
                                ? t("scheduled.search.clear")
                                : t("sessions.search.clear")
                            }
                          >
                            <SearchClearIcon className="h-3 w-3" />
                          </button>
                        ) : (
                          <SearchIcon className="h-[14px] w-[14px] text-[var(--app-hint)]" />
                        )}
                      </div>
                      <input
                        value={isScheduledTab ? scheduledSearch : sessionSearch}
                        onChange={(event) => {
                          if (isScheduledTab) {
                            setScheduledSearch(event.target.value);
                          } else {
                            setSessionSearch(event.target.value);
                          }
                        }}
                        placeholder={
                          isScheduledTab
                            ? t("scheduled.search.placeholder")
                            : t("sessions.search.placeholder")
                        }
                        aria-label={
                          isScheduledTab
                            ? t("scheduled.search.placeholder")
                            : t("sessions.search.placeholder")
                        }
                        className="min-w-0 flex-1 bg-transparent text-sm text-[var(--app-fg)] placeholder:text-[var(--app-hint)] focus:outline-none"
                        autoCapitalize="none"
                        autoCorrect="off"
                        spellCheck={false}
                      />
                      <div className="flex shrink-0 items-center gap-0.5">
                        {isScheduledTab ? null : batchMode &&
                          showSidebarBatchActions ? (
                          <>
                            <button
                              type="button"
                              onClick={
                                batchSelectedIds.size ===
                                  batchFilteredIds.size &&
                                batchFilteredIds.size > 0
                                  ? () => setBatchSelectedIds(new Set())
                                  : handleBatchSelectAll
                              }
                              disabled={
                                batchPending || batchFilteredIds.size === 0
                              }
                              className="p-0.5 rounded-full text-[var(--app-hint)] transition-colors hover:text-[var(--app-fg)] hover:bg-[var(--app-secondary-bg)] disabled:cursor-not-allowed disabled:opacity-50"
                              title={
                                batchSelectedIds.size ===
                                  batchFilteredIds.size &&
                                batchFilteredIds.size > 0
                                  ? t("batch.deselectAll")
                                  : t("batch.selectAll")
                              }
                            >
                              {batchSelectedIds.size ===
                                batchFilteredIds.size &&
                              batchFilteredIds.size > 0 ? (
                                <BatchDeselectAllIcon className="h-[14px] w-[14px]" />
                              ) : (
                                <BatchSelectAllIcon className="h-[14px] w-[14px]" />
                              )}
                            </button>
                            <button
                              type="button"
                              onClick={handleBatchConfirmClick}
                              disabled={
                                batchSelectedIds.size === 0 || batchPending
                              }
                              className={`p-0.5 rounded-full transition-colors ${batchSelectedIds.size > 0 ? "text-emerald-600 hover:bg-emerald-500/10" : "text-[var(--app-hint)]"} disabled:cursor-not-allowed disabled:opacity-50`}
                              title={t("batch.confirm.tooltip")}
                            >
                              <BatchCheckIcon className="h-[14px] w-[14px]" />
                            </button>
                            <button
                              type="button"
                              onClick={handleExitBatchMode}
                              disabled={batchPending}
                              className="p-0.5 rounded-full text-[var(--app-hint)] transition-colors hover:text-[var(--app-fg)] hover:bg-[var(--app-secondary-bg)] disabled:cursor-not-allowed disabled:opacity-50"
                              title={t("batch.cancel.tooltip")}
                            >
                              <BatchXIcon className="h-[14px] w-[14px]" />
                            </button>
                          </>
                        ) : showSidebarBatchActions ? (
                          <>
                            <button
                              type="button"
                              onClick={() => handleEnterBatchMode("archive")}
                              disabled={visibleArchivableCount === 0}
                              className="p-0.5 rounded-full text-[var(--app-hint)] transition-colors hover:text-[var(--app-fg)] hover:bg-[var(--app-secondary-bg)] disabled:cursor-not-allowed disabled:opacity-50"
                              title={t("batch.archive.tooltip")}
                            >
                              <BatchArchiveIcon className="h-[14px] w-[14px]" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleEnterBatchMode("delete")}
                              disabled={visibleDeletableCount === 0}
                              className="p-0.5 rounded-full text-[var(--app-hint)] transition-colors hover:text-[var(--app-fg)] hover:bg-[var(--app-secondary-bg)] disabled:cursor-not-allowed disabled:opacity-50"
                              title={t("batch.delete.tooltip")}
                            >
                              <BatchTrashIcon className="h-[14px] w-[14px]" />
                            </button>
                            <button
                              type="button"
                              onClick={toggleFilterOnline}
                              className={`p-0.5 rounded-full transition-colors ${filterOnlineOnly ? "bg-emerald-500/15 text-emerald-500" : "text-[var(--app-hint)] hover:text-[var(--app-fg)] hover:bg-[var(--app-secondary-bg)]"}`}
                              title={
                                filterOnlineOnly
                                  ? t("filter.showAll")
                                  : t("filter.onlineOnly")
                              }
                            >
                              <OnlineFilterIcon className="h-[14px] w-[14px]" />
                            </button>
                          </>
                        ) : (
                          <button
                            type="button"
                            onClick={toggleFilterOnline}
                            className={`p-0.5 rounded-full transition-colors ${filterOnlineOnly ? "bg-emerald-500/15 text-emerald-500" : "text-[var(--app-hint)] hover:text-[var(--app-fg)] hover:bg-[var(--app-secondary-bg)]"}`}
                            title={
                              filterOnlineOnly
                                ? t("filter.showAll")
                                : t("filter.onlineOnly")
                            }
                          >
                            <OnlineFilterIcon className="h-[14px] w-[14px]" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </div>

        {/* Batch operation confirm dialog */}
        <ConfirmDialog
          isOpen={batchConfirmOpen}
          onClose={() => setBatchConfirmOpen(false)}
          title={t(
            batchMode === "archive"
              ? "batch.archive.title"
              : "batch.delete.title",
          )}
          description={t(
            batchMode === "archive"
              ? "batch.archive.description"
              : "batch.delete.description",
            { count: batchSelectedIds.size },
          )}
          confirmLabel={t(
            batchMode === "archive"
              ? "dialog.archive.confirm"
              : "dialog.delete.confirm",
          )}
          confirmingLabel={t(
            batchMode === "archive"
              ? "dialog.archive.confirming"
              : "dialog.delete.confirming",
          )}
          onConfirm={executeBatchOperation}
          isPending={batchPending}
          destructive
          dontAskAgainKey={
            batchMode === "archive"
              ? "hapi:skip-confirm:archive"
              : "hapi:skip-confirm:delete"
          }
        />

        <ConfirmDialog
          isOpen={scheduledDeleteTarget !== null}
          onClose={() => setScheduledDeleteTarget(null)}
          title={t("scheduled.deleteDialog.title")}
          description={t("scheduled.deleteDialog.description", {
            name: scheduledDeleteTarget?.title ?? "",
          })}
          confirmLabel={t("scheduled.deleteDialog.confirm")}
          confirmingLabel={t("scheduled.deleteDialog.confirming")}
          onConfirm={async () => {
            if (!scheduledDeleteTarget) return;
            await deleteScheduledTask(scheduledDeleteTarget.id);
            setScheduledDeleteTarget(null);
          }}
          isPending={scheduledPending}
          destructive
        />
      </div>

      {/* Drag handle (PC only, when not collapsed) */}
      {!effectiveCollapsed && (
        <div
          className="hidden lg:flex items-center w-1.5 shrink-0 cursor-col-resize bg-transparent hover:bg-[var(--app-link)]/20 active:bg-[var(--app-link)]/40 transition-colors"
          onPointerDown={handleDragStart}
        />
      )}

      {/* Expand sidebar strip (PC only, when collapsed) */}
      {effectiveCollapsed && (
        <div className="hidden lg:flex flex-col h-[100dvh] shrink-0 pt-[env(safe-area-inset-top)] bg-[var(--app-bg)] border-r border-[var(--app-divider)]">
          <div className="h-[46px] shrink-0" aria-hidden="true" />
          <div className="mx-2 h-px bg-[var(--app-divider)] shrink-0" />
          <div className="px-2 py-1.5 pt-[calc(0.375rem)] shrink-0 flex flex-col items-center gap-1.5">
            <ToggleGroup
              value={workspace.tab}
              onValueChange={(value) => {
                if (value === "scheduled") {
                  handleOpenScheduledTab();
                  return;
                }
                selectWorkspaceTab("sessions");
              }}
              aria-label="Collapsed sidebar tab switcher"
              className="flex-col rounded-2xl p-1"
            >
              <ToggleGroupItem
                value="sessions"
                className="h-7 w-7 rounded-xl px-0"
              >
                <span className="sr-only">{t("sessions.tab")}</span>
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
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
              </ToggleGroupItem>
              <ToggleGroupItem
                value="scheduled"
                className="h-7 w-7 rounded-xl px-0"
              >
                <span className="sr-only">{t("scheduled.tab")}</span>
                <ScheduledTaskIcon className="h-4 w-4" />
              </ToggleGroupItem>
            </ToggleGroup>
            <HeaderActionGroup
              api={api}
              onOpenNewSession={toggleNewSessionOverlay}
              className="flex flex-col items-center gap-1"
              compactIcons
              hideQuickNewButton
              hideThemeControls
              hideSettingsButton
            />
          </div>
          <div className="mx-2 h-px bg-[var(--app-divider)] shrink-0" />

          {isSessionsTab ? (
            <>
              <div className="px-2 py-1.5 shrink-0 flex flex-col items-center gap-1">
                <button
                  type="button"
                  onClick={toggleFilterOnline}
                  className={`p-1.5 rounded-full ${filterOnlineOnly ? "bg-emerald-500/15 text-emerald-500" : "text-[var(--app-hint)] hover:text-[var(--app-fg)] hover:bg-[var(--app-subtle-bg)]"}`}
                  title={
                    filterOnlineOnly
                      ? t("filter.showAll")
                      : t("filter.onlineOnly")
                  }
                >
                  <OnlineFilterIcon className="h-[14px] w-[14px]" />
                </button>
              </div>
              <div className="mx-2 h-px bg-[var(--app-divider)] shrink-0" />
            </>
          ) : null}

          {/* Middle: scrollable session groups */}
          <div className="flex-1 min-h-0 overflow-y-auto py-1 desktop-scrollbar-left">
            {isScheduledTab
              ? scheduledGroups.map((group, gi) => (
                  <div key={group.machineId}>
                    {gi > 0 && (
                      <div className="mx-2 my-1 h-px bg-[var(--app-divider)]" />
                    )}
                    {group.tasks.map((task) => (
                      <CollapsedScheduledItem
                        key={task.id}
                        task={task}
                        selected={task.id === selectedScheduledTaskId}
                        latestRun={latestScheduledRunByTaskId.get(task.id)}
                        isPending={scheduledPending}
                        onSelect={(taskId, runId) => {
                          setSelectedScheduledTaskId(taskId);
                          setSelectedScheduledRunId(runId ?? null);
                          openWorkspaceScheduledTask(taskId, runId ?? null);
                        }}
                        onTogglePaused={() => void handleScheduledTogglePaused(task)}
                        onCancelTask={() => {
                          void archiveScheduledTask(task.id);
                        }}
                        onDeleteTask={() => {
                          setScheduledDeleteTarget(task);
                        }}
                      />
                    ))}
                  </div>
                ))
              : collapsedGroups.map((group, gi) => (
                  <div key={group.host}>
                    {gi > 0 && (
                      <div className="mx-2 my-1 h-px bg-[var(--app-divider)]" />
                    )}
                    {group.sessions.map((s) => (
                      <CollapsedSessionItem
                        key={s.id}
                        session={s}
                        selected={s.id === activeSessionId}
                        api={api}
                        onSelect={handleSelectSession}
                        menuEnabled={!batchMode}
                      />
                    ))}
                  </div>
                ))}
          </div>
          <div className="mx-2 h-px bg-[var(--app-divider)] shrink-0" />
          <div className="px-2 py-1.5 shrink-0 flex flex-col items-center gap-1">
            <HeaderActionGroup
              api={api}
              isDark={isDark}
              onToggleTheme={toggleTheme}
              className="flex flex-col items-center gap-1"
              compactIcons
              hideNewSessionButton
              hideQuickNewButton
              hideSettingsButton
              utilityContainerClassName="flex flex-col items-center gap-1"
              utilityButtonClassName="flex h-8 w-8 items-center justify-center rounded-full text-[var(--app-hint)] hover:bg-[var(--app-secondary-bg)] hover:text-[var(--app-fg)]"
              utilityLanguageClassName="flex h-8 w-8 items-center justify-center rounded-full px-0 text-[var(--app-hint)] hover:bg-[var(--app-secondary-bg)] hover:text-[var(--app-fg)]"
            />
          </div>
        </div>
      )}

      {/* Right panel */}
      <div
        className={`${((isSessionsTab ? isSessionsIndex : scheduledIndexVisible) && !hasOverlay) || mobileTabDetailVisible ? "hidden lg:flex" : "flex"} relative min-w-0 flex-1 flex-col bg-[var(--app-bg)] ${widescreen ? `widescreen-mode ${!effectiveCollapsed ? "lg:pr-[7px]" : ""}` : ""}`}
      >
        {showDesktopNewSessionPane ? (
          <div className="flex-1 min-h-0">
            <NewSessionPanel
              onClose={() => {
                setNewSessionOpen(false);
                setNewSessionInitialPrompt("");
                selectWorkspaceOverlay("none");
              }}
              onOpenSettings={openSettingsOverlay}
              initialMachineId={newSessionMachineId}
              initialPrompt={newSessionInitialPrompt}
            />
          </div>
        ) : isScheduledTab && !narrowViewport ? (
          <div className="hidden min-h-0 min-w-0 flex-1 flex-col overflow-x-hidden lg:flex">
            {!selectedScheduledTask ? (
              <EmptyListState
                icon={<EmptySelectionIcon className="h-8 w-8" />}
                title={t("scheduled.detail.emptyTitle")}
                description={t("scheduled.detail.empty")}
              />
            ) : (
              <ScheduledTaskDetailPanel
                task={selectedScheduledTask}
                machineTitle={selectedScheduledMachineTitle}
                createdBySessionTitle={selectedScheduledCreatedBySessionTitle}
                createdBySessionFlavor={selectedScheduledCreatedBySessionFlavor}
                selectedRun={selectedScheduledRun}
                taskRuns={selectedScheduledTaskRuns}
                latestRun={latestScheduledRunByTaskId.get(selectedScheduledTask.id)}
                isEditing={scheduledEditing}
                editState={scheduledEditState}
                isPending={scheduledPending}
                onEditStateChange={setScheduledEditState}
                onSetEditing={setScheduledEditing}
                onTogglePaused={() => handleScheduledTogglePaused(selectedScheduledTask)}
                onCancelTask={archiveScheduledTask}
                onDeleteTask={deleteScheduledTask}
                onUpdateTask={updateScheduledTask}
                onSelectRun={(runId) => {
                  setSelectedScheduledRunId(runId);
                  selectWorkspaceScheduledRun(runId);
                }}
                onSetRunSessionInteractive={(sessionId, interactive) => {
                  setScheduledInteractiveSessionId(interactive ? sessionId : null);
                }}
                onOpenCreatedBySession={(sessionId) => {
                  openWorkspaceSession(sessionId, "chat");
                }}
                scheduledSessionInteractive={
                  selectedScheduledRun?.sessionId === scheduledInteractiveSessionId
                }
              />
            )}

          </div>
        ) : (
          <>
            <div className="flex-1 min-h-0">
              <Outlet />
            </div>
            {mountedSessions.map((sid) => (
              <div
                key={sid}
                className={`absolute inset-0 z-30 bg-[var(--app-bg)] transition-opacity duration-200 ${sid === activeSessionId && !isSubRoute ? "opacity-100" : "opacity-0 pointer-events-none"}`}
              >
                {workspace.sessionSubview === "files" ? (
                  <FilesPanel sessionId={sid} />
                ) : workspace.sessionSubview === "terminal" ? (
                  <TerminalPanel sessionId={sid} />
                ) : (
                  <SessionView
                    sessionId={sid}
                    onBack={handleSessionBack}
                    onSessionDeleted={() => handleSessionDeleted(sid)}
                    isDark={isDark}
                    onToggleTheme={toggleTheme}
                    onOpenSettings={() => {
                      toggleSettingsOverlay();
                    }}
                    onOpenNewSession={toggleNewSessionOverlay}
                  />
                )}
              </div>
            ))}
          </>
        )}
        <div
          className={`absolute inset-0 z-50 bg-[var(--app-bg)] transition-opacity duration-200 ${settingsOpen ? "opacity-100" : "opacity-0 pointer-events-none"}`}
        >
          <SettingsPanel onClose={closeSettingsOverlay} />
        </div>
      </div>
    </div>
  );
}

function WorkspaceRootPage() {
  return <SessionsPage />;
}

function SessionsCompatIndexPage() {
  const navigate = useNavigate();
  useEffect(() => {
    selectWorkspaceTab("sessions");
    void navigate({ to: "/", replace: true });
  }, [navigate]);
  return null;
}

function ScheduledCompatPage() {
  const navigate = useNavigate();
  useEffect(() => {
    selectWorkspaceTab("scheduled");
    void navigate({ to: "/", replace: true });
  }, [navigate]);
  return null;
}

function SessionCompatPage(props: { subview: "chat" | "files" | "terminal" }) {
  const navigate = useNavigate();
  const { sessionId } = useParams({ from: "/sessions/$sessionId" });
  useEffect(() => {
    openWorkspaceSession(sessionId, props.subview);
    void navigate({ to: "/", replace: true });
  }, [navigate, props.subview, sessionId]);
  return null;
}

function SessionsIndexPage() {
  return null;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function shouldRetryPermissionSync(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }
  const text = error.message.toLowerCase();
  return (
    text.includes("session is inactive") ||
    text.includes("rpc handler not registered") ||
    text.includes("rpc socket disconnected") ||
    text.includes("network error") ||
    text.includes("failed to fetch")
  );
}

function resolveSpawnAgent(
  flavor?: string | null,
): "claude" | "codex" | undefined {
  if (flavor === "claude" || flavor === "codex") {
    return flavor;
  }
  return undefined;
}

function isSessionPermissionSynced(
  currentPermissionMode: PermissionMode | undefined,
  currentBasePermissionMode: PermissionMode | undefined,
  expectedPermissionMode: PermissionMode,
  expectedBasePermissionMode?: PermissionMode,
): boolean {
  if (currentPermissionMode !== expectedPermissionMode) {
    return false;
  }
  if (expectedPermissionMode !== "plan") {
    return true;
  }
  const expectedBase = expectedBasePermissionMode ?? "default";
  return currentBasePermissionMode === expectedBase;
}

function SessionView({
  sessionId,
  onBack,
  onSessionDeleted,
  isDark,
  onToggleTheme,
  onOpenSettings,
  onOpenNewSession,
  headerTitleOverride,
}: {
  sessionId: string;
  onBack: () => void;
  onSessionDeleted?: () => void;
  isDark?: boolean;
  onToggleTheme?: () => void;
  onOpenSettings?: () => void;
  onOpenNewSession?: () => void;
  headerTitleOverride?: string | null;
}) {
  return (
    <EmbeddedSessionView
      sessionId={sessionId}
      onBack={onBack}
      onSessionDeleted={onSessionDeleted}
      includeTopSafeArea={false}
      headerTitleOverride={headerTitleOverride}
      isDark={isDark}
      onToggleTheme={onToggleTheme}
      onOpenSettings={onOpenSettings}
      onOpenNewSession={onOpenNewSession}
    />
  );
}

function SessionPage() {
  const goBack = useAppGoBack();
  const { sessionId } = useParams({ from: "/sessions/$sessionId" });
  return <SessionView sessionId={sessionId} onBack={goBack} />;
}

function SessionDetailRoute() {
  const pathname = useLocation({ select: (location) => location.pathname });
  const { sessionId } = useParams({ from: "/sessions/$sessionId" });
  const basePath = `/sessions/${sessionId}`;
  const isChat = pathname === basePath || pathname === `${basePath}/`;

  // Chat view is handled by SessionsPage's keep-alive overlay system
  return isChat ? null : <Outlet />;
}

function NewSessionPanel(props: {
  onClose: () => void;
  onOpenSettings?: () => void;
  initialMachineId?: string | null;
  initialPrompt?: string;
}) {
  const { api } = useAppContext();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const {
    machines,
    isLoading: machinesLoading,
    error: machinesError,
  } = useMachines(api, true);

  const handleCancel = useCallback(() => {
    props.onClose();
  }, [props.onClose]);

  const handleSuccess = useCallback(
    (
      sessionId: string,
      options?: {
        initialMessage?: string;
        attachments?: AttachmentMetadata[];
        meta?: UserMessageMeta;
      },
    ) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.sessions });
      if (options?.initialMessage || options?.attachments?.length) {
        setPendingSessionInitialMessage(sessionId, {
          text: options?.initialMessage ?? "",
          attachments: options?.attachments,
          meta: options?.meta,
        });
      }
      selectWorkspaceTab("sessions");
      props.onClose();
      openWorkspaceSession(sessionId, "chat");
      navigate({ to: "/" });
    },
    [navigate, props.onClose, queryClient],
  );

  return (
    <NewSession
      api={api}
      machines={machines}
      includeTopSafeArea={false}
      isLoading={machinesLoading}
      loadError={machinesError}
      onCancel={handleCancel}
      onSuccess={handleSuccess}
      onOpenSettings={props.onOpenSettings}
      initialMachineId={props.initialMachineId}
      initialPrompt={props.initialPrompt}
    />
  );
}

function NewSessionPage() {
  const navigate = useNavigate();
  const goBack = useCallback(() => {
    void navigate({ to: "/", replace: true });
  }, [navigate]);
  return <NewSessionPanel onClose={goBack} />;
}

const rootRoute = createRootRoute({
  component: App,
});

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: WorkspaceRootPage,
});

const sessionsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/sessions",
  component: Outlet,
});

const sessionsIndexRoute = createRoute({
  getParentRoute: () => sessionsRoute,
  path: "/",
  component: SessionsCompatIndexPage,
});

const sessionDetailRoute = createRoute({
  getParentRoute: () => sessionsRoute,
  path: "$sessionId",
  component: Outlet,
});

const sessionChatCompatRoute = createRoute({
  getParentRoute: () => sessionDetailRoute,
  path: "/",
  component: () => <SessionCompatPage subview="chat" />,
});

const sessionFilesRoute = createRoute({
  getParentRoute: () => sessionDetailRoute,
  path: "files",
  validateSearch: (
    search: Record<string, unknown>,
  ): { tab?: "changes" | "directories" } => {
    const tabValue = typeof search.tab === "string" ? search.tab : undefined;
    const tab =
      tabValue === "directories"
        ? "directories"
        : tabValue === "changes"
          ? "changes"
          : undefined;

    return tab ? { tab } : {};
  },
  component: () => <SessionCompatPage subview="files" />,
});

const sessionTerminalRoute = createRoute({
  getParentRoute: () => sessionDetailRoute,
  path: "terminal",
  component: () => <SessionCompatPage subview="terminal" />,
});

type SessionFileSearch = {
  path: string;
  staged?: boolean;
  tab?: "changes" | "directories";
};

const sessionFileRoute = createRoute({
  getParentRoute: () => sessionDetailRoute,
  path: "file",
  validateSearch: (search: Record<string, unknown>): SessionFileSearch => {
    const path = typeof search.path === "string" ? search.path : "";
    const staged =
      search.staged === true || search.staged === "true"
        ? true
        : search.staged === false || search.staged === "false"
          ? false
          : undefined;

    const tabValue = typeof search.tab === "string" ? search.tab : undefined;
    const tab =
      tabValue === "directories"
        ? "directories"
        : tabValue === "changes"
          ? "changes"
          : undefined;

    const result: SessionFileSearch = { path };
    if (staged !== undefined) {
      result.staged = staged;
    }
    if (tab !== undefined) {
      result.tab = tab;
    }
    return result;
  },
  component: FilePage,
});

const newSessionRoute = createRoute({
  getParentRoute: () => sessionsRoute,
  path: "new",
  component: NewSessionPage,
});

const scheduledRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/scheduled",
  component: ScheduledCompatPage,
});

export const routeTree = rootRoute.addChildren([
  indexRoute,
  scheduledRoute,
  sessionsRoute.addChildren([
    sessionsIndexRoute,
    newSessionRoute,
    sessionDetailRoute.addChildren([
      sessionChatCompatRoute,
      sessionTerminalRoute,
      sessionFilesRoute,
      sessionFileRoute,
    ]),
  ]),
]);

type RouterHistory = Parameters<typeof createRouter>[0]["history"];

export function createAppRouter(history?: RouterHistory) {
  return createRouter({
    routeTree,
    history,
    scrollRestoration: true,
  });
}

export type AppRouter = ReturnType<typeof createAppRouter>;

declare module "@tanstack/react-router" {
  interface Register {
    router: AppRouter;
  }
}
