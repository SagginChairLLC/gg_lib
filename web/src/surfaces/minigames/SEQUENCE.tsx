import { useRef, useState } from 'react';
import type { MinigameConfig } from '@/data/useMinigames';
import { FloatShell, Keycap, TimerBar, keyPool, randomKey, useGameKeys, useRafLoop, type Verdict } from './parts';

/** Type the shown keys in order before the timer empties. One wrong key fails. */


export default function SEQUENCE({ config, finish }: { config: MinigameConfig; finish: (success: boolean) => void }) {
    const length = Math.max(3, Math.min(12, config.length ?? 6));
    const time = Math.max(2, config.time ?? 5);

    const [keys] = useState(() => {
        const pool = keyPool(config.keys);

        return Array.from({ length }, () => randomKey(pool));
    });
    const [at, setAt] = useState(0);
    const [verdict, setVerdict] = useState<Verdict>(null);

    const left = useRef(time);
    const phase = useRef<'play' | 'over'>('play');
    const [, redraw] = useState(0);

    const end = (success: boolean) => {
        if (phase.current === 'over') return;

        phase.current = 'over';
        setVerdict(success ? 'won' : 'lost');
        setTimeout(() => finish(success), 420);
    };

    useRafLoop((delta) => {
        if (phase.current !== 'play') return;

        left.current -= delta;

        if (left.current <= 0) end(false);

        redraw((tick) => tick + 1);
    });

    useGameKeys((incoming) => {
        if (phase.current !== 'play') return;
        if (incoming === 'ESCAPE') return end(false);
        if (incoming.length !== 1) return;

        if (incoming !== keys[at]) return end(false);

        const next = at + 1;

        if (next >= keys.length) return end(true);

        setAt(next);
    });

    return (
        <FloatShell>
            <div className="flex items-center gap-[0.9vh]">
                {keys.map((key, index) => {
                    const state =
                        verdict === 'lost' && index === at
                            ? 'wrong'
                            : index < at || verdict === 'won'
                              ? 'done'
                              : index === at
                                ? 'active'
                                : 'idle';

                    return (
                        <span key={index} className={`gg-tile-in ${index === at && !verdict ? 'gg-pulse' : ''}`} style={{ animationDelay: `${index * 45}ms` }}>
                            <Keycap label={key} state={state} />
                        </span>
                    );
                })}
            </div>

            <div className="w-[70%]">
                <TimerBar fraction={left.current / time} />
            </div>
        </FloatShell>
    );
}
