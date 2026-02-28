import type { ToolViewComponent } from '@/components/ToolCard/views/_all'
import { MarkdownRenderer } from '@/components/MarkdownRenderer'
import { extractSkillReadData } from '@/lib/skillRead'
import { useTranslation } from '@/lib/use-translation'

export const SkillReadView: ToolViewComponent = (props) => {
    const { t } = useTranslation()
    const data = extractSkillReadData(props.block.tool.input, props.block.tool.result)

    if (!data?.content) {
        return (
            <div className="text-xs text-[var(--app-hint)]">
                {t('tool.skillContentUnavailable')}
            </div>
        )
    }

    return (
        <div className="max-h-[48vh] overflow-auto rounded-md bg-[var(--app-bg)] p-3">
            <MarkdownRenderer content={data.content} />
        </div>
    )
}
