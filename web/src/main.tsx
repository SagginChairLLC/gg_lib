import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fortawesome/fontawesome-free/css/all.min.css';
import './index.css';
import App from './app';
import { isEnvBrowser } from './lib/fetchNui';
import { buildMockSettingsScripts } from './data/mockSettings';
import { openSettings } from './data/useSettings';
import { restoreDevSurface } from './lib/devSurface';
import { registerScreenshotProcessor } from './lib/screenshot';

if (isEnvBrowser()) {
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

createRoot(document.getElementById('root')!).render(
    <StrictMode>
        <App />
    </StrictMode>,
);
