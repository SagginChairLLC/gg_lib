import { AnimatePresence, motion } from 'framer-motion';
import { useEffect } from 'react';
import DevSurfaceSwitcher from '@/components/gg/DevSurfaceSwitcher';
import { useNuiEvent } from '@/hooks/useNuiEvent';
import { hideAccess, showAccess, useAccess } from '@/data/useAccess';
import SETTINGS_ACCESS from '@/surfaces/studio/SETTINGS_ACCESS';
import { fetchNui, isEnvBrowser } from '@/lib/fetchNui';
import { applyAppearance, hideEditor, showEditor, useLang } from '@/data/useLang';
import { openSettings, type SettingsScript } from '@/data/useSettings';
import { usePopup, type PopupData } from '@/data/usePopup';
import { applyToolState, useTool } from '@/data/useTool';
import { applyGizmoState } from '@/data/useGizmo';
import SETTINGS_EDITOR from '@/surfaces/studio/SETTINGS_EDITOR';
import POPUP_BASE from '@/surfaces/popup/POPUP_BASE';
import TOOL_HUD from '@/surfaces/tool/TOOL_HUD';
import TOOL_GIZMO from '@/surfaces/tool/TOOL_GIZMO';
import MINIGAME_HOST from '@/surfaces/minigames/MINIGAME_HOST';
import { finishMinigame, startMinigame, useMinigames, type MinigameConfig, type MinigameName } from '@/data/useMinigames';

type SettingsOpenPayload = {
    SCRIPTS?: SettingsScript[];
    CAN_EDIT?: boolean;
    FOCUS?: string | null;
    UI_THEME?: string;
    UI_FADE?: boolean;
    UI_FADE_TO?: number;
    UI_LANG?: Record<string, string>;
};

export default function App() {
    const visible = useLang((state) => state.visible);
    const placing = useLang((state) => state.placing);
    const popupEnabled = usePopup((state) => state.enabled);
    const toolActive = useTool((state) => state.active);
    const accessOpen = useAccess((state) => state.open);

    // A running game owns the screen: the editor steps aside for it and comes
    // back — same page, same spot — the moment the game answers. The stores
    // hold the editor's state, so the remount lands exactly where it left off.
    const gameRunning = useMinigames((state) => state.active !== null);

    useNuiEvent<SettingsOpenPayload>('settings_open', (data) => {
        applyAppearance(data);
        openSettings(data.SCRIPTS ?? [], data.CAN_EDIT === true, data.FOCUS ?? null);
        showEditor(data.UI_LANG);
    });

    useNuiEvent<{ IDENTIFIER?: string; FILE?: string }>('settings_access', (data) => {
        showAccess(data);
        showEditor();
    });

    useNuiEvent<Parameters<typeof applyAppearance>[0]>('settings_theme', applyAppearance);

    useNuiEvent<{ PLACING?: boolean }>('settings_placing', (data) => {
        useLang.setState({ placing: data.PLACING === true });
    });

    useNuiEvent<{ NAME?: MinigameName; CONFIG?: MinigameConfig }>('minigame_start', (data) => {
        if (data.NAME) startMinigame(data.NAME, data.CONFIG ?? {});
    });

    useNuiEvent<Record<string, never>>('minigame_cancel', () => {
        finishMinigame(false);
    });

    useNuiEvent<Parameters<typeof applyToolState>[0]>('gg_tool', applyToolState);

    useNuiEvent<Parameters<typeof applyGizmoState>[0]>('gg_gizmo', applyGizmoState);

    useNuiEvent<Partial<PopupData>>('popup_update', (data) => {
        usePopup.setState(data);
    });

    useEffect(() => {
        const handleKeyPress = (event: KeyboardEvent) => {
            if (event.key !== 'Escape') return;

            // A running game owns the keyboard; its own handler reports the
            // fail and this one must not also close the editor behind it.
            if (useMinigames.getState().active) return;
            if (!useLang.getState().visible) return;

            if (document.body.dataset.captureKey) return;

            if (useLang.getState().placing) {
                event.preventDefault();
                return;
            }

            event.preventDefault();
            hideAccess();
            hideEditor();
            fetchNui('settings_close');
        };

        window.addEventListener('keydown', handleKeyPress, true);
        return () => window.removeEventListener('keydown', handleKeyPress, true);
    }, []);

    return (
        <div className="h-screen w-full overflow-hidden">
            <AnimatePresence mode="wait">
                {visible && !placing && !gameRunning && accessOpen && (
                    <motion.div
                        key="settings_access"
                        initial={{ opacity: 0, scale: 0.97 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.97 }}
                        transition={{ duration: 0.2, ease: 'easeInOut' }}
                        className="absolute inset-0 h-full w-full"
                    >
                        <SETTINGS_ACCESS />
                    </motion.div>
                )}
                {visible && !placing && !gameRunning && !accessOpen && (
                    <motion.div
                        key="settings_editor"
                        initial={{ opacity: 0, scale: 0.97 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.97 }}
                        transition={{ duration: 0.2, ease: 'easeInOut' }}
                        className="absolute inset-0 h-full w-full"
                    >
                        <SETTINGS_EDITOR />
                    </motion.div>
                )}
            </AnimatePresence>
            <AnimatePresence>{popupEnabled && <POPUP_BASE key="popup_base" />}</AnimatePresence>
            <MINIGAME_HOST />
            <TOOL_GIZMO />
            <AnimatePresence>{toolActive && <TOOL_HUD key="tool_hud" />}</AnimatePresence>
            {import.meta.env.DEV && isEnvBrowser() && <DevSurfaceSwitcher />}
        </div>
    );
}
