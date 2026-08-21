import { create } from 'zustand';

export type SettingType = 'boolean' | 'number' | 'integer' | 'percent' | 'string' | 'enum' | 'color' | 'blipcolor' | 'blipsprite' | 'ped' | 'vehicle' | 'item' | 'coords' | 'time' | 'keybind' | 'object' | 'list' | 'outfit';

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
    /** World-editor hints, carried through so a column can edit as an area or stand in a model. */
    edit_mode?: string;
    preview_model?: string;
    min_gap?: number;
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
    /** Names the column holding a draw weight. The list then shows each row's
     *  real chance, worked out against the total rather than left to the reader. */
    weight_key?: string;
    min?: number;
    max?: number;
    max_length?: number;
    step?: number;
    suffix?: string;
    docs?: string;
    preview_from?: Record<string, string>;
    live?: boolean;
    advanced?: boolean;
    /** The value never leaves the server. Set it here, never read it back. */
    server_only?: boolean;
    /** Server-only entries report whether something is stored, not what. */
    stored?: boolean;
    default: unknown;
    value: unknown;
};

export const ADMINS_PAGE = '__gg_admins__';
export const LOGS_PAGE = '__gg_logs__';
export const BRIDGE_PAGE = '__gg_bridge__';
export const MINIGAMES_PAGE = '__gg_minigames__';
export const WAYPOINTS_PAGE = '__gg_waypoints__';
export const DEV_PAGE = '__gg_dev__';

export const ITEMS_PAGE = '__gg_items__';
export const VEHICLES_PAGE = '__gg_vehicles__';

/**
 * The pages that are not scripts. They live in the same slot as a resource
 * name, so anything deciding whether the current page still exists has to
 * know they will never be found in the script list.
 */
export const TOOL_PAGES: readonly string[] = [
    ADMINS_PAGE,
    LOGS_PAGE,
    BRIDGE_PAGE,
    MINIGAMES_PAGE,
    WAYPOINTS_PAGE,
    DEV_PAGE,
    ITEMS_PAGE,
    VEHICLES_PAGE,
];

export const GENERIC_RESOURCE = 'gg_studio';
export const THEME_PATH = 'theme.primary_color';

export type SettingGroup = {
    id: string;
    label: string;
    icon?: string;
    help?: string;
};

/** Something a script said it needs that the server has not got. */
export type SettingsWarning = {
    kind: 'item' | 'resource';
    name: string;
    /** What the script wanted it for, when the script bothered to say. */
    why?: string;
    optional?: boolean;
};

export type SettingsScript = {
    resource: string;
    label: string;
    icon?: string;
    order?: number;
    revision?: number;
    version?: string;
    generic?: boolean;
    /** Whether the viewer's role lets them change this particular script. */
    can_edit?: boolean;
    groups: SettingGroup[];
    entries: SettingEntry[];
    /** Absent when nothing is missing, rather than an empty list. */
    warnings?: SettingsWarning[];
};

export type DraftValue = { kind: 'set'; value: unknown } | { kind: 'reset' };

type SettingsState = {
    scripts: SettingsScript[];
    canEdit: boolean;
    canManage: boolean;
    role: string | null;
    roleLabel: string | null;
    /** null when the host never reported them, which is not the same as none. */
    tools: string[] | null;
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
    canManage: false,
    role: null,
    roleLabel: null,
    tools: null,
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

/** Whether a studio tool is available. A host that never reported its tool list
 *  is an older gg_lib, and predates the restriction rather than imposing it. */
export function canUseTool(id: string): boolean {
    const tools = useSettings.getState().tools;

    return tools === null || tools.includes(id);
}

/** Whether the viewer may change this script, not just settings in general. */
export function canEditScript(resource: string): boolean {
    const state = useSettings.getState();

    if (!state.canEdit) return false;

    const script = state.scripts.find((candidate) => candidate.resource === resource);

    // An older host that never sent the flag means everyone who can edit, can.
    return script?.can_edit !== false;
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

export type AccessPayload = { CAN_MANAGE?: boolean; ROLE?: string; ROLE_LABEL?: string; TOOLS?: string[] };

export function openSettings(scripts: SettingsScript[], canEdit: boolean, focus?: string | null, access?: AccessPayload) {
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
        canManage: access?.CAN_MANAGE === true,
        role: access?.ROLE ?? null,
        roleLabel: access?.ROLE_LABEL ?? null,
        tools: access?.TOOLS ?? null,
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

/** The page to stay on after a refresh, or null when it is really gone. */
function keepPage(current: string | null, scripts: SettingsScript[]): string | null {
    if (!current) return null;
    if (TOOL_PAGES.includes(current)) return current;

    return scripts.some((script) => script.resource === current) ? current : null;
}

export function applyScripts(scripts: SettingsScript[], canEdit?: boolean, access?: AccessPayload) {
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
            canManage: access?.CAN_MANAGE ?? state.canManage,
            role: access?.ROLE ?? state.role,
            roleLabel: access?.ROLE_LABEL ?? state.roleLabel,
            tools: access?.TOOLS ?? state.tools,
            // A tool page is never in the script list, so it has to be kept
            // by name. Dropping it here is what sent someone back to the
            // start every time they saved.
            activeResource: keepPage(state.activeResource, sorted),
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

                    // A server-only entry holds no value here and must not
                    // start holding one. Only whether something is stored
                    // changes, and an empty write is what clears it.
                    if (entry.server_only) {
                        const cleared = edit.kind === 'reset' || edit.value === '' || edit.value == null;

                        return { ...entry, stored: !cleared };
                    }

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
