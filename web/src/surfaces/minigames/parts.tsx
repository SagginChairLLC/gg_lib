import { useEffect, useRef } from 'react';

/**
 * The design system every game is assembled from. Two presentations share it:
 * floating games (no card at all — glowing elements lifted off the scene) and
 * board games (a soft dark pool with a two-tone header, no hard card edges).
 */

//--------------------------------------------------
// MARK: Input
//--------------------------------------------------

export function normaliseKey(key: string): string {
    if (key === ' ') return 'SPACE';

    return key.toUpperCase();
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
            ? 'border-emerald-400/80 bg-emerald-400/15 text-emerald-300 gg-glow-ok'
            : state === 'active'
              ? 'border-primary/80 bg-primary/15 text-primary gg-glow'
              : state === 'wrong'
                ? 'border-red-400/80 bg-red-500/15 text-red-300 gg-glow-err'
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
                className={`h-full rounded-full ${low ? 'bg-red-400 gg-glow-err' : 'bg-primary gg-glow'}`}
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
                                ? 'bg-red-400/60 gg-glow-err'
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
                    <span className={`gg-glow ${verdict === 'lost' ? 'text-red-400 gg-glow-err' : verdict === 'won' ? 'text-emerald-400 gg-glow-ok' : 'text-primary'}`}>
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
