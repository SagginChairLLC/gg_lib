import { create } from 'zustand';
import { fetchNui, isEnvBrowser } from '@/lib/fetchNui';

export type AdminSource = 'config' | 'database';

export type AdminEntry = {
    identifier: string;
    name?: string;
    source: AdminSource;
    granted_by?: string;
    granted_at?: string;
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
};

type AdminsState = {
    admins: AdminEntry[];
    players: OnlinePlayer[];
    loaded: boolean;
    busy: boolean;
    error: string | null;
};

export const useAdmins = create<AdminsState>(() => ({
    admins: [],
    players: [],
    loaded: false,
    busy: false,
    error: null,
}));

const mockAdmins: AdminEntry[] = [
    { identifier: 'license2:6e713bc45df69b1338e94c292948ef0053ffb638', name: 'Sag', source: 'config' },
    { identifier: 'license2:9f22c1aa77be40218c5d3e0b6a41d7cc90e3b155', name: 'Marlow', source: 'database', granted_by: 'Sag (license2:6e71…)', granted_at: '2026-08-14' },
];

const mockPlayers: OnlinePlayer[] = [
    { id: 1, name: 'Sag', identifier: 'license2:6e713bc45df69b1338e94c292948ef0053ffb638', admin: true },
    { id: 4, name: 'Marlow', identifier: 'license2:9f22c1aa77be40218c5d3e0b6a41d7cc90e3b155', admin: true },
    { id: 7, name: 'Rennick', identifier: 'license2:41ba9e07d3c8215fa6740de19bb3cc8f2201ea77', admin: false },
    { id: 12, name: 'Vale', identifier: 'license2:c07f1a3e88d5462bb190fa27ce4d6b3390aa5512', admin: false },
];

function applyResponse(response: AdminsResponse | undefined): boolean {
    if (!response?.ok) {
        useAdmins.setState({ error: response?.error ?? 'Something went wrong', busy: false });
        return false;
    }

    useAdmins.setState({
        admins: response.ADMINS ?? [],
        players: response.PLAYERS ?? [],
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
        useAdmins.setState({ admins: mockAdmins, players: mockPlayers, loaded: true, busy: false, error: null });
        return;
    }

    applyResponse(await fetchNui<AdminsResponse>('admins_fetch'));
}

export async function grantAdmin(target: { player?: number; identifier?: string }) {
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
            admins: [...state.admins, { identifier: key, name: player?.name, source: 'database', granted_by: 'Sag', granted_at: '2026-08-17' }],
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

export function clearAdminsError() {
    useAdmins.setState({ error: null });
}
