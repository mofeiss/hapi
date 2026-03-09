import { describe, expect, it } from 'vitest'
import { extractAgentPrompt, extractAgentResultMarkdown, extractAgentTopic } from '@/lib/agentTool'

describe('extractAgentPrompt', () => {
    it('returns the full prompt instead of the short description', () => {
        const input = {
            description: '读取并总结 RTK 文档',
            prompt: '请读取 ~/.claude/RTK.md 文件，然后总结其主要内容。'
        }

        expect(extractAgentPrompt(input)).toBe('请读取 ~/.claude/RTK.md 文件，然后总结其主要内容。')
    })
})

describe('extractAgentTopic', () => {
    it('prefers explicit description as the compact topic', () => {
        const input = {
            description: '读取并总结 RTK 文档',
            prompt: '请读取 ~/.claude/RTK.md 文件，然后总结其主要内容。'
        }

        expect(extractAgentTopic(input)).toBe('读取并总结 RTK 文档')
    })

    it('falls back to the first meaningful prompt line', () => {
        const input = {
            prompt: '# 分析日志\n\n请只输出关键结论。'
        }

        expect(extractAgentTopic(input)).toBe('分析日志')
    })
})

describe('extractAgentResultMarkdown', () => {
    it('extracts markdown from structured agent content blocks', () => {
        const result = {
            status: 'completed',
            agentId: 'abfab31fa828c4cf2',
            content: [
                {
                    type: 'text',
                    text: '## RTK 文档总结\n\n- 自动压缩命令输出'
                }
            ],
            totalDurationMs: 18071
        }

        expect(extractAgentResultMarkdown(result)).toBe('## RTK 文档总结\n\n- 自动压缩命令输出')
    })

    it('returns null when structured content is missing', () => {
        const result = {
            status: 'completed',
            agentId: 'abfab31fa828c4cf2',
            totalDurationMs: 18071
        }

        expect(extractAgentResultMarkdown(result)).toBeNull()
    })
})
