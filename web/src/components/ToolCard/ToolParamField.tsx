export function ToolParamField(props: { name: string; value: string }) {
    return (
        <div className="min-w-0 w-full max-w-full rounded-md bg-[var(--app-code-bg)] pl-0 pr-2 py-0.5">
            <div className="font-mono text-xs leading-4 text-[var(--app-fg)] break-all">
                <span className="inline-flex items-center rounded-sm bg-[var(--app-bg)] px-1 text-[10px] font-semibold uppercase tracking-[0.06em] text-[var(--app-hint)]">
                    {props.name}
                </span>
                <span className="ml-2">{props.value}</span>
            </div>
        </div>
    )
}
