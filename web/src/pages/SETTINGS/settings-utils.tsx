import type { ReactNode } from 'react';
import type { SettingEntry } from '@/data/useSettings';

/** Case-insensitive substring test used by both the global and script search. */
export function matchesQuery(entry: SettingEntry, groupLabel: string, query: string): boolean {
    if (!query) return true;

    const needle = query.toLowerCase();
    const haystacks: string[] = [entry.label, entry.path, entry.help ?? '', groupLabel];

    for (const option of entry.options ?? []) {
        haystacks.push(typeof option === 'string' ? option : option.label);
    }

    for (const field of entry.fields ?? []) {
        haystacks.push(field.label ?? field.key);
    }

    return haystacks.some((haystack) => haystack.toLowerCase().includes(needle));
}

/** Wraps the matched substring so search results show why they matched. */
export function highlight(text: string, query: string): ReactNode {
    if (!query) return text;

    const index = text.toLowerCase().indexOf(query.toLowerCase());
    if (index === -1) return text;

    return (
        <>
            {text.slice(0, index)}
            <span className="rounded-[0.3vh] bg-primary/25 text-primary">{text.slice(index, index + query.length)}</span>
            {text.slice(index + query.length)}
        </>
    );
}

/**
 * What a field accepts, for the badge beside its label. Controls that already
 * say it themselves — a toggle, a dropdown, a color swatch — return null
 * rather than repeating it.
 */
export function typeHint(entry: SettingEntry): string | null {
    switch (entry.type) {
        case 'number':
        case 'percent':
        case 'integer': {
            const kind = entry.type === 'integer' ? 'Whole number' : 'Number';

            if (entry.min !== undefined && entry.max !== undefined) return `${kind} · ${entry.min}–${entry.max}`;
            if (entry.min !== undefined) return `${kind} · min ${entry.min}`;
            if (entry.max !== undefined) return `${kind} · max ${entry.max}`;

            return kind;
        }

        case 'vehicle':
            return 'Vehicle model';

        case 'string':
            return entry.max_length !== undefined ? `Text · max ${entry.max_length}` : 'Text';

        case 'time':
            return 'Time · HH:MM';

        // The pickers show the id next to the name, so the type is self-evident.
        default:
            return null;
    }
}

/** Short human preview of a value for result rows and "Default:" hints. */
export function previewValue(value: unknown): string {
    if (value === null || value === undefined) return '—';
    if (typeof value === 'boolean') return value ? 'On' : 'Off';
    if (typeof value === 'number' || typeof value === 'string') return String(value);
    if (Array.isArray(value)) return `${value.length} entries`;

    return `${Object.keys(value as Record<string, unknown>).length} values`;
}
