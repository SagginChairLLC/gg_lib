import { usePanel, type PanelData } from '@/data/usePanel';

/**
 * Every state a job script can put the popup in.
 *
 * These are the demo's contents, but they double as the worked examples for
 * what a job script actually sends: each one is a whole payload, not a diff.
 */

const TAXI = { icon: 'fa-taxi', label: 'Taxi' };

const KEYS = [
    { key: 'J', label: 'Open taxi calls' },
    { key: 'E', label: 'Return vehicle' },
    { key: 'G', label: 'Hide this panel' },
];

export type PanelVariant = {
    id: string;
    label: string;
    note: string;
    data: Partial<PanelData>;
};

export const PANEL_VARIANTS: PanelVariant[] = [
    {
        id: 'fare',
        label: 'Fare in progress',
        note: 'Clock running, halfway through the steps',
        data: {
            open: true,
            job: TAXI,
            badge: 0,
            endTime: Math.floor(Date.now() / 1000) + 272,
            title: 'Drive to the drop-off',
            description: 'Marcus wants the airport terminal, and he is already late.',
            steps: [
                { label: 'Drive to the pickup', done: true },
                { label: 'Collect the passenger', done: true },
                { label: 'Drive to the drop-off', done: false },
                { label: 'Take the fare', done: false },
            ],
            hints: KEYS,
            reward: null,
        },
    },
    {
        id: 'drive',
        label: 'Heading to pickup',
        note: 'No clock, and no title -- the step supplies it',
        data: {
            open: true,
            job: TAXI,
            badge: 0,
            endTime: null,
            title: '',
            description: 'Your rider is waiting at the marked spot on Vinewood Boulevard.',
            steps: [
                { label: 'Accept the call', done: true },
                { label: 'Drive to the pickup', done: false },
                { label: 'Collect the passenger', done: false },
                { label: 'Drive to the drop-off', done: false },
            ],
            hints: KEYS,
            reward: null,
        },
    },
    {
        id: 'paid',
        label: 'Fare complete  (payout)',
        note: 'Counts up, fills the bar, then falls back to the state below',
        data: {
            open: true,
            job: TAXI,
            badge: 0,
            endTime: null,
            title: 'Waiting for a call',
            description: 'Nothing booked right now. Take another run, or clock off at the depot.',
            steps: [],
            hints: KEYS,
            reward: {
                label: 'Fare complete',
                money: 340,
                xp: 85,
                levelFrom: 11,
                levelTo: 11,
                fillFrom: 0.34,
                fillTo: 0.72,
                xpInto: 1080,
                xpNeeded: 1500,
                durationMs: 5000,
            },
        },
    },
    {
        id: 'levelup',
        label: 'Payout  (level up)',
        note: 'Bar runs out, wraps, and the level ticks over',
        data: {
            open: true,
            job: TAXI,
            badge: 0,
            endTime: null,
            title: 'Waiting for a call',
            description: 'Nothing booked right now. Take another run, or clock off at the depot.',
            steps: [],
            hints: KEYS,
            reward: {
                label: 'Fare complete',
                money: 910,
                xp: 640,
                levelFrom: 11,
                levelTo: 12,
                fillFrom: 0.78,
                fillTo: 0.41,
                xpInto: 615,
                xpNeeded: 1500,
                durationMs: 5000,
            },
        },
    },
    {
        id: 'depot',
        label: 'In the depot',
        note: 'Nothing running, so the keys are the whole point',
        data: {
            open: true,
            job: TAXI,
            badge: 0,
            endTime: null,
            title: 'Waiting for a call',
            description: 'Nothing booked right now. Take another run, or clock off at the depot.',
            steps: [],
            hints: KEYS,
            reward: null,
        },
    },
    {
        id: 'closed',
        label: 'Hidden  (cap only)',
        note: 'All a player sees until they press G',
        data: {
            open: false,
            job: TAXI,
            badge: 2,
            endTime: null,
            title: 'Two calls waiting',
            description: 'Nearest is on Vinewood Boulevard, about four blocks out.',
            steps: [],
            hints: KEYS,
            reward: null,
        },
    },
];

export function applyPanelVariant(id: string) {
    const variant = PANEL_VARIANTS.find((entry) => entry.id === id);

    if (!variant) return;

    // Cleared first, so clicking a payout twice replays it rather than being
    // ignored as an unchanged value.
    usePanel.setState({ reward: null });

    usePanel.setState({ enabled: true, toggleKey: 'G', accent: '', ...variant.data });
}
