import { logger } from '@/ui/logger';
import { CodexAppServerClient } from '../codexAppServerClient';
import type {
    ModelListItem,
    ModelListResponse,
    ReasoningEffort
} from '../appServerTypes';

const REASONING_EFFORTS = new Set<ReasoningEffort>([
    'none',
    'minimal',
    'low',
    'medium',
    'high',
    'xhigh'
]);

function asRecord(value: unknown): Record<string, unknown> | null {
    if (!value || typeof value !== 'object') {
        return null;
    }
    return value as Record<string, unknown>;
}

function asString(value: unknown): string | null {
    if (typeof value !== 'string') {
        return null;
    }
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
}

function asBoolean(value: unknown): boolean | null {
    return typeof value === 'boolean' ? value : null;
}

function asReasoningEffort(value: unknown): ReasoningEffort | null {
    if (typeof value !== 'string') {
        return null;
    }
    return REASONING_EFFORTS.has(value as ReasoningEffort) ? (value as ReasoningEffort) : null;
}

function parseModel(raw: unknown): ModelListItem | null {
    const record = asRecord(raw);
    if (!record) {
        return null;
    }

    const id = asString(record.id);
    const model = asString(record.model);
    const displayName = asString(record.displayName);
    const description = asString(record.description) ?? '';
    const hidden = asBoolean(record.hidden);
    const isDefault = asBoolean(record.isDefault);
    const defaultReasoningEffort = asReasoningEffort(record.defaultReasoningEffort);

    if (!id || !model || !displayName || hidden === null || isDefault === null || !defaultReasoningEffort) {
        return null;
    }

    const supportedReasoningEffortsRaw = Array.isArray(record.supportedReasoningEfforts)
        ? record.supportedReasoningEfforts
        : [];
    const supportedReasoningEfforts = supportedReasoningEffortsRaw
        .map((entry) => {
            const effortRecord = asRecord(entry);
            if (!effortRecord) {
                return null;
            }
            const reasoningEffort = asReasoningEffort(effortRecord.reasoningEffort);
            const optionDescription = asString(effortRecord.description) ?? '';
            if (!reasoningEffort) {
                return null;
            }
            return {
                reasoningEffort,
                description: optionDescription
            };
        })
        .filter((entry): entry is NonNullable<typeof entry> => entry !== null);

    return {
        id,
        model,
        displayName,
        description,
        hidden,
        isDefault,
        defaultReasoningEffort,
        supportedReasoningEfforts
    };
}

function parseModelListResponse(raw: unknown): ModelListResponse {
    const record = asRecord(raw);
    if (!record) {
        return { data: [] };
    }

    const dataRaw = Array.isArray(record.data) ? record.data : [];
    const data = dataRaw
        .map((entry) => parseModel(entry))
        .filter((entry): entry is ModelListItem => entry !== null);
    const nextCursor = record.nextCursor === null ? null : asString(record.nextCursor);

    return { data, nextCursor };
}

export async function fetchCodexModelCatalog(options?: {
    includeHidden?: boolean;
    limit?: number;
    maxPages?: number;
}): Promise<ModelListItem[]> {
    const includeHidden = options?.includeHidden ?? false;
    const limit = options?.limit ?? 100;
    const maxPages = options?.maxPages ?? 20;
    const client = new CodexAppServerClient();
    const models: ModelListItem[] = [];
    const seenModels = new Set<string>();

    try {
        await client.connect();
        await client.initialize({
            clientInfo: {
                name: 'hapi-runner',
                version: '1.0.0'
            }
        });

        let cursor: string | null | undefined = null;
        let pages = 0;

        while (pages < maxPages) {
            const response = parseModelListResponse(await client.listModels({
                includeHidden,
                limit,
                cursor
            }));

            for (const model of response.data) {
                if (seenModels.has(model.model)) {
                    continue;
                }
                seenModels.add(model.model);
                models.push(model);
            }

            pages += 1;
            if (!response.nextCursor) {
                break;
            }
            cursor = response.nextCursor;
        }

        return models;
    } finally {
        try {
            await client.disconnect();
        } catch (error) {
            logger.debug('[CodexModelCatalog] Failed to disconnect app-server client', error);
        }
    }
}
