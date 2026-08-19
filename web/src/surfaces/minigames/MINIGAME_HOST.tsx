import { AnimatePresence, motion } from 'framer-motion';
import { finishMinigame, MINIGAME_BY_NAME, useMinigames, type MinigameConfig, type MinigameName } from '@/data/useMinigames';
import SKILLCHECK from './SKILLCHECK';
import KEYMASH from './KEYMASH';
import TIMING from './TIMING';
import SEQUENCE from './SEQUENCE';
import MEMORY from './MEMORY';
import WORDWIZ from './WORDWIZ';
import CONNECT from './CONNECT';
import HOLD from './HOLD';
import REFLEX from './REFLEX';
import BREACH from './BREACH';
import LOCKPICK from './LOCKPICK';
import CODECRACK from './CODECRACK';

/**
 * Renders whichever game is running. Skill checks — the press-E reflex games —
 * sit small at the bottom middle like a HUD prompt; minigames take the center
 * like a board. Keyed on the session counter, so replaying the same game
 * remounts it from scratch instead of resuming stale state.
 */

const GAMES: Record<MinigameName, React.ComponentType<{ config: MinigameConfig; finish: (success: boolean) => void }>> = {
    skillcheck: SKILLCHECK,
    keymash: KEYMASH,
    timing: TIMING,
    sequence: SEQUENCE,
    memory: MEMORY,
    wordwiz: WORDWIZ,
    connect: CONNECT,
    hold: HOLD,
    reflex: REFLEX,
    breach: BREACH,
    lockpick: LOCKPICK,
    codecrack: CODECRACK,
};

export default function MINIGAME_HOST() {
    const active = useMinigames((state) => state.active);
    const config = useMinigames((state) => state.config);
    const session = useMinigames((state) => state.session);

    const Game = active ? GAMES[active] : null;
    const skill = active ? MINIGAME_BY_NAME.get(active)?.category === 'skillcheck' : false;

    return (
        <AnimatePresence>
            {Game && (
                <motion.div
                    key={`minigame_${session}`}
                    initial={{ opacity: 0, scale: 0.92, y: '2vh' }}
                    animate={{ opacity: 1, scale: 1, y: '0vh' }}
                    exit={{ opacity: 0, scale: 0.92, y: '2vh' }}
                    transition={{ duration: 0.18, ease: 'easeOut' }}
                    className={`pointer-events-none absolute inset-0 z-40 flex justify-center ${skill ? 'items-end pb-[9vh]' : 'items-center'}`}
                >
                    <Game config={config} finish={finishMinigame} />
                </motion.div>
            )}
        </AnimatePresence>
    );
}
