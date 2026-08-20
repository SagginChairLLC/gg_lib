import { useRef, useState } from 'react';
import type { MinigameConfig } from '@/data/useMinigames';
import { GameShell, Keycap, RoundBar, TimerBar, useGameKeys, useHeldKeys, useKeySequence, useRafLoop, type Verdict } from './parts';

/**
 * Turn the pick around the cylinder with A and D and set the pin where the
 * tension peaks. Nothing marks the sweet spot — the tension bar is the only
 * read on it — so this is a search under a clock rather than a reaction test.
 * Setting a pin in the wrong place snaps the pick.
 */

const HALF_TURN = 180;

/** Smallest angle between two headings, either way around. */
function gap(a: number, b: number): number {
    const raw = Math.abs(((a - b) % 360 + 360) % 360);

    return raw > HALF_TURN ? 360 - raw : raw;
}

export default function LOCKPICK({ config, finish }: { config: MinigameConfig; finish: (success: boolean) => void }) {
    const pins = Math.max(1, Math.min(6, config.rounds ?? 3));
    const baseZone = Math.max(8, Math.min(80, config.zone ?? 34));
    const time = Math.max(10, config.time ?? 25);
    const turn = Math.max(40, config.speed ?? 150);
    // A and D turn the cylinder, so neither can also be the set key.
    const asked = useKeySequence(config.keys)(0);
    const key = asked === 'A' || asked === 'D' ? 'E' : asked;

    const angle = useRef(0);
    const spot = useRef(Math.random() * 360);
    const zone = useRef(baseZone);
    const left = useRef(time);
    const phase = useRef<'play' | 'over'>('play');

    const held = useHeldKeys();

    const [set, setSet] = useState<number[]>([]);
    const [verdict, setVerdict] = useState<Verdict>(null);
    const [, redraw] = useState(0);

    const end = (success: boolean) => {
        if (phase.current === 'over') return;

        phase.current = 'over';
        setVerdict(success ? 'won' : 'lost');
        setTimeout(() => finish(success), 520);
    };

    useRafLoop((delta) => {
        if (phase.current !== 'play') return;

        left.current -= delta;

        if (left.current <= 0) return end(false);

        const back = held.current.has('A') || held.current.has('ARROWLEFT');
        const forward = held.current.has('D') || held.current.has('ARROWRIGHT');

        if (back !== forward) angle.current = (angle.current + (forward ? turn : -turn) * delta + 360) % 360;

        redraw((tick) => tick + 1);
    });

    useGameKeys((incoming) => {
        if (phase.current !== 'play') return;
        if (incoming === 'ESCAPE') return end(false);
        if (incoming !== key) return;

        if (gap(angle.current, spot.current) > zone.current / 2) return end(false);

        const done = [...set, angle.current];

        if (done.length >= pins) return end(true);

        // The next pin hides somewhere the pick is not already sitting, so a
        // player cannot fall into it without turning.
        let next = Math.random() * 360;
        while (gap(next, angle.current) < 60) next = Math.random() * 360;

        spot.current = next;
        zone.current = Math.max(8, zone.current * 0.85);
        setSet(done);
    });

    const tension = Math.max(0, 1 - gap(angle.current, spot.current) / 90);
    const glow = verdict === 'lost' ? '#f43f5e' : verdict === 'won' ? '#34d399' : tension > 0.75 ? '#34d399' : tension > 0.4 ? '#fbbf24' : '#ffffff';

    const point = (degrees: number, radius: number) => ({
        x: 50 + Math.sin((degrees * Math.PI) / 180) * radius,
        y: 50 - Math.cos((degrees * Math.PI) / 180) * radius,
    });

    const tip = point(angle.current, 38);

    return (
        <GameShell
            title="Lock"
            accent="Pick"
            subtitle={`${set.length} / ${pins} pins set`}
            verdict={verdict}
            footer={<TimerBar fraction={left.current / time} />}
        >
            <div className="relative h-[34vh] w-[34vh]">
                <svg viewBox="0 0 100 100" className="h-full w-full overflow-visible">
                    <circle cx="50" cy="50" r="42" fill="rgba(8,8,10,0.8)" strokeWidth="1.2" className="stroke-white/10" />
                    <circle cx="50" cy="50" r="30" fill="none" strokeWidth="0.6" className="stroke-white/[0.06]" />

                    {/* Notches, so the turn reads as movement rather than drift. */}
                    {Array.from({ length: 24 }, (_, index) => {
                        const at = index * 15;
                        const inner = point(at, 42);
                        const outer = point(at, index % 6 === 0 ? 46 : 44);

                        return (
                            <line
                                key={`notch_${index}`}
                                x1={inner.x}
                                y1={inner.y}
                                x2={outer.x}
                                y2={outer.y}
                                strokeWidth="0.7"
                                className={index % 6 === 0 ? 'stroke-white/25' : 'stroke-white/10'}
                            />
                        );
                    })}

                    {/* Pins already set stay marked — the route back is earned. */}
                    {set.map((at, index) => {
                        const dot = point(at, 42);

                        return (
                            <circle
                                key={`pin_${index}`}
                                cx={dot.x}
                                cy={dot.y}
                                r="2.4"
                                fill="#34d399"
                                style={{ filter: 'drop-shadow(0 0 0.7vh #34d399)' }}
                            />
                        );
                    })}

                    <line
                        x1="50"
                        y1="50"
                        x2={tip.x}
                        y2={tip.y}
                        strokeWidth="1.8"
                        strokeLinecap="round"
                        stroke={glow}
                        style={{ filter: `drop-shadow(0 0 ${0.4 + tension * 1.4}vh ${glow})` }}
                    />

                    <circle cx="50" cy="50" r={3 + tension * 2.2} fill={glow} opacity={0.35 + tension * 0.5} />
                </svg>
            </div>

            <div className="flex w-full items-center gap-[1.4vh]">
                <Keycap label={key} state={verdict === 'lost' ? 'wrong' : verdict === 'won' ? 'done' : 'active'} />

                <div className="flex min-w-0 flex-1 flex-col gap-[0.8vh]">
                    <div className="h-[1vh] w-full overflow-hidden rounded-full bg-white/10">
                        <div className="h-full rounded-full transition-none" style={{ width: `${tension * 100}%`, background: glow, boxShadow: `0 0 1vh ${glow}` }} />
                    </div>

                    <RoundBar total={pins} done={set.length} verdict={verdict} />
                </div>

                <span className="shrink-0 font-mono text-[1.3vh] font-semibold uppercase tracking-widest text-white/35">A / D turn</span>
            </div>
        </GameShell>
    );
}
