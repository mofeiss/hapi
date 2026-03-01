import { describe, it, expect } from 'vitest';
import { parseCompact, parseClear, parseNew, parseSpecialCommand } from './specialCommands';

describe('parseCompact', () => {
    it('should parse /compact command with argument', () => {
        const result = parseCompact('/compact optimize the code');
        expect(result.isCompact).toBe(true);
        expect(result.originalMessage).toBe('/compact optimize the code');
    });

    it('should parse /compact command without argument', () => {
        const result = parseCompact('/compact');
        expect(result.isCompact).toBe(true);
        expect(result.originalMessage).toBe('/compact');
    });

    it('should not parse regular messages', () => {
        const result = parseCompact('hello world');
        expect(result.isCompact).toBe(false);
        expect(result.originalMessage).toBe('hello world');
    });

    it('should not parse messages that contain compact but do not start with /compact', () => {
        const result = parseCompact('please /compact this');
        expect(result.isCompact).toBe(false);
        expect(result.originalMessage).toBe('please /compact this');
    });
});

describe('parseClear', () => {
    it('should parse /clear command exactly', () => {
        const result = parseClear('/clear');
        expect(result.isClear).toBe(true);
    });

    it('should parse /clear command with whitespace', () => {
        const result = parseClear('  /clear  ');
        expect(result.isClear).toBe(true);
    });

    it('should not parse /clear with arguments', () => {
        const result = parseClear('/clear something');
        expect(result.isClear).toBe(false);
    });

    it('should not parse regular messages', () => {
        const result = parseClear('hello world');
        expect(result.isClear).toBe(false);
    });
});

describe('parseNew', () => {
    it('should parse /new command exactly', () => {
        const result = parseNew('/new');
        expect(result.isNew).toBe(true);
        expect(result.prompt).toBeUndefined();
    });

    it('should parse /new command with prompt', () => {
        const result = parseNew('/new summarize this');
        expect(result.isNew).toBe(true);
        expect(result.prompt).toBe('summarize this');
    });

    it('should parse /new command with surrounding whitespace', () => {
        const result = parseNew('  /new   check logs   ');
        expect(result.isNew).toBe(true);
        expect(result.prompt).toBe('check logs');
    });

    it('should not parse regular messages', () => {
        const result = parseNew('hello world');
        expect(result.isNew).toBe(false);
        expect(result.prompt).toBeUndefined();
    });
});

describe('parseSpecialCommand', () => {
    it('should detect compact command', () => {
        const result = parseSpecialCommand('/compact optimize');
        expect(result.type).toBe('compact');
        expect(result.originalMessage).toBe('/compact optimize');
    });

    it('should detect clear command', () => {
        const result = parseSpecialCommand('/clear');
        expect(result.type).toBe('clear');
        expect(result.originalMessage).toBeUndefined();
    });

    it('should detect new command without prompt', () => {
        const result = parseSpecialCommand('/new');
        expect(result.type).toBe('new');
        expect(result.prompt).toBeUndefined();
    });

    it('should detect new command with prompt', () => {
        const result = parseSpecialCommand('/new check node version');
        expect(result.type).toBe('new');
        expect(result.prompt).toBe('check node version');
    });

    it('should return null for regular messages', () => {
        const result = parseSpecialCommand('hello world');
        expect(result.type).toBeNull();
        expect(result.originalMessage).toBeUndefined();
    });

    it('should handle edge cases correctly', () => {
        // Test with extra whitespace
        expect(parseSpecialCommand('  /compact test  ').type).toBe('compact');
        expect(parseSpecialCommand('  /clear  ').type).toBe('clear');
        
        // Test partial matches should not trigger
        expect(parseSpecialCommand('some /compact text').type).toBeNull();
        expect(parseSpecialCommand('/compactor').type).toBeNull();
        expect(parseSpecialCommand('/clearing').type).toBeNull();
        expect(parseSpecialCommand('/newton').type).toBeNull();
    });
});
