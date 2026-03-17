import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function TimerRing(props: { className?: string; progress: number }) {
  const radius = 4.25;
  const circumference = 2 * Math.PI * radius;
  const clampedProgress = Math.max(0, Math.min(1, props.progress));
  const dashOffset = circumference * (1 - clampedProgress);

  return (
    <svg
      className={props.className}
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
    >
      <circle
        cx="8"
        cy="8"
        r={radius}
        stroke="var(--app-border)"
        strokeWidth="1.75"
        opacity="0.55"
      />
      <circle
        cx="8"
        cy="8"
        r={radius}
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={dashOffset}
        transform="rotate(-90 8 8)"
      />
    </svg>
  );
}

const noticeVariants = cva(
  "pointer-events-auto w-[min(calc(100vw-2rem),22rem)] rounded-[18px] border text-[var(--app-fg)] shadow-[0_10px_28px_rgba(0,0,0,0.10)] backdrop-blur-sm",
  {
    variants: {
      variant: {
        default:
          "border-[var(--app-border)] bg-[color-mix(in_srgb,var(--app-secondary-bg)_82%,var(--app-bg))]",
        error:
          "border-[var(--app-badge-error-border)] bg-[color-mix(in_srgb,var(--app-secondary-bg)_78%,var(--app-badge-error-bg))]",
      },
      blocking: {
        true: "",
        false: "",
      },
    },
    defaultVariants: {
      variant: "default",
      blocking: false,
    },
  },
);

type NoticeModalProps = React.HTMLAttributes<HTMLDivElement> &
  VariantProps<typeof noticeVariants> & {
    title: string;
    body: string;
    confirmLabel: string;
    dismissLabel?: string;
    onConfirm?: () => void;
    onDismiss?: () => void;
    onPauseAutoDismiss?: () => void;
    onResumeAutoDismiss?: () => void;
    autoDismissMs?: number;
    progress?: number;
  };

export function NoticeModal({
  title,
  body,
  confirmLabel,
  dismissLabel,
  onConfirm,
  onDismiss,
  onPauseAutoDismiss,
  onResumeAutoDismiss,
  autoDismissMs,
  progress,
  className,
  variant,
  blocking,
  ...props
}: NoticeModalProps) {
  const clampedProgress =
    typeof progress === "number" ? Math.max(0, Math.min(1, progress)) : 0;
  const showTimerIcon =
    !blocking && autoDismissMs && typeof progress === "number";

  return (
    <div
      className={cn(
        noticeVariants({ variant, blocking }),
        "relative overflow-hidden",
        className,
      )}
      onMouseEnter={showTimerIcon ? onPauseAutoDismiss : undefined}
      onMouseLeave={showTimerIcon ? onResumeAutoDismiss : undefined}
      role={blocking ? "alertdialog" : "status"}
      aria-modal={blocking ? "true" : undefined}
      {...props}
    >
      <div className="p-3.5">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <div className="min-w-0 flex-1 text-sm font-semibold leading-5">
              {title}
            </div>
            {showTimerIcon ? (
              <span
                className="inline-flex h-5.5 w-5.5 shrink-0 items-center justify-center text-[var(--app-hint)]"
                aria-hidden="true"
              >
                <TimerRing className="h-5.5 w-5.5" progress={clampedProgress} />
              </span>
            ) : null}
          </div>
          <div className="mt-1 text-[13px] leading-5 text-[var(--app-hint)]">
            {body}
          </div>
        </div>

        <div className="mt-3 flex justify-end gap-1.5">
          {!blocking && dismissLabel ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 rounded-md border-[var(--app-border)] bg-transparent px-2.5 text-xs text-[var(--app-hint)] hover:bg-[var(--app-subtle-bg)] hover:text-[var(--app-fg)]"
              onClick={onDismiss}
            >
              {dismissLabel}
            </Button>
          ) : null}
          <Button
            type="button"
            size="sm"
            variant={variant === "error" ? "destructive" : "secondary"}
            className={cn(
              variant === "error"
                ? "h-7 rounded-md px-2.5 text-xs shadow-none"
                : "h-7 rounded-md border border-[var(--app-border)] bg-[var(--app-bg)] px-2.5 text-xs text-[var(--app-fg)] hover:bg-[var(--app-secondary-bg)]",
            )}
            onClick={onConfirm}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
