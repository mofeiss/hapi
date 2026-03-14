import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
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
import { HeaderActionGroup } from "@/components/HeaderActionGroup";
import {
  SessionList,
  groupSessionsByHost,
  getSessionTitle,
} from "@/components/SessionList";
import { NewSession } from "@/components/NewSession";
import { LoadingState } from "@/components/LoadingState";
import { SessionActionMenu } from "@/components/SessionActionMenu";
import { RenameSessionDialog } from "@/components/RenameSessionDialog";
import { useAppContext } from "@/lib/app-context";
import { useAppGoBack } from "@/hooks/useAppGoBack";
import { isTelegramApp } from "@/hooks/useTelegram";
import { useWidescreen } from "@/hooks/useWidescreen";
import { useLongPress } from "@/hooks/useLongPress";
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
import { useSessionTitleOverride } from "@/lib/session-title-override-store";
import { formatTimestamp } from "@/lib/dateTime";
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
  clearWorkspaceScheduledSelection,
  openWorkspaceScheduledTask,
  openWorkspaceSession,
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
const DESKTOP_SIDEBAR_MIN_WIDTH = 345;

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

type ScheduledEditState = {
  title: string;
  prompt: string;
  targetDirectory: string;
  model: string;
  scheduleType: "once" | "cron";
  runAt: string;
  cron: string;
  paused: boolean;
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

function formatScheduledDateTimeLocalInput(value: number | undefined): string {
  if (!value) return "";
  const date = new Date(value);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hour = String(date.getHours()).padStart(2, "0");
  const minute = String(date.getMinutes()).padStart(2, "0");
  const second = String(date.getSeconds()).padStart(2, "0");
  return (
    year + "-" + month + "-" + day + "T" + hour + ":" + minute + ":" + second
  );
}

function buildScheduledEditState(task: ScheduledTask): ScheduledEditState {
  return {
    title: task.title,
    prompt: task.prompt,
    targetDirectory: task.targetDirectory,
    model: task.model ?? "",
    scheduleType: task.scheduleType,
    runAt: formatScheduledDateTimeLocalInput(
      task.scheduleSpec.runAt ?? task.nextRunAt,
    ),
    cron: task.scheduleSpec.cron ?? "",
    paused: task.paused,
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
  const className =
    props.status === "succeeded"
      ? "bg-emerald-500/10 text-emerald-600"
      : props.status === "failed"
        ? "bg-red-500/10 text-red-600"
        : props.status === "running"
          ? "bg-blue-500/10 text-blue-600"
          : "bg-[var(--app-subtle-bg)] text-[var(--app-hint)]";

  return (
    <span
      className={
        "rounded-full px-2 py-0.5 text-[11px] font-medium " + className
      }
    >
      {props.status}
    </span>
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
  onSelect: (taskId: string, runId?: string | null) => void;
}) {
  const title = props.task.title.trim();
  const initial = getSessionInitial(title || "S");
  const toneClass = props.task.paused
    ? "bg-amber-500/15 text-amber-600"
    : props.latestRun?.status === "running"
      ? "bg-sky-500/15 text-sky-600"
      : props.latestRun?.status === "failed"
        ? "bg-red-500/15 text-red-600"
        : props.latestRun?.status === "succeeded"
          ? "bg-emerald-500/15 text-emerald-600"
          : "bg-[var(--app-subtle-bg)] text-[var(--app-hint)]";

  return (
    <button
      type="button"
      onClick={() => props.onSelect(props.task.id, props.latestRun?.id ?? null)}
      className={`flex w-full items-center justify-center px-1 py-1 hover:bg-[var(--app-subtle-bg)] ${props.selected ? "bg-[var(--app-secondary-bg)]" : ""}`}
      title={title}
    >
      <span
        className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[14px] font-medium leading-none select-none ${toneClass}`}
      >
        {initial}
      </span>
    </button>
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
    cancelScheduledTask,
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
  const [scheduledEditing, setScheduledEditing] = useState(false);
  const [scheduledEditState, setScheduledEditState] =
    useState<ScheduledEditState | null>(null);
  const [newSessionMachineId, setNewSessionMachineId] = useState<string | null>(
    null,
  );
  const [scheduledGroupCollapseOverrides, setScheduledGroupCollapseOverrides] =
    useState<Map<string, boolean>>(() => {
      try {
        const stored = localStorage.getItem(
          "hapi:panel:scheduled-group-collapsed",
        );
        if (stored) return new Map(JSON.parse(stored) as [string, boolean][]);
      } catch {
        /* ignore */
      }
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
        task.scheduleSpec.cron,
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

  const scheduledRunsByTaskId = useMemo(() => {
    const map = new Map<string, ScheduledTaskRun[]>();
    for (const run of scheduledRuns) {
      if (!map.has(run.taskId)) {
        map.set(run.taskId, []);
      }
      map.get(run.taskId)?.push(run);
    }
    for (const taskRuns of map.values()) {
      taskRuns.sort((left, right) => right.triggeredAt - left.triggeredAt);
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
      if (!existing || run.triggeredAt > existing.triggeredAt) {
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
        try {
          localStorage.setItem(
            "hapi:panel:scheduled-group-collapsed",
            JSON.stringify([...next.entries()]),
          );
        } catch {
          /* ignore */
        }
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
        try {
          localStorage.setItem(
            "hapi:panel:scheduled-group-collapsed",
            JSON.stringify([...next.entries()]),
          );
        } catch {
          /* ignore */
        }
      }
      return changed ? next : prev;
    });
  }, [scheduledGroups]);

  useEffect(() => {
    if (selectedScheduledTaskRuns.length === 0) {
      setSelectedScheduledRunId(null);
      return;
    }
    const exists = selectedScheduledTaskRuns.some(
      (run) => run.id === selectedScheduledRunId,
    );
    if (!exists) {
      setSelectedScheduledRunId(selectedScheduledTaskRuns[0]?.id ?? null);
    }
  }, [selectedScheduledRunId, selectedScheduledTaskRuns]);

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
      setScheduledEditState(buildScheduledEditState(selectedScheduledTask));
    }
  }, [scheduledEditing, selectedScheduledTask]);

  const selectedSessionId = workspace.selectedSessionId;

  // Panel resize state (persisted to localStorage)
  const [panelWidth, setPanelWidth] = useState(() => {
    const stored = localStorage.getItem("hapi:panel:leftWidth");
    return stored ? Math.max(DESKTOP_SIDEBAR_MIN_WIDTH, Number(stored)) : 420;
  });

  const [collapsed, setCollapsed] = useState(() => {
    return localStorage.getItem("hapi:panel:collapsed") === "true";
  });

  const { widescreen } = useWidescreen();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [newSessionOpen, setNewSessionOpen] = useState(false);
  const hasOverlay = settingsOpen || newSessionOpen;
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
    forwardSessionId: string | null;
  }>({
    canBack: false,
    canForward: false,
    activeSessionId: null,
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
  }, []);

  const toggleSettingsOverlay = useCallback(() => {
    if (settingsOpen) {
      closeSettingsOverlay();
      return;
    }

    restoreNewSessionAfterSettingsRef.current = newSessionOpen;
    setSettingsOpen(true);
    setNewSessionOpen(false);
    setToolbarMenuOpen(false);
  }, [closeSettingsOverlay, newSessionOpen, settingsOpen]);

  const openSettingsOverlay = useCallback(() => {
    restoreNewSessionAfterSettingsRef.current = newSessionOpen;
    setSettingsOpen(true);
    setNewSessionOpen(false);
    setToolbarMenuOpen(false);
  }, [newSessionOpen]);

  const toggleNewSessionOverlay = useCallback(() => {
    setSettingsOpen(false);
    setToolbarMenuOpen(false);
    setNewSessionMachineId(null);

    if (!narrowViewport) {
      setNewSessionOpen((prev) => !prev);
      setActiveSessionId(null);
      navigate({ to: "/" });
      return;
    }

    setNewSessionOpen((prev) => !prev);
  }, [narrowViewport, navigate]);

  const openNewSessionOverlay = useCallback(() => {
    setSettingsOpen(false);
    setToolbarMenuOpen(false);
    setNewSessionMachineId(null);

    if (!narrowViewport) {
      setNewSessionOpen(true);
      setActiveSessionId(null);
      navigate({ to: "/" });
      return;
    }

    setNewSessionOpen(true);
  }, [narrowViewport, navigate]);

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

  const isSubRoute =
    activeSessionId !== null && workspace.sessionSubview !== "chat";
  const isSessionsIndex = activeSessionId === null && !hasOverlay;

  const swipeNavEnabled = narrowViewport;
  const canSwipeBackToList =
    swipeNavEnabled && activeSessionId !== null && !isSubRoute && !hasOverlay;
  const canSwipeForwardToSession =
    swipeNavEnabled &&
    isSessionsIndex &&
    !hasOverlay &&
    Boolean(swipeForwardSessionId);

  swipeCapabilityRef.current = {
    canBack: canSwipeBackToList,
    canForward: canSwipeForwardToSession,
    activeSessionId,
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
        if (!capability.canBack || !capability.activeSessionId) {
          return false;
        }
        setSwipeForwardSessionId(capability.activeSessionId);
        setActiveSessionId(null);
        navigate({ to: "/" });
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
        localStorage.setItem("hapi:panel:leftWidth", String(finalWidth));
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
      localStorage.setItem("hapi:panel:collapsed", String(next));
      return next;
    });
  }, []);

  const toggleMobileSessionPane = useCallback(() => {
    if (!narrowViewport || hasOverlay || isSubRoute) {
      return;
    }

    if (activeSessionRef.current) {
      setSwipeForwardSessionId(activeSessionRef.current);
      setActiveSessionId(null);
      navigate({ to: "/" });
      return;
    }

    if (swipeForwardSessionId) {
      openSession(swipeForwardSessionId, { preserveForward: true });
    }
  }, [
    hasOverlay,
    isSubRoute,
    narrowViewport,
    navigate,
    openSession,
    swipeForwardSessionId,
  ]);

  useAppKeyboardShortcuts({
    isMobileViewport: narrowViewport,
    canToggleMobileSessionPane:
      narrowViewport &&
      !hasOverlay &&
      !isSubRoute &&
      (activeSessionId !== null || Boolean(swipeForwardSessionId)),
    onOpenNewSession: toggleNewSessionOverlay,
    onToggleSettings: toggleSettingsOverlay,
    onToggleDesktopSidebar: toggleCollapsed,
    onToggleMobileSessionPane: toggleMobileSessionPane,
  });

  const handleOpenScheduledTab = useCallback(() => {
    selectWorkspaceTab("scheduled");
    if (narrowViewport) {
      setSelectedScheduledTaskId(null);
      setSelectedScheduledRunId(null);
      clearWorkspaceScheduledSelection();
    }
  }, [narrowViewport]);

  const isScheduledTab = workspace.tab === "scheduled";
  const isSessionsTab = workspace.tab === "sessions";
  const effectiveCollapsed = collapsed;
  const scheduledIndexVisible = !selectedScheduledTaskId;
  const leftPanelVisible = effectiveCollapsed
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
    !narrowViewport && (newSessionOpen || (isSessionsTab && activeSessionId === null && !hasOverlay));
  const leftPanelContentScale = 1;
  const leftPanelContentStyle = {
    width: `${100 / leftPanelContentScale}%`,
    height: `${100 / leftPanelContentScale}%`,
    transform: `scale(${leftPanelContentScale})`,
    transformOrigin: "top left",
  };
  const showSidebarSearchRow = !effectiveCollapsed;
  const showSidebarBatchActions = !effectiveCollapsed && isSessionsTab;

  useEffect(() => {
    if (batchMode && !showSidebarBatchActions) {
      handleExitBatchMode();
    }
  }, [batchMode, handleExitBatchMode, showSidebarBatchActions]);

  return (
    <div className="flex h-full min-h-0" onWheel={handleRootWheel}>
      {/* Left panel */}
      <div
        className={`${leftPanelVisible} max-lg:!w-full shrink-0 flex-col overflow-hidden bg-[var(--app-bg)] lg:border-r lg:border-[var(--app-divider)]`}
        style={narrowViewport ? undefined : { width: panelWidth }}
      >
        <div className="flex h-full flex-col" style={leftPanelContentStyle}>
          <div className="bg-[var(--app-bg)] pt-[env(safe-area-inset-top)]">
            <div className="mx-auto w-full max-w-full lg:max-w-content px-3 pb-0 pt-2">
              <div className="flex items-end gap-2">
                <button
                  type="button"
                  onClick={toggleCollapsed}
                  className="hidden lg:inline-flex relative z-30 h-8 w-8 shrink-0 -translate-x-[1px] -translate-y-[3px] items-center justify-center text-[var(--app-fg)]"
                  title="Collapse sidebar"
                  aria-label="Collapse sidebar"
                >
                  <img
                    src="/icon.svg"
                    alt="HAPI"
                    className="h-7 w-7 shrink-0"
                  />
                </button>
                <div className="relative z-30 flex min-w-0 shrink-0 -translate-x-[1px] -translate-y-[3px] items-center justify-center lg:hidden">
                  <img
                    src="/icon.svg"
                    alt="HAPI"
                    className="h-7 w-7 shrink-0"
                  />
                </div>

                <div className="min-w-0 flex-1 overflow-visible pt-1">
                  <div className="-ml-[5px] flex min-w-0 items-end gap-[7px] overflow-visible pl-[2px]">
                    <button
                      type="button"
                      onClick={() => selectWorkspaceTab("sessions")}
                      className={`relative inline-flex shrink-0 -translate-x-[2px] items-center rounded-t-[12px] border border-b-0 px-3 py-2 text-xs font-semibold ${isSessionsTab ? "z-20 bg-[var(--app-bg)] text-[var(--app-fg)] border-[var(--app-border)]" : "z-30 -translate-y-px border-transparent bg-[var(--app-subtle-bg)] text-[var(--app-hint)] hover:bg-[var(--app-secondary-bg)] hover:text-[var(--app-fg)]"}`}
                      aria-pressed={isSessionsTab}
                    >
                      <span className="relative z-[1] inline-flex items-center gap-1.5">
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
                      className={`relative inline-flex shrink-0 -translate-x-[2px] items-center rounded-t-[12px] border border-b-0 px-3 py-2 text-xs font-semibold ${isScheduledTab ? "z-20 bg-[var(--app-bg)] text-[var(--app-fg)] border-[var(--app-border)]" : "z-30 -translate-y-px border-transparent bg-[var(--app-subtle-bg)] text-[var(--app-hint)] hover:bg-[var(--app-secondary-bg)] hover:text-[var(--app-fg)]"}`}
                      aria-pressed={isScheduledTab}
                    >
                      <span className="relative z-[1] inline-flex items-center gap-1.5">
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

          <div className="mx-auto flex min-h-0 w-full max-w-full flex-1 flex-col px-3 pb-3 lg:max-w-content">
            <div className="flex min-h-0 flex-1 flex-col pt-0">
              <div className="relative -mt-px flex min-h-0 flex-1 flex-col overflow-hidden rounded-[14px] border border-[var(--app-border)] bg-[var(--app-bg)] shadow-[0_10px_24px_rgba(15,23,42,0.04)]">
                <div
                  className={`min-h-0 flex-1 ${showSidebarSearchRow ? "" : "rounded-b-[14px]"}`}
                >
                  {isScheduledTab ? (
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
                            <div className="px-0 py-3 text-sm text-[var(--app-hint)]">
                              No scheduled tasks yet.
                            </div>
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
                                          <span className="break-words text-sm font-medium">
                                            {group.title}
                                          </span>
                                          <span className="shrink-0 text-xs text-[var(--app-hint)]">
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
                                            const statusText = task.paused
                                              ? t(
                                                  "scheduled.list.status.paused",
                                                )
                                              : latestRun?.status === "running"
                                                ? t(
                                                    "scheduled.list.status.running",
                                                  )
                                                : latestRun?.status === "failed"
                                                  ? t(
                                                      "scheduled.list.status.failed",
                                                    )
                                                  : latestRun?.status ===
                                                      "succeeded"
                                                    ? t(
                                                        "scheduled.list.status.succeeded",
                                                      )
                                                    : task.status === "active"
                                                      ? t(
                                                          "scheduled.list.status.active",
                                                        )
                                                      : t(
                                                          "scheduled.list.status.idle",
                                                        );
                                            const createdAtLabel =
                                              formatTimestamp(task.createdAt);
                                            const iconToneClass = task.paused
                                              ? "text-amber-600"
                                              : latestRun?.status === "running"
                                                ? "text-sky-600"
                                                : latestRun?.status === "failed"
                                                  ? "text-red-600"
                                                  : latestRun?.status ===
                                                      "succeeded"
                                                    ? "text-emerald-600"
                                                    : "text-[var(--app-hint)]";
                                            return (
                                              <button
                                                key={task.id}
                                                type="button"
                                                onClick={() => {
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
                                                className={
                                                  "session-list-item flex w-full flex-col gap-0.5 px-3 py-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--app-link)] select-none " +
                                                  rowBackgroundClass
                                                }
                                                style={rowStyle}
                                                aria-current={
                                                  selected ? "page" : undefined
                                                }
                                              >
                                                <div className="flex items-center justify-between gap-1.5">
                                                  <div className="flex min-w-0 items-center gap-1">
                                                    <span
                                                      className={
                                                        "inline-flex h-4 w-4 shrink-0 items-center justify-center " +
                                                        iconToneClass
                                                      }
                                                      aria-label={t(
                                                        "scheduled.list.iconLabel",
                                                      )}
                                                    >
                                                      {latestRun?.status ===
                                                      "running" ? (
                                                        <svg
                                                          className="h-3.5 w-3.5 animate-spin"
                                                          viewBox="0 0 24 24"
                                                          fill="none"
                                                          stroke="currentColor"
                                                          strokeWidth="2"
                                                          strokeLinecap="round"
                                                          strokeLinejoin="round"
                                                          aria-hidden="true"
                                                        >
                                                          <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                                                        </svg>
                                                      ) : latestRun?.status ===
                                                        "failed" ? (
                                                        <svg
                                                          className="h-3.5 w-3.5"
                                                          viewBox="0 0 24 24"
                                                          fill="none"
                                                          stroke="currentColor"
                                                          strokeWidth="2"
                                                          strokeLinecap="round"
                                                          strokeLinejoin="round"
                                                          aria-hidden="true"
                                                        >
                                                          <circle
                                                            cx="12"
                                                            cy="12"
                                                            r="10"
                                                          />
                                                          <path d="m15 9-6 6" />
                                                          <path d="m9 9 6 6" />
                                                        </svg>
                                                      ) : latestRun?.status ===
                                                        "succeeded" ? (
                                                        <svg
                                                          className="h-3.5 w-3.5"
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
                                                      ) : task.paused ? (
                                                        <svg
                                                          className="h-3.5 w-3.5"
                                                          viewBox="0 0 24 24"
                                                          fill="currentColor"
                                                          aria-hidden="true"
                                                        >
                                                          <rect
                                                            x="6"
                                                            y="5"
                                                            width="4"
                                                            height="14"
                                                            rx="1"
                                                          />
                                                          <rect
                                                            x="14"
                                                            y="5"
                                                            width="4"
                                                            height="14"
                                                            rx="1"
                                                          />
                                                        </svg>
                                                      ) : (
                                                        <svg
                                                          className="h-3.5 w-3.5"
                                                          viewBox="0 0 24 24"
                                                          fill="currentColor"
                                                          aria-hidden="true"
                                                        >
                                                          <circle
                                                            cx="12"
                                                            cy="12"
                                                            r="4"
                                                          />
                                                        </svg>
                                                      )}
                                                    </span>
                                                    <div
                                                      className={`truncate text-sm leading-none ${
                                                        selected
                                                          ? "font-semibold text-[var(--app-fg)]"
                                                          : "font-medium text-[var(--app-fg)]"
                                                      }`}
                                                    >
                                                      {task.title}
                                                    </div>
                                                  </div>
                                                  <div className="flex shrink-0 items-center gap-1 text-xs">
                                                    <span
                                                      className={
                                                        task.paused
                                                          ? "text-amber-600"
                                                          : latestRun?.status ===
                                                              "failed"
                                                            ? "text-red-600"
                                                            : latestRun?.status ===
                                                                "running"
                                                              ? "text-sky-600"
                                                              : latestRun?.status ===
                                                                  "succeeded"
                                                                ? "text-emerald-600"
                                                                : "text-[var(--app-hint)]"
                                                      }
                                                    >
                                                      {statusText}
                                                    </span>
                                                  </div>
                                                </div>
                                                <div
                                                  className="flex items-center gap-x-2 text-xs text-[var(--app-hint)] overflow-hidden whitespace-nowrap"
                                                  style={{
                                                    opacity:
                                                      "var(--app-session-subtitle-opacity)",
                                                  }}
                                                >
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
                                                      <path d="M12 8V4H8" />
                                                      <rect
                                                        x="4"
                                                        y="8"
                                                        width="16"
                                                        height="12"
                                                        rx="2"
                                                      />
                                                      <path d="M2 14h2" />
                                                      <path d="M20 14h2" />
                                                      <path d="M15 13v2" />
                                                      <path d="M9 13v2" />
                                                    </svg>
                                                    <span>
                                                      {task.agentFlavor}
                                                    </span>
                                                  </span>
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
                                                      <path d="M4 7h16" />
                                                      <path d="M7 3v8" />
                                                      <path d="M17 3v8" />
                                                      <rect
                                                        x="4"
                                                        y="7"
                                                        width="16"
                                                        height="13"
                                                        rx="2"
                                                      />
                                                    </svg>
                                                    <span>{typeText}</span>
                                                  </span>
                                                  {createdAtLabel ? (
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
                                                        <circle
                                                          cx="12"
                                                          cy="12"
                                                          r="10"
                                                        />
                                                        <polyline points="12 6 12 12 16 14" />
                                                      </svg>
                                                      <span>
                                                        {createdAtLabel}
                                                      </span>
                                                    </span>
                                                  ) : null}
                                                </div>
                                              </button>
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
                    <div className="flex items-center gap-2 rounded-[14px] border border-[var(--app-divider)] bg-[var(--app-bg)] px-3 py-2 shadow-[0_1px_0_rgba(255,255,255,0.35)_inset]">
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
          {/* Top: expand button */}
          <div className="flex shrink-0 justify-center px-2 py-2">
            <button
              type="button"
              onClick={toggleCollapsed}
              className="inline-flex h-8 w-8 translate-y-[2px] items-center justify-center text-[var(--app-fg)]"
              title="Expand sidebar"
              aria-label="Expand sidebar"
            >
              <img src="/icon.svg" alt="HAPI" className="h-7 w-7 shrink-0" />
            </button>
          </div>
          <div className="mx-2 h-px bg-[var(--app-divider)] shrink-0" />
          <div className="px-2 py-1.5 pt-[calc(0.375rem+3px)] shrink-0 flex flex-col items-center gap-1.5">
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
                        onSelect={(taskId, runId) => {
                          setSelectedScheduledTaskId(taskId);
                          setSelectedScheduledRunId(runId ?? null);
                          openWorkspaceScheduledTask(taskId, runId ?? null);
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
        className={`${(isSessionsTab ? isSessionsIndex : scheduledIndexVisible) && !hasOverlay ? "hidden lg:flex" : "flex"} relative min-w-0 flex-1 flex-col bg-[var(--app-bg)] ${widescreen ? `widescreen-mode ${!effectiveCollapsed ? "lg:pr-[7px]" : ""}` : ""}`}
      >
        {showDesktopNewSessionPane ? (
          <div className="flex-1 min-h-0">
            <NewSessionPanel
              onClose={() => setNewSessionOpen(false)}
              onOpenSettings={openSettingsOverlay}
              initialMachineId={newSessionMachineId}
            />
          </div>
        ) : isScheduledTab ? (
          <div className="flex-1 min-h-0 overflow-y-auto">
            {!selectedScheduledTask ? (
              <div className="flex h-full items-center justify-center px-6 text-sm text-[var(--app-hint)]">
                Select a scheduled task to manage it.
              </div>
            ) : (
              <div className="mx-auto flex w-full max-w-content flex-col gap-4 px-4 py-4">
                <div className="rounded-[24px] border border-[var(--app-border)] bg-[var(--app-panel-bg)] p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      {scheduledEditing && scheduledEditState ? (
                        <input
                          value={scheduledEditState.title}
                          onChange={(event) =>
                            setScheduledEditState((current) =>
                              current
                                ? { ...current, title: event.target.value }
                                : current,
                            )
                          }
                          className="w-full rounded-lg border border-[var(--app-border)] bg-[var(--app-bg)] px-3 py-2 text-base font-semibold text-[var(--app-fg)]"
                        />
                      ) : (
                        <h1 className="truncate text-xl font-semibold text-[var(--app-fg)]">
                          {selectedScheduledTask.title}
                        </h1>
                      )}
                      <p className="mt-1 text-sm text-[var(--app-hint)]">
                        {t("scheduled.detail.summary")}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {!scheduledEditing ? (
                        <>
                          <button
                            type="button"
                            disabled={scheduledPending}
                            onClick={() => setScheduledEditing(true)}
                            className="rounded-lg border border-[var(--app-border)] px-3 py-2 text-sm text-[var(--app-fg)] disabled:opacity-50"
                          >
                            {t("scheduled.action.edit")}
                          </button>
                          <button
                            type="button"
                            disabled={scheduledPending}
                            onClick={() => {
                              if (!selectedScheduledTask) return;
                              void updateScheduledTask({
                                taskId: selectedScheduledTask.id,
                                paused: !selectedScheduledTask.paused,
                              });
                            }}
                            className="rounded-lg border border-[var(--app-border)] px-3 py-2 text-sm text-[var(--app-fg)] disabled:opacity-50"
                          >
                            {selectedScheduledTask.paused
                              ? t("scheduled.action.resume")
                              : t("scheduled.action.pause")}
                          </button>
                          <button
                            type="button"
                            disabled={
                              scheduledPending ||
                              selectedScheduledTask.status !== "active" ||
                              selectedScheduledTask.paused
                            }
                            onClick={() =>
                              void cancelScheduledTask(selectedScheduledTask.id)
                            }
                            className="rounded-lg border border-[var(--app-border)] px-3 py-2 text-sm text-[var(--app-fg)] disabled:opacity-50"
                          >
                            {t("scheduled.action.cancel")}
                          </button>
                          <button
                            type="button"
                            disabled={scheduledPending}
                            onClick={() =>
                              void deleteScheduledTask(selectedScheduledTask.id)
                            }
                            className="rounded-lg border border-red-300 px-3 py-2 text-sm text-red-600 disabled:opacity-50"
                          >
                            {t("scheduled.action.delete")}
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            type="button"
                            disabled={scheduledPending || !scheduledEditState}
                            onClick={() => {
                              if (!selectedScheduledTask || !scheduledEditState)
                                return;
                              const parsedRunAt = Date.parse(
                                scheduledEditState.runAt,
                              );
                              const body: Record<string, unknown> = {
                                taskId: selectedScheduledTask.id,
                                title: scheduledEditState.title,
                                prompt: scheduledEditState.prompt,
                                targetDirectory:
                                  scheduledEditState.targetDirectory,
                                model:
                                  scheduledEditState.model.trim() || undefined,
                                scheduleType: scheduledEditState.scheduleType,
                                paused: scheduledEditState.paused,
                              };
                              if (scheduledEditState.scheduleType === "once") {
                                if (Number.isFinite(parsedRunAt)) {
                                  body.runAt = parsedRunAt;
                                }
                              } else {
                                body.cron = scheduledEditState.cron.trim();
                              }
                              void updateScheduledTask(body).then(() => {
                                setScheduledEditing(false);
                              });
                            }}
                            className="rounded-lg border border-[var(--app-border)] px-3 py-2 text-sm text-[var(--app-fg)] disabled:opacity-50"
                          >
                            {t("scheduled.action.save")}
                          </button>
                          <button
                            type="button"
                            disabled={scheduledPending}
                            onClick={() => {
                              setScheduledEditState(
                                buildScheduledEditState(selectedScheduledTask),
                              );
                              setScheduledEditing(false);
                            }}
                            className="rounded-lg border border-[var(--app-border)] px-3 py-2 text-sm text-[var(--app-fg)] disabled:opacity-50"
                          >
                            {t("scheduled.action.cancelEdit")}
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="mt-4 grid gap-3 text-sm md:grid-cols-2 xl:grid-cols-3">
                    <div className="rounded-2xl bg-[var(--app-secondary-bg)] px-3 py-3">
                      <div className="text-xs uppercase tracking-[0.12em] text-[var(--app-hint)]">
                        {t("scheduled.detail.status")}
                      </div>
                      <div className="mt-1 text-sm text-[var(--app-fg)]">
                        {selectedScheduledTask.status}
                        {selectedScheduledTask.paused ? " / paused" : ""}
                      </div>
                    </div>
                    <div className="rounded-2xl bg-[var(--app-secondary-bg)] px-3 py-3">
                      <div className="text-xs uppercase tracking-[0.12em] text-[var(--app-hint)]">
                        {t("scheduled.detail.schedule")}
                      </div>
                      <div className="mt-1 text-sm text-[var(--app-fg)]">
                        {selectedScheduledTask.scheduleType}
                      </div>
                    </div>
                    <div className="rounded-2xl bg-[var(--app-secondary-bg)] px-3 py-3">
                      <div className="text-xs uppercase tracking-[0.12em] text-[var(--app-hint)]">
                        {t("scheduled.detail.agent")}
                      </div>
                      <div className="mt-1 text-sm text-[var(--app-fg)]">
                        {selectedScheduledTask.agentFlavor}
                      </div>
                    </div>
                    <div className="rounded-2xl bg-[var(--app-secondary-bg)] px-3 py-3">
                      <div className="text-xs uppercase tracking-[0.12em] text-[var(--app-hint)]">
                        {t("scheduled.detail.created")}
                      </div>
                      <div className="mt-1 text-sm text-[var(--app-fg)]">
                        {formatScheduledDateTime(
                          selectedScheduledTask.createdAt,
                        )}
                      </div>
                    </div>
                    <div className="rounded-2xl bg-[var(--app-secondary-bg)] px-3 py-3">
                      <div className="text-xs uppercase tracking-[0.12em] text-[var(--app-hint)]">
                        {t("scheduled.detail.nextRun")}
                      </div>
                      <div className="mt-1 text-sm text-[var(--app-fg)]">
                        {formatScheduledDateTime(
                          selectedScheduledTask.nextRunAt,
                        )}
                      </div>
                    </div>
                    <div className="rounded-2xl bg-[var(--app-secondary-bg)] px-3 py-3">
                      <div className="text-xs uppercase tracking-[0.12em] text-[var(--app-hint)]">
                        {t("scheduled.detail.lastRun")}
                      </div>
                      <div className="mt-1 text-sm text-[var(--app-fg)]">
                        {formatScheduledDateTime(
                          selectedScheduledTask.lastRunAt,
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    <div className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-bg)] px-4 py-3">
                      <div className="text-xs uppercase tracking-[0.12em] text-[var(--app-hint)]">
                        {t("scheduled.detail.prompt")}
                      </div>
                      {scheduledEditing && scheduledEditState ? (
                        <textarea
                          value={scheduledEditState.prompt}
                          onChange={(event) =>
                            setScheduledEditState((current) =>
                              current
                                ? { ...current, prompt: event.target.value }
                                : current,
                            )
                          }
                          rows={6}
                          className="mt-2 w-full rounded-lg border border-[var(--app-border)] bg-[var(--app-bg)] px-3 py-2 text-sm text-[var(--app-fg)]"
                        />
                      ) : (
                        <div className="mt-2 whitespace-pre-wrap text-sm text-[var(--app-fg)]">
                          {selectedScheduledTask.prompt}
                        </div>
                      )}
                    </div>
                    <div className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-bg)] px-4 py-3">
                      <div className="text-xs uppercase tracking-[0.12em] text-[var(--app-hint)]">
                        {t("scheduled.detail.config")}
                      </div>
                      <div className="mt-2 space-y-2 text-sm text-[var(--app-fg)]">
                        <div>
                          <span className="text-[var(--app-hint)]">
                            {t("scheduled.detail.directory")}:
                          </span>{" "}
                          {scheduledEditing && scheduledEditState ? (
                            <input
                              value={scheduledEditState.targetDirectory}
                              onChange={(event) =>
                                setScheduledEditState((current) =>
                                  current
                                    ? {
                                        ...current,
                                        targetDirectory: event.target.value,
                                      }
                                    : current,
                                )
                              }
                              className="mt-1 w-full rounded-lg border border-[var(--app-border)] bg-[var(--app-bg)] px-3 py-2 text-sm text-[var(--app-fg)]"
                            />
                          ) : (
                            <span className="break-all">
                              {" "}
                              {selectedScheduledTask.targetDirectory}
                            </span>
                          )}
                        </div>
                        <div>
                          <span className="text-[var(--app-hint)]">
                            {t("scheduled.detail.model")}:
                          </span>{" "}
                          {scheduledEditing && scheduledEditState ? (
                            <input
                              value={scheduledEditState.model}
                              onChange={(event) =>
                                setScheduledEditState((current) =>
                                  current
                                    ? { ...current, model: event.target.value }
                                    : current,
                                )
                              }
                              className="mt-1 w-full rounded-lg border border-[var(--app-border)] bg-[var(--app-bg)] px-3 py-2 text-sm text-[var(--app-fg)]"
                            />
                          ) : (
                            <span> {selectedScheduledTask.model ?? "-"}</span>
                          )}
                        </div>
                        <div>
                          <span className="text-[var(--app-hint)]">
                            {t("scheduled.detail.timezone")}:
                          </span>{" "}
                          <span> {selectedScheduledTask.timezone}</span>
                        </div>
                        <div>
                          <span className="text-[var(--app-hint)]">
                            {t("scheduled.detail.taskId")}:
                          </span>{" "}
                          <span className="break-all">
                            {" "}
                            {selectedScheduledTask.id}
                          </span>
                        </div>
                        {scheduledEditing && scheduledEditState ? (
                          <>
                            <label className="block">
                              <span className="text-[var(--app-hint)]">
                                {t("scheduled.detail.scheduleType")}
                              </span>
                              <select
                                value={scheduledEditState.scheduleType}
                                onChange={(event) =>
                                  setScheduledEditState((current) =>
                                    current
                                      ? {
                                          ...current,
                                          scheduleType: event.target.value as
                                            | "once"
                                            | "cron",
                                        }
                                      : current,
                                  )
                                }
                                className="mt-1 w-full rounded-lg border border-[var(--app-border)] bg-[var(--app-bg)] px-3 py-2 text-sm text-[var(--app-fg)]"
                              >
                                <option value="once">once</option>
                                <option value="cron">cron</option>
                              </select>
                            </label>
                            {scheduledEditState.scheduleType === "once" ? (
                              <label className="block">
                                <span className="text-[var(--app-hint)]">
                                  {t("scheduled.detail.runAt")}
                                </span>
                                <input
                                  type="datetime-local"
                                  step={1}
                                  value={scheduledEditState.runAt}
                                  onChange={(event) =>
                                    setScheduledEditState((current) =>
                                      current
                                        ? {
                                            ...current,
                                            runAt: event.target.value,
                                          }
                                        : current,
                                    )
                                  }
                                  className="mt-1 w-full rounded-lg border border-[var(--app-border)] bg-[var(--app-bg)] px-3 py-2 text-sm text-[var(--app-fg)]"
                                />
                              </label>
                            ) : (
                              <label className="block">
                                <span className="text-[var(--app-hint)]">
                                  {t("scheduled.detail.cron")}
                                </span>
                                <input
                                  value={scheduledEditState.cron}
                                  onChange={(event) =>
                                    setScheduledEditState((current) =>
                                      current
                                        ? {
                                            ...current,
                                            cron: event.target.value,
                                          }
                                        : current,
                                    )
                                  }
                                  className="mt-1 w-full rounded-lg border border-[var(--app-border)] bg-[var(--app-bg)] px-3 py-2 text-sm text-[var(--app-fg)]"
                                />
                              </label>
                            )}
                          </>
                        ) : (
                          <div>
                            <span className="text-[var(--app-hint)]">
                              {t("scheduled.detail.expression")}:
                            </span>{" "}
                            <span>
                              {" "}
                              {selectedScheduledTask.scheduleSpec.cron ??
                                formatScheduledDateTime(
                                  selectedScheduledTask.scheduleSpec.runAt,
                                )}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 rounded-2xl border border-[var(--app-border)] bg-[var(--app-bg)] px-4 py-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <h2 className="text-base font-semibold text-[var(--app-fg)]">
                          {t("scheduled.detail.runs")}
                        </h2>
                        <p className="text-sm text-[var(--app-hint)]">
                          Each execution stays attached to this task. Pick one
                          to inspect its result.
                        </p>
                      </div>
                      <div className="text-sm text-[var(--app-hint)]">
                        {selectedScheduledTaskRuns.length} runs
                      </div>
                    </div>
                    {selectedScheduledTaskRuns.length === 0 ? (
                      <div className="mt-4 rounded-2xl border border-dashed border-[var(--app-border)] px-4 py-6 text-sm text-[var(--app-hint)]">
                        This task has not produced any runs yet.
                      </div>
                    ) : (
                      <div className="mt-4 space-y-4">
                        <div className="overflow-x-auto pb-1">
                          <div className="flex min-w-max gap-3">
                            {selectedScheduledTaskRuns.map((run) => (
                              <button
                                key={run.id}
                                type="button"
                                onClick={() => {
                                  setSelectedScheduledRunId(run.id);
                                  selectWorkspaceScheduledRun(run.id);
                                }}
                                className={
                                  "min-w-[280px] rounded-2xl border px-4 py-3 text-left " +
                                  (run.id === selectedScheduledRunId
                                    ? "border-[var(--app-fg)] bg-[var(--app-secondary-bg)]"
                                    : "border-[var(--app-border)] hover:bg-[var(--app-subtle-bg)]")
                                }
                              >
                                <div className="flex items-start justify-between gap-3">
                                  <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-2">
                                      <ScheduledRunStatusBadge
                                        status={run.status}
                                      />
                                      <span className="text-[11px] text-[var(--app-hint)]">
                                        {formatScheduledDateTime(
                                          run.triggeredAt,
                                        )}
                                      </span>
                                    </div>
                                    <div className="mt-2 text-xs text-[var(--app-hint)]">
                                      scheduled{" "}
                                      {formatScheduledDateTime(
                                        run.scheduledFor,
                                      )}
                                    </div>
                                    {run.sessionId ? (
                                      <div className="mt-1 truncate text-xs text-[var(--app-fg)]">
                                        session {run.sessionId}
                                      </div>
                                    ) : null}
                                  </div>
                                </div>
                              </button>
                            ))}
                          </div>
                        </div>
                        <div className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-bg)] px-4 py-4">
                          {!selectedScheduledRun ? (
                            <div className="text-sm text-[var(--app-hint)]">
                              Pick a run to inspect it.
                            </div>
                          ) : (
                            <div className="space-y-4">
                              <div>
                                <div className="flex items-center gap-2">
                                  <h3 className="text-base font-semibold text-[var(--app-fg)]">
                                    {t("scheduled.detail.selectedRun")}
                                  </h3>
                                  <ScheduledRunStatusBadge
                                    status={selectedScheduledRun.status}
                                  />
                                </div>
                                <p className="mt-1 text-sm text-[var(--app-hint)]">
                                  The selected run owns the session detail
                                  below.
                                </p>
                              </div>
                              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                                <div>
                                  <div className="text-xs uppercase tracking-[0.12em] text-[var(--app-hint)]">
                                    {t("scheduled.detail.triggered")}
                                  </div>
                                  <div className="mt-1 text-sm text-[var(--app-fg)]">
                                    {formatScheduledDateTime(
                                      selectedScheduledRun.triggeredAt,
                                    )}
                                  </div>
                                </div>
                                <div>
                                  <div className="text-xs uppercase tracking-[0.12em] text-[var(--app-hint)]">
                                    {t("scheduled.detail.finished")}
                                  </div>
                                  <div className="mt-1 text-sm text-[var(--app-fg)]">
                                    {formatScheduledDateTime(
                                      selectedScheduledRun.finishedAt,
                                    )}
                                  </div>
                                </div>
                                <div>
                                  <div className="text-xs uppercase tracking-[0.12em] text-[var(--app-hint)]">
                                    {t("scheduled.detail.runId")}
                                  </div>
                                  <div className="mt-1 break-all text-sm text-[var(--app-fg)]">
                                    {selectedScheduledRun.id}
                                  </div>
                                </div>
                                <div>
                                  <div className="text-xs uppercase tracking-[0.12em] text-[var(--app-hint)]">
                                    {t("scheduled.detail.session")}
                                  </div>
                                  <div className="mt-1 break-all text-sm text-[var(--app-fg)]">
                                    {selectedScheduledRun.sessionId ?? "-"}
                                  </div>
                                </div>
                              </div>
                              {selectedScheduledRun.error ? (
                                <div className="rounded-2xl bg-red-500/8 px-4 py-3 text-sm text-red-600">
                                  {selectedScheduledRun.error}
                                </div>
                              ) : null}
                              {selectedScheduledRun.resultSummary ? (
                                <div className="rounded-2xl bg-[var(--app-secondary-bg)] px-4 py-3 text-sm text-[var(--app-fg)]">
                                  {selectedScheduledRun.resultSummary}
                                </div>
                              ) : null}
                              {selectedScheduledRun.sessionId ? (
                                <div className="rounded-2xl border border-[var(--app-border)] px-0 py-0 overflow-hidden">
                                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--app-border)] px-4 py-3">
                                    <div>
                                      <div className="text-sm font-medium text-[var(--app-fg)]">
                                        {t("scheduled.detail.sessionView")}
                                      </div>
                                      <div className="mt-1 text-sm text-[var(--app-hint)]">
                                        Embedded session view for the selected
                                        run.
                                      </div>
                                    </div>
                                    <div className="flex gap-2">
                                      <button
                                        type="button"
                                        onClick={() =>
                                          openWorkspaceSession(
                                            selectedScheduledRun.sessionId as string,
                                            "chat",
                                          )
                                        }
                                        className="rounded-lg border border-[var(--app-border)] px-3 py-2 text-sm text-[var(--app-fg)]"
                                      >
                                        {t("scheduled.detail.openFullscreen")}
                                      </button>
                                      <Link
                                        to="/sessions/$sessionId"
                                        params={{
                                          sessionId:
                                            selectedScheduledRun.sessionId as string,
                                        }}
                                        className="rounded-lg border border-[var(--app-border)] px-3 py-2 text-sm text-[var(--app-fg)]"
                                      >
                                        {t("scheduled.detail.openDeepLink")}
                                      </Link>
                                    </div>
                                  </div>
                                  <div className="h-[760px] bg-[var(--app-bg)]">
                                    <EmbeddedSessionView
                                      sessionId={
                                        selectedScheduledRun.sessionId as string
                                      }
                                      onBack={() =>
                                        setSelectedScheduledRunId(null)
                                      }
                                    />
                                  </div>
                                </div>
                              ) : null}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
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
        {narrowViewport && newSessionOpen ? (
          <div className="absolute inset-0 z-50 bg-[var(--app-bg)] transition-opacity duration-200 opacity-100">
            <NewSessionPanel
              onClose={() => setNewSessionOpen(false)}
              onOpenSettings={openSettingsOverlay}
              initialMachineId={newSessionMachineId}
            />
          </div>
        ) : null}
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
}: {
  sessionId: string;
  onBack: () => void;
  onSessionDeleted?: () => void;
  isDark?: boolean;
  onToggleTheme?: () => void;
  onOpenSettings?: () => void;
  onOpenNewSession?: () => void;
}) {
  return (
    <EmbeddedSessionView
      sessionId={sessionId}
      onBack={onBack}
      onSessionDeleted={onSessionDeleted}
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
      isLoading={machinesLoading}
      loadError={machinesError}
      onCancel={handleCancel}
      onSuccess={handleSuccess}
      onOpenSettings={props.onOpenSettings}
      initialMachineId={props.initialMachineId}
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
