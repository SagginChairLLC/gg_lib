import { create } from 'zustand';

export type SettingType = 'boolean' | 'number' | 'integer' | 'percent' | 'string' | 'enum' | 'color' | 'blipcolor' | 'blipsprite' | 'ped' | 'vehicle' | 'coords' | 'time' | 'keybind' | 'object' | 'list';

export type SettingOption = string | { value: string; label: string };

export type SettingField = {
    key: string;
    label?: string;
    type?: SettingType;
    min?: number;
    max?: number;
    max_length?: number;
    step?: number;
    suffix?: string;
    options?: SettingOption[];
    nullable?: boolean;
    help?: string;
    fields?: SettingField[];
    item?: SettingField[];
    item_type?: string;
    item_default?: Record<string, unknown>;
    min_items?: number;
    max_items?: number;
};

export type SettingEntry = {
    path: string;
    label: string;
    help?: string;
    type: SettingType;
    group: string;
    options?: SettingOption[];
    fields?: SettingField[];
    item?: SettingField[];
    item_type?: string;
    item_default?: Record<string, unknown>;
    min_items?: number;
    max_items?: number;
    min?: number;
    max?: number;
    max_length?: number;
    step?: number;
    suffix?: string;
    docs?: string;
    preview_from?: Record<string, string>;
    live?: boolean;
    advanced?: boolean;
    default: unknown;
    value: unknown;
};

export const ADMINS_PAGE = '__gg_admins__';
export const LOGS_PAGE = '__gg_logs__';
export const BRIDGE_PAGE = '__gg_bridge__';

export const GENERIC_RESOURCE = 'gg_studio';
export const THEME_PATH = 'theme.primary_color';

export type SettingGroup = {
    id: string;
    label: string;
    icon?: string;
    help?: string;
};

export type SettingsScript = {
    resource: string;
    label: string;
    icon?: string;
    order?: number;
    revision?: number;
    version?: string;
    generic?: boolean;
    groups: SettingGroup[];
    entries: SettingEntry[];
};

export type DraftValue = { kind: 'set'; value: unknown } | { kind: 'reset' };

type SettingsState = {
    scripts: SettingsScript[];
    canEdit: boolean;
    activeResource: string | null;
    search: string;
    showAdvanced: boolean;
    draft: Record<string, Record<string, DraftValue>>;
    errors: Record<string, string>;
    saving: boolean;
    focusPath: string | null;
};

export const useSettings = create<SettingsState>(() => ({
    scripts: [],
    canEdit: false,
    activeResource: null,
    search: '',
    showAdvanced: true,
    draft: {},
    errors: {},
    saving: false,
    focusPath: null,
}));

export function stableStringify(value: unknown): string {
    if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;

    if (value !== null && typeof value === 'object') {
        const entries = Object.entries(value as Record<string, unknown>)
            .filter(([, entryValue]) => entryValue !== undefined)
            .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));

        return `{${entries.map(([key, entryValue]) => `${JSON.stringify(key)}:${stableStringify(entryValue)}`).join(',')}}`;
    }

    return JSON.stringify(value);
}

export function settingsEqual(a: unknown, b: unknown): boolean {
    return stableStringify(a) === stableStringify(b);
}

export function effectiveValue(resource: string, entry: SettingEntry): unknown {
    const staged = useSettings.getState().draft[resource]?.[entry.path];

    if (!staged) return entry.value;

    return staged.kind === 'reset' ? entry.default : staged.value;
}

export function isModified(resource: string, entry: SettingEntry): boolean {
    return !settingsEqual(effectiveValue(resource, entry), entry.default);
}

export function isStaged(resource: string, path: string): boolean {
    return useSettings.getState().draft[resource]?.[path] !== undefined;
}

const LAST_SCRIPT_KEY = 'gg_settings_last_script';

function readLastScript(): string | null {
    try {
        return window.localStorage.getItem(LAST_SCRIPT_KEY);
    } catch {
        return null;
    }
}

function writeLastScript(resource: string) {
    try {
        window.localStorage.setItem(LAST_SCRIPT_KEY, resource);
    } catch {
    }
}

export function openSettings(scripts: SettingsScript[], canEdit: boolean, focus?: string | null) {
    const sorted = [...scripts].sort((a, b) => {
        const orderA = a.order ?? 100;
        const orderB = b.order ?? 100;
        if (orderA !== orderB) return orderA - orderB;
        return a.label.localeCompare(b.label);
    });

    const focusTarget = focus && sorted.some((script) => script.resource === focus) ? focus : null;
    const remembered = readLastScript();
    const rememberedTarget = remembered && sorted.some((script) => script.resource === remembered) ? remembered : null;

    useSettings.setState({
        scripts: sorted,
        canEdit,
        activeResource: focusTarget ?? rememberedTarget ?? sorted[0]?.resource ?? null,
        search: '',
        errors: {},
        saving: false,
        focusPath: null,
    });
}

export function setActiveScript(resource: string | null, focusPath: string | null = null) {
    if (resource) writeLastScript(resource);

    useSettings.setState({ activeResource: resource, search: '', errors: {}, focusPath });
}

export function stageValue(resource: string, path: string, value: unknown) {
    useSettings.setState((state) => {
        const script = state.scripts.find((entry) => entry.resource === resource);
        const entry = script?.entries.find((candidate) => candidate.path === path);
        const forResource = { ...(state.draft[resource] ?? {}) };

        if (entry && settingsEqual(value, entry.value)) {
            delete forResource[path];
        } else {
            forResource[path] = { kind: 'set', value };
        }

        const errors = { ...state.errors };
        delete errors[path];

        return { draft: { ...state.draft, [resource]: forResource }, errors };
    });
}

export function stageReset(resource: string, path: string) {
    useSettings.setState((state) => {
        const script = state.scripts.find((entry) => entry.resource === resource);
        const entry = script?.entries.find((candidate) => candidate.path === path);
        const forResource = { ...(state.draft[resource] ?? {}) };

        if (entry && settingsEqual(entry.value, entry.default)) {
            delete forResource[path];
        } else {
            forResource[path] = { kind: 'reset' };
        }

        const errors = { ...state.errors };
        delete errors[path];

        return { draft: { ...state.draft, [resource]: forResource }, errors };
    });
}

export function unstage(resource: string, path: string) {
    useSettings.setState((state) => {
        const forResource = { ...(state.draft[resource] ?? {}) };
        delete forResource[path];

        return { draft: { ...state.draft, [resource]: forResource } };
    });
}

export function discardDraft(resource: string) {
    useSettings.setState((state) => {
        const draft = { ...state.draft };
        delete draft[resource];

        return { draft, errors: {} };
    });
}

export function draftCount(resource: string): number {
    return Object.keys(useSettings.getState().draft[resource] ?? {}).length;
}

export function applyScripts(scripts: SettingsScript[], canEdit?: boolean) {
    useSettings.setState((state) => {
        const sorted = [...scripts].sort((a, b) => {
            const orderA = a.order ?? 100;
            const orderB = b.order ?? 100;
            if (orderA !== orderB) return orderA - orderB;
            return a.label.localeCompare(b.label);
        });

        return {
            scripts: sorted,
            canEdit: canEdit ?? state.canEdit,
            activeResource: state.activeResource && sorted.some((script) => script.resource === state.activeResource) ? state.activeResource : null,
        };
    });
}

export function applyDraftLocally(resource: string) {
    useSettings.setState((state) => {
        const staged = state.draft[resource] ?? {};

        const scripts = state.scripts.map((script) => {
            if (script.resource !== resource) return script;

            return {
                ...script,
                revision: (script.revision ?? 0) + 1,
                entries: script.entries.map((entry) => {
                    const edit = staged[entry.path];
                    if (!edit) return entry;

                    const value = edit.kind === 'reset' ? JSON.parse(JSON.stringify(entry.default ?? null)) : edit.value;

                    return { ...entry, value };
                }),
            };
        });

        const draft = { ...state.draft };
        delete draft[resource];

        return { scripts, draft, errors: {} };
    });
}

export function closeSettings() {
    useSettings.setState({ activeResource: null, search: '', draft: {}, errors: {}, focusPath: null });
}
