import { AnimatePresence, motion } from 'framer-motion';
import { useEffect } from 'react';
import DevSurfaceSwitcher from '@/components/gg/DevSurfaceSwitcher';
import { useNuiEvent } from '@/hooks/useNuiEvent';
import { fetchNui, isEnvBrowser } from '@/lib/fetchNui';
import { applyAppearance, hideEditor, showEditor, useLang } from '@/data/useLang';
import { openSettings, type SettingsScript } from '@/data/useSettings';
import { usePopup, type PopupData } from '@/data/usePopup';
import { applyToolState, useTool } from '@/data/useTool';
import { applyGizmoState } from '@/data/useGizmo';
import SETTINGS_EDITOR from '@/pages/SETTINGS/SETTINGS_EDITOR';
import POPUP_BASE from '@/pages/POPUP_BASE/POPUP_BASE';
import TOOL_HUD from '@/pages/TOOL/TOOL_HUD';
import TOOL_GIZMO from '@/pages/TOOL/TOOL_GIZMO';

/** Pushed by src/client/editor.lua when /jobsettings (or an alias) opens. */
type SettingsOpenPayload = {
    SCRIPTS?: SettingsScript[];
    CAN_EDIT?: boolean;
    /** Resource to deep-link into — set when opened via a script's own alias. */
    FOCUS?: string | null;
    UI_THEME?: string;
    UI_FADE?: boolean;
    UI_FADE_TO?: number;
    UI_LANG?: Record<string, string>;
};

/**
 * Root uses w-full rather than w-screen: w-screen is 100vw, and viewport width
 * is never used anywhere in this UI — every dimension is in vh, because height
 * is the axis that stays constant across the monitors this runs on. The body
 * already spans the frame, so full width of the parent is the same box without
 * bringing the unit in.
 */
export default function App() {
    const visible = useLang((state) => state.visible);
    const placing = useLang((state) => state.placing);
    const popupEnabled = usePopup((state) => state.enabled);
    const toolActive = useTool((state) => state.active);

    useNuiEvent<SettingsOpenPayload>('settings_open', (data) => {
        applyAppearance(data);
        openSettings(data.SCRIPTS ?? [], data.CAN_EDIT === true, data.FOCUS ?? null);
        showEditor(data.UI_LANG);
    });

    // Studio accent changed while the editor is open — by this admin or another.
    useNuiEvent<Parameters<typeof applyAppearance>[0]>('settings_theme', applyAppearance);

    // Placing a position: the window hides so the player can see the world,
    // without tearing down the editor's staged edits.
    useNuiEvent<{ PLACING?: boolean }>('settings_placing', (data) => {
        useLang.setState({ placing: data.PLACING === true });
    });

    // Keybind legend for any modal in-game tool.
    useNuiEvent<Parameters<typeof applyToolState>[0]>('gg_tool', applyToolState);

    // Drag handles, republished each frame while the tool's cursor is up.
    useNuiEvent<Parameters<typeof applyGizmoState>[0]>('gg_gizmo', applyGizmoState);

    // Partial updates from src/client/popup.lua -- any of enabled/message/position.
    useNuiEvent<Partial<PopupData>>('popup_update', (data) => {
        usePopup.setState(data);
    });

    useEffect(() => {
        const handleKeyPress = (event: KeyboardEvent) => {
            if (event.key !== 'Escape') return;
            if (!useLang.getState().visible) return;

            // A keybind control is listening for its next key — that Escape
            // means "cancel capture", not "close the editor".
            if (document.body.dataset.captureKey) return;

            // Placement owns Escape. The editor is only hidden during it, not
            // closed, so `visible` is still true and this would otherwise close
            // it out from under the running tool: the tool then hands focus
            // back to an editor that no longer exists, leaving the player
            // pointing at nothing. The tool reads Escape itself and cancels.
            //
            // This matters most with the gizmo cursor up, because NUI focus is
            // exactly when the browser sees the key at all.
            if (useLang.getState().placing) {
                event.preventDefault();
                return;
            }

            event.preventDefault();
            hideEditor();
            fetchNui('settings_close');
        };

        window.addEventListener('keydown', handleKeyPress, true);
        return () => window.removeEventListener('keydown', handleKeyPress, true);
    }, []);

    return (
        <div className="h-screen w-full overflow-hidden">
            <AnimatePresence mode="wait">
                {visible && !placing && (
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
            {/* Always mounted: it holds one WebGL context and parks itself when
                idle. Mounting it on demand costs a fresh context each time. */}
            <TOOL_GIZMO />
            <AnimatePresence>{toolActive && <TOOL_HUD key="tool_hud" />}</AnimatePresence>
            {import.meta.env.DEV && isEnvBrowser() && <DevSurfaceSwitcher />}
        </div>
    );
}
