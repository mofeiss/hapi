import { useMemo } from "react";
import type { Session } from "@/types/api";
import type { ApiClient } from "@/api/client";
import { isTelegramApp } from "@/hooks/useTelegram";
import { HeaderActionGroup } from "@/components/HeaderActionGroup";
import { useSessionTitleOverride } from "@/lib/session-title-override-store";
import { normalizeProjectPath } from "@/utils/path";
import { AgentFlavorStatusIcon } from "@/components/AgentFlavorStatusIcon";
import { formatTimestamp } from "@/lib/dateTime";

function getSessionTitle(session: Session): string {
  if (session.metadata?.name) {
    return session.metadata.name;
  }
  if (session.metadata?.summary?.text) {
    return session.metadata.summary.text;
  }
  return "New Chat";
}

export function SessionHeader(props: {
  session: Session;
  titleOverride?: string | null;
  titleClassName?: string;
  includeTopSafeArea?: boolean;
  onToggleTerminal?: () => void;
  terminalOpen?: boolean;
  onToggleFiles?: () => void;
  filesOpen?: boolean;
  onQuickNewSession?: () => void;
  quickNewSessionPending?: boolean;
  hideQuickNewButton?: boolean;
  hideSubtitleRow?: boolean;
  api: ApiClient | null;
  onSessionDeleted?: () => void;
}) {
  const { session } = props;
  const includeTopSafeArea = props.includeTopSafeArea ?? true;
  const titleFromStore = useSessionTitleOverride(session.id);
  const title = useMemo(
    () => props.titleOverride ?? titleFromStore ?? getSessionTitle(session),
    [props.titleOverride, session, titleFromStore],
  );
  // In Telegram, don't render header (Telegram provides its own)
  if (isTelegramApp()) {
    return null;
  }

    return (
    <>
      <div
        className={`bg-[var(--app-bg)] ${includeTopSafeArea ? "pt-[env(safe-area-inset-top)]" : ""}`}
      >
        <div className="mx-auto flex w-full max-w-content items-center gap-2 px-3 py-[8px]">
          {/* Session title row */}
          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 items-center gap-2 overflow-hidden">
              <AgentFlavorStatusIcon
                flavor={session.metadata?.flavor}
                active={session.active}
                thinking={session.thinking}
                sizeClassName="h-4 w-4"
              />
              <div className={`min-w-0 flex-1 truncate font-semibold ${props.titleClassName ?? ""}`}>
                {title}
              </div>
            </div>
          </div>

          <HeaderActionGroup
            onQuickNewSession={props.onQuickNewSession}
            hideNewSessionButton
            hideQuickNewButton={props.hideQuickNewButton}
            hideThemeControls
            hideSettingsButton
            quickNewSessionPending={props.quickNewSessionPending}
            onToggleTerminal={props.onToggleTerminal}
            terminalOpen={props.terminalOpen}
            onToggleFiles={props.onToggleFiles}
            filesOpen={props.filesOpen}
            className="flex items-center gap-0.5"
          />
        </div>
        {!props.hideSubtitleRow ? (
          <>
            <div className="border-t border-[var(--app-border)]" />
            <div className="mx-auto w-full max-w-content px-3 py-1.5">
              <div
                className="flex min-w-0 items-center gap-x-3 overflow-hidden whitespace-nowrap text-xs text-[var(--app-hint)]"
                style={{ opacity: "var(--app-session-subtitle-opacity)" }}
              >
                {session.metadata?.host ? (
                  <span className="inline-flex min-w-0 items-center gap-1 overflow-hidden">
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
                      <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
                      <line x1="8" y1="21" x2="16" y2="21" />
                      <line x1="12" y1="17" x2="12" y2="21" />
                    </svg>
                    <span className="truncate">{session.metadata.host}</span>
                  </span>
                ) : null}
                {session.metadata?.path ? (
                  <span className="inline-flex min-w-0 items-center gap-1 overflow-hidden">
                    <span className="shrink-0 text-[10px]" aria-hidden="true">
                      📂
                    </span>
                    <span className="truncate">{normalizeProjectPath(session.metadata.path)}</span>
                  </span>
                ) : null}
                {session.createdAt ? (
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
                    <span>{formatTimestamp(session.createdAt)}</span>
                  </span>
                ) : null}
              </div>
            </div>
          </>
        ) : null}
      </div>
    </>
  );
}
