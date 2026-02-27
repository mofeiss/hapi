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
import { SessionList } from "@/components/SessionList";
import { NewSession } from "@/components/NewSession";
import { LoadingState } from "@/components/LoadingState";
import { useAppContext } from "@/lib/app-context";
import { useAppGoBack } from "@/hooks/useAppGoBack";
import { isTelegramApp } from "@/hooks/useTelegram";
import { useWidescreen } from "@/hooks/useWidescreen";
import { useMessages } from "@/hooks/queries/useMessages";
import { useMachines } from "@/hooks/queries/useMachines";
import { useSession } from "@/hooks/queries/useSession";
import { useSessions } from "@/hooks/queries/useSessions";
import { useSlashCommands } from "@/hooks/queries/useSlashCommands";
import { useSkills } from "@/hooks/queries/useSkills";
import { useSendMessage } from "@/hooks/mutations/useSendMessage";
import { queryKeys } from "@/lib/query-keys";
import { useToast } from "@/lib/toast-context";
import { useTranslation } from "@/lib/use-translation";
import { useTheme } from "@/hooks/useTheme";
import {
  fetchLatestMessages,
  seedMessageWindowFromSession,
  clearMessageWindow,
} from "@/lib/message-window-store";
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

function BatchArchiveIcon(props: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={props.className}>
      <rect width="20" height="5" x="2" y="3" rx="1" />
      <path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8" />
      <path d="M10 12h4" />
    </svg>
  );
}

function BatchTrashIcon(props: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={props.className}>
      <path d="M3 6h18" />
      <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
      <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
    </svg>
  );
}

function BatchCheckIcon(props: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={props.className}>
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function BatchXIcon(props: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={props.className}>
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  );
}

function BatchSelectAllIcon(props: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={props.className}>
      <rect width="18" height="18" x="3" y="3" rx="2" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}

function BatchDeselectAllIcon(props: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={props.className}>
      <rect width="18" height="18" x="3" y="3" rx="2" />
      <path d="M9 12h6" />
    </svg>
  );
}

function SunIcon(props: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={props.className}>
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
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={props.className}>
      <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
    </svg>
  );
}

function SessionsPage() {
  const { api } = useAppContext();
  const navigate = useNavigate();
  const pathname = useLocation({ select: (location) => location.pathname });
  const matchRoute = useMatchRoute();
  const { t } = useTranslation();
  const { isDark, toggleTheme } = useTheme();
  const { sessions, isLoading, error, refetch } = useSessions(api);

  const handleRefresh = useCallback(() => {
    void refetch();
  }, [refetch]);

  const projectCount = new Set(
    sessions.map(
      (s) => s.metadata?.host ?? "Unknown",
    ),
  ).size;
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

  // Batch mode state
  const queryClient = useQueryClient();
  const [batchMode, setBatchMode] = useState<"archive" | "delete" | null>(null);
  const [batchSelectedIds, setBatchSelectedIds] = useState<Set<string>>(
    new Set(),
  );
  const [batchConfirmOpen, setBatchConfirmOpen] = useState(false);
  const [batchPending, setBatchPending] = useState(false);

  const handleEnterBatchMode = useCallback(
    (mode: "archive" | "delete") => {
      setBatchMode(mode);
      setBatchSelectedIds(new Set());
      setSettingsOpen(false);
      setNewSessionOpen(false);
    },
    [],
  );

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
      sessions
        .filter((s) => (batchMode === "archive" ? s.active : !s.active))
        .map((s) => s.id),
    );
  }, [sessions, batchMode]);

  const handleBatchSelectAll = useCallback(() => {
    setBatchSelectedIds(new Set(batchFilteredIds));
  }, [batchFilteredIds]);

  // Session keep-alive state
  const [activeSessionId, setActiveSessionId] = useState<string | null>(
    selectedSessionId,
  );
  const [mountedSessions, setMountedSessions] = useState<string[]>(
    selectedSessionId ? [selectedSessionId] : [],
  );
  const activeSessionRef = useRef(activeSessionId);
  activeSessionRef.current = activeSessionId;

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

  const handleSelectSession = useCallback(
    (sessionId: string) => {
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

  const handleSessionBack = useCallback(() => {
    setActiveSessionId(null);
    navigate({ to: "/sessions" });
  }, [navigate]);

  const handleSessionDeleted = useCallback(
    (deletedId: string) => {
      setMountedSessions((prev) => prev.filter((id) => id !== deletedId));
      if (activeSessionRef.current === deletedId) {
        setActiveSessionId(null);
        navigate({ to: "/sessions" });
      }
    },
    [navigate],
  );

  const executeBatchOperation = useCallback(async () => {
    if (!api || batchSelectedIds.size === 0 || !batchMode) return;
    setBatchPending(true);
    const ids = [...batchSelectedIds];

    for (const id of ids) {
      try {
        if (batchMode === "archive") {
          await api.archiveSession(id);
        } else {
          await api.deleteSession(id);
          clearMessageWindow(id);
        }
      } catch {
        // continue with remaining sessions
      }
    }

    if (batchMode === "delete") {
      setMountedSessions((prev) =>
        prev.filter((sid) => !batchSelectedIds.has(sid)),
      );
      if (activeSessionId && batchSelectedIds.has(activeSessionId)) {
        setActiveSessionId(null);
        navigate({ to: "/sessions" });
      }
    }

    await queryClient.invalidateQueries({ queryKey: queryKeys.sessions });
    setBatchPending(false);
    handleExitBatchMode();
  }, [api, batchMode, batchSelectedIds, activeSessionId, navigate, queryClient, handleExitBatchMode]);

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

  const isSubRoute =
    activeSessionId !== null &&
    pathname !== `/sessions/${activeSessionId}` &&
    pathname !== `/sessions/${activeSessionId}/` &&
    pathname.startsWith(`/sessions/${activeSessionId}/`);

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
    setCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem("hapi:panel:collapsed", String(next));
      return next;
    });
  }, []);

  const leftPanelVisible = collapsed
    ? isSessionsIndex && !hasOverlay
      ? "flex lg:hidden"
      : "hidden"
    : isSessionsIndex && !hasOverlay
      ? "flex"
      : "hidden lg:flex";

  return (
    <div className="flex h-full min-h-0">
      {/* Left panel */}
      <div
        className={`${leftPanelVisible} max-lg:!w-full shrink-0 flex-col bg-[var(--app-bg)] lg:border-r lg:border-[var(--app-divider)]`}
        style={{ width: panelWidth }}
      >
        <div className="bg-[var(--app-bg)] pt-[env(safe-area-inset-top)]">
          <div className="mx-auto w-full max-w-content flex items-center justify-between px-3 py-2">
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={toggleCollapsed}
                className="hidden ml-[-5px] lg:inline-flex p-1 rounded text-[var(--app-hint)] hover:text-[var(--app-fg)] hover:bg-[var(--app-subtle-bg)] transition-colors"
                title="Collapse sidebar"
              >
                <SidebarCollapseIcon className="h-5 w-5" />
              </button>
              <div className="text-xs text-[var(--app-hint)]">
                {batchMode
                  ? t("batch.selected", { n: batchSelectedIds.size })
                  : t("sessions.count", { n: sessions.length, m: projectCount })}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {batchMode ? (
                <>
                  <button
                    type="button"
                    onClick={batchSelectedIds.size === batchFilteredIds.size && batchFilteredIds.size > 0 ? () => setBatchSelectedIds(new Set()) : handleBatchSelectAll}
                    disabled={batchPending || batchFilteredIds.size === 0}
                    className="p-1.5 rounded-full text-[var(--app-hint)] hover:text-[var(--app-fg)] hover:bg-[var(--app-subtle-bg)] transition-colors"
                    title={batchSelectedIds.size === batchFilteredIds.size && batchFilteredIds.size > 0 ? t("batch.deselectAll") : t("batch.selectAll")}
                  >
                    {batchSelectedIds.size === batchFilteredIds.size && batchFilteredIds.size > 0
                      ? <BatchDeselectAllIcon className="h-5 w-5" />
                      : <BatchSelectAllIcon className="h-5 w-5" />}
                  </button>
                  <button
                    type="button"
                    onClick={handleBatchConfirmClick}
                    disabled={batchSelectedIds.size === 0 || batchPending}
                    className={`p-1.5 rounded-full transition-colors ${batchSelectedIds.size > 0 ? 'text-emerald-600 hover:bg-emerald-500/10' : 'text-[var(--app-hint)] opacity-50 cursor-not-allowed'}`}
                    title={t("batch.confirm.tooltip")}
                  >
                    <BatchCheckIcon className="h-5 w-5" />
                  </button>
                  <button
                    type="button"
                    onClick={handleExitBatchMode}
                    disabled={batchPending}
                    className="p-1.5 rounded-full text-[var(--app-hint)] hover:text-[var(--app-fg)] hover:bg-[var(--app-subtle-bg)] transition-colors"
                    title={t("batch.cancel.tooltip")}
                  >
                    <BatchXIcon className="h-5 w-5" />
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => handleEnterBatchMode("archive")}
                    className="p-1.5 rounded-full text-[var(--app-hint)] hover:text-[var(--app-fg)] hover:bg-[var(--app-subtle-bg)] transition-colors"
                    title={t("batch.archive.tooltip")}
                  >
                    <BatchArchiveIcon className="h-5 w-5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleEnterBatchMode("delete")}
                    className="p-1.5 rounded-full text-[var(--app-hint)] hover:text-[var(--app-fg)] hover:bg-[var(--app-subtle-bg)] transition-colors"
                    title={t("batch.delete.tooltip")}
                  >
                    <BatchTrashIcon className="h-5 w-5" />
                  </button>
                </>
              )}
              {!batchMode && (
                <button
                  type="button"
                  onClick={toggleTheme}
                  className="p-1.5 rounded-full text-[var(--app-hint)] hover:text-[var(--app-fg)] hover:bg-[var(--app-subtle-bg)] transition-colors"
                  title={isDark ? t("theme.switchToLight") : t("theme.switchToDark")}
                >
                  {isDark ? <SunIcon className="h-5 w-5" /> : <MoonIcon className="h-5 w-5" />}
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  setSettingsOpen((prev) => !prev);
                  setNewSessionOpen(false);
                }}
                className="p-1.5 rounded-full text-[var(--app-hint)] hover:text-[var(--app-fg)] hover:bg-[var(--app-subtle-bg)] transition-colors"
                title={t("settings.title")}
              >
                <SettingsIcon className="h-5 w-5" />
              </button>
              <button
                type="button"
                onClick={() => {
                  setNewSessionOpen((prev) => !prev);
                  setSettingsOpen(false);
                }}
                className="session-list-new-button p-1.5 rounded-full text-[var(--app-hint)] hover:text-[var(--app-fg)] hover:bg-[var(--app-subtle-bg)] transition-colors"
                title={t("sessions.new")}
              >
                <NewChatIcon className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto desktop-scrollbar-left">
          {error ? (
            <div className="mx-auto w-full max-w-content px-3 py-2">
              <div className="text-sm text-red-600">{error}</div>
            </div>
          ) : null}
          <SessionList
            sessions={sessions}
            selectedSessionId={activeSessionId}
            onSelect={handleSelectSession}
            onNewSession={() => {
              setNewSessionOpen(true);
              setSettingsOpen(false);
            }}
            onRefresh={handleRefresh}
            isLoading={isLoading}
            renderHeader={false}
            api={api}
            batchMode={batchMode}
            batchSelectedIds={batchSelectedIds}
            onBatchToggleSelect={handleBatchToggleSelect}
          />
        </div>

        {/* Batch operation confirm dialog */}
        <ConfirmDialog
          isOpen={batchConfirmOpen}
          onClose={() => setBatchConfirmOpen(false)}
          title={t(batchMode === "archive" ? "batch.archive.title" : "batch.delete.title")}
          description={t(
            batchMode === "archive" ? "batch.archive.description" : "batch.delete.description",
            { count: batchSelectedIds.size },
          )}
          confirmLabel={t(batchMode === "archive" ? "dialog.archive.confirm" : "dialog.delete.confirm")}
          confirmingLabel={t(batchMode === "archive" ? "dialog.archive.confirming" : "dialog.delete.confirming")}
          onConfirm={executeBatchOperation}
          isPending={batchPending}
          destructive
          dontAskAgainKey={batchMode === "archive" ? "hapi:skip-confirm:archive" : "hapi:skip-confirm:delete"}
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
        <div className="hidden lg:flex flex-col shrink-0 pt-[env(safe-area-inset-top)] bg-[var(--app-bg)] border-r border-[var(--app-divider)]">
          <div className="px-3 py-2">
            <button
              type="button"
              onClick={toggleCollapsed}
              className="mt-[2px] ml-[-5px] p-1 text-[var(--app-hint)] hover:text-[var(--app-fg)] hover:bg-[var(--app-subtle-bg)] rounded transition-colors"
              title="Expand sidebar"
            >
              <SidebarExpandIcon className="h-5 w-5" />
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

function SessionView({
  sessionId,
  onBack,
  onSessionDeleted,
}: {
  sessionId: string;
  onBack: () => void;
  onSessionDeleted?: () => void;
}) {
  const { api } = useAppContext();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { addToast } = useToast();
  const { session, refetch: refetchSession } = useSession(api, sessionId);
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
          <div className="flex-1 font-semibold">{t('newSession.title')}</div>
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
