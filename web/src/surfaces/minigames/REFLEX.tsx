import { useRef, useState } from 'react';
import type { MinigameConfig } from '@/data/useMinigames';
import { FloatShell, Keycap, RoundBar, keyPool, randomKey, useGameKeys, useRafLoop, type Verdict } from './parts';

/**
 * One key at a time, somewhere new each time, inside a ring that closes on it.
 * Hit it before the ring lands. The eye has to find the prompt before the hand
 * can answer it, which is what separates this from the fixed-position checks.
 */

type Target = { key: string; x: number; y: number };

export default function REFLEX({ config, finish }: { config: MinigameConfig; finish: (success: boolean) => void }) {
    const rounds = Math.max(1, config.rounds ?? 4);
    const baseWindow = Math.max(0.4, config.window ?? 1.3);
    const pool = keyPool(config.keys);

    const left = useRef(baseWindow);
    const span = useRef(baseWindow);
    const phase = useRef<'play' | 'over'>('play');

    // Kept off the edges so the ring never clips out of the play area.
    const makeTarget = (previous?: Target): Target => {
        let next = randomKey(pool);

        // Two of the same key in a row lets the hand answer before the eye has
        // found the prompt, which is the whole test.
        while (pool.length > 1 && next === previous?.key) next = randomKey(pool);

        return { key: next, x: 12 + Math.random() * 76, y: 16 + Math.random() * 68 };
    };

    const [target, setTarget] = useState<Target>(() => makeTarget());
    const [cleared, setCleared] = useState(0);
    const [verdict, setVerdict] = useState<Verdict>(null);
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

        if (left.current <= 0) return end(false);

        redraw((tick) => tick + 1);
    });

    useGameKeys((incoming) => {
        if (phase.current !== 'play') return;
        if (incoming === 'ESCAPE') return end(false);
        if (incoming !== target.key) return end(false);

        const done = cleared + 1;

        if (done >= rounds) return end(true);

        span.current = Math.max(0.35, span.current * 0.9);
        left.current = span.current;
        setCleared(done);
        setTarget((current) => makeTarget(current));
    });

    const fraction = Math.max(0, left.current / span.current);

    // The ring closes onto the keycap rather than draining around it: a shape
    // shrinking toward the key pulls the eye straight to it.
    const ring = 7 + fraction * 7;
    const ringClass = verdict === 'lost' ? 'border-[#f43f5e] gg-glow-err' : verdict === 'won' ? 'border-[#34d399] gg-glow-ok' : 'border-primary gg-glow';

    return (
        <FloatShell>
            <div className="relative h-[17vh] w-[44vh]">
                <div className="absolute" style={{ left: `${target.x}%`, top: `${target.y}%`, transform: 'translate(-50%, -50%)' }}>
                    <div
                        className={`absolute rounded-full border-[0.3vh] transition-none ${ringClass}`}
                        style={{ width: `${ring}vh`, height: `${ring}vh`, left: '50%', top: '50%', transform: 'translate(-50%, -50%)', opacity: 0.25 + fraction * 0.55 }}
                    />

                    <Keycap label={target.key} state={verdict === 'lost' ? 'wrong' : verdict === 'won' ? 'done' : 'active'} />
                </div>
            </div>

            <div className="w-[30vh]">
                <RoundBar total={rounds} done={cleared + (verdict === 'won' ? 1 : 0)} verdict={verdict} />
            </div>
        </FloatShell>
    );
}
