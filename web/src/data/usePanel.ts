import { create } from 'zustand';

/**
 * The job popup: one shape, filled in by whichever job script is running.
 *
 * This is the whole contract. A job script owns `job`, `title`, `description`,
 * `steps` and `hints` and changes them as the run goes; everything else is
 * placement, and is normally left to the server's settings. There is no second
 * popup for a job with nothing in progress -- that is this one with no steps
 * and different keys offered.
 *
 *   gg.panel.show({
 *       job         = { icon = "fa-taxi", label = "Taxi" },
 *       title       = "Drive to the drop-off",
 *       description = "Marcus wants the airport terminal.",
 *       steps       = { { label = "Collect the passenger", done = true }, ... },
 *       hints       = { { key = "E", label = "Return vehicle" }, ... },
 *   })
 */

/**
 * Whose popup this is. Drawn on the cap and in the header both, so a job reads
 * the same in either place rather than being named twice, differently.
 */
export type PanelJob = {
    /** A Font Awesome name, without the style prefix: "fa-taxi". */
    icon: string;
    label: string;
};

/**
 * What a finished run paid out, revealed once and then gone.
 *
 * The bar walks from where it was to where it ended up, crossing however many
 * level boundaries it needs to on the way, which is why both ends are given as
 * a fraction of their own level rather than as raw experience.
 */
export type PanelReward = {
    /** What finished. "Fare complete", "Delivery complete". */
    label: string;
    money: number;
    xp: number;
    levelFrom: number;
    levelTo: number;
    /** Where the bar starts, 0..1 through levelFrom. */
    fillFrom: number;
    /** Where it lands, 0..1 through levelTo. */
    fillTo: number;
    /** Experience into the new level, and what the next one costs. */
    xpInto: number;
    xpNeeded: number;
    /** How long the whole reveal lasts before the panel goes back to normal. */
    durationMs: number;
};

/** One key and what pressing it does. */
export type PanelHint = {
    key: string;
    label: string;
};

/** One step of a run. The first one not done is the one in progress. */
export type PanelStep = {
    label: string;
    done: boolean;
};

export type PanelData = {
    enabled: boolean;
    /** Whether the panel is out. The cap shows either way. */
    open: boolean;

    //-- Placement. The server's settings, not the script's business.
    side: 'left' | 'right';
    /** How far down that edge it sits, as a percentage of screen height. */
    height: number;

    //-- Identity.
    job: PanelJob;
    /** The key that opens and closes it. Drawn on the cap. */
    toggleKey: string;

    //-- What is going on.
    /** Things waiting, drawn on the cap. Zero draws nothing. */
    badge: number;
    /** Unix seconds to count down to. Null for no clock. */
    endTime: number | null;
    /** What to do now. Falls back to the step in progress when left empty. */
    title: string;
    description: string;
    steps: PanelStep[];
    hints: PanelHint[];

    /** Set to reveal a payout over the body. Clears itself when it is done. */
    reward: PanelReward | null;

    /** The job's accent colour. Empty means gg_lib's own. */
    accent: string;
};

export const usePanel = create<PanelData>(() => ({
    enabled: false,
    open: false,
    side: 'right',
    height: 50,
    job: { icon: 'fa-briefcase', label: '' },
    toggleKey: 'G',
    badge: 0,
    endTime: null,
    title: '',
    description: '',
    steps: [],
    hints: [],
    reward: null,
    accent: '',
}));

export function togglePanel() {
    usePanel.setState((state) => ({ open: !state.open }));
}
