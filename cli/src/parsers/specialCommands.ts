/**
 * Parsers for special commands that require dedicated remote session handling
 */

export interface CompactCommandResult {
    isCompact: boolean;
    originalMessage: string;
}

export interface ClearCommandResult {
    isClear: boolean;
}

export interface NewCommandResult {
    isNew: boolean;
    prompt?: string;
}

export interface SpecialCommandResult {
    type: 'compact' | 'clear' | 'new' | null;
    originalMessage?: string;
    prompt?: string;
}

/**
 * Parse /compact command
 * Matches messages starting with "/compact " or exactly "/compact"
 */
export function parseCompact(message: string): CompactCommandResult {
    const trimmed = message.trim();
    
    if (trimmed === '/compact') {
        return {
            isCompact: true,
            originalMessage: trimmed
        };
    }
    
    if (trimmed.startsWith('/compact ')) {
        return {
            isCompact: true,
            originalMessage: trimmed
        };
    }
    
    return {
        isCompact: false,
        originalMessage: message
    };
}

/**
 * Parse /clear command
 * Only matches exactly "/clear"
 */
export function parseClear(message: string): ClearCommandResult {
    const trimmed = message.trim();
    
    return {
        isClear: trimmed === '/clear'
    };
}

/**
 * Parse /new command
 * Matches exactly "/new" or "/new <prompt>"
 */
export function parseNew(message: string): NewCommandResult {
    const trimmed = message.trim();
    const match = trimmed.match(/^\/new(?:\s+([\s\S]+))?$/);

    if (!match) {
        return {
            isNew: false
        };
    }

    const prompt = match[1]?.trim();

    return {
        isNew: true,
        ...(prompt ? { prompt } : {})
    };
}

/**
 * Unified parser for special commands
 * Returns the type of command and original message if applicable
 */
export function parseSpecialCommand(message: string): SpecialCommandResult {
    const compactResult = parseCompact(message);
    if (compactResult.isCompact) {
        return {
            type: 'compact',
            originalMessage: compactResult.originalMessage
        };
    }
    
    const clearResult = parseClear(message);
    if (clearResult.isClear) {
        return {
            type: 'clear'
        };
    }

    const newResult = parseNew(message);
    if (newResult.isNew) {
        return {
            type: 'new',
            ...(newResult.prompt ? { prompt: newResult.prompt } : {})
        };
    }
    
    return {
        type: null
    };
}
