import { randomUUID } from 'node:crypto';

type StreamState = {
    messageId: string;
    text: string;
};

export type PartialCodexAssistantMessage = {
    messageId: string;
    message: {
        type: 'message';
        message: string;
        id: string;
    };
};

export class PartialCodexAssistantStreamTracker {
    private readonly streams = new Map<string, StreamState>();

    consumeDelta(itemId: string, delta: string): PartialCodexAssistantMessage | null {
        if (!itemId || !delta) {
            return null;
        }

        const state = this.getOrCreateState(itemId);
        state.text += delta;

        return {
            messageId: state.messageId,
            message: {
                type: 'message',
                message: state.text,
                id: randomUUID()
            }
        };
    }

    finish(itemId: string, finalText: string): PartialCodexAssistantMessage | null {
        const state = this.streams.get(itemId);
        if (!state) {
            return null;
        }

        this.streams.delete(itemId);
        state.text = finalText;

        return {
            messageId: state.messageId,
            message: {
                type: 'message',
                message: state.text,
                id: randomUUID()
            }
        };
    }

    clear(): void {
        this.streams.clear();
    }

    private getOrCreateState(itemId: string): StreamState {
        const existing = this.streams.get(itemId);
        if (existing) {
            return existing;
        }

        const created: StreamState = {
            messageId: randomUUID(),
            text: ''
        };
        this.streams.set(itemId, created);
        return created;
    }
}
