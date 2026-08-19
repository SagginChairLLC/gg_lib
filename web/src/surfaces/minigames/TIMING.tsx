import { useRef, useState } from 'react';
import type { MinigameConfig } from '@/data/useMinigames';
import { FloatShell, Keycap, RoundBar, keyPool, randomKey, useGameKeys, useRafLoop, type Verdict } from './parts';

/**
 * A marker sweeps the bar once; stop it inside the glowing zone. Reaching the
 * end without pressing fails, and every cleared round shrinks the zone and
 * speeds the sweep. Floating like the skill check — a wide track, no card.
 */

type Round = { zoneAt: number; zoneWidth: number };

export default function TIMING({ config, finish }: { config: MinigameConfig; finish: (success: boolean) => void }) {
    const rounds = Math.max(1, config.rounds ?? 3);
    const baseZone = Math.max(4, Math.min(40, config.zone ?? 16));
    const [key] = useState(() => randomKey(keyPool(config.keys)));

    const position = useRef(0);
    const speed = useRef(Math.max(0.3, config.speed ?? 0.7));
    const phase = useRef<'play' | 'over'>('play');

    const makeRound = (width: number): Round => ({
        // Never flush against either end: an instant-press or last-frame zone is
        // luck, not skill.
        zoneAt: 12 + Math.random() * (88 - width - 12),
        zoneWidth: width,
    });

    const [round, setRound] = useState<Round>(() => makeRound(baseZone));
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

        position.current += speed.current * 100 * delta;

        if (position.current >= 100) end(false);

        redraw((tick) => tick + 1);
    });

    useGameKeys((incoming) => {
        if (phase.current !== 'play') return;
        if (incoming === 'ESCAPE') return end(false);
        if (incoming !== key) return end(false);

        const inside = position.current >= round.zoneAt && position.current <= round.zoneAt + round.zoneWidth;
        if (!inside) return end(false);

        const done = cleared + 1;

        if (done >= rounds) return end(true);

        setCleared(done);
        position.current = 0;
        speed.current *= 1.08;
        setRound(makeRound(Math.max(4, baseZone * (1 - done * 0.18))));
    });

    const zoneClass =
        verdict === 'lost'
            ? 'border-[#f43f5e]/80 bg-[#f43f5e]/25 gg-glow-err'
            : verdict === 'won'
              ? 'border-[#34d399]/80 bg-[#34d399]/25 gg-glow-ok'
              : 'border-primary/80 bg-primary/25 gg-glow';

    return (
        <FloatShell>
            <div className="relative h-[3.4vh] w-[42vh] overflow-visible rounded-full bg-neutral-950/85" style={{ boxShadow: 'inset 0 0.3vh 0.8vh rgba(0,0,0,0.8)' }}>
                <div
                    className={`absolute top-[0.4vh] h-[2.6vh] rounded-[0.6vh] border-[0.2vh] ${zoneClass}`}
                    style={{ left: `${round.zoneAt}%`, width: `${round.zoneWidth}%` }}
                />

                <div
                    className={`absolute top-[-0.6vh] h-[4.6vh] w-[0.5vh] rounded-full ${verdict === 'lost' ? 'bg-[#f43f5e] gg-glow-err' : 'bg-white gg-glow'}`}
                    style={{ left: `calc(${Math.min(position.current, 100)}% - 0.25vh)` }}
                />
            </div>

            <div className="flex w-[42vh] items-center gap-[1.4vh]">
                <Keycap label={key} state={verdict === 'lost' ? 'wrong' : verdict === 'won' ? 'done' : 'active'} />
                <RoundBar total={rounds} done={cleared + (verdict === 'won' ? 1 : 0)} verdict={verdict} />
            </div>
        </FloatShell>
    );
}
