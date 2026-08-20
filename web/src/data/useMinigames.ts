import { create } from 'zustand';
import { fetchNui, isEnvBrowser } from '@/lib/fetchNui';

/**
 * The minigame engine's state. One game runs at a time; Lua starts it with a
 * merged config and waits on the result, so finishing MUST always answer — a
 * silent close would strand the caller's promise.
 */

export type MinigameName =
    | 'skillcheck'
    | 'keymash'
    | 'timing'
    | 'sequence'
    | 'hold'
    | 'reflex'
    | 'memory'
    | 'wordwiz'
    | 'connect'
    | 'breach'
    | 'lockpick'
    | 'codecrack';

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
    /** sequence/wordwiz/codecrack: how many keys, letters or digits. */
    length?: number;
    /** memory/breach: grid is size x size. */
    size?: number;
    /** memory: tiles to memorise. */
    flashes?: number;
    /** connect: how many circuit pairs. */
    pairs?: number;
    /** reflex: seconds allowed per key. */
    window?: number;
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
    /** Reasonable browser-preview config, mirroring the Lua defaults. */
    preview: MinigameConfig;
};

export const MINIGAMES: MinigameMeta[] = [
    {
        name: 'skillcheck',
        label: 'Needle Drop',
        icon: 'fa-bullseye',
        category: 'skillcheck',
        description: 'A needle sweeps a circle — press the key while it crosses the marked arc. Misses and wrong keys fail.',
        preview: { rounds: 3, zone: 40, speed: 220, keys: ['E'] },
    },
    {
        name: 'keymash',
        label: 'Key Mash',
        icon: 'fa-hand-back-fist',
        category: 'skillcheck',
        description: 'Mash the key to fill the bar before time runs out. The bar drains the moment you slow down.',
        preview: { time: 6, decay: 22, gain: 7, keys: ['E'] },
    },
    {
        name: 'timing',
        label: 'Timing Bar',
        icon: 'fa-arrows-left-right',
        category: 'skillcheck',
        description: 'A marker bounces along a bar — stop it inside the zone. Each round the zone moves and shrinks.',
        preview: { rounds: 3, zone: 16, speed: 0.9, keys: ['E'] },
    },
    {
        name: 'sequence',
        label: 'Key Sequence',
        icon: 'fa-keyboard',
        category: 'skillcheck',
        description: 'A row of keys appears — type them in order before the timer empties. One wrong key fails.',
        preview: { length: 6, time: 5 },
    },
    {
        name: 'hold',
        label: 'Hold Steady',
        icon: 'fa-gauge-high',
        category: 'skillcheck',
        description: 'Hold the key to raise the pressure and let go inside the band. Overshooting the top fails.',
        preview: { rounds: 3, zone: 18, speed: 55, time: 8 },
    },
    {
        name: 'reflex',
        label: 'Reflex Rush',
        icon: 'fa-bolt',
        category: 'skillcheck',
        description: 'A key appears somewhere new with a ring closing on it — hit each one before the ring lands.',
        preview: { rounds: 4, window: 1.3 },
    },
    {
        name: 'memory',
        label: 'Memory Grid',
        icon: 'fa-table-cells',
        category: 'minigame',
        description: 'Tiles flash, then go dark — click every tile that lit up. A wrong tile fails.',
        preview: { size: 4, flashes: 5, time: 8 },
    },
    {
        name: 'wordwiz',
        label: 'Word Scramble',
        icon: 'fa-font',
        category: 'minigame',
        description: 'Unscramble the word and type it before the timer empties.',
        preview: { length: 6, time: 10 },
    },
    {
        name: 'connect',
        label: 'Connect Circuits',
        icon: 'fa-diagram-project',
        category: 'minigame',
        description: 'Drag a wire between every pair of matching dots. Wires cannot cross, and the clock keeps running.',
        preview: { pairs: 4, time: 45 },
    },
    {
        name: 'breach',
        label: 'Breach Protocol',
        icon: 'fa-terminal',
        category: 'minigame',
        description: 'Pull a code sequence out of a matrix, alternating between rows and columns, before the buffer fills.',
        preview: { size: 5, length: 4, time: 30 },
    },
    {
        name: 'lockpick',
        label: 'Lock Pick',
        icon: 'fa-unlock-keyhole',
        category: 'minigame',
        description: 'Turn the pick with A and D and set each pin where the tension peaks. A pin set wrong snaps it.',
        preview: { rounds: 3, zone: 34, speed: 150, time: 25 },
    },
    {
        name: 'codecrack',
        label: 'Code Cracker',
        icon: 'fa-lock',
        category: 'minigame',
        description: 'Guess the digit code from marked feedback — right digit, right slot, or not in the code at all.',
        preview: { length: 4, rounds: 5, time: 45 },
    },
];

export const MINIGAME_BY_NAME = new Map(MINIGAMES.map((game) => [game.name, game]));
