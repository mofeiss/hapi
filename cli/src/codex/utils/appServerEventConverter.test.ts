import { describe, expect, it } from 'vitest';
import { AppServerEventConverter } from './appServerEventConverter';

describe('AppServerEventConverter', () => {
    it('maps thread/started', () => {
        const converter = new AppServerEventConverter();
        const events = converter.handleNotification('thread/started', { thread: { id: 'thread-1' } });

        expect(events).toEqual([{ type: 'thread_started', thread_id: 'thread-1' }]);
    });

    it('maps thread/resumed', () => {
        const converter = new AppServerEventConverter();
        const events = converter.handleNotification('thread/resumed', { thread: { id: 'thread-2' } });

        expect(events).toEqual([{ type: 'thread_started', thread_id: 'thread-2' }]);
    });

    it('maps turn/started and completed statuses', () => {
        const converter = new AppServerEventConverter();

        const started = converter.handleNotification('turn/started', { turn: { id: 'turn-1' } });
        expect(started).toEqual([{ type: 'task_started', turn_id: 'turn-1' }]);

        const completed = converter.handleNotification('turn/completed', { turn: { id: 'turn-1' }, status: 'Completed' });
        expect(completed).toEqual([{ type: 'task_complete', turn_id: 'turn-1' }]);

        const interrupted = converter.handleNotification('turn/completed', { turn: { id: 'turn-1' }, status: 'Interrupted' });
        expect(interrupted).toEqual([{ type: 'turn_aborted', turn_id: 'turn-1' }]);

        const failed = converter.handleNotification('turn/completed', { turn: { id: 'turn-1' }, status: 'Failed', message: 'boom' });
        expect(failed).toEqual([{ type: 'task_failed', turn_id: 'turn-1', error: 'boom' }]);
    });

    it('accumulates agent message deltas', () => {
        const converter = new AppServerEventConverter();

        converter.handleNotification('item/agentMessage/delta', { itemId: 'msg-1', delta: 'Hello' });
        converter.handleNotification('item/agentMessage/delta', { itemId: 'msg-1', delta: ' world' });
        const completed = converter.handleNotification('item/completed', {
            item: { id: 'msg-1', type: 'agentMessage' }
        });

        expect(completed).toEqual([{ type: 'agent_message', message: 'Hello world' }]);
    });

    it('maps command execution items and output deltas', () => {
        const converter = new AppServerEventConverter();

        const started = converter.handleNotification('item/started', {
            item: { id: 'cmd-1', type: 'commandExecution', command: 'ls' }
        });
        expect(started).toEqual([{
            type: 'exec_command_begin',
            call_id: 'cmd-1',
            command: 'ls'
        }]);

        converter.handleNotification('item/commandExecution/outputDelta', { itemId: 'cmd-1', delta: 'ok' });
        const completed = converter.handleNotification('item/completed', {
            item: { id: 'cmd-1', type: 'commandExecution', exitCode: 0 }
        });

        expect(completed).toEqual([{
            type: 'exec_command_end',
            call_id: 'cmd-1',
            command: 'ls',
            output: 'ok',
            exit_code: 0
        }]);
    });

    it('preserves stdout and aggregated output for command execution items', () => {
        const converter = new AppServerEventConverter();

        converter.handleNotification('item/started', {
            item: { id: 'cmd-2', type: 'commandExecution', command: 'sed -n 1,20p file.ts' }
        });

        const completed = converter.handleNotification('item/completed', {
            item: {
                id: 'cmd-2',
                type: 'commandExecution',
                stdout: 'export const value = 1;\n',
                aggregated_output: 'export const value = 1;\n',
                exitCode: 0,
                status: 'completed'
            }
        });

        expect(completed).toEqual([{
            type: 'exec_command_end',
            call_id: 'cmd-2',
            command: 'sed -n 1,20p file.ts',
            stdout: 'export const value = 1;\n',
            output: 'export const value = 1;\n',
            exit_code: 0,
            status: 'completed'
        }]);
    });

    it('ignores poorer duplicate exec_command_end wrapper after a richer item-completed event', () => {
        const converter = new AppServerEventConverter();

        converter.handleNotification('item/started', {
            item: { id: 'cmd-3', type: 'commandExecution', command: 'sed -n 1,20p file.ts', cwd: '/tmp' }
        });
        converter.handleNotification('item/commandExecution/outputDelta', {
            itemId: 'cmd-3',
            delta: 'export const value = 1;\n'
        });

        const completed = converter.handleNotification('item/completed', {
            item: { id: 'cmd-3', type: 'commandExecution', exitCode: 0, status: 'completed' }
        });
        expect(completed).toEqual([{
            type: 'exec_command_end',
            call_id: 'cmd-3',
            command: 'sed -n 1,20p file.ts',
            cwd: '/tmp',
            output: 'export const value = 1;\n',
            exit_code: 0,
            status: 'completed'
        }]);

        const duplicate = converter.handleNotification('codex/event/exec_command_end', {
            msg: {
                call_id: 'cmd-3',
                command: '/bin/zsh -lc "sed -n 1,20p file.ts"',
                cwd: '/tmp',
                exit_code: 0,
                status: 'completed'
            }
        });
        expect(duplicate).toEqual([]);
    });

    it('ignores user message item lifecycle notifications', () => {
        const converter = new AppServerEventConverter();

        const started = converter.handleNotification('item/started', {
            item: { id: 'user-1', type: 'userMessage', content: [{ type: 'text', text: 'hello' }] }
        });
        const completed = converter.handleNotification('item/completed', {
            item: { id: 'user-1', type: 'userMessage', content: [{ type: 'text', text: 'hello' }] }
        });

        expect(started).toEqual([]);
        expect(completed).toEqual([]);
    });

    it('maps codex/event exec command wrappers with stdout', () => {
        const converter = new AppServerEventConverter();

        const started = converter.handleNotification('codex/event/exec_command_begin', {
            msg: {
                call_id: 'call-1',
                command: ['/bin/zsh', '-lc', 'cat /tmp/SKILL.md'],
                cwd: '/tmp',
                parsed_cmd: [{ type: 'read', path: '/tmp/SKILL.md' }]
            }
        });
        expect(started).toEqual([{
            type: 'exec_command_begin',
            call_id: 'call-1',
            command: '/bin/zsh -lc cat /tmp/SKILL.md',
            cwd: '/tmp',
            parsed_cmd: [{ type: 'read', path: '/tmp/SKILL.md' }]
        }]);

        const completed = converter.handleNotification('codex/event/exec_command_end', {
            msg: {
                call_id: 'call-1',
                command: ['/bin/zsh', '-lc', 'cat /tmp/SKILL.md'],
                cwd: '/tmp',
                stdout: '# skill',
                exit_code: 0,
                status: 'completed'
            }
        });
        expect(completed).toEqual([{
            type: 'exec_command_end',
            call_id: 'call-1',
            command: '/bin/zsh -lc cat /tmp/SKILL.md',
            cwd: '/tmp',
            stdout: '# skill',
            exit_code: 0,
            status: 'completed'
        }]);
    });

    it('maps reasoning deltas', () => {
        const converter = new AppServerEventConverter();

        const events = converter.handleNotification('item/reasoning/textDelta', { itemId: 'r1', delta: 'step' });
        expect(events).toEqual([{ type: 'agent_reasoning_delta', delta: 'step' }]);
    });

    it('maps diff updates', () => {
        const converter = new AppServerEventConverter();

        const events = converter.handleNotification('turn/diff/updated', { diff: 'diff --git a b' });
        expect(events).toEqual([{ type: 'turn_diff', unified_diff: 'diff --git a b' }]);
    });

    it('maps codex stream/error notifications and wrapper task complete', () => {
        const converter = new AppServerEventConverter();

        const streamError = converter.handleNotification('codex/event/stream_error', {
            msg: {
                message: 'Reconnecting... 5/5',
                additional_details: 'unexpected status 401 Unauthorized'
            }
        });
        expect(streamError).toEqual([{
            type: 'task_warning',
            warning: 'unexpected status 401 Unauthorized'
        }]);

        const failed = converter.handleNotification('codex/event/error', {
            msg: {
                message: 'unexpected status 401 Unauthorized'
            }
        });
        expect(failed).toEqual([{
            type: 'task_failed',
            error: 'unexpected status 401 Unauthorized'
        }]);

        const completed = converter.handleNotification('codex/event/task_complete', {
            msg: {
                turn_id: 'turn-2'
            }
        });
        expect(completed).toEqual([{ type: 'task_complete', turn_id: 'turn-2' }]);
    });

    it('maps thread/status/changed system errors', () => {
        const converter = new AppServerEventConverter();

        const events = converter.handleNotification('thread/status/changed', {
            status: {
                type: 'systemError',
                message: 'Missing authentication'
            }
        });
        expect(events).toEqual([{
            type: 'task_failed',
            error: 'Missing authentication'
        }]);
    });

    it('maps codex warning and task started wrapper events', () => {
        const converter = new AppServerEventConverter();

        const warning = converter.handleNotification('codex/event/warning', {
            msg: {
                message: 'rate limit warning'
            }
        });
        expect(warning).toEqual([{
            type: 'task_warning',
            warning: 'rate limit warning'
        }]);

        const started = converter.handleNotification('codex/event/task_started', {
            id: 'turn-wrapped',
            msg: {
                turn_id: 'turn-wrapped'
            }
        });
        expect(started).toEqual([{
            type: 'task_started',
            turn_id: 'turn-wrapped'
        }]);
    });

    it('maps codex token count wrapper event', () => {
        const converter = new AppServerEventConverter();

        const events = converter.handleNotification('codex/event/token_count', {
            msg: {
                info: {
                    total_token_usage: {
                        total_tokens: 123
                    }
                }
            }
        });

        expect(events).toEqual([{
            type: 'token_count',
            info: {
                total_token_usage: {
                    total_tokens: 123
                }
            }
        }]);
    });

    it('ignores duplicated codex wrapper notifications', () => {
        const converter = new AppServerEventConverter();

        expect(converter.handleNotification('codex/event/mcp_startup_update', { msg: { status: { state: 'ready' } } })).toEqual([]);
        expect(converter.handleNotification('codex/event/mcp_startup_complete', { msg: { ready: ['hapi'] } })).toEqual([]);
        expect(converter.handleNotification('codex/event/item_started', { msg: { item: { id: 'x' } } })).toEqual([]);
        expect(converter.handleNotification('codex/event/item_completed', { msg: { item: { id: 'x' } } })).toEqual([]);
        expect(converter.handleNotification('codex/event/user_message', { msg: { message: 'hello' } })).toEqual([]);
    });
});
