import { create } from 'zustand';

/**
 * State for the shared GG settings editor (/jobsettings). The payload mirrors
 * settings.describe() in base/settings/shared/registry.lua: every started GG
 * script carrying the module reports its schema, and this store holds all of
 * them plus the admin's staged-but-unsaved edits.
 */

export type SettingType = 'boolean' | 'number' | 'integer' | 'percent' | 'string' | 'enum' | 'color' | 'blipcolor' | 'blipsprite' | 'ped' | 'vehicle' | 'coords' | 'time' | 'keybind' | 'object' | 'list';

/** Enums arrive either as bare strings or as { value, label } pairs. */
export type SettingOption = string | { value: string; label: string };

/**
 * One key inside an object/list setting — a slimmed-down SettingEntry.
 *
 * Fields carry the container properties too, because ObjectControl renders each
 * field through the same SettingControl the top level uses. That means a field
 * can itself be an object, a list or a set of coordinates, which is what lets a
 * vehicle row hold its own mods, or a location hold its own pickup points.
 */
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
    /** Absent-is-meaningful: an unset field is stored as missing, not defaulted. */
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
    /** List rows validate against these fields; absent means a list of scalars. */
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
    /** coords only: sibling setting paths whose values drive the world preview. */
    preview_from?: Record<string, string>;
    /** false = read once at boot; the editor badges it as needing a restart. */
    live?: boolean;
    advanced?: boolean;
    default: unknown;
    value: unknown;
};

/**
 * activeResource sentinel for the Admins page. Not a real resource, so it never
 * matches a script and the rail renders the admin pane instead of sections.
 */
export const ADMINS_PAGE = '__gg_admins__';
export const LOGS_PAGE = '__gg_logs__';

/** gg_lib's studio-wide pseudo-resource, and the accent the editor paints in. */
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
    /** Bumped by the store on every saved change — the config's version number. */
    revision?: number;
    /** fxmanifest version of the script build these settings belong to. */
    version?: string;
    /** Studio-wide settings (currency, theming) rather than one script's — listed
     *  in the rail's Generic section instead of under Scripts. */
    generic?: boolean;
    groups: SettingGroup[];
    entries: SettingEntry[];
};

/**
 * A staged edit. 'set' overrides the stored value; 'reset' deletes the stored
 * override so the Lua default comes back. Both only hit the server on Save.
 */
export type DraftValue = { kind: 'set'; value: unknown } | { kind: 'reset' };

type SettingsState = {
    scripts: SettingsScript[];
    canEdit: boolean;
    /** null renders the script picker; a resource name renders that script's editor. */
    activeResource: string | null;
    search: string;
    showAdvanced: boolean;
    /** resource -> path -> staged edit. Cleared per resource on save/discard. */
    draft: Record<string, Record<string, DraftValue>>;
    /** path -> validation message from the last failed save of the active script. */
    errors: Record<string, string>;
    saving: boolean;
    /** Path to scroll into view once the editor mounts (deep link from search). */
    focusPath: string | null;
};

export const useSettings = create<SettingsState>(() => ({
    scripts: [],
    canEdit: false,
    activeResource: null,
    search: '',
    // A live settings editor should surface every option — advanced entries are
    // visible by default and the toggle filters them away instead.
    showAdvanced: true,
    draft: {},
    errors: {},
    saving: false,
    focusPath: null,
}));

/**
 * Key-order-independent stringify, so a Lua table that serialised its keys in a
 * different order still compares equal to the same object built in JS.
 */
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

/** The value the control should render: the staged edit if any, else the live value. */
export function effectiveValue(resource: string, entry: SettingEntry): unknown {
    const staged = useSettings.getState().draft[resource]?.[entry.path];

    if (!staged) return entry.value;

    return staged.kind === 'reset' ? entry.default : staged.value;
}

/** Modified = the value an admin would see differs from the shipped Lua default. */
export function isModified(resource: string, entry: SettingEntry): boolean {
    return !settingsEqual(effectiveValue(resource, entry), entry.default);
}

export function isStaged(resource: string, path: string): boolean {
    return useSettings.getState().draft[resource]?.[path] !== undefined;
}

/** Which script the admin had open last time — /jobsettings reopens it. */
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
        // Storage blocked; the editor just opens on the first script next time.
    }
}

export function openSettings(scripts: SettingsScript[], canEdit: boolean, focus?: string | null) {
    const sorted = [...scripts].sort((a, b) => {
        const orderA = a.order ?? 100;
        const orderB = b.order ?? 100;
        if (orderA !== orderB) return orderA - orderB;
        return a.label.localeCompare(b.label);
    });

    // An explicit focus (the per-script alias command, /taxisettings) wins;
    // otherwise land on whichever script the admin was in last, then first.
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

/**
 * Stage one edit. Writing the current live value back removes the stage, so
 * toggling something away and back leaves nothing to save.
 */
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

/** Stage a return to the Lua default (a DELETE of the stored override on save). */
export function stageReset(resource: string, path: string) {
    useSettings.setState((state) => {
        const script = state.scripts.find((entry) => entry.resource === resource);
        const entry = script?.entries.find((candidate) => candidate.path === path);
        const forResource = { ...(state.draft[resource] ?? {}) };

        // Already running on the default: nothing stored, nothing to reset.
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

/** Refresh payload landed: swap in fresh schemas, drop drafts that saved clean. */
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

/**
 * Browser-dev stand-in for the save round-trip: fold the staged draft into the
 * live values the way the server broadcast would, then drop the draft. The NUI
 * build never calls this — in game the refreshed schema comes from Lua.
 */
export function applyDraftLocally(resource: string) {
    useSettings.setState((state) => {
        const staged = state.draft[resource] ?? {};

        const scripts = state.scripts.map((script) => {
            if (script.resource !== resource) return script;

            return {
                ...script,
                // Mirror the server store: any accepted change bumps the config revision.
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
