import { hideEditor, showEditor } from '@/data/useLang';
import { usePopup } from '@/data/usePopup';

/**
 * Browser-only surface switching for the vite dev server. The NUI build never
 * touches any of this — Lua drives visibility through app.tsx's nui events.
 */

const STORAGE_KEY = 'gg_lib_dev_surface';

/** Surface we are actively iterating on, used when nothing has been stored yet. */
const DEFAULT_SURFACE = 'editor';

/** A surface id, or 'none' to hide every surface. */
export type DevSurfaceId = string;

export function readDevSurface(): DevSurfaceId {
    // A URL hash deep-links a surface (http://localhost:5180/#popup), beating
    // the stored selection — handy for screenshots and sharing exact states.
    const fromHash = window.location.hash.slice(1);
    if (fromHash) return fromHash;

    try {
        return window.localStorage.getItem(STORAGE_KEY) || DEFAULT_SURFACE;
    } catch {
        return DEFAULT_SURFACE;
    }
}

export function writeDevSurface(id: DevSurfaceId) {
    try {
        window.localStorage.setItem(STORAGE_KEY, id);
    } catch {
        // Storage blocked (private mode). Selection just won't survive a refresh.
    }
}

export function applyDevSurface(id: DevSurfaceId) {
    if (id === 'editor') {
        usePopup.setState({ enabled: false });
        showEditor();
        return;
    }

    if (id === 'popup') {
        hideEditor();
        // Seed a message so the popup renders something instead of a blank card.
        usePopup.setState({ enabled: true, message: 'Drive to the marked pickup and press E to start.', position: 'bottom-middle' });
        return;
    }

    hideEditor();
    usePopup.setState({ enabled: false });
}

export function restoreDevSurface() {
    applyDevSurface(readDevSurface());
}
