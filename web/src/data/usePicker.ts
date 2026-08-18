import { create } from 'zustand';

/**
 * The side picker's state. One drawer serves every large-dataset field — peds,
 * blip icons, blip colors, long enums — because they are all the same problem:
 * hundreds of options that cannot be judged from a name alone.
 *
 * A dropdown could not do this. It is bounded by the width of the value column
 * it hangs off, which is where the grid ran out of room, and it has nowhere to
 * put a search box, a custom entry and a legible preview at once.
 */

export type PickerItem = {
    id: string | number;
    label: string;
    /** Second line — a category, a model name, a raw id. */
    sublabel?: string;
    image?: string;
    /** Tried when `image` fails; blip sprites are png for some ids and gif for others. */
    imageAlt?: string;
    /** Flat color tile instead of an image. */
    swatch?: string;
};

type PickerState = {
    open: boolean;
    title: string;
    items: PickerItem[];
    value: string | number | null;
    /** Whether a value outside the list can be typed — addon peds, unlisted ids. */
    allowCustom: boolean;
    customHint: string;
    /**
     * Tiles per row. Set per field rather than fixed, because the previews are
     * not the same shape: a ped is a tall portrait that needs room to be
     * recognised, a blip is a small square icon that only looks blurry blown up.
     */
    columns: number;
    onSelect: ((value: string | number) => void) | null;
};

export const usePicker = create<PickerState>(() => ({
    open: false,
    title: '',
    items: [],
    value: null,
    allowCustom: false,
    customHint: '',
    columns: 5,
    onSelect: null,
}));

export function openPicker(options: Omit<PickerState, 'open'>) {
    usePicker.setState({ ...options, open: true });
}

export function closePicker() {
    // Only `open` changes. Clearing items here would empty the grid on the
    // first frame of the close, so the panel would animate out showing "no
    // results" instead of what was in it. openPicker replaces them anyway.
    usePicker.setState({ open: false });
}
