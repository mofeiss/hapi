import { describe, expect, it } from 'bun:test'
import { Store } from './index'

describe('MessageStore upsertMessage', () => {
    it('updates an existing message in place and advances sequence', () => {
        const store = new Store(':memory:')
        const session = store.sessions.getOrCreateSession('tag', { path: '/project' }, null, 'default')

        const first = store.messages.upsertMessage(session.id, { text: 'hello' }, { id: 'msg-1' })
        const updated = store.messages.upsertMessage(session.id, { text: 'hello world' }, { id: 'msg-1' })

        expect(updated.id).toBe(first.id)
        expect(updated.createdAt).toBe(first.createdAt)
        expect(updated.seq).toBeGreaterThan(first.seq)

        const page = store.messages.getMessages(session.id)
        expect(page).toHaveLength(1)
        expect(page[0]?.content).toEqual({ text: 'hello world' })

        const afterFirst = store.messages.getMessagesAfter(session.id, first.seq, 10)
        expect(afterFirst).toHaveLength(1)
        expect(afterFirst[0]?.id).toBe('msg-1')
        expect(afterFirst[0]?.content).toEqual({ text: 'hello world' })
    })
})
