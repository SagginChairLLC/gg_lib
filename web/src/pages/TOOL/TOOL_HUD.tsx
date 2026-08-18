import { motion } from 'framer-motion';
import { useTool } from '@/data/useTool';

/**
 * The panel for any gg.tool session: a live readout, then the keybinds listed
 * top down. It sits in the top-left so it never covers what the player is
 * pointing at, and it is the only thing a tool draws — nothing goes through the
 * game's own text or marker natives.
 *
 * No backdrop-filter and no large soft shadow: this page is transparent over
 * the game, so CEF has nothing behind it to sample. A backdrop blur composites
 * against black and paints a solid rectangle around the panel.
 */

export default function TOOL_HUD() {
    const title = useTool((state) => state.title);
    const mode = useTool((state) => state.mode);
    const keys = useTool((state) => state.keys);
    const info = useTool((state) => state.info);

    return (
        <motion.div
            initial={{ opacity: 0, x: -16 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -16 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            className="pointer-events-none absolute left-[2.4vh] top-[2.4vh] z-50 flex w-[26vh] flex-col overflow-hidden rounded-[0.6vh] border border-white/15 bg-neutral-950/95"
        >
            <div className="flex items-center gap-[0.9vh] border-b border-white/10 px-[1.4vh] py-[1vh]">
                <span className="h-[0.8vh] w-[0.8vh] flex-shrink-0 rounded-full bg-primary" />
                <span className="min-w-0 flex-1 truncate text-[1.55vh] font-bold text-white/95">{title}</span>
                {mode && (
                    <span className="flex-shrink-0 rounded-[0.4vh] bg-primary/15 px-[0.7vh] py-[0.15vh] font-mono text-[1.05vh] font-bold uppercase tracking-wide text-primary">
                        {mode}
                    </span>
                )}
            </div>

            {info.length > 0 && (
                <div className="flex flex-col gap-[0.25vh] border-b border-white/10 px-[1.4vh] py-[0.9vh]">
                    {info.map((row) => (
                        <div key={row.label} className="flex items-baseline justify-between gap-[1vh]">
                            <span className="font-mono text-[1.1vh] uppercase tracking-widest text-white/30">{row.label}</span>
                            <span className="font-mono text-[1.35vh] text-white/85">{row.value}</span>
                        </div>
                    ))}
                </div>
            )}

            <div className="flex flex-col gap-[0.45vh] px-[1.4vh] py-[1vh]">
                {keys.map((entry) => (
                    <div key={`${entry.key}-${entry.label}`} className="flex items-center gap-[0.9vh]">
                        <kbd className="min-w-[5.6vh] flex-shrink-0 rounded-[0.4vh] border border-white/25 bg-white/[0.08] px-[0.7vh] py-[0.2vh] text-center font-mono text-[1.15vh] font-semibold uppercase tracking-wide text-white/90">
                            {entry.key}
                        </kbd>
                        <span className="min-w-0 flex-1 truncate text-[1.35vh] text-white/60">{entry.label}</span>
                    </div>
                ))}
            </div>
        </motion.div>
    );
}
