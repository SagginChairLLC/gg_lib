import { useState } from 'react';
import { hideEditor, t, useLang } from '@/data/useLang';
import { useSettings } from '@/data/useSettings';
import { fetchNui } from '@/lib/fetchNui';
import SETTINGS_SCRIPT from './SETTINGS_SCRIPT';

/**
 * The /jobsettings surface: one window. Script selection is embedded in the
 * editor's left rail, so opening lands straight in a script — whichever one the
 * admin was in last (see openSettings) — with no separate picker step.
 */

export default function SETTINGS_EDITOR() {
    const activeResource = useSettings((state) => state.activeResource);
    const scripts = useSettings((state) => state.scripts);

    /**
     * Moving the pointer off the window fades it back, so the world behind can
     * be checked without closing the editor and losing staged edits. Whether it
     * fades at all, and how far, are studio-wide settings — Generic Settings ->
     * Appearance — rather than a number baked in here.
     *
     * Starts hovered: the editor opens wherever the cursor happens to be, and
     * opening already faded would look broken.
     */
    const [hovered, setHovered] = useState(true);
    const fade = useLang((state) => state.fade);
    const fadeOpacity = useLang((state) => state.fadeOpacity);

    const opacity = hovered || !fade ? 1 : Math.min(Math.max(fadeOpacity, 10), 100) / 100;

    const activeScript = scripts.find((script) => script.resource === activeResource) ?? scripts[0] ?? null;

    const handleClose = () => {
        hideEditor();
        fetchNui('settings_close');
    };

    if (!activeScript) {
        return (
            <div className="flex h-full w-full items-center justify-center">
                <div className="flex w-[40vh] flex-col items-center gap-[1.5vh] rounded-[0.5vh] border border-white/10 bg-neutral-950 p-[3vh] shadow-2xl">
                    <i className="fas fa-plug-circle-xmark text-[3.5vh] text-white/30" />
                    <span className="text-[1.6vh] text-white/60">{t('settings_no_scripts')}</span>
                    <button type="button" onClick={handleClose} className="rounded-[0.4vh] border border-white/15 px-[1.6vh] py-[0.7vh] text-[1.4vh] font-semibold text-white/70 transition-colors hover:border-primary/40 hover:text-primary">
                        {t('util_close_btn')}
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="flex h-full w-full items-center justify-center">
            {/* Wider than 16:9 on purpose. The rail costs a fixed 27vh whatever
                the window, and the value column another 28vh, so at a video
                aspect the space left for a setting's own label and help was the
                narrowest part of the layout -- and picker panels had nowhere to
                open into.

                Every dimension in this UI is in vh, width included. Viewport
                width is never used: height is the one axis that stays constant
                across the monitors this runs on, so sizing off it makes the
                whole panel render identically everywhere, while a vw anywhere
                would make it drift with the aspect ratio. */}
            <div
                onMouseEnter={() => setHovered(true)}
                onMouseLeave={() => setHovered(false)}
                style={{ opacity }}
                className="flex h-[78vh] w-[148vh] flex-col overflow-hidden rounded-[0.5vh] border border-white/10 bg-neutral-950 shadow-[0_30px_90px_rgba(0,0,0,0.65)] transition-opacity duration-200"
            >
                <SETTINGS_SCRIPT script={activeScript} scripts={scripts} />
            </div>
        </div>
    );
}
