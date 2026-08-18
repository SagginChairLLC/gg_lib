import { useEffect, useRef, useState } from 'react';
import type { MinigameConfig } from '@/data/useMinigames';
import { GameShell, TimerBar, useGameKeys, useRafLoop, type Verdict } from './parts';

/**
 * Tiles flash, go dark, and every lit tile has to be found again. A wrong tile
 * fails. The board fills most of the view — tile size comes from the grid, so
 * a 4x4 and a 6x6 both land around 44vh square.
 */
export default function MEMORY({ config, finish }: { config: MinigameConfig; finish: (success: boolean) => void }) {
    const size = Math.max(3, Math.min(6, config.size ?? 4));
    const time = Math.max(3, config.time ?? 8);
    const flashes = Math.max(2, Math.min(size * size - 1, config.flashes ?? 5));

    const [targets] = useState<Set<number>>(() => {
        const picked = new Set<number>();
        while (picked.size < flashes) picked.add(Math.floor(Math.random() * size * size));

        return picked;
    });

    const [showing, setShowing] = useState(true);
    const [found, setFound] = useState<Set<number>>(new Set());
    const [wrong, setWrong] = useState<number | null>(null);
    const [verdict, setVerdict] = useState<Verdict>(null);

    const left = useRef(time);
    const phase = useRef<'show' | 'play' | 'over'>('show');
    const [, redraw] = useState(0);

    const tile = `${(44 - (size - 1) * 1.2) / size}vh`;

    const end = (success: boolean) => {
        if (phase.current === 'over') return;

        phase.current = 'over';
        setVerdict(success ? 'won' : 'lost');
        setTimeout(() => finish(success), 520);
    };

    // The study window scales with how much there is to memorise.
    useEffect(() => {
        const timer = setTimeout(() => {
            if (phase.current !== 'show') return;

            phase.current = 'play';
            setShowing(false);
        }, 1200 + flashes * 220);

        return () => clearTimeout(timer);
    }, [flashes]);

    useRafLoop((delta) => {
        if (phase.current !== 'play') return;

        left.current -= delta;

        if (left.current <= 0) end(false);

        redraw((tick) => tick + 1);
    });

    useGameKeys((incoming) => {
        if (incoming === 'ESCAPE' && phase.current !== 'over') end(false);
    });

    const pick = (index: number) => {
        if (phase.current !== 'play' || found.has(index)) return;

        if (!targets.has(index)) {
            setWrong(index);
            return end(false);
        }

        const next = new Set(found);
        next.add(index);
        setFound(next);

        if (next.size >= targets.size) end(true);
    };

    return (
        <GameShell
            title="Memory"
            accent="Grid"
            subtitle={showing ? 'Memorise the pattern' : 'Click every tile that lit up'}
            verdict={verdict}
            footer={<TimerBar fraction={showing ? 1 : left.current / time} />}
        >
            <div className="grid gap-[1.2vh]" style={{ gridTemplateColumns: `repeat(${size}, minmax(0, 1fr))` }}>
                {Array.from({ length: size * size }, (_, index) => {
                    const row = Math.floor(index / size);
                    const col = index % size;

                    const lit = (showing && targets.has(index)) || found.has(index);
                    const missed = verdict === 'lost' && targets.has(index) && !found.has(index);

                    const look =
                        index === wrong
                            ? 'border-red-400 bg-red-500/40 gg-glow-err'
                            : found.has(index) && verdict === 'won'
                              ? 'border-emerald-400/80 bg-emerald-400/30 gg-glow-ok'
                              : lit
                                ? 'border-primary/80 bg-primary/30 gg-glow'
                                : missed
                                  ? 'border-red-400/50 bg-red-500/15'
                                  : 'border-white/10 bg-neutral-900/80 hover:border-white/30 hover:bg-neutral-800/80';

                    return (
                        <button
                            key={index}
                            type="button"
                            onClick={() => pick(index)}
                            className={`gg-tile-in rounded-[0.8vh] border-[0.22vh] transition-colors duration-150 ${look}`}
                            style={{
                                width: tile,
                                height: tile,
                                animationDelay: `${(row + col) * 40}ms`,
                                boxShadow: 'inset 0 -0.4vh 0 rgba(0,0,0,0.35)',
                            }}
                        />
                    );
                })}
            </div>
        </GameShell>
    );
}
