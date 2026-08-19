import { useMemo, useRef, useState } from 'react';
import type { MinigameConfig } from '@/data/useMinigames';
import { GameShell, TimerBar, useGameKeys, useRafLoop, type Verdict } from './parts';

/**
 * Pull the target sequence out of the matrix. The first pick comes from the top
 * row; after that the lock alternates — a pick locks its column, the next locks
 * its row — so the route matters as much as the codes. The sequence has to land
 * in the buffer back to back, and the buffer is two picks longer than it needs
 * to be, which is the whole margin for error.
 */

const CODES = ['1C', '55', 'BD', 'E9', '7A', 'FF'];

type Lock = { axis: 'row' | 'col'; index: number };

const cellKey = (row: number, col: number) => `${row}:${col}`;

/** A grid plus a sequence walked out of it, so there is always a route. */
function buildPuzzle(size: number, length: number) {
    const grid = Array.from({ length: size }, () => Array.from({ length: size }, () => CODES[Math.floor(Math.random() * CODES.length)]));

    let best: string[] = [];

    for (let attempt = 0; attempt < 40; attempt += 1) {
        const used = new Set<string>();
        const sequence: string[] = [];

        let row = 0;
        let col = Math.floor(Math.random() * size);
        let axis: 'row' | 'col' = 'col';

        used.add(cellKey(row, col));
        sequence.push(grid[row][col]);

        while (sequence.length < length) {
            const open: [number, number][] = [];

            for (let index = 0; index < size; index += 1) {
                const next: [number, number] = axis === 'col' ? [index, col] : [row, index];

                if (!used.has(cellKey(next[0], next[1]))) open.push(next);
            }

            if (open.length === 0) break;

            [row, col] = open[Math.floor(Math.random() * open.length)];
            used.add(cellKey(row, col));
            sequence.push(grid[row][col]);
            axis = axis === 'col' ? 'row' : 'col';
        }

        if (sequence.length === length) return { grid, sequence };
        if (sequence.length > best.length) best = sequence;
    }

    // No walk reached the full length, which a grid this size should never
    // manage. The longest one that did is still a route, so the puzzle stands.
    return { grid, sequence: best };
}

export default function BREACH({ config, finish }: { config: MinigameConfig; finish: (success: boolean) => void }) {
    const size = Math.max(4, Math.min(6, config.size ?? 5));
    const length = Math.max(3, Math.min(6, config.length ?? 4));
    const time = Math.max(10, config.time ?? 30);
    const slots = length + 2;

    const puzzle = useMemo(() => buildPuzzle(size, length), [size, length]);

    const [buffer, setBuffer] = useState<string[]>([]);
    const [used, setUsed] = useState<Set<string>>(() => new Set());
    const [lock, setLock] = useState<Lock>({ axis: 'row', index: 0 });
    const [verdict, setVerdict] = useState<Verdict>(null);

    const left = useRef(time);
    const phase = useRef<'play' | 'over'>('play');
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

        if (left.current <= 0) end(false);

        redraw((tick) => tick + 1);
    });

    useGameKeys((incoming) => {
        if (incoming === 'ESCAPE' && phase.current !== 'over') end(false);
    });

    const selectable = (row: number, col: number) => {
        if (phase.current !== 'play') return false;
        if (used.has(cellKey(row, col))) return false;

        return lock.axis === 'row' ? row === lock.index : col === lock.index;
    };

    const pick = (row: number, col: number) => {
        if (!selectable(row, col)) return;

        const next = [...buffer, puzzle.grid[row][col]];
        const spent = new Set(used).add(cellKey(row, col));
        const nextLock: Lock = lock.axis === 'row' ? { axis: 'col', index: col } : { axis: 'row', index: row };

        setBuffer(next);
        setUsed(spent);
        setLock(nextLock);

        if (next.join('|').includes(puzzle.sequence.join('|'))) return end(true);
        if (next.length >= slots) return end(false);

        // A line with nothing left in it is a dead end. Ending here beats
        // leaving the player clicking at a board that cannot answer.
        const open = Array.from({ length: size }, (_, index) =>
            nextLock.axis === 'row' ? cellKey(nextLock.index, index) : cellKey(index, nextLock.index),
        ).some((at) => !spent.has(at));

        if (!open) return end(false);
    };

    // How much of the sequence the tail of the buffer already spells. Only a
    // run that reaches the end of the buffer can still grow into the answer.
    const progress = useMemo(() => {
        for (let run = Math.min(buffer.length, puzzle.sequence.length); run > 0; run -= 1) {
            if (buffer.slice(-run).join('|') === puzzle.sequence.slice(0, run).join('|')) return run;
        }

        return 0;
    }, [buffer, puzzle.sequence]);

    const tile = 46 / size;

    return (
        <GameShell
            title="Breach"
            accent="Protocol"
            subtitle={`${buffer.length} / ${slots} buffer`}
            verdict={verdict}
            footer={<TimerBar fraction={left.current / time} />}
        >
            <div className="flex w-full flex-col gap-[0.7vh]">
                <span className="text-[1.2vh] font-semibold uppercase tracking-widest text-white/30">Sequence</span>

                <div className="flex gap-[0.6vh]">
                    {puzzle.sequence.map((code, index) => (
                        <span
                            key={`want_${index}`}
                            className={`flex h-[3.4vh] min-w-[4.6vh] items-center justify-center rounded-[0.5vh] border-[0.18vh] font-mono text-[1.6vh] font-black tracking-wider transition-colors ${
                                verdict === 'won' || index < progress
                                    ? 'border-[#34d399]/70 bg-[#34d399]/15 text-[#34d399] gg-glow-ok'
                                    : verdict === 'lost'
                                      ? 'border-[#f43f5e]/50 bg-[#f43f5e]/10 text-[#f43f5e]/70'
                                      : 'border-white/15 bg-neutral-900/70 text-white/55'
                            }`}
                        >
                            {code}
                        </span>
                    ))}
                </div>
            </div>

            <div className="flex w-full flex-col gap-[0.7vh]">
                <span className="text-[1.2vh] font-semibold uppercase tracking-widest text-white/30">Buffer</span>

                <div className="flex gap-[0.6vh]">
                    {Array.from({ length: slots }, (_, index) => (
                        <span
                            key={`slot_${index}`}
                            className={`flex h-[3.4vh] min-w-[4.6vh] items-center justify-center rounded-[0.5vh] border-[0.18vh] font-mono text-[1.6vh] font-black tracking-wider ${
                                buffer[index] ? 'border-primary/60 bg-primary/10 text-primary gg-glow' : 'border-dashed border-white/10 text-white/15'
                            }`}
                        >
                            {buffer[index] ?? '··'}
                        </span>
                    ))}
                </div>
            </div>

            <div className="grid gap-[0.5vh]" style={{ gridTemplateColumns: `repeat(${size}, ${tile}vh)` }}>
                {puzzle.grid.map((line, row) =>
                    line.map((code, col) => {
                        const spent = used.has(cellKey(row, col));
                        const open = selectable(row, col);
                        const lit = phase.current === 'play' && (lock.axis === 'row' ? row === lock.index : col === lock.index);

                        return (
                            <button
                                key={cellKey(row, col)}
                                type="button"
                                onClick={() => pick(row, col)}
                                disabled={!open}
                                className={`gg-tile-in flex items-center justify-center rounded-[0.6vh] border-[0.18vh] font-mono text-[1.7vh] font-black tracking-wider transition-colors ${
                                    spent
                                        ? 'border-white/[0.06] bg-neutral-950/70 text-white/15'
                                        : open
                                          ? 'cursor-pointer border-primary/60 bg-primary/10 text-white hover:bg-primary/25 gg-glow'
                                          : lit
                                            ? 'border-white/15 bg-neutral-900/70 text-white/45'
                                            : 'border-white/[0.06] bg-neutral-900/40 text-white/25'
                                }`}
                                style={{ height: `${tile}vh`, animationDelay: `${(row + col) * 25}ms` }}
                            >
                                {code}
                            </button>
                        );
                    }),
                )}
            </div>
        </GameShell>
    );
}
