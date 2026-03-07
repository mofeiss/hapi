import { describe, expect, it } from 'vitest';
import { PartialCodexAssistantStreamTracker } from './partialAssistantStream';

describe('PartialCodexAssistantStreamTracker', () => {
    it('accumulates deltas and reuses the same message id for the final snapshot', () => {
        const tracker = new PartialCodexAssistantStreamTracker();

        const first = tracker.consumeDelta('msg-1', 'Hello');
        const second = tracker.consumeDelta('msg-1', ' world');
        const final = tracker.finish('msg-1', 'Hello world');

        expect(first).not.toBeNull();
        expect(second).not.toBeNull();
        expect(final).not.toBeNull();

        expect(first?.messageId).toBe(second?.messageId);
        expect(second?.messageId).toBe(final?.messageId);
        expect(second?.message.message).toBe('Hello world');
        expect(final?.message.message).toBe('Hello world');
        expect(tracker.finish('msg-1', 'Hello world')).toBeNull();
    });

    it('ignores empty item ids or deltas', () => {
        const tracker = new PartialCodexAssistantStreamTracker();

        expect(tracker.consumeDelta('', 'Hello')).toBeNull();
        expect(tracker.consumeDelta('msg-1', '')).toBeNull();
    });
});
