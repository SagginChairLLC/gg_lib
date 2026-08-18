import { create } from 'zustand';
import { fetchNui, isEnvBrowser } from '@/lib/fetchNui';

/**
 * The minigame engine's state. One game runs at a time; Lua starts it with a
 * merged config and waits on the result, so finishing MUST always answer — a
 * silent close would strand the caller's promise.
 */

export type MinigameName = 'skillcheck' | 'keymash' | 'timing' | 'sequence' | 'memory' | 'wordwiz' | 'connect';

export type MinigameConfig = {
    /** Rounds to clear in one session, where the game supports it. */
    rounds?: number;
    /** Degrees or track-percent the target zone spans. */
    zone?: number;
    /** Sweep speed — degrees/s for the circle, track-lengths/s for the bar. */
    speed?: number;
    /** Keys a round may ask for. Single-key games use the first. */
    keys?: string[];
    /** Seconds the whole attempt may take, for the timed games. */
    time?: number;
    /** keymash: percent lost per second while not pressing. */
    decay?: number;
    /** keymash: percent gained per press. */
    gain?: number;
    /** sequence/wordwiz: how many keys or letters. */
    length?: number;
    /** memory: grid is size x size. */
    size?: number;
    /** memory: tiles to memorise. */
    flashes?: number;
    /** connect: how many circuit pairs. */
    pairs?: number;
};

type MinigameState = {
    active: MinigameName | null;
    config: MinigameConfig;
    /** Bumps every start so a replayed game remounts from scratch. */
    session: number;
};

export const useMinigames = create<MinigameState>(() => ({
    active: null,
    config: {},
    session: 0,
}));

export function startMinigame(name: MinigameName, config: MinigameConfig = {}) {
    useMinigames.setState((state) => ({ active: name, config, session: state.session + 1 }));
}

/** Every exit funnels through here, so Lua always gets its answer. */
export function finishMinigame(success: boolean) {
    if (!useMinigames.getState().active) return;

    useMinigames.setState({ active: null });

    if (!isEnvBrowser()) void fetchNui('minigame_finish', { success });
}

//--------------------------------------------------
// MARK: Registry
//--------------------------------------------------
// What the studio page lists. Descriptions face the server owner deciding which
// game fits an action, so they say what the player experiences.

export type MinigameCategory = 'skillcheck' | 'minigame';

export type MinigameMeta = {
    name: MinigameName;
    label: string;
    icon: string;
    /** Reflex skill checks sit small at the bottom; minigames take the center. */
    category: MinigameCategory;
    description: string;
    /** Path of the object setting holding this game's defaults. */
    setting: string;
    /** Reasonable browser-preview config, mirroring the Lua defaults. */
    preview: MinigameConfig;
};

export const MINIGAMES: MinigameMeta[] = [
    {
        name: 'skillcheck',
        label: 'Skill Check',
        icon: 'fa-bullseye',
        category: 'skillcheck',
        description: 'A needle sweeps a circle — press the key while it crosses the marked arc. Misses and wrong keys fail.',
        setting: 'minigames.skillcheck',
        preview: { rounds: 3, zone: 40, speed: 220, keys: ['E'] },
    },
    {
        name: 'keymash',
        label: 'Key Mash',
        icon: 'fa-hand-back-fist',
        category: 'skillcheck',
        description: 'Mash the key to fill the bar before time runs out. The bar drains the moment you slow down.',
        setting: 'minigames.keymash',
        preview: { time: 6, decay: 22, gain: 7, keys: ['E'] },
    },
    {
        name: 'timing',
        label: 'Timing Bar',
        icon: 'fa-arrows-left-right',
        category: 'skillcheck',
        description: 'A marker bounces along a bar — stop it inside the zone. Each round the zone moves and shrinks.',
        setting: 'minigames.timing',
        preview: { rounds: 3, zone: 16, speed: 0.9, keys: ['E'] },
    },
    {
        name: 'sequence',
        label: 'Key Sequence',
        icon: 'fa-keyboard',
        category: 'skillcheck',
        description: 'A row of keys appears — type them in order before the timer empties. One wrong key fails.',
        setting: 'minigames.sequence',
        preview: { length: 6, time: 5 },
    },
    {
        name: 'memory',
        label: 'Memory Grid',
        icon: 'fa-table-cells',
        category: 'minigame',
        description: 'Tiles flash, then go dark — click every tile that lit up. A wrong tile fails.',
        setting: 'minigames.memory',
        preview: { size: 4, flashes: 5, time: 8 },
    },
    {
        name: 'wordwiz',
        label: 'Word Scramble',
        icon: 'fa-font',
        category: 'minigame',
        description: 'Unscramble the word and type it before the timer empties.',
        setting: 'minigames.wordwiz',
        preview: { length: 6, time: 10 },
    },
    {
        name: 'connect',
        label: 'Connect Circuits',
        icon: 'fa-diagram-project',
        category: 'minigame',
        description: 'Drag a wire between every pair of matching dots. Wires cannot cross, and the clock keeps running.',
        setting: 'minigames.connect',
        preview: { pairs: 4, time: 45 },
    },
];

export const MINIGAME_BY_NAME = new Map(MINIGAMES.map((game) => [game.name, game]));
