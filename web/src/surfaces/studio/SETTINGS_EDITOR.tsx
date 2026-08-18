import { useState } from 'react';
import { hideEditor, t, useLang } from '@/data/useLang';
import { useSettings } from '@/data/useSettings';
import { fetchNui } from '@/lib/fetchNui';
import SETTINGS_SCRIPT from './SETTINGS_SCRIPT';

export default function SETTINGS_EDITOR() {
    const activeResource = useSettings((state) => state.activeResource);
    const scripts = useSettings((state) => state.scripts);

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
