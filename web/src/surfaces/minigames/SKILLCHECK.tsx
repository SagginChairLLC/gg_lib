import { useRef, useState } from 'react';
import type { MinigameConfig } from '@/data/useMinigames';
import { FloatShell, Keycap, RoundBar, useGameKeys, useRafLoop, type Verdict } from './parts';

/**
 * A needle sweeps a ring; press the key while it crosses the marked arc.
 * Passing the arc without pressing, or pressing anywhere else, fails.
 *
 * No card, no ground — a big glowing ring floating over the action, in the
 * style the rest of the set follows. The needle's angle is tracked unwrapped
 * and each round's arc is placed ahead of it, so "missed the zone" is a plain
 * comparison instead of wrap-around bookkeeping.
 */

const LEAD = 70;
const GRACE = 6;

type Round = { start: number; end: number; key: string };

function polar(angle: number, radius: number) {
    const rad = ((angle - 90) * Math.PI) / 180;

    return { x: 50 + radius * Math.cos(rad), y: 50 + radius * Math.sin(rad) };
}

function arcPath(from: number, to: number, radius: number) {
    const a = polar(from, radius);
    const b = polar(to, radius);

    return `M ${a.x} ${a.y} A ${radius} ${radius} 0 ${to - from > 180 ? 1 : 0} 1 ${b.x} ${b.y}`;
}

export default function SKILLCHECK({ config, finish }: { config: MinigameConfig; finish: (success: boolean) => void }) {
    const rounds = Math.max(1, config.rounds ?? 3);
    const zone = Math.max(8, Math.min(90, config.zone ?? 40));
    const keys = config.keys?.length ? config.keys.map((key) => key.toUpperCase()) : ['E'];

    const angle = useRef(0);
    const speed = useRef(Math.max(60, config.speed ?? 220));
    const phase = useRef<'play' | 'over'>('play');

    const makeRound = (from: number): Round => ({
        start: from + LEAD + Math.random() * 140,
        end: 0,
        key: keys[Math.floor(Math.random() * keys.length)],
    });

    const [round, setRound] = useState<Round>(() => {
        const first = makeRound(0);
        return { ...first, end: first.start + zone };
    });
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

        angle.current += speed.current * delta;

        if (angle.current > round.end + GRACE) end(false);

        redraw((tick) => tick + 1);
    });

    useGameKeys((key) => {
        if (phase.current !== 'play') return;
        if (key === 'ESCAPE') return end(false);
        if (key !== round.key) return end(false);

        const inside = angle.current >= round.start && angle.current <= round.end;
        if (!inside) return end(false);

        const done = cleared + 1;

        if (done >= rounds) return end(true);

        setCleared(done);
        speed.current *= 1.07;

        const next = makeRound(angle.current);
        setRound({ ...next, end: next.start + zone * Math.max(0.55, 1 - done * 0.12) });
    });

    const shownStart = round.start % 360;
    const shownEnd = shownStart + (round.end - round.start);
    const needle = polar(angle.current % 360, 41);
    const needleFrom = polar(angle.current % 360, 27);

    const arcClass = verdict === 'lost' ? 'stroke-red-400 gg-glow-err' : verdict === 'won' ? 'stroke-emerald-400 gg-glow-ok' : 'stroke-primary gg-glow';

    return (
        <FloatShell>
            <div className="relative h-[23vh] w-[23vh]">
                <svg viewBox="0 0 100 100" className="h-full w-full overflow-visible">
                    <circle cx="50" cy="50" r="41" fill="none" strokeWidth="6.5" className="stroke-neutral-950/85" />
                    <circle cx="50" cy="50" r="41" fill="none" strokeWidth="5" className="stroke-white/10" />

                    <path d={arcPath(shownStart, shownEnd, 41)} fill="none" strokeWidth="5" strokeLinecap="round" className={arcClass} />

                    <line
                        x1={needleFrom.x}
                        y1={needleFrom.y}
                        x2={needle.x}
                        y2={needle.y}
                        strokeWidth="2"
                        strokeLinecap="round"
                        className={verdict === 'lost' ? 'stroke-red-300 gg-glow-err' : 'stroke-white gg-glow'}
                    />
                </svg>

                <div className="absolute inset-0 flex items-center justify-center">
                    <span className={verdict ? '' : 'gg-pulse'}>
                        <Keycap label={round.key} state={verdict === 'lost' ? 'wrong' : verdict === 'won' ? 'done' : 'active'} />
                    </span>
                </div>
            </div>

            <div className="w-[16vh]">
                <RoundBar total={rounds} done={cleared + (verdict === 'won' ? 1 : 0)} verdict={verdict} />
            </div>
        </FloatShell>
    );
}
