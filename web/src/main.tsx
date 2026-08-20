import { StrictMode, type ReactElement } from 'react';
import { createRoot } from 'react-dom/client';
import '@fortawesome/fontawesome-free/css/all.min.css';
import './index.css';
import App from './app';
import WAYPOINT_DUI from './surfaces/waypoint/WAYPOINT_DUI';
import { isEnvBrowser } from './lib/fetchNui';
import { buildMockSettingsScripts } from './data/mockSettings';
import { openSettings } from './data/useSettings';
import { restoreDevSurface } from './lib/devSurface';
import { registerScreenshotProcessor } from './lib/screenshot';

if (isEnvBrowser() && !window.location.search.includes('dui=')) {
    const root = document.getElementById('root');

    root!.style.backgroundSize = 'cover';
    root!.style.backgroundRepeat = 'no-repeat';
    root!.style.backgroundPosition = 'center';
    root!.style.backgroundImage = 'url(background.jpg)';

    // The browser preview stands in for an owner, so every tool is on and the
    // access controls are all reachable.
    openSettings(buildMockSettingsScripts(), true, null, {
        CAN_MANAGE: true,
        ROLE: 'god',
        ROLE_LABEL: 'Owner',
        TOOLS: ['logs', 'bridges', 'minigames', 'items', 'vehicles'],
    });
    restoreDevSurface();
}

// Chromium fires this when a ResizeObserver cannot deliver every notification
// inside one frame. It is a benign scheduling note from the animation
// libraries' internal observers, not a fault — but CEF prints it as an error
// on every editor open, so it is silenced by exact message.
window.addEventListener('error', (event) => {
    if (typeof event.message === 'string' && event.message.includes('ResizeObserver loop')) {
        event.stopImmediatePropagation();
        event.preventDefault();
    }
});

registerScreenshotProcessor();

// A DUI is its own page in its own browser, drawn into a world texture rather
// than onto the screen. It shares this bundle but none of the editor: no
// stores, no listeners, no background -- nothing that would cost a frame in a
// surface that renders continuously out in the world.
const dui = new URLSearchParams(window.location.search).get('dui');

const DUI_SURFACES: Record<string, () => ReactElement> = {
    waypoint: WAYPOINT_DUI,
};

const Surface = (dui && DUI_SURFACES[dui]) || App;

createRoot(document.getElementById('root')!).render(
    <StrictMode>
        <Surface />
    </StrictMode>,
);
