import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { createElement } from 'react'
import { defaultComponents } from '@/components/assistant-ui/markdown-text'

describe('MarkdownRenderer links', () => {
    it('renders code header language labels with a prefix', () => {
        Object.defineProperty(window, 'matchMedia', {
            writable: true,
            value: () => ({
                matches: false,
                media: '',
                onchange: null,
                addListener: () => {},
                removeListener: () => {},
                addEventListener: () => {},
                removeEventListener: () => {},
                dispatchEvent: () => false,
            }),
        })

        const MarkdownCodeHeader = defaultComponents.CodeHeader as NonNullable<typeof defaultComponents.CodeHeader>
        render(createElement(MarkdownCodeHeader as any, { language: 'json', code: '{}' }))

        expect(screen.getByText('language: json')).toBeInTheDocument()
    })

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
