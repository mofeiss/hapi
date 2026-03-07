import { cn } from '@/lib/utils'

export type ToolParamFieldPosition = 'single' | 'first' | 'middle' | 'last'

export function getToolParamFieldPosition(index: number, total: number): ToolParamFieldPosition {
    if (total <= 1) return 'single'
    if (index === 0) return 'first'
    if (index === total - 1) return 'last'
    return 'middle'
}

export function getToolParamFieldContainerClass(position: ToolParamFieldPosition = 'single'): string {
    return cn(
        'tool-param-field min-w-0 w-full max-w-full bg-transparent pl-0 pr-2 py-0.5',
        position === 'single' && 'rounded-md',
        position === 'first' && 'rounded-t-md',
        position === 'middle' && 'rounded-none',
        position === 'last' && 'rounded-b-md'
    )
}

export function ToolParamField(props: { name: string; value: string; position?: ToolParamFieldPosition }) {
    return (
        <div className={getToolParamFieldContainerClass(props.position)}>
            <div className="font-mono text-xs leading-4 text-[var(--app-fg)] break-all">
                <span className="inline-flex items-center rounded-sm bg-[var(--app-bg)] px-1 text-[10px] font-semibold uppercase tracking-[0.06em] text-[var(--app-hint)]">
                    {props.name}
                </span>
                <span className="ml-2">{props.value}</span>
            </div>
        </div>
    )
}
