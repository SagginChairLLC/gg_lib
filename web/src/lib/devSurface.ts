import { hideEditor, showEditor } from '@/data/useLang';
import { usePopup } from '@/data/usePopup';

const STORAGE_KEY = 'gg_lib_dev_surface';

const DEFAULT_SURFACE = 'editor';

export type DevSurfaceId = string;

export function readDevSurface(): DevSurfaceId {
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
        usePopup.setState({ enabled: true, message: 'Drive to the marked pickup and press E to start.', position: 'bottom-middle' });
        return;
    }

    hideEditor();
    usePopup.setState({ enabled: false });
}

export function restoreDevSurface() {
    applyDevSurface(readDevSurface());
}
