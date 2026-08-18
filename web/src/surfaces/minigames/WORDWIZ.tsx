import { useRef, useState } from 'react';
import type { MinigameConfig } from '@/data/useMinigames';
import { GameShell, Keycap, TimerBar, useGameKeys, useRafLoop, type Verdict } from './parts';

/**
 * Unscramble the word before the timer empties. The scrambled letters glow up
 * top; typing fills the answer slots below — backspace edits, enter submits,
 * a wrong submit clears the slots and the clock keeps draining.
 */

const WORDS = [
    'able', 'acid', 'aware', 'badge', 'beacon', 'blend', 'bridge', 'bronze', 'cable', 'candle',
    'canyon', 'carbon', 'cargo', 'castle', 'cinder', 'circle', 'clover', 'copper', 'coral', 'craft',
    'crystal', 'diesel', 'donor', 'dragon', 'ember', 'engine', 'fabric', 'falcon', 'fiber', 'flare',
    'forge', 'fossil', 'garden', 'garlic', 'glacier', 'granite', 'gravel', 'grove', 'harbor', 'hazard',
    'helmet', 'hollow', 'hunter', 'insect', 'island', 'jacket', 'jungle', 'kernel', 'ladder', 'lantern',
    'legend', 'lumber', 'magnet', 'marble', 'meadow', 'mirror', 'motor', 'nickel', 'orbit', 'oyster',
    'panther', 'pepper', 'piston', 'planet', 'pocket', 'powder', 'prism', 'raven', 'ribbon', 'rocket',
    'saddle', 'salmon', 'shadow', 'signal', 'silver', 'siren', 'spark', 'spiral', 'stone', 'summit',
    'tackle', 'talon', 'thunder', 'timber', 'trigger', 'tunnel', 'velvet', 'violet', 'walnut', 'winter',
];

function scramble(word: string): string {
    const letters = word.split('');

    for (let attempt = 0; attempt < 12; attempt += 1) {
        for (let index = letters.length - 1; index > 0; index -= 1) {
            const swap = Math.floor(Math.random() * (index + 1));
            [letters[index], letters[swap]] = [letters[swap], letters[index]];
        }

        if (letters.join('') !== word) break;
    }

    return letters.join('');
}

export default function WORDWIZ({ config, finish }: { config: MinigameConfig; finish: (success: boolean) => void }) {
    const time = Math.max(3, config.time ?? 10);
    const length = Math.max(4, Math.min(8, config.length ?? 6));

    const [word] = useState(() => {
        const fits = WORDS.filter((candidate) => candidate.length === length);
        const pool = fits.length ? fits : WORDS;

        return pool[Math.floor(Math.random() * pool.length)].toUpperCase();
    });
    const [shown] = useState(() => scramble(word));
    const [typed, setTyped] = useState('');
    const [shake, setShake] = useState(false);
    const [verdict, setVerdict] = useState<Verdict>(null);

    const left = useRef(time);
    const phase = useRef<'play' | 'over'>('play');
    const [, redraw] = useState(0);

    const end = (success: boolean) => {
        if (phase.current === 'over') return;

        phase.current = 'over';
        setVerdict(success ? 'won' : 'lost');
        setTimeout(() => finish(success), 420);
    };

    useRafLoop((delta) => {
        if (phase.current !== 'play') return;

        left.current -= delta;

        if (left.current <= 0) end(false);

        redraw((tick) => tick + 1);
    });

    useGameKeys((incoming) => {
        if (phase.current !== 'play') return;
        if (incoming === 'ESCAPE') return end(false);

        if (incoming === 'BACKSPACE') return setTyped((current) => current.slice(0, -1));

        if (incoming === 'ENTER') {
            if (typed === word) return end(true);

            // A wrong guess costs the letters, not the game — the clock is
            // the pressure here.
            setShake(true);
            setTimeout(() => setShake(false), 300);
            setTyped('');
            return;
        }

        if (incoming.length !== 1 || !/[A-Z]/.test(incoming)) return;

        setTyped((current) => (current.length < word.length ? current + incoming : current));
    });

    return (
        <GameShell
            title="Word"
            accent="Scramble"
            subtitle="Unscramble it, then press Enter"
            verdict={verdict}
            footer={<TimerBar fraction={left.current / time} />}
        >
            <div className="flex items-center gap-[0.9vh]">
                {shown.split('').map((letter, index) => (
                    <span key={index} className="gg-tile-in" style={{ animationDelay: `${index * 55}ms` }}>
                        <Keycap label={letter} state="active" />
                    </span>
                ))}
            </div>

            <div className={`flex items-center gap-[0.9vh] transition-transform ${shake ? 'translate-x-[0.6vh]' : ''}`}>
                {word.split('').map((_, index) => (
                    <div key={index} className="flex flex-col items-center gap-[0.5vh]">
                        <span className={`flex h-[5.4vh] min-w-[5.4vh] items-center justify-center font-mono text-[2.6vh] font-black ${
                            verdict === 'won' ? 'text-emerald-300 gg-glow-ok' : verdict === 'lost' ? 'text-red-300 gg-glow-err' : 'text-white'
                        }`}>
                            {typed[index] ?? ''}
                        </span>
                        <span className={`h-[0.4vh] w-[4.6vh] rounded-full ${
                            typed[index] ? (verdict === 'lost' ? 'bg-red-400 gg-glow-err' : 'bg-primary gg-glow') : 'bg-white/15'
                        }`} />
                    </div>
                ))}
            </div>
        </GameShell>
    );
}
