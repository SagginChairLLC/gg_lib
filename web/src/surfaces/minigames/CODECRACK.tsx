import { useMemo, useRef, useState } from 'react';
import type { MinigameConfig } from '@/data/useMinigames';
import { GameShell, TimerBar, useGameKeys, useRafLoop, type Verdict } from './parts';

/**
 * Guess the code. Every submitted row comes back marked: green where the digit
 * is right and in the right slot, amber where the digit is in the code but not
 * there, dark where it is not in the code at all. No digit repeats, which is
 * what makes a few guesses enough to reason it out.
 */

const DIGITS = ['1', '2', '3', '4', '5', '6'];

type Mark = 'exact' | 'near' | 'miss';

function makeSecret(length: number): string[] {
    const bag = [...DIGITS];

    for (let index = bag.length - 1; index > 0; index -= 1) {
        const swap = Math.floor(Math.random() * (index + 1));
        [bag[index], bag[swap]] = [bag[swap], bag[index]];
    }

    return bag.slice(0, length);
}

/** Exacts first, then leftovers, so a repeated guess digit cannot double-count. */
function markGuess(guess: string[], secret: string[]): Mark[] {
    const marks: Mark[] = guess.map(() => 'miss');
    const spare = secret.map((digit, index) => (guess[index] === digit ? null : digit));

    guess.forEach((digit, index) => {
        if (digit === secret[index]) marks[index] = 'exact';
    });

    guess.forEach((digit, index) => {
        if (marks[index] === 'exact') return;

        const at = spare.indexOf(digit);

        if (at === -1) return;

        spare[at] = null;
        marks[index] = 'near';
    });

    return marks;
}

const MARK_CLASS: Record<Mark, string> = {
    exact: 'border-[#34d399]/80 bg-[#34d399]/20 text-[#34d399] gg-glow-ok',
    near: 'border-[#fbbf24]/70 bg-[#fbbf24]/15 text-[#fbbf24]',
    miss: 'border-white/10 bg-neutral-950/70 text-white/25',
};

export default function CODECRACK({ config, finish }: { config: MinigameConfig; finish: (success: boolean) => void }) {
    const length = Math.max(3, Math.min(5, config.length ?? 4));
    const attempts = Math.max(2, Math.min(8, config.rounds ?? 5));
    const time = Math.max(15, config.time ?? 45);

    const secret = useMemo(() => makeSecret(length), [length]);

    const [rows, setRows] = useState<{ guess: string[]; marks: Mark[] }[]>([]);
    const [typed, setTyped] = useState<string[]>([]);
    const [verdict, setVerdict] = useState<Verdict>(null);

    const left = useRef(time);
    const phase = useRef<'play' | 'over'>('play');
    const [, redraw] = useState(0);

    const end = (success: boolean) => {
        if (phase.current === 'over') return;

        phase.current = 'over';
        setVerdict(success ? 'won' : 'lost');
        setTimeout(() => finish(success), 620);
    };

    useRafLoop((delta) => {
        if (phase.current !== 'play') return;

        left.current -= delta;

        if (left.current <= 0) end(false);

        redraw((tick) => tick + 1);
    });

    const submit = () => {
        if (typed.length < length) return;

        const marks = markGuess(typed, secret);
        const next = [...rows, { guess: typed, marks }];

        setRows(next);
        setTyped([]);

        if (marks.every((mark) => mark === 'exact')) return end(true);
        if (next.length >= attempts) return end(false);
    };

    useGameKeys((incoming) => {
        if (phase.current !== 'play') return;
        if (incoming === 'ESCAPE') return end(false);
        if (incoming === 'BACKSPACE') return setTyped((current) => current.slice(0, -1));
        if (incoming === 'ENTER') return submit();
        if (!DIGITS.includes(incoming)) return;

        setTyped((current) => (current.length >= length ? current : [...current, incoming]));
    });

    const slot = 'flex h-[5vh] w-[5vh] items-center justify-center rounded-[0.7vh] border-[0.2vh] font-mono text-[2.4vh] font-black';

    return (
        <GameShell
            title="Code"
            accent="Cracker"
            subtitle={`${attempts - rows.length} guesses left`}
            verdict={verdict}
            footer={<TimerBar fraction={left.current / time} />}
        >
            <div className="flex flex-col gap-[0.7vh]">
                {Array.from({ length: attempts }, (_, row) => {
                    const past = rows[row];
                    const live = !past && row === rows.length && phase.current === 'play';

                    return (
                        <div key={`row_${row}`} className="flex gap-[0.7vh]">
                            {Array.from({ length }, (_, index) => {
                                if (past) {
                                    return (
                                        <span key={index} className={`${slot} ${MARK_CLASS[past.marks[index]]}`}>
                                            {past.guess[index]}
                                        </span>
                                    );
                                }

                                const filled = live ? typed[index] : undefined;
                                const caret = live && index === typed.length;

                                return (
                                    <span
                                        key={index}
                                        className={`${slot} ${
                                            filled
                                                ? 'border-primary/70 bg-primary/10 text-white'
                                                : caret
                                                  ? 'border-primary/70 bg-primary/[0.06] text-white/20 gg-pulse'
                                                  : 'border-dashed border-white/10 text-white/10'
                                        }`}
                                    >
                                        {filled ?? '·'}
                                    </span>
                                );
                            })}
                        </div>
                    );
                })}
            </div>

            <div className="flex w-full items-center justify-between gap-[1.4vh]">
                <span className="font-mono text-[1.3vh] font-semibold uppercase tracking-widest text-white/35">1–6 · enter · backspace</span>

                {verdict === 'lost' && (
                    <span className="flex items-center gap-[0.6vh] font-mono text-[1.5vh] font-black tracking-[0.3em] text-[#f43f5e] gg-glow-err">{secret.join('')}</span>
                )}
            </div>
        </GameShell>
    );
}
