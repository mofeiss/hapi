import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { useLongPress } from './useLongPress'

function TestButton(props: { onClick?: () => void; onLongPress?: () => void }) {
    const handlers = useLongPress({
        onClick: props.onClick,
        onLongPress: () => props.onLongPress?.(),
    })

    return (
        <div>
            <div data-testid="outside">outside</div>
            <button type="button" {...handlers}>session</button>
        </div>
    )
}

describe('useLongPress', () => {
    afterEach(() => {
        cleanup()
    })

    it('does not trigger click when mouseup lands on element without a press starting there', () => {
        const onClick = vi.fn()

        render(<TestButton onClick={onClick} />)

        fireEvent.mouseDown(screen.getByTestId('outside'))
        fireEvent.mouseUp(screen.getByRole('button', { name: 'session' }))

        expect(onClick).not.toHaveBeenCalled()
    })

    it('triggers click when press starts and ends on the same element', () => {
        const onClick = vi.fn()

        render(<TestButton onClick={onClick} />)

        const button = screen.getByRole('button', { name: 'session' })
        fireEvent.mouseDown(button, { button: 0, clientX: 12, clientY: 18 })
        fireEvent.mouseUp(button)

        expect(onClick).toHaveBeenCalledTimes(1)
    })
})
