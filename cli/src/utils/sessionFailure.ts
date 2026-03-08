import { basename } from 'node:path';

const MAX_REASON_LENGTH = 1200;
const MAX_CAUSE_DEPTH = 6;

function normalizeWhitespace(value: string): string {
    return value.replace(/\s+/g, ' ').trim();
}

function truncate(value: string, maxLength: number = MAX_REASON_LENGTH): string {
    if (value.length <= maxLength) {
        return value;
    }
    return `${value.slice(0, maxLength - 3)}...`;
}

function toStringSafe(value: unknown): string {
    if (typeof value === 'string') {
        return value;
    }
    if (value === null || value === undefined) {
        return '';
    }
    try {
        return JSON.stringify(value);
    } catch {
        return String(value);
    }
}

function collectErrorMessages(error: unknown, depth: number = 0): string[] {
    if (depth >= MAX_CAUSE_DEPTH) {
        return [];
    }

    if (error instanceof Error) {
        const messages: string[] = [];
        const primary = normalizeWhitespace(error.message || error.name || 'Unknown error');
        if (primary) {
            messages.push(primary);
        }

        const cause = (error as Error & { cause?: unknown }).cause;
        if (cause !== undefined) {
            messages.push(...collectErrorMessages(cause, depth + 1));
        }

        return messages;
    }

    const fallback = normalizeWhitespace(toStringSafe(error));
    return fallback ? [fallback] : [];
}

function dedupe(messages: string[]): string[] {
    const seen = new Set<string>();
    const result: string[] = [];
    for (const message of messages) {
        if (!message || seen.has(message)) {
            continue;
        }
        seen.add(message);
        result.push(message);
    }
    return result;
}

export function getLogReference(logPath?: string): string | null {
    if (!logPath) {
        return null;
    }

    const trimmed = logPath.trim();
    if (!trimmed) {
        return null;
    }

    return basename(trimmed);
}

export function summarizeErrorForUser(error: unknown, fallback: string = 'Unknown error'): string {
    const messages = dedupe(collectErrorMessages(error));
    if (messages.length === 0) {
        return fallback;
    }
    return truncate(messages.join(' | '));
}

export function formatSessionFailureMessage(opts: {
    headline: string;
    error?: unknown;
    fallbackReason?: string;
    logPath?: string;
}): string {
    const headline = normalizeWhitespace(opts.headline);
    const reason = summarizeErrorForUser(opts.error, opts.fallbackReason ?? 'Unknown error');
    const logRef = getLogReference(opts.logPath);

    const parts = [headline];
    if (reason) {
        parts.push(`Reason: ${reason}`);
    }
    if (logRef) {
        parts.push(`Log: ${logRef}`);
    }

    return parts.join(' ');
}
