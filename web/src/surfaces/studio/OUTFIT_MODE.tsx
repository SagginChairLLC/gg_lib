import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { t } from '@/data/useLang';
import { closeOutfit, editOutfit, revertOutfit, useOutfit, type OutfitSlot, type OutfitValue } from '@/data/useOutfit';
import { fetchNui, isEnvBrowser } from '@/lib/fetchNui';
import { useNuiEvent } from '@/hooks/useNuiEvent';

/**
 * The clothing editor.
 *
 * A ped in the world with a short menu beside it. Every slot is either changed
 * by the outfit or left at the body's own default, and switching one off puts
 * it straight back, so the effect of a switch is visible the moment it is made.
 *
 * Nothing here has a save button. Edits go into the setting as they are made
 * and the settings page saves them the way it saves everything else, so backing
 * out is never a decision about whether work was kept.
 */

const DEGREES_PER_PIXEL = 0.4;

/** Per click of a button, and per notch of the wheel. */
const DOLLY = 0.35;
const RISE = 0.18;

/** Per frame while a key is down, so holding one glides rather than steps. */
const KEY_TURN = 1.6;
const KEY_DOLLY = 0.035;

type SlotSpec = { key: string; label: string };

/** In the order they read on a body rather than by the game's component ids. */
const COMPONENTS: SlotSpec[] = [
    { key: 'face', label: 'Face' },
    { key: 'hair', label: 'Hair' },
    { key: 'mask', label: 'Mask' },
    { key: 'undershirt', label: 'Undershirt' },
    { key: 'arms', label: 'Arms' },
    { key: 'jacket', label: 'Top' },
    { key: 'kevlar', label: 'Kevlar' },
    { key: 'badge', label: 'Badge' },
    { key: 'accessory', label: 'Accessory' },
    { key: 'pants', label: 'Pants' },
    { key: 'shoes', label: 'Shoes' },
    { key: 'bag', label: 'Bag' },
];

const PROPS: SlotSpec[] = [
    { key: 'hat', label: 'Hat' },
    { key: 'glasses', label: 'Glasses' },
    { key: 'ear', label: 'Earpiece' },
    { key: 'watch', label: 'Watch' },
    { key: 'bracelet', label: 'Bracelet' },
];

const GENDERS = ['male', 'female'] as const;
type Gender = (typeof GENDERS)[number];

type SlotLimit = { drawable: number; texture: number };
type Limits = { components?: Record<string, SlotLimit>; props?: Record<string, SlotLimit> };

function Stepper({
    value,
    min,
    max,
    disabled,
    onChange,
}: {
    value: number;
    min: number;
    /** Highest index this slot actually has. Undefined until the game says. */
    max?: number;
    disabled?: boolean;
    onChange: (next: number) => void;
}) {
    const cap = (next: number) => {
        if (next < min) return min;
        if (max !== undefined && next > max) return max;

        return next;
    };

    const [text, setText] = useState(String(value));
    const [focused, setFocused] = useState(false);

    useEffect(() => {
        if (!focused) setText(String(value));
    }, [value, focused]);

    return (
        <div className="flex items-center">
            <button
                type="button"
                disabled={disabled || value <= min}
                onClick={() => onChange(cap(value - 1))}
                className="flex h-[2.4vh] w-[2vh] items-center justify-center rounded-l-[0.35vh] border border-white/10 text-[1vh] text-white/40 transition-colors hover:border-primary/40 hover:text-primary disabled:opacity-30"
            >
                <i className="fas fa-minus" />
            </button>

            <input
                type="text"
                inputMode="numeric"
                value={text}
                disabled={disabled}
                onFocus={() => setFocused(true)}
                onChange={(event) => setText(event.target.value)}
                onBlur={(event) => {
                    setFocused(false);

                    const parsed = Number(event.target.value);

                    if (Number.isNaN(parsed)) setText(String(value));
                    else onChange(cap(Math.round(parsed)));
                }}
                onKeyDown={(event) => {
                    if (event.key === 'Enter') (event.target as HTMLInputElement).blur();
                }}
                className="h-[2.4vh] w-[3.8vh] border-y border-white/10 bg-neutral-950/60 text-center font-mono text-[1.2vh] text-white/90 outline-none focus:border-primary/50 disabled:opacity-40"
            />

            <button
                type="button"
                disabled={disabled || (max !== undefined && value >= max)}
                onClick={() => onChange(cap(value + 1))}
                className="flex h-[2.4vh] w-[2vh] items-center justify-center rounded-r-[0.35vh] border border-white/10 text-[1vh] text-white/40 transition-colors hover:border-primary/40 hover:text-primary disabled:opacity-30"
            >
                <i className="fas fa-plus" />
            </button>

            {/* What the model actually has. Without it these are two unbounded
                boxes, and most of the numbers you could type are invisible. */}
            <span className="w-[3.2vh] flex-shrink-0 pl-[0.4vh] font-mono text-[1vh] text-white/25">
                {max === undefined ? '' : `/${max}`}
            </span>
        </div>
    );
}

export default function OUTFIT_MODE() {
    const open = useOutfit((state) => state.open);
    const value = useOutfit((state) => state.value);
    const readOnly = useOutfit((state) => state.readOnly);

    const [gender, setGender] = useState<Gender>('male');

    const [leaving, setLeaving] = useState(false);

    const dragging = useRef(false);
    const pending = useRef(0);
    const frame = useRef(0);
    const held = useRef(new Set<string>());

    // What a slot was set to before it was switched off, so switching it back on
    // returns to the number that was being worked on rather than to zero.
    const remembered = useRef(new Map<string, OutfitSlot>());

    const [limits, setLimits] = useState<Limits>({});

    // Sent after every change, because how many textures a slot has depends on
    // which drawable is on it.
    useNuiEvent<Limits>('outfit_limits', (data) => setLimits(data ?? {}));

    const body = value?.[gender];

    const show = (next: OutfitValue, forGender: Gender) => {
        if (isEnvBrowser()) return;

        void fetchNui('outfit_preview', {
            gender: forGender,
            components: next?.[forGender]?.components ?? {},
            props: next?.[forGender]?.props ?? {},
        });
    };

    // The ped appears with the editor rather than waiting to be asked for.
    useEffect(() => {
        if (!open) return;

        show(useOutfit.getState().value, gender);
    }, [open, gender]);

    useEffect(() => {
        return () => {
            if (!isEnvBrowser()) void fetchNui('outfit_close');
        };
    }, []);

    // Drags and held keys are accumulated and flushed on a frame. A pointermove
    // fires well over a hundred times a second and each one would otherwise be
    // its own round trip into the game.
    useEffect(() => {
        if (!open) return;

        const tick = () => {
            const keys = held.current;

            if (keys.has('a')) pending.current -= KEY_TURN;
            if (keys.has('d')) pending.current += KEY_TURN;

            if (!isEnvBrowser()) {
                if (pending.current !== 0) {
                    void fetchNui('outfit_turn', { by: pending.current });
                    pending.current = 0;
                }

                // Zoom is asked for continuously and eased in the game, so a
                // held key glides in rather than stepping.
                const dolly = (keys.has('s') ? KEY_DOLLY : 0) - (keys.has('w') ? KEY_DOLLY : 0);

                if (dolly !== 0) void fetchNui('outfit_camera', { dolly, rise: 0 });
            }

            frame.current = requestAnimationFrame(tick);
        };

        frame.current = requestAnimationFrame(tick);

        return () => cancelAnimationFrame(frame.current);
    }, [open]);

    // Escape asks rather than acts: the changes are already in the setting, so
    // leaving silently would be indistinguishable from leaving deliberately.
    useEffect(() => {
        if (!open) return;

        const down = (event: KeyboardEvent) => {
            if (document.activeElement?.tagName === 'INPUT') return;

            if (event.key === 'Escape') {
                event.preventDefault();
                event.stopPropagation();

                setLeaving(true);

                return;
            }

            const key = event.key.toLowerCase();

            if ('wasd'.includes(key) && key.length === 1) {
                event.preventDefault();
                held.current.add(key);
            }
        };

        const up = (event: KeyboardEvent) => held.current.delete(event.key.toLowerCase());

        // Anything held when the window loses focus is not held any more.
        const blur = () => held.current.clear();

        window.addEventListener('keydown', down, true);
        window.addEventListener('keyup', up, true);
        window.addEventListener('blur', blur);

        return () => {
            window.removeEventListener('keydown', down, true);
            window.removeEventListener('keyup', up, true);
            window.removeEventListener('blur', blur);

            held.current.clear();
        };
    }, [open]);

    if (!open) return null;

    const write = (kind: 'components' | 'props', key: string, slot: OutfitSlot | null) => {
        const currentBody = value[gender] ?? {};
        const currentKind = { ...(currentBody[kind] ?? {}) };

        if (slot === null) delete currentKind[key];
        else currentKind[key] = slot;

        const next: OutfitValue = { ...value, [gender]: { ...currentBody, [kind]: currentKind } };

        editOutfit(next);
        show(next, gender);
    };

    const move = (dolly: number, rise: number) => {
        if (isEnvBrowser()) return;

        void fetchNui('outfit_camera', { dolly, rise });
    };

    const rows = (title: string, kind: 'components' | 'props', slots: SlotSpec[]) => (
        <div className="flex flex-col gap-[0.4vh]">
            <span className="px-[0.4vh] text-[1.05vh] font-bold uppercase tracking-widest text-white/25">{title}</span>

            {slots.map((slot) => {
                const current: OutfitSlot = body?.[kind]?.[slot.key] ?? {};
                const active = current.drawable !== undefined && current.drawable !== null;
                const limit = limits[kind]?.[slot.key];

                return (
                    <div
                        key={slot.key}
                        className={`flex h-[3.2vh] items-center gap-[0.9vh] rounded-[0.4vh] px-[0.8vh] transition-colors ${
                            active ? 'bg-primary/[0.07]' : 'hover:bg-white/[0.03]'
                        }`}
                    >
                        <button
                            type="button"
                            disabled={readOnly}
                            title={active ? t('outfit_change_off') : t('outfit_change_on')}
                            onClick={() => {
                                const id = gender + ':' + kind + ':' + slot.key;

                                if (active) {
                                    remembered.current.set(id, current);
                                    write(kind, slot.key, null);

                                    return;
                                }

                                write(kind, slot.key, remembered.current.get(id) ?? { drawable: 0, texture: 0 });
                            }}
                            className={`flex h-[1.7vh] w-[1.7vh] flex-shrink-0 items-center justify-center rounded-[0.3vh] border text-[0.85vh] transition-colors disabled:opacity-30 ${
                                active ? 'border-primary/60 bg-primary/25 text-primary' : 'border-white/15 text-transparent hover:border-primary/40'
                            }`}
                        >
                            <i className="fas fa-check" />
                        </button>

                        <span className={`min-w-0 flex-1 truncate text-[1.3vh] ${active ? 'text-white/85' : 'text-white/35'}`}>{slot.label}</span>

                        {active ? (
                            <>
                                <Stepper
                                    value={current.drawable ?? 0}
                                    min={kind === 'props' ? -1 : 0}
                                    max={limit?.drawable}
                                    disabled={readOnly}
                                    // A texture index only means anything against the
                                    // drawable it belongs to, so changing the garment
                                    // starts its colour over rather than carrying a
                                    // number across to a slot that may not have it.
                                    onChange={(next) => write(kind, slot.key, { drawable: next, texture: 0 })}
                                />
                                <Stepper
                                    value={current.texture ?? 0}
                                    min={0}
                                    max={limit?.texture}
                                    disabled={readOnly}
                                    onChange={(next) => write(kind, slot.key, { ...current, texture: next })}
                                />
                            </>
                        ) : (
                            <span className="flex-shrink-0 text-[1.15vh] italic text-white/25">{t('outfit_unchanged')}</span>
                        )}
                    </div>
                );
            })}
        </div>
    );

    return (
        <div className="absolute inset-0 z-[60]">
            {/* Everything that is not the menu turns the ped. */}
            <div
                className="absolute inset-0 cursor-ew-resize"
                onWheel={(event) => move(0, event.deltaY < 0 ? RISE : -RISE)}
                onPointerDown={(event) => {
                    dragging.current = true;
                    (event.target as HTMLElement).setPointerCapture(event.pointerId);
                }}
                onPointerMove={(event) => {
                    if (dragging.current) pending.current += event.movementX * DEGREES_PER_PIXEL;
                }}
                onPointerUp={() => {
                    dragging.current = false;
                }}
                onPointerCancel={() => {
                    dragging.current = false;
                }}
            />

            {/* Beside the menu rather than in the far corner, where they were
                easy to miss entirely. */}
            <div className="pointer-events-none absolute bottom-[3vh] right-[50vh] flex flex-col items-end gap-[0.8vh]">
                <div className="pointer-events-auto flex flex-col gap-[0.4vh] rounded-[0.5vh] border border-white/10 bg-neutral-900/85 p-[0.5vh] backdrop-blur">
                    <CamButton icon="fa-angle-up" label={t('outfit_cam_up')} onClick={() => move(0, RISE)} />
                    <CamButton icon="fa-magnifying-glass-plus" label={t('outfit_cam_in')} onClick={() => move(-DOLLY, 0)} />
                    <CamButton icon="fa-magnifying-glass-minus" label={t('outfit_cam_out')} onClick={() => move(DOLLY, 0)} />
                    <CamButton icon="fa-angle-down" label={t('outfit_cam_down')} onClick={() => move(0, -RISE)} />
                </div>

                <div className="flex flex-col items-end gap-[0.3vh] rounded-[0.4vh] border border-white/10 bg-neutral-900/85 px-[1vh] py-[0.6vh] text-[1.1vh] text-white/40 backdrop-blur">
                    <Hint keys="A D" label={t('outfit_keys_turn')} />
                    <Hint keys="W S" label={t('outfit_keys_zoom')} />
                    <Hint keys="↑ ↓" label={t('outfit_keys_rise')} />
                </div>
            </div>

            <motion.div
                initial={{ x: '100%', opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ duration: 0.28, ease: [0.22, 0.61, 0.36, 1] }}
                className="absolute inset-y-0 right-0 flex w-[48vh] flex-col border-l border-white/10 bg-neutral-950/95 backdrop-blur"
            >
                <div className="flex items-center gap-[1vh] border-b border-white/10 px-[1.4vh] py-[1.1vh]">
                    <i className="fas fa-shirt text-[1.5vh] text-primary" />
                    <span className="flex-1 truncate text-[1.6vh] font-bold text-white/95">{t('outfit_title')}</span>

                    <button
                        type="button"
                        onClick={() => setLeaving(true)}
                        className="flex h-[3vh] items-center rounded-[0.4vh] border border-white/15 px-[1.2vh] text-[1.3vh] font-semibold text-white/55 transition-colors hover:border-white/30 hover:text-white/85"
                    >
                        {t('outfit_cancel')}
                    </button>

                    <button
                        type="button"
                        onClick={() => {
                            if (!isEnvBrowser()) void fetchNui('outfit_close');

                            closeOutfit();
                        }}
                        className="flex h-[3vh] items-center gap-[0.7vh] rounded-[0.4vh] border border-primary/40 bg-primary/10 px-[1.2vh] text-[1.3vh] font-bold text-primary transition-colors hover:bg-primary/20"
                    >
                        <i className="fas fa-check text-[1.1vh]" />
                        {t('outfit_done')}
                    </button>
                </div>

                <div className="flex gap-[0.4vh] border-b border-white/10 px-[1.4vh] py-[0.9vh]">
                    {GENDERS.map((option) => (
                        <button
                            key={option}
                            type="button"
                            onClick={() => setGender(option)}
                            className={`flex h-[2.8vh] flex-1 items-center justify-center gap-[0.6vh] rounded-[0.4vh] border text-[1.3vh] font-semibold transition-colors ${
                                gender === option ? 'border-primary/50 bg-primary/15 text-primary' : 'border-white/10 text-white/45 hover:text-white/80'
                            }`}
                        >
                            <i className={`fas ${option === 'male' ? 'fa-person' : 'fa-person-dress'} text-[1.15vh]`} />
                            {option === 'male' ? t('outfit_male') : t('outfit_female')}
                        </button>
                    ))}
                </div>

                <div className="flex flex-1 flex-col gap-[1.2vh] overflow-y-auto p-[1.4vh]">
                    {rows(t('outfit_components'), 'components', COMPONENTS)}
                    {rows(t('outfit_props'), 'props', PROPS)}
                </div>
            </motion.div>
            {leaving && (
                <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/70">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.97 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.16 }}
                        className="flex w-[46vh] flex-col gap-[1.4vh] rounded-[0.7vh] border border-white/10 bg-neutral-950 p-[2vh] shadow-2xl"
                    >
                        <span className="text-[1.7vh] font-bold text-white/95">{t('outfit_leave_title')}</span>
                        <span className="text-[1.3vh] leading-relaxed text-white/45">{t('outfit_leave_body')}</span>

                        <div className="flex gap-[0.8vh]">
                            <button
                                type="button"
                                onClick={() => setLeaving(false)}
                                className="flex h-[3.2vh] flex-1 items-center justify-center rounded-[0.4vh] border border-white/15 text-[1.35vh] font-semibold text-white/60 transition-colors hover:border-white/30 hover:text-white/90"
                            >
                                {t('outfit_leave_back')}
                            </button>

                            <button
                                type="button"
                                onClick={() => {
                                    if (!isEnvBrowser()) void fetchNui('outfit_close');

                                    revertOutfit();
                                }}
                                className="flex h-[3.2vh] flex-1 items-center justify-center rounded-[0.4vh] border border-red-500/40 bg-red-500/10 text-[1.35vh] font-semibold text-red-300 transition-colors hover:bg-red-500/20"
                            >
                                {t('outfit_leave_discard')}
                            </button>

                            <button
                                type="button"
                                onClick={() => {
                                    if (!isEnvBrowser()) void fetchNui('outfit_close');

                                    closeOutfit();
                                }}
                                className="flex h-[3.2vh] flex-1 items-center justify-center rounded-[0.4vh] bg-primary text-[1.35vh] font-bold text-neutral-900 transition-colors hover:bg-primary/90"
                            >
                                {t('outfit_leave_keep')}
                            </button>
                        </div>
                    </motion.div>
                </div>
            )}
        </div>
    );
}

function Hint({ keys, label }: { keys: string; label: string }) {
    return (
        <span className="flex items-center gap-[0.5vh]">
            <span className="font-mono text-[1.05vh] font-bold text-white/70">{keys}</span>
            {label}
        </span>
    );
}

function CamButton({ icon, label, onClick }: { icon: string; label: string; onClick: () => void }) {
    return (
        <button
            type="button"
            title={label}
            onClick={onClick}
            className="flex h-[3vh] w-[3vh] items-center justify-center rounded-[0.4vh] border border-white/15 bg-neutral-900/80 text-[1.2vh] text-white/60 backdrop-blur transition-colors hover:border-primary/50 hover:text-primary"
        >
            <i className={`fas ${icon}`} />
        </button>
    );
}
