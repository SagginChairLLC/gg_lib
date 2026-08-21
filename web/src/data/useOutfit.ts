import { create } from 'zustand';

/**
 * The clothing editor, opened from a setting and handed back when it closes.
 *
 * It is its own mode rather than a page inside the settings window: the subject
 * is a ped standing in the world, and a window covering that ped is the one
 * thing the editor cannot afford. The setting hands over its value and a way to
 * write it, and gets control back on close.
 */

export type OutfitSlot = { drawable?: number | null; texture?: number };
export type OutfitBody = { components?: Record<string, OutfitSlot>; props?: Record<string, OutfitSlot> };
export type OutfitValue = { male?: OutfitBody; female?: OutfitBody };

type OutfitState = {
    open: boolean;
    value: OutfitValue;
    /** What it looked like on the way in, so backing out can put it back. */
    initial: OutfitValue;
    /** Where edits go. Set by whichever setting opened the editor. */
    commit: ((next: OutfitValue) => void) | null;
    readOnly: boolean;
};

export const useOutfit = create<OutfitState>(() => ({
    open: false,
    value: {},
    initial: {},
    commit: null,
    readOnly: false,
}));

export function openOutfit(value: OutfitValue, commit: (next: OutfitValue) => void, readOnly = false) {
    const safe = value ?? {};

    // Deep enough to survive the nested slot tables being rewritten in place.
    useOutfit.setState({
        open: true,
        value: safe,
        initial: JSON.parse(JSON.stringify(safe)),
        commit,
        readOnly,
    });
}

/** Puts back what was there before the editor opened. */
export function revertOutfit() {
    const { initial, commit } = useOutfit.getState();

    commit?.(initial);

    useOutfit.setState({ open: false, commit: null });
}

/** Edits land in the setting as they are made, so closing is never a decision. */
export function editOutfit(next: OutfitValue) {
    const { commit } = useOutfit.getState();

    useOutfit.setState({ value: next });

    commit?.(next);
}

export function closeOutfit() {
    useOutfit.setState({ open: false, commit: null });
}
