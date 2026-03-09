import claudeIconUrl from "@/assets/agents/claude.svg";
import codexIconUrl from "@/assets/agents/codex.svg";
import geminiIconUrl from "@/assets/agents/gemini.svg";
import opencodeIconUrl from "@/assets/agents/opencode.svg";

const AGENT_ICON_URL_BY_FLAVOR = {
  claude: claudeIconUrl,
  codex: codexIconUrl,
  gemini: geminiIconUrl,
  opencode: opencodeIconUrl,
} as const;

function getAgentFlavorIconUrl(flavor?: string | null): string | null {
  const normalizedFlavor = flavor?.trim();
  if (!normalizedFlavor) return null;
  return AGENT_ICON_URL_BY_FLAVOR[
    normalizedFlavor as keyof typeof AGENT_ICON_URL_BY_FLAVOR
  ] ?? null;
}

export function AgentFlavorStatusIcon(props: {
  flavor?: string | null;
  active?: boolean;
  thinking?: boolean;
  className?: string;
  sizeClassName?: string;
}) {
  const normalizedFlavor = props.flavor?.trim() ?? null;
  const iconUrl = getAgentFlavorIconUrl(normalizedFlavor);
  const isActive = props.active ?? false;
  const isThinking = Boolean(props.thinking && isActive);
  const needsDarkInvert =
    normalizedFlavor === "codex" || normalizedFlavor === "opencode";
  const stateClassName = isThinking
    ? "[animation:spin_2.2s_linear_infinite]"
    : isActive
      ? ""
      : "grayscale opacity-60";
  const sizeClassName = props.sizeClassName ?? "h-4 w-4";

  if (!iconUrl) {
    return (
      <span
        className={`${props.className ?? ""} ${sizeClassName} inline-flex shrink-0 items-center justify-center ${stateClassName}`}
        aria-hidden="true"
      >
        <span className="inline-block -translate-y-px text-[15px] leading-none text-[var(--app-hint)]">
          ✻
        </span>
      </span>
    );
  }

  return (
    <span
      className={`${props.className ?? ""} ${sizeClassName} inline-flex shrink-0 items-center justify-center ${stateClassName}`}
      aria-hidden="true"
    >
      <img
        src={iconUrl}
        alt=""
        className={`h-full w-full object-contain ${needsDarkInvert ? "agent-icon-dark-invert" : ""}`}
        draggable={false}
      />
    </span>
  );
}
