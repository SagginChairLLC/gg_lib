import { create } from 'zustand';

export type ToolKey = { key: string; label: string };

export type ToolInfo = { label: string; value: string };

type ToolState = {
    active: boolean;
    title: string;
    mode: string;
    keys: ToolKey[];
    info: ToolInfo[];
};

export const useTool = create<ToolState>(() => ({
    active: false,
    title: '',
    mode: '',
    keys: [],
    info: [],
}));

type ToolPayload = {
    ACTIVE?: boolean;
    TITLE?: string;
    MODE?: string;
    KEYS?: ToolKey[];
    INFO?: ToolInfo[];
};

export function applyToolState(data: ToolPayload) {
    if (data.ACTIVE === false) {
        useTool.setState({ active: false, keys: [], info: [], mode: '' });
        return;
    }

    useTool.setState((state) => ({
        active: true,
        title: data.TITLE ?? state.title,
        mode: data.MODE ?? state.mode,
        keys: data.KEYS ?? state.keys,
        info: data.INFO ?? state.info,
    }));
}
