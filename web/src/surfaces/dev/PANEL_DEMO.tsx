import { useState } from 'react';
import { usePanel } from '@/data/usePanel';
import { PANEL_VARIANTS, applyPanelVariant } from '@/lib/panelVariants';

/**
 * A bench for the job popup.
 *
 * Browser only. The popup itself renders where it really renders, on the edge
 * of the screen; this is only the row of things to point it at, so what is
 * being looked at is the real component in its real position rather than a
 * picture of it in a box.
 */

export default function PANEL_DEMO() {
    const enabled = usePanel((state) => state.enabled);
    const [picked, setPicked] = useState<string>('fare');

    if (!enabled) return null;

    return (
        <div className="pointer-events-none fixed inset-x-0 bottom-0 z-30 flex justify-center pb-[3vh] font-sans">
            <div className="pointer-events-auto flex max-w-[90%] flex-col gap-[1.2vh] rounded-[0.7vh] border border-neutral-700/70 bg-neutral-900/95 p-[1.4vh] shadow-2xl backdrop-blur">
                <div className="flex items-baseline gap-[1vh]">
                    <span className="text-[1.3vh] font-bold uppercase tracking-widest text-neutral-500">Job Popup</span>
                    <span className="text-[1.15vh] text-neutral-600">every state a job script can put it in</span>
                </div>

                <div className="flex flex-wrap gap-[0.8vh]">
                    {PANEL_VARIANTS.map((variant) => {
                        const active = picked === variant.id;

                        return (
                            <button
                                key={variant.id}
                                type="button"
                                onClick={() => {
                                    setPicked(variant.id);
                                    applyPanelVariant(variant.id);
                                }}
                                className={`flex w-[19vh] flex-col gap-[0.3vh] rounded-[0.5vh] border px-[1.1vh] py-[0.9vh] text-left transition-colors ${
                                    active
                                        ? 'border-primary/50 bg-primary/10'
                                        : 'border-neutral-700 bg-neutral-800/40 hover:border-neutral-600 hover:bg-neutral-800/70'
                                }`}
                            >
                                <span className={`text-[1.3vh] font-semibold ${active ? 'text-primary' : 'text-neutral-200'}`}>{variant.label}</span>
                                <span className="text-[1.1vh] leading-snug text-neutral-500">{variant.note}</span>
                            </button>
                        );
                    })}
                </div>

                <div className="flex items-center gap-[1vh] border-t border-neutral-800 pt-[1vh] text-[1.15vh] text-neutral-500">
                    <kbd className="rounded-[0.3vh] border border-neutral-600 bg-neutral-800 px-[0.6vh] py-[0.15vh] font-mono text-[1.05vh] text-neutral-300">G</kbd>
                    hides and shows the panel. Payouts replay every time you click one.
                </div>
            </div>
        </div>
    );
}
