import { create } from 'zustand';

export type PickerItem = {
    id: string | number;
    label: string;
    sublabel?: string;
    image?: string;
    imageAlt?: string;
    swatch?: string;
};

type PickerState = {
    open: boolean;
    title: string;
    items: PickerItem[];
    value: string | number | null;
    allowCustom: boolean;
    customHint: string;
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
    usePicker.setState({ open: false });
}
