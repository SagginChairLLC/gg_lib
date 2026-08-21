import { hideEditor, showEditor } from '@/data/useLang';
import { usePopup } from '@/data/usePopup';
import { usePanel } from '@/data/usePanel';
import { applyPanelVariant } from './panelVariants';

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

/**
 * The states a job popup actually goes through, rather than one dressed
 * example. Most of the work in a design like this is in the states that carry
 * almost nothing, so those are the ones worth being able to look at.
 */
export function applyDevSurface(id: DevSurfaceId) {
    if (id === 'editor') {
        usePopup.setState({ enabled: false });
        usePanel.setState({ enabled: false });
        showEditor();
        return;
    }

    if (id === 'panel') {
        hideEditor();
        usePopup.setState({ enabled: false });
        applyPanelVariant('fare');
        return;
    }

    if (id === 'popup') {
        hideEditor();
        usePanel.setState({ enabled: false });
        usePopup.setState({ enabled: true, message: 'Drive to the marked pickup and press E to start.', position: 'bottom-middle' });
        return;
    }

    hideEditor();
    usePopup.setState({ enabled: false });
    usePanel.setState({ enabled: false });
}

export function restoreDevSurface() {
    applyDevSurface(readDevSurface());
}
