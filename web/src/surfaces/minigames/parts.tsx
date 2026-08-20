import { useEffect, useRef, useState } from 'react';

/**
 * The design system every game is assembled from. Two presentations share it:
 * floating games (no card at all — glowing elements lifted off the scene) and
 * board games (a soft dark pool with a two-tone header, no hard card edges).
 */

//--------------------------------------------------
// MARK: Result colours
//--------------------------------------------------
/**
 * One green and one red for every game, so a win reads the same in the memory
 * grid as it does in a skill check. Kept as hex as well as classes because the
 * SVG games need a value rather than a utility.
 */

export const RESULT = {
    ok: '#34d399',
    fail: '#f43f5e',
    /** Half right — a digit in the code but in the wrong slot, and the like. */
    near: '#fbbf24',
} as const;

// The classes below are written out rather than built from RESULT: Tailwind
// reads them out of the source, and a name assembled at runtime is never
// compiled. Change these together with the values above.

//--------------------------------------------------
// MARK: Input
//--------------------------------------------------

export function normaliseKey(key: string): string {
    if (key === ' ') return 'SPACE';

    return key.toUpperCase();
}

/**
 * Keys a prompt falls back to when the caller named none: the cluster under the
 * left hand, where a player's fingers already are. Small on purpose — a prompt
 * has to be answered without looking down, which rules out the far letters and
 * the digit row.
 */
const KEY_POOL = 'EWASDQRF'.split('');

/**
 * The keys a game may prompt with. A caller naming its own wins; naming none
 * means the fallback cluster. Whichever it is, a game draws from it ONCE when
 * it starts -- draw during a render and the prompt changes every frame.
 */
export function keyPool(keys?: string[]): string[] {
    const named = (keys ?? []).map(normaliseKey).filter((key) => key !== '');

    return named.length > 0 ? named : KEY_POOL;
}

/**
 * The key each round asks for.
 *
 * One key means that key every round. Several means a sequence: the first
 * round asks for the first, the second for the second, wrapping if there are
 * more rounds than keys. That is what a list of keys means to anyone who has
 * met one before.
 *
 * Nothing given means E. A script that wants otherwise says so.
 */
export function useKeySequence(keys?: string[]) {
    const [sequence] = useState(() => {
        const named = (keys ?? []).map(normaliseKey).filter((key) => key !== '');

        return named.length > 0 ? named : ['E'];
    });

    return (round: number) => sequence[Math.max(0, round) % sequence.length];
}

/**
 * The value the player is actually looking at.
 *
 * These games move in the frame loop and paint on the render after it, so the
 * number the loop holds is always a step ahead of the screen. Judging a press
 * against it marks people wrong for what they were never shown. Assigned
 * during render, so it holds exactly what is on the glass.
 */
export function usePainted(value: number) {
    const painted = useRef(value);

    painted.current = value;

    return painted;
}

export function randomKey(pool: string[]): string {
    return pool[Math.floor(Math.random() * pool.length)];
}

/**
 * Captures the keyboard for the life of the game. Registered in the capture
 * phase and stopping propagation, so the editor's own Escape handling never
 * sees a press meant for the game.
 */
export function useGameKeys(handler: (key: string, event: KeyboardEvent) => void) {
    const latest = useRef(handler);
    latest.current = handler;

    useEffect(() => {
        const onKey = (event: KeyboardEvent) => {
            if (event.repeat) return;

            event.preventDefault();
            event.stopPropagation();

            latest.current(normaliseKey(event.key), event);
        };

        window.addEventListener('keydown', onKey, true);
        return () => window.removeEventListener('keydown', onKey, true);
    }, []);
}

/**
 * The keys held down right now, for the games driven by holding rather than
 * tapping. A ref rather than state: the frame loop reads it, and re-rendering
 * on every press would fight the loop for frames. Cleared on blur, because a
 * window that loses focus never delivers the keyup.
 */
export function useHeldKeys() {
    const held = useRef<Set<string>>(new Set());

    useEffect(() => {
        const down = (event: KeyboardEvent) => held.current.add(normaliseKey(event.key));
        const up = (event: KeyboardEvent) => held.current.delete(normaliseKey(event.key));
        const clear = () => held.current.clear();

        window.addEventListener('keydown', down, true);
        window.addEventListener('keyup', up, true);
        window.addEventListener('blur', clear);

        return () => {
            window.removeEventListener('keydown', down, true);
            window.removeEventListener('keyup', up, true);
            window.removeEventListener('blur', clear);
        };
    }, []);

    return held;
}

/** requestAnimationFrame loop with delta seconds, torn down on unmount. */
export function useRafLoop(onFrame: (delta: number) => void) {
    const latest = useRef(onFrame);
    latest.current = onFrame;

    useEffect(() => {
        let handle = 0;
        let last = performance.now();

        const tick = (now: number) => {
            const delta = Math.min((now - last) / 1000, 0.1);
            last = now;

            latest.current(delta);
            handle = requestAnimationFrame(tick);
        };

        handle = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(handle);
    }, []);
}

export type Verdict = 'won' | 'lost' | null;

//--------------------------------------------------
// MARK: Atoms
//--------------------------------------------------

export function Keycap({ label, state, big }: { label: string; state?: 'idle' | 'active' | 'done' | 'wrong'; big?: boolean }) {
    const look =
        state === 'done'
            ? 'border-[#34d399]/80 bg-[#34d399]/15 text-[#34d399] gg-glow-ok'
            : state === 'active'
              ? 'border-primary/80 bg-primary/15 text-primary gg-glow'
              : state === 'wrong'
                ? 'border-[#f43f5e]/80 bg-[#f43f5e]/15 text-[#f43f5e] gg-glow-err'
                : 'border-white/20 bg-neutral-950/85 text-white/60';

    const size = big ? 'h-[7vh] min-w-[7vh] text-[3vh]' : 'h-[5.4vh] min-w-[5.4vh] text-[2.3vh]';

    return (
        <span
            className={`flex items-center justify-center rounded-[0.8vh] border-[0.22vh] px-[1.2vh] font-mono font-black tracking-wide transition-all duration-100 ${size} ${look}`}
            style={{ boxShadow: 'inset 0 -0.5vh 0 rgba(0,0,0,0.45), 0 0.5vh 1.2vh rgba(0,0,0,0.6)' }}
        >
            {label}
        </span>
    );
}

/** Time remaining as a glowing drain bar. `fraction` runs 1 -> 0. */
export function TimerBar({ fraction }: { fraction: number }) {
    const clamped = Math.max(0, Math.min(1, fraction));
    const low = clamped < 0.25;

    return (
        <div className="h-[1vh] w-full overflow-hidden rounded-full bg-white/10">
            <div
                className={`h-full rounded-full ${low ? 'bg-[#f43f5e] gg-glow-err' : 'bg-primary gg-glow'}`}
                style={{ width: `${clamped * 100}%` }}
            />
        </div>
    );
}

/** Rounds as filled segments — the finished ones glow, the current one pulses. */
export function RoundBar({ total, done, verdict }: { total: number; done: number; verdict?: Verdict }) {
    if (total <= 1) return null;

    return (
        <div className="flex w-full items-center gap-[0.8vh]">
            {Array.from({ length: total }, (_, index) => {
                const filled = index < done;
                const current = index === done && !verdict;

                return (
                    <span
                        key={index}
                        className={`h-[1vh] flex-1 rounded-full transition-colors ${
                            verdict === 'lost' && index >= done
                                ? 'bg-[#f43f5e]/60 gg-glow-err'
                                : filled || verdict === 'won'
                                  ? 'bg-primary gg-glow'
                                  : current
                                    ? 'bg-primary/40 gg-pulse'
                                    : 'bg-white/10'
                        }`}
                    />
                );
            })}
        </div>
    );
}

//--------------------------------------------------
// MARK: Shells
//--------------------------------------------------

/**
 * Board games sit in a pool of dark rather than a card: a soft rounded ground
 * with a huge feathered shadow, so there is no hard edge against the world.
 * The header is the set's signature — bold title with the last word in the
 * accent, a quiet instruction line under it.
 */
export function GameShell({
    title,
    accent,
    subtitle,
    verdict,
    children,
    footer,
}: {
    title: string;
    accent: string;
    subtitle: string;
    verdict: Verdict;
    children: React.ReactNode;
    footer?: React.ReactNode;
}) {
    return (
        <div
            className="pointer-events-auto flex flex-col items-center gap-[1.8vh] rounded-[1.4vh] bg-neutral-950/80 p-[2.6vh]"
            style={{ boxShadow: '0 0 9vh 3vh rgba(6,6,9,0.8)' }}
        >
            <div className="flex w-full items-baseline gap-[1.2vh]">
                <h1 className="flex gap-[0.9vh] text-[2.7vh] font-black uppercase tracking-wider">
                    <span className="text-white/90">{title}</span>
                    <span className={`gg-glow ${verdict === 'lost' ? 'text-[#f43f5e] gg-glow-err' : verdict === 'won' ? 'text-[#34d399] gg-glow-ok' : 'text-primary'}`}>
                        {accent}
                    </span>
                </h1>

                <span className="min-w-0 flex-1 truncate text-right text-[1.4vh] font-medium text-white/35">{subtitle}</span>
            </div>

            {children}

            {footer && <div className="w-full">{footer}</div>}
        </div>
    );
}

/** Floating games: no ground at all, just the elements lifted by shadow. */
export function FloatShell({ children }: { children: React.ReactNode }) {
    return <div className="gg-float pointer-events-auto flex flex-col items-center gap-[1.8vh]">{children}</div>;
}
