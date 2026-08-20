import { useRef, useState } from 'react';
import type { MinigameConfig } from '@/data/useMinigames';
import { FloatShell, Keycap, RoundBar, TimerBar, useGameKeys, useHeldKeys, useKeySequence, usePainted, useRafLoop, type Verdict } from './parts';

/**
 * Hold the key to raise the pressure, let go inside the band. Overshooting the
 * top blows it, and so does releasing anywhere else — the only control is when
 * you stop, which makes it read very differently from the games you tap.
 */

type Round = { bandAt: number; bandWidth: number };

export default function HOLD({ config, finish }: { config: MinigameConfig; finish: (success: boolean) => void }) {
    const rounds = Math.max(1, config.rounds ?? 3);
    const baseBand = Math.max(4, Math.min(40, config.zone ?? 18));
    const time = Math.max(3, config.time ?? 8);
    const keyFor = useKeySequence(config.keys);

    const value = useRef(0);
    const left = useRef(time);
    const wasHeld = useRef(false);
    // The interaction that opened this was very likely a key press of its own.
    // Nothing counts until the key has been seen up, or a player still holding
    // it from the trigger starts filling before the game has drawn.
    const armed = useRef(false);
    const speed = useRef(Math.max(10, config.speed ?? 55));
    const phase = useRef<'play' | 'over'>('play');

    const painted = usePainted(value.current);

    const held = useHeldKeys();

    // Never against either end: a band at the very bottom is a tap, and one at
    // the very top is a hold until it blows.
    const makeRound = (width: number): Round => ({
        bandAt: 14 + Math.random() * (86 - width - 14),
        bandWidth: width,
    });

    const [round, setRound] = useState<Round>(() => makeRound(baseBand));
    const [cleared, setCleared] = useState(0);
    const [verdict, setVerdict] = useState<Verdict>(null);
    const [, redraw] = useState(0);

    const end = (success: boolean) => {
        if (phase.current === 'over') return;

        phase.current = 'over';
        setVerdict(success ? 'won' : 'lost');
        setTimeout(() => finish(success), 420);
    };

    const release = () => {
        // Judged on the fill the player can see, not the one the frame loop has
        // already pushed past.
        const at = painted.current;
        const inside = at >= round.bandAt && at <= round.bandAt + round.bandWidth;

        if (!inside) return end(false);

        const done = cleared + 1;

        if (done >= rounds) return end(true);

        value.current = 0;
        speed.current *= 1.1;
        setCleared(done);
        setRound(makeRound(Math.max(4, baseBand * (1 - done * 0.16))));
    };

    useRafLoop((delta) => {
        if (phase.current !== 'play') return;

        left.current -= delta;

        if (left.current <= 0) return end(false);

        const wanted = keyFor(cleared);
        const down = held.current.has(wanted) && armed.current;

        if (!held.current.has(wanted)) armed.current = true;

        if (down) {
            value.current = Math.min(100, value.current + speed.current * delta);

            if (value.current >= 100) return end(false);
        } else if (wasHeld.current) {
            release();
        }

        wasHeld.current = down;

        redraw((tick) => tick + 1);
    });

    useGameKeys((incoming) => {
        if (phase.current !== 'play') return;
        if (incoming === 'ESCAPE') return end(false);
    });

    const key = keyFor(cleared);

    const bandClass =
        verdict === 'lost'
            ? 'border-[#f43f5e]/80 bg-[#f43f5e]/25 gg-glow-err'
            : verdict === 'won'
              ? 'border-[#34d399]/80 bg-[#34d399]/25 gg-glow-ok'
              : 'border-primary/80 bg-primary/25 gg-glow';

    return (
        <FloatShell>
            <div className="flex items-end gap-[1.6vh]">
                <div
                    className="relative h-[24vh] w-[5.4vh] overflow-hidden rounded-[1vh] bg-neutral-950/85"
                    style={{ boxShadow: 'inset 0 0.3vh 0.9vh rgba(0,0,0,0.8)' }}
                >
                    <div
                        className={`absolute inset-x-0 rounded-[0.5vh] border-[0.2vh] ${bandClass}`}
                        style={{ bottom: `${round.bandAt}%`, height: `${round.bandWidth}%` }}
                    />

                    <div
                        className={`absolute inset-x-[0.5vh] bottom-0 rounded-t-[0.4vh] ${verdict === 'lost' ? 'bg-[#f43f5e]/70 gg-glow-err' : 'bg-white/80 gg-glow'}`}
                        style={{ height: `${value.current}%` }}
                    />
                </div>

                <div className="flex flex-col items-center gap-[1vh]">
                    <Keycap label={key} state={verdict === 'lost' ? 'wrong' : verdict === 'won' ? 'done' : value.current > 0 ? 'active' : 'idle'} big />
                    <span className="text-[1.3vh] font-semibold uppercase tracking-widest text-white/35">Hold</span>
                </div>
            </div>

            <div className="flex w-[30vh] flex-col gap-[0.9vh]">
                <RoundBar total={rounds} done={cleared + (verdict === 'won' ? 1 : 0)} verdict={verdict} />
                <TimerBar fraction={left.current / time} />
            </div>
        </FloatShell>
    );
}
