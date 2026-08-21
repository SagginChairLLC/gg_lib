import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { usePanel, type PanelReward } from '@/data/usePanel';

/**
 * What a finished run paid out.
 *
 * Shown over the panel's body for a few seconds and then gone, leaving behind
 * whatever the job set underneath -- normally the "what next" state. The script
 * sets both at once and does not have to come back and clear this one.
 *
 * The whole reveal runs off a single clock rather than a pile of timeouts, so
 * the money, the experience and the bar cannot drift apart from each other, and
 * nothing is left running if the panel closes halfway through.
 */

const COUNT_UNTIL = 0.5;
const BAR_FROM = 0.1;
const BAR_UNTIL = 0.68;

/** Enough to read as segments at this width without turning into a comb. */
const SEGMENTS = 14;

/** Slows into the end, so the last few pounds land rather than stop dead. */
function easeOut(t: number) {
    return 1 - Math.pow(1 - t, 3);
}

function span(t: number, from: number, until: number) {
    if (t <= from) return 0;
    if (t >= until) return 1;

    return (t - from) / (until - from);
}

function money(value: number) {
    return `$${Math.round(value).toLocaleString('en-US')}`;
}

/**
 * How far the bar has travelled, and which level that leaves it in.
 *
 * Distance is counted in levels: the rest of the one it started in, every whole
 * level crossed, then the part of the one it ends in. That makes two levels in
 * one payout behave the same as one, rather than being a case nobody tested.
 */
function walk(reward: PanelReward, progress: number) {
    const gained = Math.max(0, reward.levelTo - reward.levelFrom);

    if (gained === 0) {
        return {
            level: reward.levelFrom,
            fill: reward.fillFrom + (reward.fillTo - reward.fillFrom) * progress,
        };
    }

    const total = 1 - reward.fillFrom + (gained - 1) + reward.fillTo;
    let travelled = total * progress;

    const first = 1 - reward.fillFrom;

    if (travelled < first) return { level: reward.levelFrom, fill: reward.fillFrom + travelled };

    travelled -= first;

    const whole = Math.min(gained - 1, Math.floor(travelled));

    travelled -= whole;

    return { level: reward.levelFrom + 1 + whole, fill: Math.min(travelled, 1) };
}

/**
 * The same segmented bar the run's progress uses, so a player reads one shape
 * for "how far along" everywhere in the popup. The leading segment fills part
 * way, which keeps a count-up smooth instead of clicking over in fourteenths.
 */
function SegmentBar({ fill }: { fill: number }) {
    return (
        <div className="flex gap-[0.3vh]">
            {Array.from({ length: SEGMENTS }, (_, index) => {
                const part = Math.min(1, Math.max(0, fill * SEGMENTS - index));

                return (
                    <div key={index} className="h-[0.5vh] flex-1 overflow-hidden rounded-full bg-neutral-800">
                        <div className="h-full rounded-full bg-primary" style={{ width: `${part * 100}%` }} />
                    </div>
                );
            })}
        </div>
    );
}

export default function PANEL_REWARD({ reward }: { reward: PanelReward }) {
    const [progress, setProgress] = useState(0);
    const frame = useRef(0);

    useEffect(() => {
        const started = performance.now();
        const duration = Math.max(500, reward.durationMs);

        const step = () => {
            const t = Math.min(1, (performance.now() - started) / duration);

            setProgress(t);

            if (t < 1) {
                frame.current = requestAnimationFrame(step);
                return;
            }

            // Clearing it here is what takes the panel back to normal. The job
            // script set the "what next" state at the same time it set this.
            usePanel.setState({ reward: null });
        };

        frame.current = requestAnimationFrame(step);

        return () => cancelAnimationFrame(frame.current);
    }, [reward]);

    const counted = easeOut(span(progress, 0, COUNT_UNTIL));
    const { level, fill } = walk(reward, easeOut(span(progress, BAR_FROM, BAR_UNTIL)));

    const levelled = level > reward.levelFrom;

    return (
        <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            className="flex flex-col"
        >
            {/* Something happened, and it went well. Worth one line saying so
                before the numbers, or a payout reads like a status readout. */}
            <div className="flex items-center gap-[0.8vh] border-b border-neutral-800 bg-primary/[0.07] px-[1.1vh] py-[0.8vh]">
                <motion.span
                    initial={{ scale: 0.4, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ duration: 0.35, ease: 'easeOut' }}
                    className="flex h-[2vh] w-[2vh] flex-shrink-0 items-center justify-center rounded-full border border-primary/50 bg-primary/20 text-[1vh] text-primary"
                >
                    <i className="fas fa-check" />
                </motion.span>

                <span className="truncate text-[1.25vh] font-bold uppercase tracking-wider text-primary">{reward.label}</span>
            </div>

            {/* The money is the point, so it gets the size. The experience is
                the same colour a shade down rather than a second hue. */}
            <div className="flex items-stretch">
                <div className="flex flex-1 flex-col gap-[0.15vh] px-[1.1vh] py-[1vh]">
                    <span className="flex items-center gap-[0.5vh] text-[1vh] uppercase tracking-wide text-neutral-500">
                        <i className="fas fa-sack-dollar text-[1vh] text-primary/60" />
                        Payout
                    </span>
                    <span className="font-mono text-[2.1vh] font-black leading-none text-primary">{money(reward.money * counted)}</span>
                </div>

                <div className="w-px bg-neutral-800" />

                <div className="flex flex-1 flex-col gap-[0.15vh] px-[1.1vh] py-[1vh]">
                    <span className="flex items-center gap-[0.5vh] text-[1vh] uppercase tracking-wide text-neutral-500">
                        <i className="fas fa-bolt text-[1vh] text-primary/60" />
                        Experience
                    </span>
                    <span className="font-mono text-[2.1vh] font-black leading-none text-neutral-200">+{Math.round(reward.xp * counted)}</span>
                </div>
            </div>

            <div className="flex flex-col gap-[0.6vh] border-t border-neutral-800 px-[1.1vh] py-[1vh]">
                <div className="flex items-baseline justify-between">
                    <div className="flex items-baseline gap-[0.6vh]">
                        <span className="text-[1vh] uppercase tracking-wide text-neutral-500">Level</span>

                        {/* Keyed on the level, so the number is genuinely
                            replaced when it changes and can be animated. */}
                        <motion.span
                            key={level}
                            initial={levelled ? { scale: 1.6, opacity: 0 } : false}
                            animate={{ scale: 1, opacity: 1 }}
                            transition={{ duration: 0.4, ease: 'easeOut' }}
                            className="font-mono text-[1.45vh] font-bold text-primary"
                        >
                            {level}
                        </motion.span>
                    </div>

                    <motion.span
                        initial={false}
                        animate={{ opacity: progress >= BAR_UNTIL ? 1 : 0 }}
                        transition={{ duration: 0.25 }}
                        className="font-mono text-[1vh] text-neutral-500"
                    >
                        {reward.xpInto.toLocaleString('en-US')} / {reward.xpNeeded.toLocaleString('en-US')}
                    </motion.span>
                </div>

                <SegmentBar fill={fill} />

                {levelled && (
                    <motion.div
                        initial={{ opacity: 0, y: 3 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.3, ease: 'easeOut' }}
                        className="flex items-center gap-[0.6vh] text-[1.1vh] font-semibold text-primary"
                    >
                        <i className="fas fa-arrow-up text-[1vh]" />
                        Level {level} reached
                    </motion.div>
                )}
            </div>
        </motion.div>
    );
}
