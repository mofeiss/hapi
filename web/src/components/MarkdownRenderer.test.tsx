import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { createElement } from 'react'
import { defaultComponents } from '@/components/assistant-ui/markdown-text'

describe('MarkdownRenderer links', () => {
    it('opens markdown links in a new tab with safe rel attributes', () => {
        const MarkdownLink = defaultComponents.a as NonNullable<typeof defaultComponents.a>
        render(createElement(MarkdownLink as any, { href: 'https://openai.com' }, 'OpenAI'))

        const link = screen.getByRole('link', { name: 'OpenAI' })
        expect(link).toHaveAttribute('target', '_blank')

        const rel = link.getAttribute('rel') ?? ''
        expect(rel).toContain('noopener')
        expect(rel).toContain('noreferrer')
    })
})
