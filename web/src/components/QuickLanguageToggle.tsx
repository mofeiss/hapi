import { useTranslation } from "@/lib/use-translation";

export function QuickLanguageToggle(props: {
  className?: string;
  labelClassName?: string;
}) {
  const { locale, setLocale, t } = useTranslation();
  const nextLocale = locale === "zh-CN" ? "en" : "zh-CN";
  const nextLocaleLabel =
    nextLocale === "zh-CN" ? t("language.chinese") : t("language.english");
  const buttonLabel = locale === "zh-CN" ? "EN" : "中";
  const defaultLabelClassName =
    buttonLabel === "EN"
      ? "text-[13px] font-medium leading-none tracking-tight"
      : "text-[16px] font-[455] leading-none";

  return (
    <button
      type="button"
      onClick={() => setLocale(nextLocale)}
      className={
        props.className ??
        "inline-flex h-8 min-w-8 items-center justify-center rounded-full px-1.5 text-[var(--app-hint)] transition-colors hover:bg-[var(--app-subtle-bg)] hover:text-[var(--app-fg)]"
      }
      title={`${t("language.title")}: ${nextLocaleLabel}`}
      aria-label={`${t("language.title")}: ${nextLocaleLabel}`}
    >
      <span className={props.labelClassName ?? defaultLabelClassName}>
        {buttonLabel}
      </span>
    </button>
  );
}
