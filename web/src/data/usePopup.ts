import { create } from 'zustand';

export type PopupPosition = 'bottom-middle' | 'right-middle' | 'left-middle' | 'top-middle' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';

/** What kind of thing the popup is saying. Drives the icon and the accent,
 *  not the layout -- one frame so a script switching between them does not
 *  make the HUD jump. */
export type PopupVariant = 'info' | 'keybind' | 'warn';

export type PopupData = {
    enabled: boolean;
    message: string;
    position: PopupPosition;
    variant: PopupVariant;
    /** Drawn as a key cap on the keybind variant; ignored by the others. */
    keybind: string;
};

export const usePopup = create<PopupData>(() => ({
    enabled: false,
    message: '',
    position: 'bottom-middle',
    variant: 'info',
    keybind: '',
}));
