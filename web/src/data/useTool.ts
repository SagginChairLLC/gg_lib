import { create } from 'zustand';

/**
 * Keybind legend for gg.tool. Any modal in-game tool pushes its title and key
 * list here and the HUD renders it, so no tool draws its own on-screen text.
 */

export type ToolKey = { key: string; label: string };

/** Live readout rows — position, heading, mode. Pushed only when they change. */
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

    // Info arrives on its own far more often than the key list does, so a
    // payload without KEYS is a readout update and must not blank the legend.
    useTool.setState((state) => ({
        active: true,
        title: data.TITLE ?? state.title,
        mode: data.MODE ?? state.mode,
        keys: data.KEYS ?? state.keys,
        info: data.INFO ?? state.info,
    }));
}
