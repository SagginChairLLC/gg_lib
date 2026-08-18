import { useMemo, useRef, useState } from 'react';
import type { MinigameConfig } from '@/data/useMinigames';
import { pickPuzzle, type Cell } from '@/data/connectPuzzles';
import { GameShell, TimerBar, useGameKeys, useRafLoop, type Verdict } from './parts';

/**
 * Connect every pair of matching dots by dragging a wire between them, ported
 * from the electrician job. Wires cannot cross; releasing early drops the
 * wire; clicking a finished pair's dot rips its wire back out.
 *
 * Cells are DOM for pointer tracking; the wires are one SVG overlay drawing a
 * glowing polyline per pair through the cell centers.
 */

const PAIR_COLORS = ['rgb(var(--primary))', '#34d399', '#38bdf8', '#a78bfa', '#fb7185', '#fbbf24'];

const keyOf = (cell: Cell) => `${cell[0]}:${cell[1]}`;

const adjacent = (a: Cell, b: Cell) => Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) === 1;

export default function CONNECT({ config, finish }: { config: MinigameConfig; finish: (success: boolean) => void }) {
    const time = Math.max(5, config.time ?? 45);

    const puzzle = useMemo(() => pickPuzzle(Math.max(3, Math.min(6, config.pairs ?? 4))), [config.pairs]);
    const size = puzzle.size;

    // Only the endpoints reach the player; the stored paths stay the author's
    // proof that the layout is solvable.
    const dots = useMemo(() => {
        const map = new Map<string, number>();

        puzzle.paths.forEach((path, pair) => {
            map.set(keyOf(path[0]), pair);
            map.set(keyOf(path[path.length - 1]), pair);
        });

        return map;
    }, [puzzle]);

    const [wires, setWires] = useState<(Cell[] | null)[]>(() => puzzle.paths.map(() => null));
    const [verdict, setVerdict] = useState<Verdict>(null);

    const drag = useRef<{ pair: number; path: Cell[] } | null>(null);
    const left = useRef(time);
    const phase = useRef<'play' | 'over'>('play');
    const [, redraw] = useState(0);

    const board = 46;
    const tile = board / size;

    const end = (success: boolean) => {
        if (phase.current === 'over') return;

        phase.current = 'over';
        drag.current = null;
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

    /** Cells claimed by finished wires or the wire being dragged, minus one pair. */
    const blocked = (except: number): Set<string> => {
        const taken = new Set<string>();

        wires.forEach((wire, pair) => {
            if (pair !== except && wire) wire.forEach((cell) => taken.add(keyOf(cell)));
        });

        dots.forEach((pair, key) => {
            if (pair !== except) taken.add(key);
        });

        return taken;
    };

    const press = (cell: Cell) => {
        if (phase.current !== 'play') return;

        const pair = dots.get(keyOf(cell));
        if (pair === undefined) return;

        // A finished wire is ripped out by grabbing either of its dots.
        if (wires[pair]) {
            setWires((current) => current.map((wire, index) => (index === pair ? null : wire)));
        }

        drag.current = { pair, path: [cell] };
        redraw((tick) => tick + 1);
    };

    const enter = (cell: Cell) => {
        const active = drag.current;
        if (!active || phase.current !== 'play') return;

        const path = active.path;
        const head = path[path.length - 1];
        const key = keyOf(cell);

        // Sliding back along the wire pulls it in.
        if (path.length > 1 && keyOf(path[path.length - 2]) === key) {
            active.path = path.slice(0, -1);
            return redraw((tick) => tick + 1);
        }

        if (!adjacent(head, cell)) return;
        if (path.some((step) => keyOf(step) === key)) return;
        if (blocked(active.pair).has(key)) return;

        const dotHere = dots.get(key);

        // Reaching the partner dot locks the wire in.
        if (dotHere === active.pair && keyOf(active.path[0]) !== key) {
            const done = [...path, cell];
            drag.current = null;

            setWires((current) => {
                const next = current.map((wire, index) => (index === active.pair ? done : wire));

                if (next.every((wire) => wire !== null)) end(true);

                return next;
            });
            return;
        }

        if (dotHere !== undefined) return;

        active.path = [...path, cell];
        redraw((tick) => tick + 1);
    };

    const release = () => {
        if (!drag.current) return;

        drag.current = null;
        redraw((tick) => tick + 1);
    };

    const center = (cell: Cell) => ({ x: (cell[1] + 0.5) * tile, y: (cell[0] + 0.5) * tile });

    const wirePoints = (path: Cell[]) => path.map((cell) => {
        const at = center(cell);
        return `${at.x},${at.y}`;
    }).join(' ');

    const colorOf = (pair: number) => PAIR_COLORS[pair % PAIR_COLORS.length];

    const done = wires.filter(Boolean).length;

    return (
        <GameShell
            title="Connect"
            accent="Circuits"
            subtitle={`${done} / ${puzzle.paths.length} circuits live`}
            verdict={verdict}
            footer={<TimerBar fraction={left.current / time} />}
        >
            <div
                className="relative touch-none select-none"
                style={{ width: `${board}vh`, height: `${board}vh` }}
                onPointerUp={release}
                onPointerLeave={release}
            >
                {/* The cells: hit targets and the faint circuit-board grid. */}
                <div className="absolute inset-0 grid" style={{ gridTemplateColumns: `repeat(${size}, minmax(0, 1fr))` }}>
                    {Array.from({ length: size * size }, (_, index) => {
                        const cell: Cell = [Math.floor(index / size), index % size];

                        return (
                            <div
                                key={index}
                                className="gg-tile-in rounded-[0.6vh] border border-white/[0.06] bg-neutral-900/60"
                                style={{ margin: '0.35vh', animationDelay: `${(cell[0] + cell[1]) * 30}ms` }}
                                onPointerDown={() => press(cell)}
                                onPointerEnter={() => enter(cell)}
                            />
                        );
                    })}
                </div>

                {/* The wires and dots, drawn over the top. */}
                <svg
                    viewBox={`0 0 ${board} ${board}`}
                    className="pointer-events-none absolute inset-0 h-full w-full overflow-visible"
                >
                    {wires.map((wire, pair) =>
                        wire ? (
                            <polyline
                                key={`wire_${pair}`}
                                points={wirePoints(wire)}
                                fill="none"
                                stroke={verdict === 'lost' ? '#f87171' : colorOf(pair)}
                                strokeWidth={tile * 0.32}
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                opacity={0.85}
                                style={{ filter: `drop-shadow(0 0 0.6vh ${verdict === 'lost' ? '#f87171' : colorOf(pair)})` }}
                            />
                        ) : null,
                    )}

                    {drag.current && drag.current.path.length > 0 && (
                        <polyline
                            points={wirePoints(drag.current.path)}
                            fill="none"
                            stroke={colorOf(drag.current.pair)}
                            strokeWidth={tile * 0.32}
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            opacity={0.6}
                            style={{ filter: `drop-shadow(0 0 0.6vh ${colorOf(drag.current.pair)})` }}
                        />
                    )}

                    {[...dots.entries()].map(([key, pair]) => {
                        const [row, col] = key.split(':').map(Number);
                        const at = center([row, col]);
                        const lit = wires[pair] !== null || drag.current?.pair === pair;

                        return (
                            <circle
                                key={`dot_${key}`}
                                cx={at.x}
                                cy={at.y}
                                r={tile * 0.26}
                                fill={colorOf(pair)}
                                opacity={lit ? 1 : 0.75}
                                style={{ filter: `drop-shadow(0 0 ${lit ? '0.9vh' : '0.4vh'} ${colorOf(pair)})` }}
                            />
                        );
                    })}
                </svg>
            </div>
        </GameShell>
    );
}
