import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { t } from '@/data/useLang';
import type { ParticleGroup } from '@/data/particles';
import { PARTICLE_DICT_COUNT, PARTICLE_EFFECT_COUNT } from '@/data/particlesMeta';
import { copyText } from '@/lib/clipboard';
import {
    exitViewer,
    playParticle,
    recentreParticle,
    stopParticle,
    styleParticle,
    useParticles,
} from '@/data/useParticles';

/**
 * The viewer itself: a panel down the right while the world stays playable.
 *
 * Everything else in the studio takes the whole screen, because everything else
 * is about reading settings. This one is about looking at the world, so it sits
 * beside it and the player keeps their keys.
 */

function Slider({
    label,
    value,
    min,
    max,
    step,
    format,
    onChange,
}: {
    label: string;
    value: number;
    min: number;
    max: number;
    step: number;
    format: (value: number) => string;
    onChange: (value: number) => void;
}) {
    return (
        <div className="flex flex-col gap-[0.3vh]">
            <div className="flex items-baseline justify-between">
                <span className="text-[1.1vh] font-semibold uppercase tracking-widest text-white/30">{label}</span>
                <span className="font-mono text-[1.2vh] text-white/70">{format(value)}</span>
            </div>

            <input
                type="range"
                min={min}
                max={max}
                step={step}
                value={value}
                onChange={(event) => onChange(Number(event.target.value))}
                className="h-[1.6vh] w-full cursor-pointer accent-[rgb(var(--primary-rgb))]"
            />
        </div>
    );
}

/**
 * What the copy buttons hand over. The looped and one-shot calls carry
 * whatever the sliders are set to, so pasting one gives back the effect as
 * it looked here rather than at its defaults.
 */
function snippets(dict: string, effect: string, scale: number, alpha: number, colour: { r: number; g: number; b: number }) {
    const load = [
        `RequestNamedPtfxAsset("${dict}")`,
        `while not HasNamedPtfxAssetLoaded("${dict}") do Wait(0) end`,
        '',
        `UseParticleFxAssetNextCall("${dict}")`,
    ];

    const size = scale.toFixed(2);
    const rgb = [colour.r, colour.g, colour.b].map((part) => (part / 255).toFixed(3));

    return {
        effect,
        dict,
        pair: `${dict} / ${effect}`,
        looped: [
            ...load,
            `local fx = StartParticleFxLoopedAtCoord("${effect}", coords.x, coords.y, coords.z, 0.0, 0.0, 0.0, ${size}, false, false, false, false)`,
            `SetParticleFxLoopedColour(fx, ${rgb[0]}, ${rgb[1]}, ${rgb[2]}, false)`,
            `SetParticleFxLoopedAlpha(fx, ${alpha.toFixed(2)})`,
        ].join('\n'),
        once: [
            ...load,
            `StartParticleFxNonLoopedAtCoord("${effect}", coords.x, coords.y, coords.z, 0.0, 0.0, 0.0, ${size}, false, false, false)`,
        ].join('\n'),
    };
}

export default function PARTICLE_VIEWER() {
    const open = useParticles((state) => state.open);
    const playing = useParticles((state) => state.playing);
    const dict = useParticles((state) => state.dict);
    const effect = useParticles((state) => state.effect);
    const problem = useParticles((state) => state.problem);
    const scale = useParticles((state) => state.scale);
    const alpha = useParticles((state) => state.alpha);
    const colour = useParticles((state) => state.colour);
    const looking = useParticles((state) => state.looking);

    const [query, setQuery] = useState('');
    const [copied, setCopied] = useState<string | null>(null);
    const [customDict, setCustomDict] = useState('');
    const [customEffect, setCustomEffect] = useState('');
    // Nothing is open to begin with: a few hundred dictionaries expanded at
    // once is a list nobody can use.
    const [expanded, setExpanded] = useState<Record<string, boolean>>({});

    // Two thousand strings that most players will never look at, so they are
    // fetched the first time the viewer opens and kept after that.
    const [library, setLibrary] = useState<ParticleGroup[] | null>(null);

    useEffect(() => {
        if (!open || library) return;

        void import('@/data/particles').then((module) => setLibrary(module.PARTICLE_LIBRARY));
    }, [open, library]);

    const flat = useMemo(
        () => (library ?? []).flatMap((group) => group.effects.map((effect) => ({ dict: group.dict, effect }))),
        [library],
    );

    // The tick goes back to a copy icon on its own rather than staying on.
    useEffect(() => {
        if (!copied) return;

        const timer = setTimeout(() => setCopied(null), 1400);

        return () => clearTimeout(timer);
    }, [copied]);

    const needle = query.trim().toLowerCase();

    // Searching drops the grouping entirely and answers flat, because what
    // you want back from a search is the effect, not which drawer it is in.
    const found = useMemo(() => {
        if (!needle) return null;

        return flat.filter(
            (entry) => entry.effect.toLowerCase().includes(needle) || entry.dict.toLowerCase().includes(needle),
        );
    }, [needle, flat]);

    if (!open) return null;

    // Long result sets are cut off rather than rendered: a search for "e"
    // matches most of the library, and putting all of it in the page for a
    // list you are going to narrow anyway costs a visible pause.
    const CAP = 300;

    const shown = found ? found.slice(0, CAP) : null;
    const total = found ? found.length : PARTICLE_EFFECT_COUNT;

    return (
        <motion.aside
            initial={{ opacity: 0, x: '4vh' }}
            exit={{ opacity: 0, x: '4vh' }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            animate={{ opacity: looking ? 0.35 : 1, x: 0 }}
            className="absolute right-[2vh] top-[2vh] bottom-[2vh] z-50 flex w-[34vh] flex-col overflow-hidden rounded-[0.7vh] border border-white/10 bg-neutral-950/95 pointer-events-auto"
        >
            <div className="flex flex-shrink-0 items-center gap-[0.9vh] border-b border-white/10 px-[1.3vh] py-[1vh]">
                <i className="fas fa-fire-flame-curved text-[1.5vh] text-primary" />

                <div className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-[1.5vh] font-bold text-white/95">{t('particles_title')}</span>
                    <span className="truncate text-[1.05vh] text-white/30">
                        {total} {t('particles_count')}
                        {!found && ` · ${PARTICLE_DICT_COUNT} ${t('particles_dicts')}`}
                    </span>
                </div>

                <button
                    type="button"
                    title={t('particles_close')}
                    onClick={exitViewer}
                    className="flex h-[2.8vh] w-[2.8vh] flex-shrink-0 items-center justify-center rounded-[0.4vh] border border-white/10 text-[1.3vh] text-white/40 transition-colors hover:border-red-400/50 hover:text-red-300"
                >
                    <i className="fas fa-xmark" />
                </button>
            </div>

            {/* What is playing, and what went wrong if it did not. */}
            <div className="flex flex-shrink-0 flex-col gap-[0.6vh] border-b border-white/10 px-[1.3vh] py-[1vh]">
                {effect ? (
                    <div className="flex min-w-0 flex-col">
                        <span className="truncate font-mono text-[1.3vh] font-semibold text-primary">{effect}</span>
                        <span className="truncate font-mono text-[1.05vh] text-white/30">{dict}</span>
                    </div>
                ) : (
                    <span className="text-[1.2vh] text-white/30">{t('particles_none')}</span>
                )}

                {problem && (
                    <span className="flex items-center gap-[0.6vh] text-[1.15vh] font-semibold text-red-300">
                        <i className="fas fa-triangle-exclamation text-[1.05vh]" />
                        {t('particles_failed')} {problem}
                    </span>
                )}

                {/* Four ways to take it with you: the two names on their
                    own, and the whole call either way round. */}
                {effect && dict && (
                    <div className="flex flex-wrap gap-[0.4vh]">
                        {(() => {
                            const cut = snippets(dict, effect, scale, alpha, colour);

                            const buttons: { id: string; label: string; text: string }[] = [
                                { id: 'effect', label: t('particles_copy_effect'), text: cut.effect },
                                { id: 'dict', label: t('particles_copy_dict'), text: cut.dict },
                                { id: 'looped', label: t('particles_copy_looped'), text: cut.looped },
                                { id: 'once', label: t('particles_copy_once'), text: cut.once },
                            ];

                            return buttons.map((button) => (
                                <button
                                    key={button.id}
                                    type="button"
                                    title={button.text}
                                    onClick={() => {
                                        if (copyText(button.text)) setCopied(button.id);
                                    }}
                                    className={`flex h-[2.3vh] items-center gap-[0.4vh] rounded-[0.35vh] border px-[0.7vh] text-[1.05vh] font-semibold transition-colors ${
                                        copied === button.id
                                            ? 'border-primary/60 bg-primary/15 text-primary'
                                            : 'border-white/10 text-white/40 hover:border-primary/40 hover:text-primary'
                                    }`}
                                >
                                    <i className={`fas ${copied === button.id ? 'fa-check' : 'fa-copy'} text-[0.9vh]`} />
                                    {button.label}
                                </button>
                            ));
                        })()}
                    </div>
                )}

                <div className="flex gap-[0.5vh]">
                    <button
                        type="button"
                        disabled={!effect}
                        onClick={() => (playing ? stopParticle() : effect && dict && playParticle(dict, effect))}
                        className={`flex h-[2.7vh] flex-1 items-center justify-center gap-[0.5vh] rounded-[0.4vh] border text-[1.15vh] font-bold transition-colors disabled:opacity-30 ${
                            playing
                                ? 'border-red-400/40 bg-red-400/10 text-red-300'
                                : 'border-primary/45 bg-primary/[0.12] text-primary hover:bg-primary/25'
                        }`}
                    >
                        <i className={`fas ${playing ? 'fa-stop' : 'fa-play'} text-[1vh]`} />
                        {playing ? t('particles_stop') : t('particles_play')}
                    </button>

                    <button
                        type="button"
                        disabled={!effect}
                        title={t('particles_recentre')}
                        onClick={recentreParticle}
                        className="flex h-[2.7vh] flex-shrink-0 items-center gap-[0.5vh] rounded-[0.4vh] border border-white/10 px-[1vh] text-[1.15vh] font-semibold text-white/45 transition-colors hover:border-primary/40 hover:text-primary disabled:opacity-30"
                    >
                        <i className="fas fa-crosshairs text-[1vh]" />
                    </button>
                </div>
            </div>

            {/* Scale, alpha and colour, live on whatever is playing. */}
            <div className="flex flex-shrink-0 flex-col gap-[0.7vh] border-b border-white/10 px-[1.3vh] py-[1vh]">
                <Slider
                    label={t('particles_scale')}
                    value={scale}
                    min={0.1}
                    max={10}
                    step={0.1}
                    format={(value) => `${value.toFixed(1)}x`}
                    onChange={(next) => styleParticle({ scale: next })}
                />

                <Slider
                    label={t('particles_alpha')}
                    value={alpha}
                    min={0}
                    max={1}
                    step={0.05}
                    format={(value) => `${Math.round(value * 100)}%`}
                    onChange={(next) => styleParticle({ alpha: next })}
                />

                <div className="flex items-center gap-[0.8vh]">
                    <span className="text-[1.1vh] font-semibold uppercase tracking-widest text-white/30">{t('particles_colour')}</span>

                    <input
                        type="color"
                        value={`#${[colour.r, colour.g, colour.b].map((part) => part.toString(16).padStart(2, '0')).join('')}`}
                        onChange={(event) => {
                            const hex = event.target.value;

                            styleParticle({
                                colour: {
                                    r: parseInt(hex.slice(1, 3), 16),
                                    g: parseInt(hex.slice(3, 5), 16),
                                    b: parseInt(hex.slice(5, 7), 16),
                                },
                            });
                        }}
                        className="h-[2.4vh] w-[4.5vh] cursor-pointer rounded-[0.3vh] border border-white/15 bg-transparent"
                    />

                    <span className="min-w-0 flex-1" />

                    <button
                        type="button"
                        onClick={() => styleParticle({ scale: 1, alpha: 1, colour: { r: 255, g: 255, b: 255 } })}
                        className="text-[1.1vh] font-semibold text-white/30 transition-colors hover:text-white/70"
                    >
                        {t('particles_reset')}
                    </button>
                </div>
            </div>

            <div className="flex-shrink-0 border-b border-white/10 px-[1.3vh] py-[0.8vh]">
                <input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder={t('particles_search')}
                    className="h-[2.8vh] w-full rounded-[0.4vh] border border-white/10 bg-neutral-900/70 px-[0.9vh] text-[1.2vh] text-white/85 transition-colors focus:border-primary/50"
                />
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto">
                {!library && (
                    <div className="flex justify-center py-[5vh] text-white/25">
                        <i className="fas fa-spinner animate-spin text-[2.5vh]" />
                    </div>
                )}

                {/* Searching: flat results, each carrying the dictionary it
                    came out of, because that is what you have to pass. */}
                {shown &&
                    shown.map((entry) => (
                        <button
                            key={`${entry.dict}:${entry.effect}`}
                            type="button"
                            onClick={() => playParticle(entry.dict, entry.effect)}
                            className={`flex w-full flex-col items-start border-b border-white/5 px-[1.3vh] py-[0.45vh] text-left transition-colors ${
                                effect === entry.effect && dict === entry.dict
                                    ? 'bg-primary/[0.12]'
                                    : 'hover:bg-white/[0.04]'
                            }`}
                        >
                            <span
                                className={`w-full truncate font-mono text-[1.15vh] ${
                                    effect === entry.effect && dict === entry.dict ? 'text-primary' : 'text-white/70'
                                }`}
                            >
                                {entry.effect}
                            </span>
                            <span className="w-full truncate font-mono text-[1vh] text-white/25">{entry.dict}</span>
                        </button>
                    ))}

                {found && found.length > CAP && (
                    <div className="px-[1.3vh] py-[1vh] text-center text-[1.15vh] text-white/30">
                        {t('particles_more')} {found.length - CAP}
                    </div>
                )}

                {found && found.length === 0 && (
                    <div className="flex flex-col items-center gap-[0.8vh] py-[5vh] text-white/25">
                        <i className="fas fa-magnifying-glass-minus text-[2.5vh]" />
                        <span className="text-[1.25vh]">{t('settings_no_results')}</span>
                    </div>
                )}

                {/* Browsing: one row per dictionary, opened on demand. */}
                {!found &&
                    (library ?? []).map((group) => {
                        const open = expanded[group.dict] === true;

                        return (
                            <div key={group.dict}>
                                <button
                                    type="button"
                                    onClick={() => setExpanded((current) => ({ ...current, [group.dict]: !open }))}
                                    className="flex w-full items-center gap-[0.7vh] border-b border-white/5 px-[1.3vh] py-[0.55vh] text-left transition-colors hover:bg-white/[0.05]"
                                >
                                    <i
                                        className={`fas fa-chevron-right w-[1vh] flex-shrink-0 text-[0.95vh] text-white/25 transition-transform ${
                                            open ? 'rotate-90' : ''
                                        }`}
                                    />

                                    <span className="min-w-0 flex-1 truncate font-mono text-[1.15vh] text-white/70">{group.dict}</span>

                                    <span className="flex-shrink-0 font-mono text-[1vh] text-white/25">{group.effects.length}</span>
                                </button>

                                {open &&
                                    group.effects.map((name) => (
                                        <button
                                            key={`${group.dict}:${name}`}
                                            type="button"
                                            onClick={() => playParticle(group.dict, name)}
                                            className={`flex w-full items-center gap-[0.6vh] py-[0.4vh] pl-[3vh] pr-[1.3vh] text-left transition-colors ${
                                                effect === name && dict === group.dict
                                                    ? 'bg-primary/[0.12] text-primary'
                                                    : 'text-white/55 hover:bg-white/[0.04] hover:text-white/90'
                                            }`}
                                        >
                                            <span className="min-w-0 flex-1 truncate font-mono text-[1.1vh]">{name}</span>
                                        </button>
                                    ))}
                            </div>
                        );
                    })}
            </div>
            <div className="flex flex-shrink-0 items-center gap-[0.6vh] border-t border-white/10 px-[1.3vh] py-[0.6vh] text-[1.05vh] text-white/30">
                <kbd className="rounded-[0.3vh] border border-white/15 px-[0.5vh] font-mono text-[1vh] text-white/50">ALT</kbd>
                {t('particles_look_hint')}
            </div>

            {/* Anything not in the list. This is how most effects get tested:
                you find a name somewhere and want to see it now. */}
            <div className="flex flex-shrink-0 flex-col gap-[0.5vh] border-t border-white/10 px-[1.3vh] py-[1vh]">
                <span className="text-[1.05vh] font-semibold uppercase tracking-widest text-white/25">{t('particles_manual')}</span>

                <div className="flex gap-[0.5vh]">
                    <input
                        value={customDict}
                        onChange={(event) => setCustomDict(event.target.value)}
                        placeholder={t('particles_dict')}
                        className="h-[2.6vh] min-w-0 flex-1 rounded-[0.4vh] border border-white/10 bg-neutral-900/70 px-[0.8vh] font-mono text-[1.1vh] text-white/85 focus:border-primary/50"
                    />
                    <input
                        value={customEffect}
                        onChange={(event) => setCustomEffect(event.target.value)}
                        placeholder={t('particles_effect')}
                        className="h-[2.6vh] min-w-0 flex-1 rounded-[0.4vh] border border-white/10 bg-neutral-900/70 px-[0.8vh] font-mono text-[1.1vh] text-white/85 focus:border-primary/50"
                    />
                    <button
                        type="button"
                        disabled={!customDict.trim() || !customEffect.trim()}
                        onClick={() => playParticle(customDict.trim(), customEffect.trim())}
                        className="flex h-[2.6vh] flex-shrink-0 items-center rounded-[0.4vh] border border-primary/40 bg-primary/10 px-[1vh] text-[1.1vh] font-bold text-primary transition-colors hover:bg-primary/25 disabled:opacity-30"
                    >
                        <i className="fas fa-play text-[0.95vh]" />
                    </button>
                </div>
            </div>
        </motion.aside>
    );
}
