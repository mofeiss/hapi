import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { SessionChat } from "@/components/SessionChat";
import { LoadingState } from "@/components/LoadingState";
import { useAppContext } from "@/lib/app-context";
import { useTranslation } from "@/lib/use-translation";
import { useToast } from "@/lib/toast-context";
import { useSession } from "@/hooks/queries/useSession";
import { useMessages } from "@/hooks/queries/useMessages";
import { useSlashCommands } from "@/hooks/queries/useSlashCommands";
import { useSkills } from "@/hooks/queries/useSkills";
import { useSendMessage } from "@/hooks/mutations/useSendMessage";
import { queryKeys } from "@/lib/query-keys";
import {
  fetchLatestMessages,
  seedMessageWindowFromSession,
} from "@/lib/message-window-store";
import {
  clearPendingSessionInitialMessage,
  peekPendingSessionInitialMessage,
} from "@/lib/pending-session-initial-message-store";
import {
  setPendingSessionMode,
  clearPendingSessionMode,
  usePendingSessionMode,
} from "@/lib/pending-session-mode-store";
import { resolveDraftAttachmentMetadata } from "@/lib/draftAttachments";
import type {
  AttachmentMetadata,
  PermissionMode,
  UserMessageMeta,
} from "@/types/api";

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

export function EmbeddedSessionView({
  sessionId,
  onBack,
  onSessionDeleted,
  includeTopSafeArea = true,
  isDark,
  onToggleTheme,
  onOpenSettings,
  onOpenNewSession,
}: {
  sessionId: string;
  onBack: () => void;
  onSessionDeleted?: () => void;
  includeTopSafeArea?: boolean;
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
  const pendingInitialMessageRef = useRef<
    ReturnType<typeof peekPendingSessionInitialMessage> | undefined
  >(undefined);
  const pendingInitialMessageSendingRef = useRef(false);

  useEffect(() => {
    pendingInitialMessageRef.current = undefined;
    pendingInitialMessageSendingRef.current = false;
  }, [sessionId]);

  useEffect(() => {
    if (pendingInitialMessageRef.current !== undefined) {
      return;
    }

    pendingInitialMessageRef.current = peekPendingSessionInitialMessage(sessionId);
  }, [sessionId]);

  useEffect(() => {
    const pending = pendingInitialMessageRef.current;
    if (!api || !session || !pending || pendingInitialMessageSendingRef.current) {
      return;
    }

    if (permissionSyncPending || modeSyncInFlight) {
      return;
    }

    if (!pending.text && (!pending.attachments || pending.attachments.length === 0)) {
      pendingInitialMessageRef.current = null;
      clearPendingSessionInitialMessage(session.id);
      return;
    }

    pendingInitialMessageSendingRef.current = true;
    void (async () => {
      try {
        const resolvedAttachments = await resolveDraftAttachmentMetadata(
          api,
          session.id,
          pending.attachments,
        );
        clearPendingSessionInitialMessage(session.id);
        pendingInitialMessageRef.current = null;
        sendMessage(pending.text, resolvedAttachments, { meta: pending.meta });
      } catch (error) {
        clearPendingSessionInitialMessage(session.id);
        pendingInitialMessageRef.current = null;
        const message =
          error instanceof Error && error.message
            ? error.message
            : t("dialog.error.default");
        addToast({
          title: t("send.blocked.title"),
          body: message,
          sessionId: session.id,
          url: `/sessions/${session.id}`,
        });
      } finally {
        pendingInitialMessageSendingRef.current = false;
      }
    })();
  }, [addToast, api, modeSyncInFlight, permissionSyncPending, sendMessage, session, t]);

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
      includeTopSafeArea={includeTopSafeArea}
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
