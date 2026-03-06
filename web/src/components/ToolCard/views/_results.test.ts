import { describe, expect, it } from 'vitest'
import {
    extractMcpResourceListEntries,
    extractMcpResourceServerGroups,
    extractPlanModeMessage,
    groupMcpResourceListEntries,
    shouldUseGroupedMcpResourceListLayout,
    sanitizeReadResultText
} from '@/components/ToolCard/views/_results'
import { isResultOnlyToolName } from '@/components/ToolCard/toolRenderModes'

describe('sanitizeReadResultText', () => {
    it('removes system reminder block from read output', () => {
        const input = [
            'first line',
            '<system-reminder>',
            'Whenever you read a file...',
            '</system-reminder>',
            'second line'
        ].join('\n')

        const output = sanitizeReadResultText(input)
        expect(output).toBe('first line\n\nsecond line')
    })

    it('keeps normal text unchanged', () => {
        const input = 'line a\nline b'
        expect(sanitizeReadResultText(input)).toBe(input)
    })

    it('returns empty text when only reminder exists', () => {
        const input = '<system-reminder>\ninternal text\n</system-reminder>'
        expect(sanitizeReadResultText(input)).toBe('')
    })

    it('strips claude-style line number prefixes in read output', () => {
        const input = [
            '     1→##',
            '     2→# Host Database',
            '     3→127.0.0.1\tlocalhost',
            '    10→127.0.0.1 m'
        ].join('\n')

        const output = sanitizeReadResultText(input)
        expect(output).toBe([
            '##',
            '# Host Database',
            '127.0.0.1\tlocalhost',
            '127.0.0.1 m'
        ].join('\n'))
    })

    it('does not strip isolated arrow-like normal lines', () => {
        const input = [
            'normal line',
            'x = y -> z',
            'another line'
        ].join('\n')

        expect(sanitizeReadResultText(input)).toBe(input)
    })
})

describe('extractPlanModeMessage', () => {
    it('extracts message from object result', () => {
        const result = {
            message: 'Entered plan mode. You should now focus on exploring the codebase.'
        }

        expect(extractPlanModeMessage(result)).toBe(result.message)
    })

    it('extracts message from InputValidationError string payload', () => {
        const result = [
            'InputValidationError: [',
            '  {',
            '    "code": "unrecognized_keys",',
            '    "keys": [',
            '      "bad_field"',
            '    ],',
            '    "path": [],',
            '    "message": "Unrecognized key: \\"bad_field\\""',
            '  }',
            ']'
        ].join('\n')

        expect(extractPlanModeMessage(result)).toBe('Unrecognized key: "bad_field"')
    })

    it('returns null when no message can be parsed', () => {
        expect(extractPlanModeMessage('InputValidationError: not-a-json-payload')).toBeNull()
    })
})

describe('extractMcpResourceListEntries', () => {
    it('extracts resource entries from array result', () => {
        const result = [
            {
                name: 'Server Configuration',
                uri: 'config://server-config',
                description: 'Current server configuration and environment variables',
                mimeType: 'application/json',
                server: 'searxng'
            },
            {
                name: 'Usage Guide',
                uri: 'help://usage-guide',
                description: 'How to use the MCP SearXNG server effectively',
                mimeType: 'text/markdown',
                server: 'searxng'
            }
        ]

        expect(extractMcpResourceListEntries(result)).toEqual([
            {
                server: 'searxng',
                name: 'Server Configuration',
                description: 'Current server configuration and environment variables'
            },
            {
                server: 'searxng',
                name: 'Usage Guide',
                description: 'How to use the MCP SearXNG server effectively'
            }
        ])
    })

    it('extracts resource entries from stringified json result', () => {
        const result = JSON.stringify([
            {
                name: 'Usage Guide',
                description: 'How to use the MCP SearXNG server effectively'
            }
        ])

        expect(extractMcpResourceListEntries(result)).toEqual([
            {
                server: null,
                name: 'Usage Guide',
                description: 'How to use the MCP SearXNG server effectively'
            }
        ])
    })

    it('extracts resource entries from nested resources payload', () => {
        const result = {
            data: {
                resources: [
                    {
                        name: 'Server Configuration',
                        description: 'Current server configuration and environment variables'
                    }
                ]
            }
        }

        expect(extractMcpResourceListEntries(result)).toEqual([
            {
                server: null,
                name: 'Server Configuration',
                description: 'Current server configuration and environment variables'
            }
        ])
    })

    it('returns empty list for empty resource payload', () => {
        expect(extractMcpResourceListEntries([])).toEqual([])
    })

    it('returns null for unrelated result payload', () => {
        expect(extractMcpResourceListEntries({ message: 'not a resource list' })).toBeNull()
    })
})

describe('groupMcpResourceListEntries', () => {
    it('groups resources by server and preserves first-seen order', () => {
        const entries = [
            {
                server: 'searxng',
                name: 'Server Configuration',
                description: 'Current server configuration and environment variables'
            },
            {
                server: 'searxng',
                name: 'Usage Guide',
                description: 'How to use the MCP SearXNG server effectively'
            },
            {
                server: 'websearch-serpapi',
                name: 'serpapi-engines-index',
                description: 'Index of available SerpApi engines and their resource URIs.'
            }
        ]

        expect(groupMcpResourceListEntries(entries)).toEqual([
            {
                server: 'searxng',
                resources: [
                    {
                        name: 'Server Configuration',
                        description: 'Current server configuration and environment variables'
                    },
                    {
                        name: 'Usage Guide',
                        description: 'How to use the MCP SearXNG server effectively'
                    }
                ]
            },
            {
                server: 'websearch-serpapi',
                resources: [
                    {
                        name: 'serpapi-engines-index',
                        description: 'Index of available SerpApi engines and their resource URIs.'
                    }
                ]
            }
        ])
    })
})

describe('extractMcpResourceServerGroups', () => {
    it('extracts grouped server nodes from resource payload', () => {
        const result = [
            {
                name: 'Server Configuration',
                description: 'Current server configuration and environment variables',
                server: 'searxng'
            },
            {
                name: 'Usage Guide',
                description: 'How to use the MCP SearXNG server effectively',
                server: 'searxng'
            },
            {
                name: 'serpapi-engines-index',
                description: 'Index of available SerpApi engines and their resource URIs.',
                server: 'websearch-serpapi'
            }
        ]

        expect(extractMcpResourceServerGroups(result)).toEqual([
            {
                server: 'searxng',
                resources: [
                    {
                        name: 'Server Configuration',
                        description: 'Current server configuration and environment variables'
                    },
                    {
                        name: 'Usage Guide',
                        description: 'How to use the MCP SearXNG server effectively'
                    }
                ]
            },
            {
                server: 'websearch-serpapi',
                resources: [
                    {
                        name: 'serpapi-engines-index',
                        description: 'Index of available SerpApi engines and their resource URIs.'
                    }
                ]
            }
        ])
    })
})

describe('shouldUseGroupedMcpResourceListLayout', () => {
    it('uses grouped layout only for empty object input', () => {
        expect(shouldUseGroupedMcpResourceListLayout({})).toBe(true)
        expect(shouldUseGroupedMcpResourceListLayout({ server: 'searxng' })).toBe(false)
        expect(shouldUseGroupedMcpResourceListLayout(null)).toBe(false)
    })
})

describe('isResultOnlyToolName', () => {
    it('treats ListMcpResourcesTool as result-only when input is empty object and json parses into grouped resources', () => {
        const result = [
            {
                name: 'Server Configuration',
                description: 'Current server configuration and environment variables',
                server: 'searxng'
            }
        ]

        expect(isResultOnlyToolName('ListMcpResourcesTool', {}, result)).toBe(true)
    })

    it('does not treat ListMcpResourcesTool as result-only when input contains server filter', () => {
        const result = [
            {
                name: 'Server Configuration',
                description: 'Current server configuration and environment variables',
                server: 'searxng'
            }
        ]

        expect(isResultOnlyToolName('ListMcpResourcesTool', { server: 'searxng' }, result)).toBe(false)
    })

    it('falls back to non-result-only when ListMcpResourcesTool result is not parseable json', () => {
        expect(isResultOnlyToolName('ListMcpResourcesTool', {}, 'not-json')).toBe(false)
    })
})
