import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Navigate,
  Outlet,
  createRootRoute,
  createRoute,
  createRouter,
  useLocation,
  useMatchRoute,
  useNavigate,
  useParams,
} from "@tanstack/react-router";
import { App } from "@/App";
import { SessionChat } from "@/components/SessionChat";
import {
  SessionList,
  groupSessionsByHost,
  getSessionTitle,
} from "@/components/SessionList";
import { NewSession } from "@/components/NewSession";
import { LoadingState } from "@/components/LoadingState";
import { SessionActionMenu } from "@/components/SessionActionMenu";
import { RenameSessionDialog } from "@/components/RenameSessionDialog";
import { QuickLanguageToggle } from "@/components/QuickLanguageToggle";
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
import { useSlashCommands } from "@/hooks/queries/useSlashCommands";
import { useSkills } from "@/hooks/queries/useSkills";
import { useSendMessage } from "@/hooks/mutations/useSendMessage";
import { useSessionActions } from "@/hooks/mutations/useSessionActions";
import { queryKeys } from "@/lib/query-keys";
import { useToast } from "@/lib/toast-context";
import { useTranslation } from "@/lib/use-translation";
import { useTheme } from "@/hooks/useTheme";
import { useSessionTitleOverride } from "@/lib/session-title-override-store";
import type { PermissionMode, SessionSummary } from "@/types/api";
import {
  fetchLatestMessages,
  seedMessageWindowFromSession,
  clearMessageWindow,
} from "@/lib/message-window-store";
import {
  clearPendingSessionMode,
  setPendingSessionMode,
  usePendingSessionMode,
} from "@/lib/pending-session-mode-store";
import FilesPage from "@/routes/sessions/files";
import FilePage from "@/routes/sessions/file";
import TerminalPage from "@/routes/sessions/terminal";
import { SettingsPanel } from "@/routes/settings";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";

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

function NewChatIcon(props: { className?: string }) {
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
      <line x1="12" y1="7" x2="12" y2="13" />
      <line x1="9" y1="10" x2="15" y2="10" />
    </svg>
  );
}

function QuickCloneChatIcon(props: { className?: string }) {
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
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
      <line x1="15.5" y1="14.5" x2="15.5" y2="18.5" />
      <line x1="13.5" y1="16.5" x2="17.5" y2="16.5" />
    </svg>
  );
}

function SettingsIcon(props: { className?: string }) {
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
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}

function SidebarCollapseIcon(props: { className?: string }) {
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
      <path d="m16 15-3-3 3-3" />
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

function SunIcon(props: { className?: string }) {
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
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2" />
      <path d="M12 20v2" />
      <path d="m4.93 4.93 1.41 1.41" />
      <path d="m17.66 17.66 1.41 1.41" />
      <path d="M2 12h2" />
      <path d="M20 12h2" />
      <path d="m6.34 17.66-1.41 1.41" />
      <path d="m19.07 4.93-1.41 1.41" />
    </svg>
  );
}

function MoonIcon(props: { className?: string }) {
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
      <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
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

function SessionsPage() {
  const { api } = useAppContext();
  const navigate = useNavigate();
  const pathname = useLocation({ select: (location) => location.pathname });
  const matchRoute = useMatchRoute();
  const { t } = useTranslation();
  const { addToast } = useToast();
  const { isDark, toggleTheme } = useTheme();
  const { sessions, isLoading, error, refetch } = useSessions(api);

  const [filterOnlineOnly, setFilterOnlineOnly] = useState(() => {
    try {
      return localStorage.getItem("hapi:filter:onlineOnly") === "1";
    } catch {
      return false;
    }
  });
  const [sessionSearch, setSessionSearch] = useState("");

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

  const sessionMatch = matchRoute({ to: "/sessions/$sessionId", fuzzy: true });
  const selectedSessionId =
    sessionMatch && sessionMatch.sessionId !== "new"
      ? sessionMatch.sessionId
      : null;
  const isSessionsIndex = pathname === "/sessions" || pathname === "/sessions/";

  // Panel resize state (persisted to localStorage)
  const [panelWidth, setPanelWidth] = useState(() => {
    const stored = localStorage.getItem("hapi:panel:leftWidth");
    return stored ? Math.max(280, Number(stored)) : 420;
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
  }, [selectedSessionId]);

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
      navigate({ to: "/sessions/$sessionId", params: { sessionId } });
    },
    [navigate],
  );

  const handleSelectSession = useCallback(
    (sessionId: string) => {
      openSession(sessionId);
    },
    [openSession],
  );

  const handleSessionBack = useCallback(() => {
    if (activeSessionRef.current) {
      setSwipeForwardSessionId(activeSessionRef.current);
    }
    setActiveSessionId(null);
    navigate({ to: "/sessions" });
  }, [navigate]);

  const handleSessionDeleted = useCallback(
    (deletedId: string) => {
      setMountedSessions((prev) => prev.filter((id) => id !== deletedId));
      setSwipeForwardSessionId((prev) => (prev === deletedId ? null : prev));
      if (activeSessionRef.current === deletedId) {
        setActiveSessionId(null);
        navigate({ to: "/sessions" });
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
        navigate({ to: "/sessions" });
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

  const toggleSettingsOverlay = useCallback(() => {
    setSettingsOpen((prev) => !prev);
    setNewSessionOpen(false);
    setToolbarMenuOpen(false);
  }, []);

  const toggleNewSessionOverlay = useCallback(() => {
    setNewSessionOpen((prev) => !prev);
    setSettingsOpen(false);
    setToolbarMenuOpen(false);
  }, []);

  const openNewSessionOverlay = useCallback(() => {
    setNewSessionOpen(true);
    setSettingsOpen(false);
    setToolbarMenuOpen(false);
  }, []);


  const isSubRoute =
    activeSessionId !== null &&
    pathname !== `/sessions/${activeSessionId}` &&
    pathname !== `/sessions/${activeSessionId}/` &&
    pathname.startsWith(`/sessions/${activeSessionId}/`);

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
        navigate({ to: "/sessions" });
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
          Math.round(Math.min(Math.max(startWidth + delta, 280), maxW)),
        );
      };

      const onUp = (ev: PointerEvent) => {
        el.removeEventListener("pointermove", onMove);
        el.removeEventListener("pointerup", onUp);
        el.releasePointerCapture(ev.pointerId);
        const delta = ev.clientX - startX;
        const maxW = window.innerWidth * 0.5;
        const finalWidth = Math.round(
          Math.min(Math.max(startWidth + delta, 280), maxW),
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
      navigate({ to: "/sessions" });
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

  const leftPanelVisible = collapsed
    ? isSessionsIndex && !hasOverlay
      ? "flex lg:hidden"
      : "hidden"
    : isSessionsIndex && !hasOverlay
      ? "flex"
      : "hidden lg:flex";
  const leftPanelContentScale = narrowViewport ? 1 : 1.08;
  const leftPanelContentStyle = {
    width: `${100 / leftPanelContentScale}%`,
    height: `${100 / leftPanelContentScale}%`,
    transform: `scale(${leftPanelContentScale})`,
    transformOrigin: "top left",
  };
  const showSidebarSearchRow = !collapsed;
  const showSidebarBatchActions = !collapsed;

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
          <div className="mx-auto w-full max-w-full lg:max-w-content flex items-center justify-between px-3 py-2">
            <div className="flex items-center gap-1.5 min-w-0 shrink-0">
              <img src="/icon.svg" alt="HAPI" className="h-5 w-5 shrink-0" />
              <span className="text-sm font-semibold text-[var(--app-fg)] select-none shrink-0">
                HAPI
              </span>
            </div>
            <div className="flex items-center gap-0 shrink-0">
              <button
                type="button"
                onClick={toggleCollapsed}
                className="hidden lg:inline-flex -ml-[2px] mr-[2px] p-1 rounded-full text-[var(--app-hint)] hover:text-[var(--app-fg)] hover:bg-[var(--app-subtle-bg)] transition-colors"
                title="Collapse sidebar"
              >
                <SidebarCollapseIcon className="h-[18px] w-[18px]" />
              </button>
              <div className="hidden lg:block mx-0.5 h-4 w-0.5 bg-[var(--app-divider)]" />
              <QuickLanguageToggle className="inline-flex h-[30px] min-w-[30px] items-center justify-center rounded-full px-1 text-[var(--app-hint)] transition-colors hover:bg-[var(--app-subtle-bg)] hover:text-[var(--app-fg)]" />
              <button
                type="button"
                onClick={toggleTheme}
                className="inline-flex p-1 rounded-full text-[var(--app-hint)] hover:text-[var(--app-fg)] hover:bg-[var(--app-subtle-bg)] transition-colors"
                title={
                  isDark ? t("theme.switchToLight") : t("theme.switchToDark")
                }
              >
                {isDark ? (
                  <SunIcon className="h-[18px] w-[18px]" />
                ) : (
                  <MoonIcon className="h-[18px] w-[18px]" />
                )}
              </button>
              <button
                type="button"
                onClick={toggleSettingsOverlay}
                className="inline-flex p-1 rounded-full text-[var(--app-hint)] hover:text-[var(--app-fg)] hover:bg-[var(--app-subtle-bg)] transition-colors"
                title={t("settings.title")}
              >
                <SettingsIcon className="h-[18px] w-[18px]" />
              </button>
              <button
                type="button"
                onClick={toggleNewSessionOverlay}
                className="session-list-new-button inline-flex p-1 rounded-full text-[var(--app-link)] hover:bg-[var(--app-subtle-bg)] transition-colors"
                title={t("sessions.new")}
              >
                <NewChatIcon className="h-[18px] w-[18px]" />
              </button>
              <button
                type="button"
                onClick={handleQuickNewSession}
                disabled={quickNewDisabled}
                className={`hidden lg:inline-flex p-1 rounded-full transition-colors ${
                  quickNewDisabled
                    ? "cursor-not-allowed text-[var(--app-hint)] opacity-50"
                    : "text-[var(--app-link)] hover:bg-[var(--app-subtle-bg)]"
                }`}
                title={quickNewTitle}
                aria-label={quickNewTitle}
              >
                <QuickCloneChatIcon className="h-[18px] w-[18px]" />
              </button>
            </div>
          </div>
          {showSidebarSearchRow ? (
            <div className="mx-auto w-full max-w-full lg:max-w-content px-3 pb-2">
              <div className="flex items-center gap-2 rounded-md bg-[var(--app-subtle-bg)] px-3 py-1.5">
                <div className="flex h-[18px] w-[18px] shrink-0 items-center justify-center">
                  {hasSessionSearch ? (
                    <button
                      type="button"
                      onClick={() => setSessionSearch("")}
                      onMouseDown={(event) => event.preventDefault()}
                      className="flex h-[18px] w-[18px] items-center justify-center rounded-full text-[var(--app-hint)] transition-colors hover:bg-[var(--app-secondary-bg)] hover:text-[var(--app-fg)]"
                      title={t("sessions.search.clear")}
                      aria-label={t("sessions.search.clear")}
                    >
                      <SearchClearIcon className="h-3.5 w-3.5" />
                    </button>
                  ) : (
                    <SearchIcon className="h-[15px] w-[15px] text-[var(--app-hint)]" />
                  )}
                </div>
                <input
                  value={sessionSearch}
                  onChange={(event) => setSessionSearch(event.target.value)}
                  placeholder={t("sessions.search.placeholder")}
                  aria-label={t("sessions.search.placeholder")}
                  className="min-w-0 flex-1 bg-transparent text-sm text-[var(--app-fg)] placeholder:text-[var(--app-hint)] focus:outline-none"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                />
                <div className="flex shrink-0 items-center gap-0.5">
                  {batchMode && showSidebarBatchActions ? (
                    <>
                      <button
                        type="button"
                        onClick={
                          batchSelectedIds.size === batchFilteredIds.size &&
                          batchFilteredIds.size > 0
                            ? () => setBatchSelectedIds(new Set())
                            : handleBatchSelectAll
                        }
                        disabled={batchPending || batchFilteredIds.size === 0}
                        className="p-1 rounded-full text-[var(--app-hint)] transition-colors hover:text-[var(--app-fg)] hover:bg-[var(--app-secondary-bg)] disabled:cursor-not-allowed disabled:opacity-50"
                        title={
                          batchSelectedIds.size === batchFilteredIds.size &&
                          batchFilteredIds.size > 0
                            ? t("batch.deselectAll")
                            : t("batch.selectAll")
                        }
                      >
                        {batchSelectedIds.size === batchFilteredIds.size &&
                        batchFilteredIds.size > 0 ? (
                          <BatchDeselectAllIcon className="h-[18px] w-[18px]" />
                        ) : (
                          <BatchSelectAllIcon className="h-[18px] w-[18px]" />
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={handleBatchConfirmClick}
                        disabled={batchSelectedIds.size === 0 || batchPending}
                        className={`p-1 rounded-full transition-colors ${batchSelectedIds.size > 0 ? "text-emerald-600 hover:bg-emerald-500/10" : "text-[var(--app-hint)]"} disabled:cursor-not-allowed disabled:opacity-50`}
                        title={t("batch.confirm.tooltip")}
                      >
                        <BatchCheckIcon className="h-[18px] w-[18px]" />
                      </button>
                      <button
                        type="button"
                        onClick={handleExitBatchMode}
                        disabled={batchPending}
                        className="p-1 rounded-full text-[var(--app-hint)] transition-colors hover:text-[var(--app-fg)] hover:bg-[var(--app-secondary-bg)] disabled:cursor-not-allowed disabled:opacity-50"
                        title={t("batch.cancel.tooltip")}
                      >
                        <BatchXIcon className="h-[18px] w-[18px]" />
                      </button>
                    </>
                  ) : showSidebarBatchActions ? (
                    <>
                      <button
                        type="button"
                        onClick={() => handleEnterBatchMode("archive")}
                        disabled={visibleArchivableCount === 0}
                        className="p-1 rounded-full text-[var(--app-hint)] transition-colors hover:text-[var(--app-fg)] hover:bg-[var(--app-secondary-bg)] disabled:cursor-not-allowed disabled:opacity-50"
                        title={t("batch.archive.tooltip")}
                      >
                        <BatchArchiveIcon className="h-[18px] w-[18px]" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleEnterBatchMode("delete")}
                        disabled={visibleDeletableCount === 0}
                        className="p-1 rounded-full text-[var(--app-hint)] transition-colors hover:text-[var(--app-fg)] hover:bg-[var(--app-secondary-bg)] disabled:cursor-not-allowed disabled:opacity-50"
                        title={t("batch.delete.tooltip")}
                      >
                        <BatchTrashIcon className="h-[18px] w-[18px]" />
                      </button>
                      <button
                        type="button"
                        onClick={toggleFilterOnline}
                        className={`p-1 rounded-full transition-colors ${filterOnlineOnly ? "bg-emerald-500/15 text-emerald-500" : "text-[var(--app-hint)] hover:text-[var(--app-fg)] hover:bg-[var(--app-secondary-bg)]"}`}
                        title={
                          filterOnlineOnly
                            ? t("filter.showAll")
                            : t("filter.onlineOnly")
                        }
                      >
                        <OnlineFilterIcon className="h-[18px] w-[18px]" />
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={toggleFilterOnline}
                      className={`p-1 rounded-full transition-colors ${filterOnlineOnly ? "bg-emerald-500/15 text-emerald-500" : "text-[var(--app-hint)] hover:text-[var(--app-fg)] hover:bg-[var(--app-secondary-bg)]"}`}
                      title={
                        filterOnlineOnly
                          ? t("filter.showAll")
                          : t("filter.onlineOnly")
                      }
                    >
                      <OnlineFilterIcon className="h-[18px] w-[18px]" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ) : null}
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto desktop-scrollbar-left">
          {error ? (
            <div className="mx-auto w-full max-w-full lg:max-w-content px-3 py-2">
              <div className="text-sm text-red-600">{error}</div>
            </div>
          ) : null}
          {!error &&
          !isLoading &&
          normalizedSessionSearch &&
          displaySessions.length === 0 ? (
            <div className="mx-auto flex w-full max-w-full justify-center px-3 py-4 text-center text-sm text-[var(--app-hint)] lg:max-w-content">
              {t("sessions.search.noMatch")}
            </div>
          ) : (
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
              api={api}
              batchMode={batchMode}
              batchSelectedIds={batchSelectedIds}
              archivingSessionIds={batchArchivingIds}
              deletingSessionIds={batchDeletingIds}
              onBatchToggleSelect={handleBatchToggleSelect}
            />
          )}
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
      {!collapsed && (
        <div
          className="hidden lg:flex items-center w-1.5 shrink-0 cursor-col-resize bg-transparent hover:bg-[var(--app-link)]/20 active:bg-[var(--app-link)]/40 transition-colors"
          onPointerDown={handleDragStart}
        />
      )}

      {/* Expand sidebar strip (PC only, when collapsed) */}
      {collapsed && (
        <div className="hidden lg:flex flex-col h-[100dvh] shrink-0 pt-[env(safe-area-inset-top)] bg-[var(--app-bg)] border-r border-[var(--app-divider)]">
          {/* Top: expand button */}
          <div className="flex shrink-0 justify-center px-2 py-2">
            <button
              type="button"
              onClick={toggleCollapsed}
              className="inline-flex h-8 w-8 items-center justify-center rounded-full text-[var(--app-hint)] transition-colors hover:bg-[var(--app-subtle-bg)] hover:text-[var(--app-fg)]"
              title="Expand sidebar"
            >
              <SidebarExpandIcon className="h-[18px] w-[18px]" />
            </button>
          </div>
          <div className="mx-2 h-px bg-[var(--app-divider)] shrink-0" />
          <div className="px-2 py-1.5 shrink-0 flex flex-col items-center gap-1">
            <button
              type="button"
              onClick={toggleNewSessionOverlay}
              className="session-list-new-button p-1.5 rounded-full text-[var(--app-link)] hover:bg-[var(--app-subtle-bg)] transition-colors"
              title={t("sessions.new")}
            >
              <NewChatIcon className="h-[18px] w-[18px]" />
            </button>
            <button
              type="button"
              onClick={handleQuickNewSession}
              disabled={quickNewDisabled}
              className={`p-1.5 rounded-full transition-colors ${
                quickNewDisabled
                  ? "cursor-not-allowed text-[var(--app-hint)] opacity-50"
                  : "text-[var(--app-link)] hover:bg-[var(--app-subtle-bg)]"
              }`}
              title={quickNewTitle}
              aria-label={quickNewTitle}
            >
              <QuickCloneChatIcon className="h-[18px] w-[18px]" />
            </button>
          </div>
          <div className="mx-2 h-px bg-[var(--app-divider)] shrink-0" />

          {/* Middle: scrollable session groups */}
          <div className="flex-1 min-h-0 overflow-y-auto py-1 desktop-scrollbar-left">
            {collapsedGroups.map((group, gi) => (
              <div key={group.host}>
                {gi > 0 && (
                  <div className="mx-2 my-1 h-px bg-[var(--app-divider)]" />
                )}
                {/* Session icons */}
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

          {/* Bottom: toolbar buttons (vertical) */}
          <div className="shrink-0 flex flex-col items-center py-2 gap-0.5">
            <div className="mx-2 mb-1 h-px w-full bg-[var(--app-divider)]" />
            <button
              type="button"
              onClick={toggleFilterOnline}
              className={`p-1.5 rounded-full transition-colors ${filterOnlineOnly ? "bg-emerald-500/15 text-emerald-500" : "text-[var(--app-hint)] hover:text-[var(--app-fg)] hover:bg-[var(--app-subtle-bg)]"}`}
              title={
                filterOnlineOnly ? t("filter.showAll") : t("filter.onlineOnly")
              }
            >
              <OnlineFilterIcon className="h-[18px] w-[18px]" />
            </button>
            <div className="mx-2 my-0.5 h-px w-full bg-[var(--app-divider)]" />
            <QuickLanguageToggle className="inline-flex h-8 min-w-8 items-center justify-center rounded-full px-1.5 text-[var(--app-hint)] transition-colors hover:bg-[var(--app-subtle-bg)] hover:text-[var(--app-fg)]" />
            <button
              type="button"
              onClick={toggleTheme}
              className="p-1.5 rounded-full text-[var(--app-hint)] hover:text-[var(--app-fg)] hover:bg-[var(--app-subtle-bg)] transition-colors"
              title={
                isDark ? t("theme.switchToLight") : t("theme.switchToDark")
              }
            >
              {isDark ? (
                <SunIcon className="h-[18px] w-[18px]" />
              ) : (
                <MoonIcon className="h-[18px] w-[18px]" />
              )}
            </button>
            <button
              type="button"
              onClick={toggleSettingsOverlay}
              className="p-1.5 rounded-full text-[var(--app-hint)] hover:text-[var(--app-fg)] hover:bg-[var(--app-subtle-bg)] transition-colors"
              title={t("settings.title")}
            >
              <SettingsIcon className="h-[18px] w-[18px]" />
            </button>
          </div>
        </div>
      )}

      {/* Right panel */}
      <div
        className={`${isSessionsIndex && !hasOverlay ? "hidden lg:flex" : "flex"} relative min-w-0 flex-1 flex-col bg-[var(--app-bg)] ${widescreen ? `widescreen-mode ${!collapsed ? "lg:pr-[7px]" : ""}` : ""}`}
      >
        <div className="flex-1 min-h-0">
          <Outlet />
        </div>

        {/* Session views (keep-alive) */}
        {mountedSessions.map((sid) => (
          <div
            key={sid}
            className={`absolute inset-0 z-30 bg-[var(--app-bg)] transition-opacity duration-200 ${sid === activeSessionId && !isSubRoute ? "opacity-100" : "opacity-0 pointer-events-none"}`}
          >
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
          </div>
        ))}

        {/* Settings overlay */}
        <div
          className={`absolute inset-0 z-50 bg-[var(--app-bg)] transition-opacity duration-200 ${settingsOpen ? "opacity-100" : "opacity-0 pointer-events-none"}`}
        >
          <SettingsPanel onClose={() => setSettingsOpen(false)} />
        </div>

        {/* New session overlay */}
        <div
          className={`absolute inset-0 z-50 bg-[var(--app-bg)] transition-opacity duration-200 ${newSessionOpen ? "opacity-100" : "opacity-0 pointer-events-none"}`}
        >
          <NewSessionPanel onClose={() => setNewSessionOpen(false)} />
        </div>
      </div>
    </div>
  );
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
): "claude" | "codex" | "gemini" | "opencode" | undefined {
  if (
    flavor === "claude" ||
    flavor === "codex" ||
    flavor === "gemini" ||
    flavor === "opencode"
  ) {
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
  const { api } = useAppContext();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { addToast } = useToast();
  const { session, refetch: refetchSession } = useSession(api, sessionId);
  const pendingSessionMode = usePendingSessionMode(sessionId);
  const [modeSyncInFlight, setModeSyncInFlight] = useState(false);
  const [quickNewSessionPending, setQuickNewSessionPending] = useState(false);
  const modeSyncKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (!api || !session || !pendingSessionMode) {
      return;
    }

    const alreadySynced = isSessionPermissionSynced(
      session.permissionMode,
      session.basePermissionMode,
      pendingSessionMode.permissionMode,
      pendingSessionMode.basePermissionMode,
    );

    if (alreadySynced) {
      clearPendingSessionMode(session.id);
      setModeSyncInFlight(false);
      modeSyncKeyRef.current = null;
      return;
    }

    const syncKey = `${session.id}:${pendingSessionMode.permissionMode}:${pendingSessionMode.basePermissionMode ?? ""}`;
    if (modeSyncKeyRef.current === syncKey) {
      return;
    }
    modeSyncKeyRef.current = syncKey;

    let cancelled = false;
    setModeSyncInFlight(true);

    void (async () => {
      const maxAttempts = 8;
      for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
        try {
          await api.setPermissionMode(
            session.id,
            pendingSessionMode.permissionMode,
            pendingSessionMode.basePermissionMode,
          );
          if (cancelled) {
            return;
          }
          await refetchSession();
          if (cancelled) {
            return;
          }
          clearPendingSessionMode(session.id);
          setModeSyncInFlight(false);
          modeSyncKeyRef.current = null;
          return;
        } catch (error) {
          if (!shouldRetryPermissionSync(error) || attempt === maxAttempts) {
            if (cancelled) {
              return;
            }
            clearPendingSessionMode(session.id);
            setModeSyncInFlight(false);
            modeSyncKeyRef.current = null;
            addToast({
              title: t("misc.permissionMode"),
              body: t("session.permissionSync.failed"),
              sessionId: session.id,
              url: "",
            });
            return;
          }
          await delay(Math.min(250 * attempt, 1000));
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [api, addToast, pendingSessionMode, refetchSession, session, t]);

  const permissionSyncPending = useMemo(() => {
    if (!session || !pendingSessionMode) {
      return false;
    }
    return !isSessionPermissionSynced(
      session.permissionMode,
      session.basePermissionMode,
      pendingSessionMode.permissionMode,
      pendingSessionMode.basePermissionMode,
    );
  }, [pendingSessionMode, session]);

  const optimisticPermissionMode = useMemo(() => {
    if (!session || !pendingSessionMode) {
      return undefined;
    }
    return session.permissionMode ?? pendingSessionMode.permissionMode;
  }, [pendingSessionMode, session]);

  const optimisticBasePermissionMode = useMemo(() => {
    if (!session || !pendingSessionMode) {
      return undefined;
    }
    return (
      session.basePermissionMode ??
      (pendingSessionMode.permissionMode === "plan"
        ? (pendingSessionMode.basePermissionMode ?? "default")
        : (pendingSessionMode.basePermissionMode ??
          pendingSessionMode.permissionMode))
    );
  }, [pendingSessionMode, session]);

  const {
    messages,
    warning: messagesWarning,
    isLoading: messagesLoading,
    isLoadingMore: messagesLoadingMore,
    hasMore: messagesHasMore,
    loadMore: loadMoreMessages,
    refetch: refetchMessages,
    pendingCount,
    messagesVersion,
    flushPending,
    setAtBottom,
  } = useMessages(api, sessionId);
  const { sendMessage, retryMessage, isSending } = useSendMessage(
    api,
    sessionId,
    {
      resolveSessionId: async (currentSessionId) => {
        if (!api || !session || session.active) {
          return currentSessionId;
        }
        try {
          return await api.resumeSession(currentSessionId);
        } catch (error) {
          const message =
            error instanceof Error ? error.message : "Resume failed";
          addToast({
            title: "Resume failed",
            body: message,
            sessionId: currentSessionId,
            url: "",
          });
          throw error;
        }
      },
      onSessionResolved: (resolvedSessionId) => {
        void (async () => {
          if (api) {
            if (session && resolvedSessionId !== session.id) {
              seedMessageWindowFromSession(session.id, resolvedSessionId);
              queryClient.setQueryData(queryKeys.session(resolvedSessionId), {
                session: { ...session, id: resolvedSessionId, active: true },
              });
            }
            try {
              await Promise.all([
                queryClient.prefetchQuery({
                  queryKey: queryKeys.session(resolvedSessionId),
                  queryFn: () => api.getSession(resolvedSessionId),
                }),
                fetchLatestMessages(api, resolvedSessionId),
              ]);
            } catch {}
          }
          navigate({
            to: "/sessions/$sessionId",
            params: { sessionId: resolvedSessionId },
            replace: true,
          });
        })();
      },
      onBlocked: (reason) => {
        if (reason === "no-api") {
          addToast({
            title: t("send.blocked.title"),
            body: t("send.blocked.noConnection"),
            sessionId: sessionId ?? "",
            url: "",
          });
        }
      },
    },
  );

  const agentType = session?.metadata?.flavor ?? "claude";
  const { getSuggestions: getSlashSuggestions } = useSlashCommands(
    api,
    sessionId,
    agentType,
  );
  const { getSuggestions: getSkillSuggestions } = useSkills(api, sessionId);

  const getAutocompleteSuggestions = useCallback(
    async (query: string) => {
      if (query.startsWith("$")) {
        return await getSkillSuggestions(query);
      }
      return await getSlashSuggestions(query);
    },
    [getSkillSuggestions, getSlashSuggestions],
  );

  const refreshSelectedSession = useCallback(() => {
    void refetchSession();
    void refetchMessages();
  }, [refetchMessages, refetchSession]);

  const handleQuickNewSession = useCallback(async () => {
    if (!api || !session || quickNewSessionPending) {
      return;
    }

    const machineId = session.metadata?.machineId?.trim();
    const directory = session.metadata?.path?.trim();
    if (!machineId || !directory) {
      addToast({
        title: t("sessions.quickNew.failedTitle"),
        body: t("sessions.quickNew.unavailable"),
        sessionId: session.id,
        url: `/sessions/${session.id}`,
      });
      return;
    }

    const permissionMode = session.permissionMode ?? "default";
    const basePermissionMode =
      session.basePermissionMode ??
      (permissionMode === "plan" ? "default" : permissionMode);
    const spawnSessionType = session.metadata?.worktree ? "worktree" : "simple";
    const worktreeName =
      spawnSessionType === "worktree"
        ? session.metadata?.worktree?.name?.trim() || undefined
        : undefined;
    const model = session.metadata?.model?.trim() || undefined;

    setQuickNewSessionPending(true);
    try {
      const result = await api.spawnSession(
        machineId,
        directory,
        resolveSpawnAgent(session.metadata?.flavor),
        model,
        session.metadata?.reasoningEffort,
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
      navigate({
        to: "/sessions/$sessionId",
        params: { sessionId: result.sessionId },
      });
    } catch (error) {
      const message =
        error instanceof Error && error.message
          ? error.message
          : t("dialog.error.default");
      addToast({
        title: t("sessions.quickNew.failedTitle"),
        body: message,
        sessionId: session.id,
        url: `/sessions/${session.id}`,
      });
    } finally {
      setQuickNewSessionPending(false);
    }
  }, [
    api,
    addToast,
    navigate,
    queryClient,
    quickNewSessionPending,
    session,
    t,
  ]);

  if (!session) {
    return (
      <div className="flex-1 flex items-center justify-center p-4">
        <LoadingState label="Loading session…" className="text-sm" />
      </div>
    );
  }

  return (
    <SessionChat
      api={api}
      session={session}
      messages={messages}
      messagesWarning={messagesWarning}
      hasMoreMessages={messagesHasMore}
      isLoadingMessages={messagesLoading}
      isLoadingMoreMessages={messagesLoadingMore}
      isSending={isSending}
      pendingCount={pendingCount}
      messagesVersion={messagesVersion}
      onBack={onBack}
      onRefresh={refreshSelectedSession}
      onLoadMore={loadMoreMessages}
      onSend={sendMessage}
      onFlushPending={flushPending}
      onAtBottomChange={setAtBottom}
      onRetryMessage={retryMessage}
      autocompleteSuggestions={getAutocompleteSuggestions}
      onSessionDeleted={onSessionDeleted}
      isDark={isDark}
      onToggleTheme={onToggleTheme}
      onOpenSettings={onOpenSettings}
      onOpenNewSession={onOpenNewSession}
      onQuickNewSession={handleQuickNewSession}
      quickNewSessionPending={quickNewSessionPending}
      permissionSyncPending={permissionSyncPending || modeSyncInFlight}
      permissionModeOverride={optimisticPermissionMode}
      basePermissionModeOverride={optimisticBasePermissionMode}
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

function NewSessionPanel({ onClose }: { onClose: () => void }) {
  const { api } = useAppContext();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const {
    machines,
    isLoading: machinesLoading,
    error: machinesError,
  } = useMachines(api, true);

  const handleCancel = useCallback(() => {
    onClose();
  }, [onClose]);

  const handleSuccess = useCallback(
    (sessionId: string) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.sessions });
      onClose();
      navigate({
        to: "/sessions/$sessionId",
        params: { sessionId },
      });
    },
    [navigate, queryClient, onClose],
  );

  return (
    <div className="flex h-full flex-col">
      <div className="bg-[var(--app-bg)] pt-[env(safe-area-inset-top)]">
        <div className="mx-auto w-full max-w-content flex items-center gap-2 border-b border-[var(--app-border)] p-3">
          {!isTelegramApp() && (
            <button
              type="button"
              onClick={onClose}
              className="flex lg:hidden h-8 w-8 items-center justify-center rounded-full bg-[var(--app-secondary-bg)] text-[var(--app-fg)] transition-colors"
            >
              <BackIcon />
            </button>
          )}
          <div className="flex-1 font-semibold">{t("newSession.title")}</div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-content">
          {machinesError ? (
            <div className="p-3 text-sm text-red-600">{machinesError}</div>
          ) : null}

          <NewSession
            api={api}
            machines={machines}
            isLoading={machinesLoading}
            onCancel={handleCancel}
            onSuccess={handleSuccess}
          />
        </div>
      </div>
    </div>
  );
}

function NewSessionPage() {
  const goBack = useAppGoBack();
  return <NewSessionPanel onClose={goBack} />;
}

const rootRoute = createRootRoute({
  component: App,
});

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: () => <Navigate to="/sessions" replace />,
});

const sessionsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/sessions",
  component: SessionsPage,
});

const sessionsIndexRoute = createRoute({
  getParentRoute: () => sessionsRoute,
  path: "/",
  component: SessionsIndexPage,
});

const sessionDetailRoute = createRoute({
  getParentRoute: () => sessionsRoute,
  path: "$sessionId",
  component: SessionDetailRoute,
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
  component: FilesPage,
});

const sessionTerminalRoute = createRoute({
  getParentRoute: () => sessionDetailRoute,
  path: "terminal",
  component: TerminalPage,
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

export const routeTree = rootRoute.addChildren([
  indexRoute,
  sessionsRoute.addChildren([
    sessionsIndexRoute,
    newSessionRoute,
    sessionDetailRoute.addChildren([
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
