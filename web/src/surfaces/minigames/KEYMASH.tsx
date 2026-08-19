import { useRef, useState } from 'react';
import type { MinigameConfig } from '@/data/useMinigames';
import { FloatShell, keyPool, randomKey, useGameKeys, useRafLoop, type Verdict } from './parts';

/**
 * Mash the key until the glow fills the ring. The fill is a circle growing
 * from the center — every press pushes it out, every quiet moment pulls it
 * back — and the thin outer ring is the clock draining clockwise.
 */
export default function KEYMASH({ config, finish }: { config: MinigameConfig; finish: (success: boolean) => void }) {
    const time = Math.max(2, config.time ?? 6);
    const decay = Math.max(0, config.decay ?? 16);
    const gain = Math.max(1, config.gain ?? 6);
    const [key] = useState(() => randomKey(keyPool(config.keys)));

    const value = useRef(18);
    const left = useRef(time);
    const phase = useRef<'play' | 'over'>('play');

    const [verdict, setVerdict] = useState<Verdict>(null);
    const [pressed, setPressed] = useState(false);
    const [, redraw] = useState(0);

    const end = (success: boolean) => {
        if (phase.current === 'over') return;

        phase.current = 'over';
        setVerdict(success ? 'won' : 'lost');
        setTimeout(() => finish(success), 420);
    };

    useRafLoop((delta) => {
        if (phase.current !== 'play') return;

        value.current = Math.max(0, value.current - decay * delta);
        left.current -= delta;

        if (left.current <= 0) end(false);

        redraw((tick) => tick + 1);
    });

    useGameKeys((incoming) => {
        if (phase.current !== 'play') return;
        if (incoming === 'ESCAPE') return end(false);
        if (incoming !== key) return;

        value.current = Math.min(100, value.current + gain);
        setPressed(true);
        setTimeout(() => setPressed(false), 60);

        if (value.current >= 100) end(true);
    });

    // Ring geometry: r=44 in a 100 viewbox; the timer drains along it.
    const CIRCUMFERENCE = 2 * Math.PI * 44;
    const drained = CIRCUMFERENCE * (1 - Math.max(0, left.current) / time);
    const low = left.current / time < 0.25;

    // The fill stays the accent whatever happens. Flooding the whole ring green
    // on a win read as a different screen rather than a finished one; the key
    // itself carries the result instead.
    const fill = verdict === 'won' ? 44 : (value.current / 100) * 42;
    const fillClass = verdict === 'lost' ? 'fill-[#f43f5e]/30 gg-glow-err' : 'fill-primary/45 gg-glow';

    return (
        <FloatShell>
            <div className="relative h-[19vh] w-[19vh]">
                <svg viewBox="0 0 100 100" className="h-full w-full overflow-visible">
                    <circle cx="50" cy="50" r="44" fill="rgba(8,8,10,0.75)" strokeWidth="1.4" className="stroke-white/10" />

                    <circle cx="50" cy="50" r={fill} className={`transition-none ${fillClass}`} />

                    <circle
                        cx="50"
                        cy="50"
                        r="44"
                        fill="none"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                        strokeDasharray={CIRCUMFERENCE}
                        strokeDashoffset={-drained}
                        transform="rotate(-90 50 50)"
                        className={
                            verdict === 'won'
                                ? 'stroke-[#34d399] gg-glow-ok'
                                : low || verdict === 'lost'
                                  ? 'stroke-[#f43f5e] gg-glow-err'
                                  : 'stroke-primary gg-glow'
                        }
                    />
                </svg>

                <div className="absolute inset-0 flex items-center justify-center">
                    <span
                        className={`font-mono text-[3.4vh] font-black tracking-wider transition-transform duration-75 ${
                            pressed ? 'scale-125' : 'scale-100'
                        } ${verdict === 'won' ? 'text-[#34d399] gg-glow-ok' : verdict === 'lost' ? 'text-[#f43f5e] gg-glow-err' : 'text-white gg-glow'}`}
                        style={{ textShadow: '0 0 1.2vh rgba(0,0,0,0.9)' }}
                    >
                        {key}
                    </span>
                </div>
            </div>
        </FloatShell>
    );
}
