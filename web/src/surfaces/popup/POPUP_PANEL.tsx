import React, { useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { usePanel, togglePanel, type PanelHint } from '@/data/usePanel';
import PANEL_REWARD from './PANEL_REWARD';
import { isEnvBrowser } from '@/lib/fetchNui';
import { parseColor } from '@/lib/color-utils';

/**
 * The job popup. One of these for every job script, never more than one on
 * screen, and it says everything a player needs to know about the run:
 *
 *   what to do now     -- the instruction, up top where the eye lands
 *   how far along      -- a count and a bar, no more than that
 *   what to press      -- the keys, at the bottom, always including the one
 *                         that puts it away
 *
 * There is no separate popup for "no route left". That is just this one with
 * nothing in progress and different keys offered, which is the point of it
 * being all in one: a player learns the shape once.
 *
 * The cap and the panel are positioned independently of each other. Stacking
 * them and centring the pair feeds the panel's height back into the cap's
 * position, and the cap jumps every time the panel opens. Both are worked out
 * from the configured height alone, so neither can move the other.
 */

const CAP_VH = 3.2;
const GAP_VH = 0.9;

const EASE = [0.22, 0.61, 0.36, 1] as const;

/** Keys the browser names as words but that read better as a glyph. */
const GLYPHS: Record<string, string> = {
    ArrowDown: '↓',
    ArrowUp: '↑',
    ArrowLeft: '←',
    ArrowRight: '→',
};

function isStripKey(event: KeyboardEvent, key: string) {
    return event.key.toLowerCase() === key.toLowerCase() || GLYPHS[event.key] === key;
}

function pad(value: number) {
    return value.toString().padStart(2, '0');
}

function remaining(endTime: number | null) {
    if (!endTime) return 0;

    return Math.max(0, endTime - Math.floor(Date.now() / 1000));
}

function clock(seconds: number) {
    return `${pad(Math.floor(seconds / 60))}:${pad(seconds % 60)}`;
}

/** A key cap. One shape everywhere, so it always reads as something to press. */
function Cap({ children, strong }: { children: React.ReactNode; strong?: boolean }) {
    return (
        <span
            className={`flex h-[2.1vh] min-w-[2.1vh] flex-shrink-0 items-center justify-center rounded-[0.35vh] border px-[0.5vh] text-[1.1vh] font-black uppercase leading-none ${
                strong ? 'border-primary/50 bg-primary/15 text-primary' : 'border-neutral-600 bg-neutral-800/60 text-neutral-300'
            }`}
        >
            {children}
        </span>
    );
}

const POPUP_PANEL = React.memo(() => {
    const open = usePanel((state) => state.open);
    const side = usePanel((state) => state.side);
    const height = usePanel((state) => state.height);
    const job = usePanel((state) => state.job);
    const toggleKey = usePanel((state) => state.toggleKey);
    const badge = usePanel((state) => state.badge);
    const endTime = usePanel((state) => state.endTime);
    const title = usePanel((state) => state.title);
    const description = usePanel((state) => state.description);
    const steps = usePanel((state) => state.steps);
    const hints = usePanel((state) => state.hints);
    const reward = usePanel((state) => state.reward);
    const accent = usePanel((state) => state.accent);

    const clockRef = useRef<HTMLSpanElement>(null);

    // Scoped here rather than on :root, so a job's colour cannot repaint
    // anything else on screen.
    const accentStyle = React.useMemo(() => {
        if (!accent) return undefined;

        const parsed = parseColor(accent);

        return parsed.spaceSeparated ? ({ ['--primary' as string]: parsed.spaceSeparated } as React.CSSProperties) : undefined;
    }, [accent]);

    // Written straight into the node. Held in state it would re-render the
    // whole panel once a second to change two digits.
    useEffect(() => {
        if (!endTime) return;

        const tick = () => {
            if (clockRef.current) clockRef.current.textContent = clock(remaining(endTime));
        };

        tick();

        const timer = setInterval(tick, 1000);

        return () => clearInterval(timer);
    }, [endTime, open]);

    // In game the script owns the key and tells us. In the browser there is no
    // script, so the preview listens itself.
    useEffect(() => {
        if (!isEnvBrowser()) return;

        const onKey = (event: KeyboardEvent) => {
            if (event.repeat || document.activeElement?.tagName === 'INPUT') return;

            if (isStripKey(event, toggleKey)) {
                event.preventDefault();
                togglePanel();
            }
        };

        window.addEventListener('keydown', onKey);

        return () => window.removeEventListener('keydown', onKey);
    }, [toggleKey]);

    const edge = side === 'left' ? 'left-[1.2vh]' : 'right-[1.2vh]';
    const away = side === 'left' ? -34 : 34;
    const done = steps.filter((step) => step.done).length;

    // A script that named its steps has already said what to do now, so the
    // heading falls back to whichever one is current rather than repeating it.
    const heading = title || steps.find((step) => !step.done)?.label || '';

    return (
        <div className="pointer-events-none fixed inset-0 z-40" style={accentStyle}>
            {/* The cap. Always out, whether the panel is or not: hiding the panel
                should not also hide the fact that there is one. */}
            <motion.button
                type="button"
                onClick={togglePanel}
                initial={{ x: away, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: away, opacity: 0 }}
                transition={{ duration: 0.3, ease: EASE }}
                style={{ top: `calc(${height}% - ${CAP_VH + GAP_VH}vh)`, height: `${CAP_VH}vh` }}
                className={`pointer-events-auto absolute flex items-center gap-[0.7vh] rounded-[0.5vh] border bg-neutral-900/90 px-[0.8vh] shadow-lg backdrop-blur-sm transition-colors ${edge} ${
                    open ? 'border-neutral-700/60' : 'border-primary/40'
                }`}
            >
                <Cap strong={!open}>{toggleKey}</Cap>

                <i className={`fas ${job.icon} text-[1.15vh] text-primary`} />

                <span className="whitespace-nowrap text-[1.2vh] font-semibold text-neutral-300">{job.label}</span>

                {badge > 0 && (
                    <span className="flex h-[1.7vh] min-w-[1.7vh] items-center justify-center rounded-full bg-primary px-[0.4vh] text-[1.05vh] font-black leading-none text-neutral-900">
                        {badge}
                    </span>
                )}
            </motion.button>

            <AnimatePresence>
                {open && (
                    <motion.div
                        key="panel"
                        initial={{ x: away, opacity: 0 }}
                        animate={{ x: 0, opacity: 1 }}
                        exit={{ x: away, opacity: 0 }}
                        transition={{ duration: 0.3, ease: EASE }}
                        style={{ top: `${height}%` }}
                        className={`pointer-events-auto absolute w-[31vh] overflow-hidden rounded-[0.6vh] border border-neutral-700/70 bg-neutral-900/90 shadow-2xl backdrop-blur-sm ${edge}`}
                    >
                        <div className="flex items-center justify-between border-b border-neutral-700/50 px-[1.1vh] py-[0.8vh]">
                            <div className="flex min-w-0 items-center gap-[0.7vh]">
                                <i className={`fas ${job.icon} flex-shrink-0 text-[1.15vh] text-primary`} />
                                <span className="truncate text-[1.05vh] font-medium uppercase tracking-wider text-neutral-400">{job.label}</span>
                            </div>

                            {endTime !== null && (
                                <div className="flex flex-shrink-0 items-center gap-[0.55vh] font-mono text-[1.05vh] text-primary">
                                    <i className="fas fa-clock text-[1vh]" />
                                    <span ref={clockRef}>{clock(remaining(endTime))}</span>
                                </div>
                            )}
                        </div>

                        {/* A payout takes the body over while it runs, then
                            clears itself and leaves what the job set underneath. */}
                        {reward ? (
                            <PANEL_REWARD reward={reward} />
                        ) : (
                            /* What to do now. The heading is the step you are on,
                               which is why the steps below are not listed out. */
                            <div className="flex flex-col gap-[0.35vh] px-[1.1vh] pb-[1.1vh] pt-[1.1vh]">
                                <h4 className="text-[1.35vh] font-semibold leading-tight text-white">{heading}</h4>
                                {description && <p className="text-[1.1vh] leading-relaxed text-neutral-400">{description}</p>}
                            </div>
                        )}

                        {/* How far along, and nothing else. A player driving does
                            not need four lines of things they have already done
                            taking up the side of their screen. */}
                        {!reward && steps.length > 0 && (
                            <div className="flex items-center gap-[0.8vh] border-t border-neutral-800 px-[1.1vh] py-[0.7vh]">
                                <span className="flex-shrink-0 font-mono text-[1vh] font-medium text-primary">
                                    {done}/{steps.length}
                                </span>

                                <div className="flex flex-1 gap-[0.35vh]">
                                    {steps.map((step, index) => (
                                        <motion.span
                                            key={step.label}
                                            initial={false}
                                            animate={{ opacity: step.done ? 1 : 0.4 }}
                                            transition={{ duration: 0.3, delay: index * 0.04, ease: EASE }}
                                            className={`h-[0.35vh] flex-1 rounded-full ${step.done ? 'bg-primary' : 'bg-neutral-700'}`}
                                        />
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* What to press. */}
                        {hints.length > 0 && (
                            <div className="flex flex-col gap-[0.5vh] border-t border-neutral-800 bg-neutral-800/25 px-[1.1vh] py-[1vh]">
                                {hints.map((hint) => (
                                    <div key={`${hint.key}:${hint.label}`} className="flex items-center gap-[0.8vh]">
                                        <Cap strong={hint.key.toLowerCase() !== toggleKey.toLowerCase()}>{hint.key}</Cap>
                                        <span className="min-w-0 truncate text-[1.1vh] text-neutral-400">{hint.label}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
});

export type { PanelHint };

export default POPUP_PANEL;
