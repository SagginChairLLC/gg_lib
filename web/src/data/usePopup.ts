import { create } from 'zustand';

export type PopupPosition = 'bottom-middle' | 'right-middle' | 'left-middle' | 'top-middle' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';

export type PopupData = {
    enabled: boolean;
    message: string;
    position: PopupPosition;
};

export const usePopup = create<PopupData>(() => ({
    enabled: false,
    message: '',
    position: 'bottom-middle',
}));
