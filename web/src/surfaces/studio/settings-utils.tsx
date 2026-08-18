import type { ReactNode } from 'react';
import type { SettingEntry } from '@/data/useSettings';

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

        default:
            return null;
    }
}

export function previewValue(value: unknown): string {
    if (value === null || value === undefined) return '—';
    if (typeof value === 'boolean') return value ? 'On' : 'Off';
    if (typeof value === 'number' || typeof value === 'string') return String(value);
    if (Array.isArray(value)) return `${value.length} entries`;

    return `${Object.keys(value as Record<string, unknown>).length} values`;
}

/**
 * A styled hover tooltip. Native `title` bubbles are unreliable inside NUI, so
 * icon-only buttons wrap themselves in this instead: hover shows a small label
 * above the control saying what it does.
 */
export function Tip({ label, children }: { label: string; children: ReactNode }) {
    return (
        <span className="group/tip relative inline-flex">
            {children}

            <span className="pointer-events-none absolute bottom-[calc(100%+0.7vh)] left-1/2 z-50 -translate-x-1/2 whitespace-nowrap rounded-[0.5vh] border border-white/15 bg-neutral-900 px-[1vh] py-[0.5vh] text-[1.2vh] font-semibold text-white/85 opacity-0 shadow-[0_0.6vh_1.8vh_rgba(0,0,0,0.6)] transition-opacity duration-150 group-hover/tip:opacity-100">
                {label}
                <span className="absolute left-1/2 top-full h-[0.7vh] w-[0.7vh] -translate-x-1/2 -translate-y-[0.4vh] rotate-45 border-b border-r border-white/15 bg-neutral-900" />
            </span>
        </span>
    );
}
