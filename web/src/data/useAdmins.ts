import { create } from 'zustand';
import { fetchNui, isEnvBrowser } from '@/lib/fetchNui';

/**
 * Where someone's access comes from. 'config' is server_config.lua and
 * 'database' is this page; 'server' is a permission the server already
 * granted them elsewhere, which this page can show but not change.
 */
export type AdminSource = 'config' | 'database' | 'server';

export type AdminEntry = {
    identifier: string;
    name?: string;
    source: AdminSource;
    role: string;
    granted_by?: string;
    granted_at?: string;
};

/** What a role may reach. A scope of '*' means everything. */
export type RolePermissions = {
    manage_admins: boolean;
    view: string[] | '*';
    edit: string[] | '*';
    tools: string[] | '*';
};

export type RoleEntry = {
    id: string;
    label: string;
    icon: string;
    help?: string;
    builtin: boolean;
    locked: boolean;
    permissions: RolePermissions;
};

export type OnlinePlayer = {
    id: number;
    name: string;
    identifier: string;
    admin: boolean;
};

type AdminsResponse = {
    ok: boolean;
    error?: string;
    ADMINS?: AdminEntry[];
    PLAYERS?: OnlinePlayer[];
    ROLES?: RoleEntry[];
};

type AdminsState = {
    admins: AdminEntry[];
    players: OnlinePlayer[];
    roles: RoleEntry[];
    loaded: boolean;
    busy: boolean;
    error: string | null;
};

export const useAdmins = create<AdminsState>(() => ({
    admins: [],
    players: [],
    roles: [],
    loaded: false,
    busy: false,
    error: null,
}));

// Covers what the page has to render: locked config entries, granted ones,
// online and offline, and a row the server never learned a name for.
const mockAdmins: AdminEntry[] = [
    { identifier: 'license2:6e713bc45df69b1338e94c292948ef0053ffb638', name: 'Sag', source: 'config', role: 'god' },
    { identifier: 'license2:b41d90ac7752e8f3a0c614db2e8f77aa31c0d904', name: 'Roan', source: 'config', role: 'god' },
    { identifier: 'license2:9f22c1aa77be40218c5d3e0b6a41d7cc90e3b155', name: 'Marlow', source: 'database', role: 'admin', granted_by: 'Sag (license2:6e71…)', granted_at: '2026-08-14' },
    { identifier: 'license2:31ab04c7d9e2f8560b73a1cc4408ef29d7714b62', name: 'Nova', source: 'server', role: 'admin', granted_by: 'group.admin' },
    { identifier: 'license2:2ad8f0e91cb7346dd05e8a1f77b902cc4e16aa38', name: 'Devi', source: 'database', role: 'taxi_only', granted_by: 'Sag (license2:6e71…)', granted_at: '2026-08-09' },
    { identifier: 'license2:77c1e4b0a9df23851ce6b0f4471dd2e6a8390bb1', source: 'database', role: 'moderator', granted_by: 'Marlow (license2:9f22…)', granted_at: '2026-07-28' },
];

const mockRoles: RoleEntry[] = [
    { id: 'god', label: 'Owner', icon: 'fa-crown', help: 'Everything, including who else gets in. Cannot be edited.', builtin: true, locked: true, permissions: { manage_admins: true, view: '*', edit: '*', tools: ['logs', 'bridges', 'minigames'] } },
    { id: 'admin', label: 'Admin', icon: 'fa-user-shield', help: 'Every script and every tool, but cannot change who has access.', builtin: true, locked: false, permissions: { manage_admins: false, view: '*', edit: '*', tools: ['logs', 'bridges', 'minigames'] } },
    { id: 'moderator', label: 'Moderator', icon: 'fa-eye', help: 'Can open the studio and read every setting, but changes nothing.', builtin: true, locked: false, permissions: { manage_admins: false, view: '*', edit: [], tools: ['logs'] } },
    { id: 'taxi_only', label: 'Taxi Team', icon: 'fa-taxi', builtin: false, locked: false, permissions: { manage_admins: false, view: ['gg_taxijob'], edit: ['gg_taxijob'], tools: [] } },
];

const mockPlayers: OnlinePlayer[] = [
    { id: 1, name: 'Sag', identifier: 'license2:6e713bc45df69b1338e94c292948ef0053ffb638', admin: true },
    { id: 4, name: 'Marlow', identifier: 'license2:9f22c1aa77be40218c5d3e0b6a41d7cc90e3b155', admin: true },
    { id: 7, name: 'Rennick', identifier: 'license2:41ba9e07d3c8215fa6740de19bb3cc8f2201ea77', admin: false },
    { id: 12, name: 'Vale', identifier: 'license2:c07f1a3e88d5462bb190fa27ce4d6b3390aa5512', admin: false },
    { id: 18, name: 'Okonkwo', identifier: 'license2:5be2d7013f8a94cc2610ae7bb4f0912dd7431ce6', admin: false },
    { id: 23, name: 'Prudence', identifier: 'license2:e390ba71c4d5f8021ab6e73c9d40f1a8b25c7702', admin: false },
];

function applyResponse(response: AdminsResponse | undefined): boolean {
    if (!response?.ok) {
        useAdmins.setState({ error: response?.error ?? 'Something went wrong', busy: false });
        return false;
    }

    useAdmins.setState({
        admins: response.ADMINS ?? [],
        players: response.PLAYERS ?? [],
        roles: response.ROLES ?? useAdmins.getState().roles,
        loaded: true,
        busy: false,
        error: null,
    });

    return true;
}

export async function fetchAdmins() {
    useAdmins.setState({ busy: true, error: null });

    if (isEnvBrowser()) {
        await new Promise((resolve) => setTimeout(resolve, 250));
        useAdmins.setState({ admins: mockAdmins, players: mockPlayers, roles: mockRoles, loaded: true, busy: false, error: null });
        return;
    }

    applyResponse(await fetchNui<AdminsResponse>('admins_fetch'));
}

export async function grantAdmin(target: { player?: number; identifier?: string; role?: string }) {
    useAdmins.setState({ busy: true, error: null });

    if (isEnvBrowser()) {
        await new Promise((resolve) => setTimeout(resolve, 250));

        const state = useAdmins.getState();
        const player = target.player !== undefined ? state.players.find((candidate) => candidate.id === target.player) : undefined;
        const identifier = (player?.identifier ?? target.identifier ?? '').trim().toLowerCase();

        if (!identifier) {
            useAdmins.setState({ error: 'that is not a valid identifier', busy: false });
            return false;
        }

        const key = identifier.includes(':') ? identifier : `license2:${identifier}`;

        if (state.admins.some((entry) => entry.identifier === key)) {
            useAdmins.setState({ error: 'already an admin', busy: false });
            return false;
        }

        useAdmins.setState({
            admins: [...state.admins, { identifier: key, name: player?.name, source: 'database', role: target.role ?? 'admin', granted_by: 'Sag', granted_at: '2026-08-17' }],
            players: state.players.map((candidate) => (candidate.identifier === key ? { ...candidate, admin: true } : candidate)),
            busy: false,
            error: null,
        });

        return true;
    }

    return applyResponse(await fetchNui<AdminsResponse>('admins_grant', target));
}

export async function revokeAdmin(identifier: string) {
    useAdmins.setState({ busy: true, error: null });

    if (isEnvBrowser()) {
        await new Promise((resolve) => setTimeout(resolve, 250));

        const state = useAdmins.getState();

        useAdmins.setState({
            admins: state.admins.filter((entry) => entry.identifier !== identifier),
            players: state.players.map((candidate) => (candidate.identifier === identifier ? { ...candidate, admin: false } : candidate)),
            busy: false,
            error: null,
        });

        return true;
    }

    return applyResponse(await fetchNui<AdminsResponse>('admins_revoke', { identifier }));
}

export async function setAdminRole(identifier: string, role: string) {
    useAdmins.setState({ busy: true, error: null });

    if (isEnvBrowser()) {
        const state = useAdmins.getState();

        useAdmins.setState({
            admins: state.admins.map((entry) => (entry.identifier === identifier ? { ...entry, role } : entry)),
            busy: false,
        });

        return true;
    }

    return applyResponse(await fetchNui<AdminsResponse>('admins_set_role', { identifier, role }));
}

export async function saveRole(role: { id: string; label: string; icon?: string; permissions: RolePermissions }) {
    useAdmins.setState({ busy: true, error: null });

    if (isEnvBrowser()) {
        const state = useAdmins.getState();
        const id = role.id.toLowerCase().replace(/[^a-z0-9_]/g, '');

        if (!id) {
            useAdmins.setState({ error: 'that is not a usable role name', busy: false });
            return false;
        }

        const next = { ...role, id, icon: role.icon ?? 'fa-user-shield', builtin: false, locked: false };
        const existing = state.roles.findIndex((candidate) => candidate.id === id);

        useAdmins.setState({
            roles: existing >= 0 ? state.roles.map((candidate, index) => (index === existing ? next : candidate)) : [...state.roles, next],
            busy: false,
        });

        return true;
    }

    return applyResponse(await fetchNui<AdminsResponse>('admins_save_role', role));
}

export async function deleteRole(id: string) {
    useAdmins.setState({ busy: true, error: null });

    if (isEnvBrowser()) {
        const state = useAdmins.getState();

        useAdmins.setState({
            roles: state.roles.filter((role) => role.id !== id),
            admins: state.admins.map((entry) => (entry.role === id ? { ...entry, role: 'admin' } : entry)),
            busy: false,
        });

        return true;
    }

    return applyResponse(await fetchNui<AdminsResponse>('admins_delete_role', { id }));
}

export function clearAdminsError() {
    useAdmins.setState({ error: null });
}
