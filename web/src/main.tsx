import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fortawesome/fontawesome-free/css/all.min.css';
import './index.css';
import App from './app';
import { isEnvBrowser } from './lib/fetchNui';
import { buildMockSettingsScripts } from './data/mockSettings';
import { openSettings } from './data/useSettings';
import { restoreDevSurface } from './lib/devSurface';

if (isEnvBrowser()) {
    // Same in-game screenshot the taxi job's dev server uses, so the editor's
    // footprint can be judged against the real game view.
    const root = document.getElementById('root');

    root!.style.backgroundSize = 'cover';
    root!.style.backgroundRepeat = 'no-repeat';
    root!.style.backgroundPosition = 'center';
    root!.style.backgroundImage = 'url(background.jpg)';

    // Editor booted as an admin with edit rights over the mock scripts.
    openSettings(buildMockSettingsScripts(), true, null);
    restoreDevSurface();
}

createRoot(document.getElementById('root')!).render(
    <StrictMode>
        <App />
    </StrictMode>,
);
