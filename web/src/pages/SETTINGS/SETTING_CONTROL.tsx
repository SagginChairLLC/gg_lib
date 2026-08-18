import { useEffect, useMemo, useRef, useState } from 'react';
import { HexColorPicker } from 'react-colorful';
import { t } from '@/data/useLang';
import { fetchNui } from '@/lib/fetchNui';
import { matchColorNotation, parseColor } from '@/lib/color-utils';
import { BLIP_COLORS, BLIP_COLOR_BY_ID, BLIP_SPRITES, BLIP_SPRITE_BY_ID, spriteImageUrl } from '@/data/blips';
import { PEDS, PED_BY_MODEL, pedImageUrl } from '@/data/peds';
import { openPicker } from '@/data/usePicker';
import { effectiveValue, useSettings, type SettingField, type SettingOption, type SettingType } from '@/data/useSettings';

/**
 * The typed control kit for the settings editor. Every value type renders
 * through here — top-level entries, object sub-fields and list rows all share
 * the same primitives, which is what keeps the whole panel looking like one
 * instrument instead of a pile of forms.
 */

const INPUT = 'h-[3.6vh] w-full rounded-[0.6vh] border border-white/10 bg-neutral-950/60 px-[1.1vh] text-[1.5vh] text-white/90 transition-colors focus:border-primary/60';

/** Minimal definition a control needs — SettingEntry and SettingField both satisfy it. */
export type ControlDef = {
    type?: SettingType;
    min?: number;
    max?: number;
    step?: number;
    suffix?: string;
    options?: SettingOption[];
    fields?: SettingField[];
    item?: SettingField[];
    item_type?: string;
    item_default?: Record<string, unknown>;
    min_items?: number;
    max_items?: number;
    nullable?: boolean;
    /** coords only: sibling paths whose values drive the in-world preview. */
    preview_from?: Record<string, string>;
};

type ControlProps = {
    def: ControlDef;
    value: unknown;
    onChange: (value: unknown) => void;
    disabled?: boolean;
};

//--------------------------------------------------
// MARK: Path helpers
//--------------------------------------------------
// Object fields address their slot with dotted keys ("face.drawable"), exactly
// like the Lua side's settings.read/write. Absence is meaningful for nullable
// fields, so writing `undefined` deletes the key rather than storing a null.

function readPath(root: unknown, path: string): unknown {
    let node: unknown = root;

    for (const part of path.split('.')) {
        if (node === null || typeof node !== 'object') return undefined;
        node = (node as Record<string, unknown>)[part];
    }

    return node;
}

function writePath(root: Record<string, unknown>, path: string, value: unknown): Record<string, unknown> {
    const parts = path.split('.');
    const out = { ...root };
    let node = out;

    for (let index = 0; index < parts.length - 1; index += 1) {
        const key = parts[index];
        const next = node[key];
        node[key] = next !== null && typeof next === 'object' && !Array.isArray(next) ? { ...(next as Record<string, unknown>) } : {};
        node = node[key] as Record<string, unknown>;
    }

    const leaf = parts[parts.length - 1];

    if (value === undefined) delete node[leaf];
    else node[leaf] = value;

    return out;
}

//--------------------------------------------------
// MARK: Boolean
//--------------------------------------------------

function BooleanControl({ value, onChange, disabled }: ControlProps) {
    const on = value === true;

    return (
        <button
            type="button"
            disabled={disabled}
            onClick={() => onChange(!on)}
            className={`relative h-[2.6vh] w-[5vh] flex-shrink-0 rounded-full border transition-colors duration-200 ${
                on ? 'border-primary/60 bg-primary/80 shadow-[0_0_10px_rgba(var(--primary-rgb),0.35)]' : 'border-white/10 bg-neutral-700/70'
            } ${disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}
        >
            <span
                className={`absolute top-1/2 h-[1.9vh] w-[1.9vh] -translate-y-1/2 rounded-full transition-all duration-200 ${
                    on ? 'left-[2.7vh] bg-neutral-900' : 'left-[0.35vh] bg-white/70'
                }`}
            />
        </button>
    );
}

//--------------------------------------------------
// MARK: Numbers
//--------------------------------------------------
// Free typing is buffered locally so "-", "" or a half-typed number never snaps
// back mid-keystroke; the parsed value commits on blur or Enter.

function NumberInput({
    value,
    onCommit,
    min,
    max,
    step,
    suffix,
    disabled,
    allowEmpty,
    className,
}: {
    value: number | undefined;
    onCommit: (value: number | undefined) => void;
    min?: number;
    max?: number;
    step?: number;
    suffix?: string;
    disabled?: boolean;
    /** Empty input commits `undefined` — used by nullable object fields. */
    allowEmpty?: boolean;
    className?: string;
}) {
    const [text, setText] = useState(value === undefined ? '' : String(value));
    const [focused, setFocused] = useState(false);

    useEffect(() => {
        if (!focused) setText(value === undefined ? '' : String(value));
    }, [value, focused]);

    const commit = () => {
        setFocused(false);

        if (text.trim() === '' && allowEmpty) {
            if (value !== undefined) onCommit(undefined);
            return;
        }

        let parsed = Number(text);

        if (Number.isNaN(parsed)) {
            setText(value === undefined ? '' : String(value));
            return;
        }

        if (min !== undefined && parsed < min) parsed = min;
        if (max !== undefined && parsed > max) parsed = max;

        setText(String(parsed));

        // Focusing a field and leaving it is not an edit. Committing regardless
        // would stage every field the admin merely clicked through.
        if (parsed !== value) onCommit(parsed);
    };

    return (
        <div className={`relative ${className ?? 'w-full'}`}>
            <input
                type="text"
                inputMode="decimal"
                value={text}
                disabled={disabled}
                placeholder={allowEmpty ? t('settings_unset') : undefined}
                onFocus={() => setFocused(true)}
                onChange={(event) => setText(event.target.value)}
                onBlur={commit}
                onKeyDown={(event) => {
                    if (event.key === 'Enter') (event.target as HTMLInputElement).blur();
                    if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
                        event.preventDefault();
                        const base = Number(text) || value || 0;
                        const delta = (step ?? 1) * (event.key === 'ArrowUp' ? 1 : -1);
                        let next = Math.round((base + delta) * 1000) / 1000;
                        if (min !== undefined && next < min) next = min;
                        if (max !== undefined && next > max) next = max;
                        setText(String(next));
                        onCommit(next);
                    }
                }}
                className={`${INPUT} ${suffix ? 'pr-[3.4vh]' : ''} ${disabled ? 'cursor-not-allowed opacity-50' : ''} placeholder:text-white/25`}
            />
            {suffix && <span className="pointer-events-none absolute right-[1vh] top-1/2 -translate-y-1/2 text-[1.25vh] font-semibold uppercase tracking-wide text-white/35">{suffix}</span>}
        </div>
    );
}

// Always a typed field. Bounds are enforced on commit and shown as a hint on
// the row, so a number is entered rather than dragged for.
function NumericControl({ def, value, onChange, disabled }: ControlProps) {
    const numeric = typeof value === 'number' ? value : undefined;

    return <NumberInput value={numeric} onCommit={(next) => next !== undefined && onChange(next)} min={def.min} max={def.max} step={def.step} suffix={def.suffix} disabled={disabled} />;
}

//--------------------------------------------------
// MARK: Enum
//--------------------------------------------------

function optionValue(option: SettingOption): string {
    return typeof option === 'string' ? option : option.value;
}

function optionLabel(option: SettingOption): string {
    return typeof option === 'string' ? option : option.label;
}

/**
 * Past this many options a dropdown stops being scannable and needs a search
 * box, so the field opens the side drawer instead. Below it — cash/bank, a
 * handful of positions — a dropdown is faster than a panel sliding in.
 */
const ENUM_DRAWER_THRESHOLD = 6;

function EnumControl({ def, value, onChange, disabled }: ControlProps) {
    const [open, setOpen] = useState(false);
    const [openUp, setOpenUp] = useState(false);
    const buttonRef = useRef<HTMLButtonElement | null>(null);
    const options = def.options ?? [];
    const selected = options.find((option) => optionValue(option) === value);

    if (options.length > ENUM_DRAWER_THRESHOLD) {
        return (
            <DrawerTrigger
                disabled={disabled}
                preview={<i className="fas fa-list w-[1.8vh] flex-shrink-0 text-center text-[1.3vh] text-white/35" />}
                label={selected ? optionLabel(selected) : String(value ?? '')}
                onOpen={() =>
                    openPicker({
                        title: t('picker_search'),
                        columns: 5,
                        value: String(value ?? ''),
                        allowCustom: false,
                        customHint: '',
                        items: options.map((option) => ({ id: optionValue(option), label: optionLabel(option) })),
                        onSelect: (next) => onChange(String(next)),
                    })
                }
            />
        );
    }

    const toggle = () => {
        if (disabled) return;

        // Flip the menu upward when the trigger sits in the lower part of the
        // viewport, so it never gets clipped by the scrolling settings list.
        const rect = buttonRef.current?.getBoundingClientRect();
        setOpenUp(!!rect && rect.bottom > window.innerHeight * 0.62);
        setOpen((current) => !current);
    };

    return (
        <div className="relative w-full">
            <button
                ref={buttonRef}
                type="button"
                onClick={toggle}
                disabled={disabled}
                className={`${INPUT} flex items-center justify-between gap-[1vh] text-left ${disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer hover:border-white/25'} ${open ? 'border-primary/60' : ''}`}
            >
                <span className={`truncate ${selected ? 'text-white/90' : 'text-white/35'}`}>{selected ? optionLabel(selected) : String(value ?? '')}</span>
                <i className={`fas fa-chevron-down flex-shrink-0 text-[1.1vh] text-white/40 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
            </button>

            {/* The panel is itself the scroller, so overscroll-contain is enough
                to keep the settings list behind it still. */}
            {open && (
                <>
                    <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
                    <div
                        className={`absolute left-0 right-0 z-50 max-h-[24vh] overflow-y-auto overscroll-contain rounded-[0.6vh] border border-white/15 bg-neutral-900 py-[0.4vh] shadow-2xl ${
                            openUp ? 'bottom-[calc(100%+0.4vh)]' : 'top-[calc(100%+0.4vh)]'
                        }`}
                    >
                        {options.map((option) => {
                            const isActive = optionValue(option) === value;

                            return (
                                <button
                                    key={optionValue(option)}
                                    type="button"
                                    onClick={() => {
                                        onChange(optionValue(option));
                                        setOpen(false);
                                    }}
                                    className={`flex w-full items-center justify-between gap-[1vh] px-[1.2vh] py-[0.7vh] text-left text-[1.45vh] transition-colors ${
                                        isActive ? 'bg-primary/15 text-primary' : 'text-white/80 hover:bg-white/5'
                                    }`}
                                >
                                    <span className="truncate">{optionLabel(option)}</span>
                                    {isActive && <i className="fas fa-check flex-shrink-0 text-[1.2vh]" />}
                                </button>
                            );
                        })}
                    </div>
                </>
            )}
        </div>
    );
}

//--------------------------------------------------
// MARK: Coords
//--------------------------------------------------
// A world position is placed in game, not typed. The numbers stay visible
// because they are worth reading back, but they are not the way in.

type Coords = { x: number; y: number; z: number; heading: number };

/**
 * One position out of whatever the admin pasted.
 *
 * Accepts the shapes a position actually gets copied from: `vector4(x, y, z, h)`
 * straight out of a config, the shorthand `vec4`/`vec3` forms, or bare numbers
 * separated by commas or spaces. The label is stripped before the numbers are
 * read, or the 4 in `vec4` would be parsed as the X coordinate.
 */
export function parseCoords(text: string): Coords | null {
    const numbers = text.replace(/vec(?:tor)?[234]?/gi, ' ').match(/-?\d+(?:\.\d+)?/g);
    if (!numbers || numbers.length < 3) return null;

    const [x, y, z, heading] = numbers.map(Number);
    if (![x, y, z].every(Number.isFinite)) return null;

    return { x, y, z, heading: normaliseHeading(heading) };
}

/**
 * Only wraps a heading that is actually out of range.
 *
 * `((h % 360) + 360) % 360` drifts a valid heading by a float ulp — 324.44
 * comes back as 324.44000000000005 — which is enough to make a position differ
 * from its default forever and re-save on every visit.
 */
function normaliseHeading(value: number): number {
    if (!Number.isFinite(value)) return 0;
    if (value >= 0 && value < 360) return value;

    return ((value % 360) + 360) % 360;
}

/** Every position in a pasted block — one per vector4(), else one per line. */
export function parseCoordsList(text: string): Coords[] {
    const out: Coords[] = [];

    // A whole config block pastes as one line, so the vector calls are what
    // separate the entries there — not the newlines.
    const groups = text.match(/vec(?:tor)?[234]?\s*\([^)]*\)/gi);

    for (const chunk of groups ?? text.split(/[\r\n]+/)) {
        const parsed = parseCoords(chunk);
        if (parsed) out.push(parsed);
    }

    return out;
}

/** Round-trips through parseCoords, so what is shown can be pasted back in. */
export function formatCoords(value: Partial<Coords> | null | undefined): string {
    if (!value || typeof value.x !== 'number') return '';

    const parts = [value.x, value.y, value.z, value.heading ?? 0];

    return parts.map((part) => (typeof part === 'number' ? part.toFixed(2) : '0.00')).join(', ');
}

//--------------------------------------------------
// MARK: Row Actions
//--------------------------------------------------

export type RowAction = {
    id: string;
    label: string;
    icon: string;
    /** Rendered below a divider, in red. Delete lives here. */
    danger?: boolean;
    disabled?: boolean;
    busy?: boolean;
    run: () => void;
};

/**
 * The one place a row's verbs live. A position can be re-placed, teleported to
 * or removed, and hanging three buttons off every row buries the values they
 * belong to — so they collapse into a single menu instead.
 */
function RowActions({ actions, disabled }: { actions: RowAction[]; disabled?: boolean }) {
    const [open, setOpen] = useState(false);
    const [upward, setUpward] = useState(false);
    const holder = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        if (!open) return;

        const onDown = (event: MouseEvent) => {
            if (!holder.current?.contains(event.target as Node)) setOpen(false);
        };
        const onKey = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                event.stopPropagation();
                setOpen(false);
            }
        };

        document.addEventListener('mousedown', onDown);
        document.addEventListener('keydown', onKey, true);

        return () => {
            document.removeEventListener('mousedown', onDown);
            document.removeEventListener('keydown', onKey, true);
        };
    }, [open]);

    if (disabled || !actions.length) return null;

    const usable = actions.filter((action) => !action.disabled);
    const normal = usable.filter((action) => !action.danger);
    const danger = usable.filter((action) => action.danger);

    return (
        <div ref={holder} className="relative flex-shrink-0">
            <button
                type="button"
                onClick={(event) => {
                    // Menus near the bottom of a scrolling list would open into
                    // the clipped area, so they flip up instead.
                    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
                    setUpward(window.innerHeight - rect.bottom < usable.length * 42 + 40);
                    setOpen((state) => !state);
                }}
                className={`flex h-[3.4vh] w-[3.4vh] items-center justify-center rounded-[0.5vh] border text-[1.4vh] transition-colors ${
                    open ? 'border-primary/50 bg-primary/10 text-primary' : 'border-white/10 text-white/40 hover:border-white/30 hover:text-white/80'
                }`}
            >
                <i className="fas fa-ellipsis-vertical" />
            </button>

            {open && (
                <div
                    className={`absolute right-0 z-30 flex w-[22vh] flex-col overflow-hidden rounded-[0.6vh] border border-white/15 bg-neutral-900 py-[0.4vh] shadow-[0_1vh_3vh_rgba(0,0,0,0.6)] ${
                        upward ? 'bottom-full mb-[0.5vh]' : 'top-full mt-[0.5vh]'
                    }`}
                >
                    {normal.map((action) => (
                        <button
                            key={action.id}
                            type="button"
                            onClick={() => {
                                setOpen(false);
                                action.run();
                            }}
                            className="flex items-center gap-[1vh] px-[1.2vh] py-[0.8vh] text-left text-[1.4vh] text-white/75 transition-colors hover:bg-primary/15 hover:text-primary"
                        >
                            <i className={`fas ${action.busy ? 'fa-spinner fa-spin' : action.icon} w-[1.8vh] flex-shrink-0 text-[1.3vh]`} />
                            {action.label}
                        </button>
                    ))}

                    {normal.length > 0 && danger.length > 0 && <span className="my-[0.4vh] h-px bg-white/10" />}

                    {danger.map((action) => (
                        <button
                            key={action.id}
                            type="button"
                            onClick={() => {
                                setOpen(false);
                                action.run();
                            }}
                            className="flex items-center gap-[1vh] px-[1.2vh] py-[0.8vh] text-left text-[1.4vh] text-red-300/80 transition-colors hover:bg-red-500/15 hover:text-red-300"
                        >
                            <i className={`fas ${action.icon} w-[1.8vh] flex-shrink-0 text-[1.3vh]`} />
                            {action.label}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}

/**
 * Turn { model: "settings.depot.ped_model" } into { model: "g_m_m_armboss_01" }
 * by reading those paths out of the script currently open, staged edits
 * included — placing a ped right after changing its model should preview the
 * new one.
 */
function resolvePreview(from: Record<string, string> | undefined): Record<string, unknown> | undefined {
    if (!from) return undefined;

    const state = useSettings.getState();
    const script = state.scripts.find((candidate) => candidate.resource === state.activeResource);
    if (!script) return undefined;

    const resolved: Record<string, unknown> = {};

    for (const [key, path] of Object.entries(from)) {
        const entry = script.entries.find((candidate) => candidate.path === path);
        if (entry) resolved[key] = effectiveValue(script.resource, entry);
    }

    return resolved;
}

function CoordsControl({ def, value, onChange, disabled }: ControlProps) {
    const [placing, setPlacing] = useState(false);
    const current = (value ?? {}) as Partial<Coords>;

    const pick = async () => {
        if (disabled || placing) return;
        setPlacing(true);

        try {
            const response = await fetchNui<{ ok: boolean; COORDS?: Coords }>('settings_pick_coords', {
                current,
                // `preview_from` names sibling settings holding the model and
                // scenario, so the ped placed is the ped that will stand there.
                preview: resolvePreview(def.preview_from),
            });

            if (response?.ok && response.COORDS) onChange(response.COORDS);
        } finally {
            setPlacing(false);
        }
    };

    return (
        <div className="flex w-full items-center gap-[0.6vh]">
            <CoordsFields value={current} disabled={disabled} onChange={onChange} />
            <RowActions disabled={disabled} actions={[placeAction(pick, placing), teleportAction(current)]} />
        </div>
    );
}

/**
 * One box, not four cells. A position is edited by pasting a whole one over the
 * top of it far more often than by nudging a single axis, and four separate
 * inputs make that the awkward path instead of the easy one.
 */
function CoordsFields({ value, disabled, onChange }: { value: Partial<Coords>; disabled?: boolean; onChange: (next: Coords) => void }) {
    const [text, setText] = useState(formatCoords(value));
    const [focused, setFocused] = useState(false);

    useEffect(() => {
        if (!focused) setText(formatCoords(value));
    }, [value.x, value.y, value.z, value.heading, focused]);

    const commit = (raw: string) => {
        const parsed = parseCoords(raw);

        // Unparseable input reverts rather than storing a broken position.
        if (!parsed) {
            setText(formatCoords(value));
            return;
        }

        const next = formatCoords(parsed);
        setText(next);

        // Compared as displayed, not as stored: the box shows two decimals, so
        // re-committing what it shows is a no-op even when the stored value
        // carries more precision than that.
        if (next !== formatCoords(value)) onChange(parsed);
    };

    return (
        <input
            type="text"
            value={text}
            disabled={disabled}
            spellCheck={false}
            placeholder="x, y, z, heading"
            onFocus={() => setFocused(true)}
            onChange={(event) => setText(event.target.value)}
            onPaste={(event) => {
                const parsed = parseCoords(event.clipboardData.getData('text'));
                if (!parsed) return;

                // Tidied the moment it lands, so a pasted vector4(...) or a
                // vector3 short of a heading reads back as plain numbers.
                event.preventDefault();

                const next = formatCoords(parsed);
                setText(next);
                if (next !== formatCoords(value)) onChange(parsed);
            }}
            onBlur={() => {
                setFocused(false);
                commit(text);
            }}
            onKeyDown={(event) => event.key === 'Enter' && (event.target as HTMLInputElement).blur()}
            className={`${INPUT} min-w-0 flex-1 font-mono text-[1.35vh] ${disabled ? 'cursor-not-allowed opacity-50' : ''} placeholder:text-white/20`}
        />
    );
}

/** Shared by the standalone control and every row in a position list. */
function placeAction(run: () => void, busy: boolean): RowAction {
    return { id: 'place', label: t('settings_place_in_world'), icon: 'fa-location-crosshairs', busy, run };
}

function teleportAction(coords: Partial<Coords>): RowAction {
    return {
        id: 'teleport',
        label: t('settings_teleport'),
        icon: 'fa-person-walking-arrow-right',
        disabled: typeof coords.x !== 'number',
        run: () => void fetchNui('settings_teleport', { coords }),
    };
}

//--------------------------------------------------
// MARK: Drawer Pickers
//--------------------------------------------------
// Blip colors, blip icons and peds are all the same shape of problem: a few
// hundred options that cannot be judged from a name. They open the side drawer
// rather than a dropdown -- a dropdown is bounded by the width of the value
// column it hangs off, which is not enough room for a legible grid, a search
// box and a custom entry at once.

/** The field itself: a preview, the current value, and a hint that it opens. */
function DrawerTrigger({
    preview,
    label,
    note,
    disabled,
    onOpen,
}: {
    preview: React.ReactNode;
    label: string;
    note?: string;
    disabled?: boolean;
    onOpen: () => void;
}) {
    return (
        <button
            type="button"
            onClick={onOpen}
            disabled={disabled}
            className={`${INPUT} flex items-center justify-between gap-[1vh] text-left ${disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer hover:border-white/25'}`}
        >
            <span className="flex min-w-0 flex-1 items-center gap-[0.8vh]">
                {preview}
                <span className="truncate font-mono text-[1.35vh] text-white/90">{label}</span>
                {note && (
                    <span className="flex-shrink-0 rounded-[0.4vh] border border-white/15 px-[0.6vh] text-[1.05vh] uppercase tracking-wide text-white/35">{note}</span>
                )}
            </span>
            <i className="fas fa-chevron-right flex-shrink-0 text-[1.1vh] text-white/40" />
        </button>
    );
}

function BlipColorControl({ value, onChange, disabled }: ControlProps) {
    const current = BLIP_COLOR_BY_ID.get(Number(value));

    return (
        <DrawerTrigger
            disabled={disabled}
            preview={<span className="h-[1.8vh] w-[1.8vh] flex-shrink-0 rounded-[0.3vh] border border-white/25" style={{ backgroundColor: current?.hex ?? '#000' }} />}
            label={current ? `${current.name}  ·  ${current.id}` : String(value ?? '')}
            onOpen={() =>
                openPicker({
                    title: t('settings_blip_search_color'),
                    columns: 6,
                    value: Number(value),
                    allowCustom: false,
                    customHint: '',
                    items: BLIP_COLORS.map((color) => ({ id: color.id, label: color.name, sublabel: String(color.id), swatch: color.hex })),
                    onSelect: (next) => onChange(Number(next)),
                })
            }
        />
    );
}

function BlipSpriteControl({ value, onChange, disabled }: ControlProps) {
    const current = BLIP_SPRITE_BY_ID.get(Number(value));

    return (
        <DrawerTrigger
            disabled={disabled}
            preview={
                current ? (
                    <img src={spriteImageUrl(current.name)} alt="" loading="lazy" decoding="async" className="h-[2.2vh] w-[2.2vh] flex-shrink-0 object-contain" />
                ) : (
                    <span className="h-[2.2vh] w-[2.2vh] flex-shrink-0 rounded-[0.3vh] bg-white/[0.06]" />
                )
            }
            label={current ? `${current.label}  ·  ${current.id}` : String(value ?? '')}
            onOpen={() =>
                openPicker({
                    title: t('settings_blip_search_sprite'),
                    columns: 8,
                    value: Number(value),
                    allowCustom: true,
                    customHint: t('picker_hint_id'),
                    items: BLIP_SPRITES.map((sprite) => ({
                        id: sprite.id,
                        label: sprite.label,
                        sublabel: String(sprite.id),
                        image: spriteImageUrl(sprite.name),
                        imageAlt: spriteImageUrl(sprite.name, 'gif'),
                    })),
                    onSelect: (next) => onChange(Number(next) || 0),
                })
            }
        />
    );
}

function PedControl({ value, onChange, disabled }: ControlProps) {
    const current = String(value ?? '');
    const known = PED_BY_MODEL.get(current);

    return (
        <DrawerTrigger
            disabled={disabled}
            preview={
                current ? (
                    <img src={pedImageUrl(current)} alt="" loading="lazy" decoding="async" className="h-[2.4vh] w-[2.4vh] flex-shrink-0 rounded-[0.3vh] bg-black/30 object-cover object-top" />
                ) : (
                    <span className="h-[2.4vh] w-[2.4vh] flex-shrink-0 rounded-[0.3vh] bg-white/[0.06]" />
                )
            }
            label={current || t('settings_unset')}
            note={current && !known ? t('settings_ped_custom') : undefined}
            onOpen={() =>
                openPicker({
                    title: t('settings_ped_search'),
                    columns: 5,
                    value: current,
                    allowCustom: true,
                    customHint: t('picker_hint_ped'),
                    items: PEDS.map((ped) => ({ id: ped.model, label: ped.model, sublabel: ped.category, image: pedImageUrl(ped.model) })),
                    onSelect: (next) => onChange(String(next).trim().toLowerCase()),
                })
            }
        />
    );
}

function toHex(color: string): string {
    if (/^#[0-9A-Fa-f]{6}$/.test(color)) return color;
    if (/^#[0-9A-Fa-f]{3}$/.test(color)) {
        return `#${color[1]}${color[1]}${color[2]}${color[2]}${color[3]}${color[3]}`;
    }

    const parsed = parseColor(color);
    if (!parsed.spaceSeparated) return '#ffffff';

    const [r, g, b] = parsed.spaceSeparated.split(' ').map(Number);
    return `#${[r, g, b].map((channel) => channel.toString(16).padStart(2, '0')).join('')}`;
}

function ColorControl({ value, onChange, disabled }: ControlProps) {
    const [open, setOpen] = useState(false);
    const [text, setText] = useState(String(value ?? ''));
    const [focused, setFocused] = useState(false);
    const color = String(value ?? '#ffffff');
    const hex = toHex(color);

    // The picker and the presets only speak hex; keep whichever notation the
    // setting was already written in.
    const emit = (next: string) => onChange(matchColorNotation(next, color));

    useEffect(() => {
        if (!focused) setText(color);
    }, [color, focused]);

    const commitText = () => {
        setFocused(false);
        const trimmed = text.trim();
        const valid = /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/.test(trimmed) || /^rgba?\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*[,)]/.test(trimmed);

        if (valid) onChange(trimmed);
        else setText(color);
    };

    return (
        <div className="w-full">
            <div className="flex items-center gap-[0.8vh]">
                <button
                    type="button"
                    disabled={disabled}
                    onClick={() => setOpen((current) => !current)}
                    className={`h-[3.6vh] w-[3.6vh] flex-shrink-0 rounded-[0.6vh] border transition-all ${open ? 'border-primary/70' : 'border-white/20'} ${
                        disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer hover:scale-105'
                    }`}
                    style={{ backgroundColor: hex, boxShadow: `0 0 10px ${hex}55` }}
                />
                <input
                    type="text"
                    value={text}
                    disabled={disabled}
                    onFocus={() => setFocused(true)}
                    onChange={(event) => setText(event.target.value)}
                    onBlur={commitText}
                    onKeyDown={(event) => event.key === 'Enter' && (event.target as HTMLInputElement).blur()}
                    className={`${INPUT} font-mono ${disabled ? 'cursor-not-allowed opacity-50' : ''}`}
                />
            </div>

            {/* Expands inline rather than floating, so it can never be clipped by the scroll container. */}
            {open && !disabled && (
                <div className="mt-[0.8vh] w-full rounded-[0.8vh] border border-white/10 bg-neutral-950/70 p-[1.2vh]">
                    <HexColorPicker color={hex} onChange={(next) => emit(next)} style={{ width: '100%', height: '14vh' }} />
                    <div className="mt-[1vh] flex flex-wrap gap-[0.6vh]">
                        {['#fcba03', '#fb923c', '#f43f5e', '#a78bfa', '#22d3ee', '#4ade80', '#f8fafc'].map((preset) => (
                            <button
                                key={preset}
                                type="button"
                                onClick={() => emit(preset)}
                                className="h-[2.4vh] w-[2.4vh] rounded-[0.4vh] border border-white/20 transition-transform hover:scale-110"
                                style={{ backgroundColor: preset }}
                            />
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

//--------------------------------------------------
// MARK: Time
//--------------------------------------------------

function TimeControl({ value, onChange, disabled }: ControlProps) {
    const [text, setText] = useState(String(value ?? ''));
    const [focused, setFocused] = useState(false);

    useEffect(() => {
        if (!focused) setText(String(value ?? ''));
    }, [value, focused]);

    const commit = () => {
        setFocused(false);
        const match = text.trim().match(/^(\d{1,2}):(\d{2})$/);

        if (match && Number(match[1]) <= 23 && Number(match[2]) <= 59) {
            onChange(`${match[1].padStart(2, '0')}:${match[2]}`);
        } else {
            setText(String(value ?? ''));
        }
    };

    return (
        <div className="relative w-full">
            <input
                type="text"
                value={text}
                disabled={disabled}
                placeholder="HH:MM"
                maxLength={5}
                onFocus={() => setFocused(true)}
                onChange={(event) => setText(event.target.value)}
                onBlur={commit}
                onKeyDown={(event) => event.key === 'Enter' && (event.target as HTMLInputElement).blur()}
                className={`${INPUT} pr-[3.6vh] font-mono tracking-widest ${disabled ? 'cursor-not-allowed opacity-50' : ''} placeholder:text-white/25`}
            />
            <i className="fas fa-clock pointer-events-none absolute right-[1.1vh] top-1/2 -translate-y-1/2 text-[1.4vh] text-white/35" />
        </div>
    );
}

//--------------------------------------------------
// MARK: Keybind
//--------------------------------------------------
// Capture mode is flagged on <body> so the global Escape handler in
// PAGE_HANDLER knows an Escape here means "cancel capture", not "close the UI".

function KeybindControl({ value, onChange, disabled }: ControlProps) {
    const [capturing, setCapturing] = useState(false);

    useEffect(() => {
        if (capturing) document.body.dataset.captureKey = '1';
        else delete document.body.dataset.captureKey;

        return () => {
            delete document.body.dataset.captureKey;
        };
    }, [capturing]);

    return (
        <button
            type="button"
            disabled={disabled}
            onClick={() => setCapturing(true)}
            onBlur={() => setCapturing(false)}
            onKeyDown={(event) => {
                if (!capturing) return;
                event.preventDefault();
                event.stopPropagation();

                if (event.key === 'Escape') {
                    setCapturing(false);
                    return;
                }

                onChange(event.key.toUpperCase());
                setCapturing(false);
            }}
            className={`flex h-[3.6vh] w-full items-center justify-center rounded-[0.6vh] border text-[1.5vh] font-bold uppercase tracking-widest transition-colors ${
                capturing ? 'animate-pulse border-primary/70 bg-primary/10 text-primary' : 'border-white/10 bg-neutral-950/60 text-white/90 hover:border-white/25'
            } ${disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}
        >
            {capturing ? t('settings_press_key') : String(value ?? '')}
        </button>
    );
}

//--------------------------------------------------
// MARK: String
//--------------------------------------------------

function StringControl({ value, onChange, disabled }: ControlProps) {
    const [text, setText] = useState(String(value ?? ''));
    const [focused, setFocused] = useState(false);

    useEffect(() => {
        if (!focused) setText(String(value ?? ''));
    }, [value, focused]);

    return (
        <input
            type="text"
            value={text}
            disabled={disabled}
            onFocus={() => setFocused(true)}
            onChange={(event) => setText(event.target.value)}
            onBlur={() => {
                setFocused(false);
                if (text !== String(value ?? '')) onChange(text);
            }}
            onKeyDown={(event) => event.key === 'Enter' && (event.target as HTMLInputElement).blur()}
            className={`${INPUT} ${disabled ? 'cursor-not-allowed opacity-50' : ''}`}
        />
    );
}

//--------------------------------------------------
// MARK: Object
//--------------------------------------------------

function ObjectControl({ def, value, onChange, disabled }: ControlProps) {
    const record = value !== null && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
    const fields = def.fields ?? [];

    // Wide objects (the uniform's 24 slots) pack tighter than a 2-field position.
    const columns = fields.length > 8 ? 'grid-cols-4' : fields.length > 2 ? 'grid-cols-3' : 'grid-cols-2';

    return (
        <div className={`grid w-full gap-x-[1.2vh] gap-y-[1vh] ${columns}`}>
            {fields.map((field) => {
                const fieldValue = readPath(record, field.key);

                return (
                    <div
                        key={field.key}
                        className="flex min-w-0 flex-col gap-[0.4vh]"
                        style={isWideType(field.type) ? { gridColumn: '1 / -1' } : undefined}
                    >
                        <span className="truncate text-[1.2vh] font-semibold uppercase tracking-wide text-white/40" title={field.help}>
                            {field.label ?? field.key}
                            {field.nullable && <i className="fas fa-circle-info ml-[0.5vh] text-[1vh] text-white/25" title={field.help} />}
                        </span>
                        <SettingControl
                            def={field}
                            value={fieldValue}
                            disabled={disabled}
                            onChange={(next) => onChange(writePath(record, field.key, next))}
                        />
                    </div>
                );
            })}
        </div>
    );
}

//--------------------------------------------------
// MARK: List
//--------------------------------------------------

/**
 * A row's one-line summary while collapsed — its name, then whatever short
 * scalars follow. Enough to pick the right row out without opening it.
 */
function rowSummary(row: unknown, fields: SettingField[]): string {
    if (row === null || typeof row !== 'object') return String(row ?? '');

    const parts: string[] = [];

    for (const field of fields) {
        if (isWideType(field.type)) continue;

        const raw = readPath(row as Record<string, unknown>, field.key);
        if (raw === undefined || raw === null || raw === '') continue;

        parts.push(typeof raw === 'boolean' ? `${field.label ?? field.key}: ${raw ? 'On' : 'Off'}` : String(raw));
        if (parts.length === 3) break;
    }

    return parts.join('  ·  ');
}

/**
 * The wide fields inside a row, as "51 Pickup Points" labels.
 *
 * A zone row is three short columns and then fifty-one coordinates. Without
 * this the row gives no sign the coordinates are in there at all.
 */
function nestedCounts(row: unknown, fields: SettingField[]): { label: string; count: number }[] {
    if (row === null || typeof row !== 'object') return [];

    const out: { label: string; count: number }[] = [];

    for (const field of fields) {
        if (field.type !== 'list') continue;

        const raw = readPath(row as Record<string, unknown>, field.key);
        out.push({ label: field.label ?? field.key, count: Array.isArray(raw) ? raw.length : 0 });
    }

    return out;
}

/** Rows rendered at once. A rider roster is 200+ long; mounting it all stutters. */
export const ROWS_PER_PAGE = 20;

/**
 * Which rows a filter leaves visible, as indices into the full list.
 *
 * Indices stay absolute on purpose: page 6 row 3 must still write row 103 of
 * the stored value, and a filtered view must edit the row it actually found.
 */
export function visibleIndices(rows: unknown[], itemFields: SettingField[] | undefined, needle: string): number[] {
    const all = rows.map((_, index) => index);

    const search = needle.trim().toLowerCase();
    if (!search || !itemFields) return all;

    return all.filter((index) => rowSummary(rows[index], itemFields).toLowerCase().includes(search));
}

function ListControl({ def, value, onChange, disabled }: ControlProps) {
    const rows = Array.isArray(value) ? value : [];
    const itemFields = def.item;
    const canRemove = rows.length > (def.min_items ?? 0);
    const canAdd = def.max_items === undefined || rows.length < def.max_items;

    // A row holding a nested list or object opens on its own rather than in
    // place: a zone carries fifty-one coordinates, which is a page, not a
    // drawer. A row of plain scalars stays inline.
    const nested = (itemFields ?? []).some((field) => isWideType(field.type));
    const [openRow, setOpenRow] = useState<number | null>(null);

    const [page, setPage] = useState(0);
    const [filter, setFilter] = useState('');
    const [placing, setPlacing] = useState(false);
    const [replacingRow, setReplacingRow] = useState<number | null>(null);
    const [importText, setImportText] = useState<string | null>(null);

    // A bare list of positions: placed in the world, typed, or pasted in bulk.
    const coordsList = !itemFields && def.item_type === 'coords';
    const imported = importText === null ? [] : parseCoordsList(importText);

    // Filtering works on the whole list, not the page, so a name on page 9 is
    // still findable. Indices stay absolute: editing row 3 of a filtered view
    // has to write row 187 of the value.
    const needle = filter;

    // Only object rows have anything to match on. A list of bare coordinates
    // still pages, but there is no text in it to filter by.
    const filterable = Boolean(itemFields);

    const indices = useMemo(() => visibleIndices(rows, itemFields, needle), [rows, needle, itemFields]);

    const pageCount = Math.max(1, Math.ceil(indices.length / ROWS_PER_PAGE));
    const current = Math.min(page, pageCount - 1);
    const paged = indices.slice(current * ROWS_PER_PAGE, current * ROWS_PER_PAGE + ROWS_PER_PAGE);
    const paginated = indices.length > ROWS_PER_PAGE;

    // Columns are sized off the narrow fields, since a wide one takes its own row.
    const narrowCount = (itemFields ?? []).filter((field) => !isWideType(field.type)).length;
    const columns = Math.min(Math.max(narrowCount, 1), 4);

    const updateRow = (index: number, next: unknown) => {
        const copy = [...rows];
        copy[index] = next;
        onChange(copy);
    };

    const removeRow = (index: number) => {
        onChange(rows.filter((_, rowIndex) => rowIndex !== index));
    };

    // Land on the new row rather than leaving it on a page nobody is looking at.
    const focusNewRow = () => {
        setFilter('');
        setPage(Math.floor(rows.length / ROWS_PER_PAGE));
    };

    const addRow = () => {
        const template = itemFields ? JSON.parse(JSON.stringify(def.item_default ?? {})) : def.item_type === 'number' || def.item_type === 'integer' ? 0 : '';
        onChange([...rows, template]);
        focusNewRow();
    };

    /** Opens the placement tool seeded from `from`, and returns what was placed. */
    const placeFrom = async (from: Partial<Coords>) =>
        fetchNui<{ ok: boolean; COORDS?: Coords }>('settings_pick_coords', {
            current: from,
            preview: resolvePreview(def.preview_from),
        });

    /**
     * A list of positions has nothing sensible to seed a blank row with — 0,0,0
     * is in the ocean. So adding one goes straight out to the placement tool and
     * appends whatever comes back, and cancelling adds nothing at all.
     *
     * Seeded from the last point so the tool opens on the cluster being extended
     * rather than wherever the admin happens to be standing.
     */
    const addPlacedRow = async () => {
        if (disabled || placing) return;
        setPlacing(true);

        try {
            const response = await placeFrom((rows[rows.length - 1] ?? {}) as Partial<Coords>);

            if (response?.ok && response.COORDS) {
                onChange([...rows, response.COORDS]);
                focusNewRow();
            }
        } finally {
            setPlacing(false);
        }
    };

    /** Re-place one that already exists, starting the tool where it currently sits. */
    const replaceRow = async (index: number) => {
        if (disabled || replacingRow !== null) return;
        setReplacingRow(index);

        try {
            const response = await placeFrom((rows[index] ?? {}) as Partial<Coords>);

            if (response?.ok && response.COORDS) updateRow(index, response.COORDS);
        } finally {
            setReplacingRow(null);
        }
    };

    const deleteAction = (index: number): RowAction => ({
        id: 'delete',
        label: t('settings_remove_row'),
        icon: 'fa-trash-can',
        danger: true,
        disabled: !canRemove,
        run: () => removeRow(index),
    });

    /** Every row carries the same menu; a position row just has more in it. */
    const rowActions = (index: number) => <RowActions disabled={disabled} actions={[deleteAction(index)]} />;

    const fieldGrid = (row: unknown, index: number) => (
        <div className="grid min-w-0 flex-1 gap-x-[1.2vh] gap-y-[0.8vh]" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
            {itemFields!.map((field) => (
                <div
                    key={field.key}
                    className="flex min-w-0 flex-col gap-[0.4vh]"
                    style={isWideType(field.type) ? { gridColumn: '1 / -1' } : undefined}
                >
                    <span className="truncate text-[1.15vh] font-semibold uppercase tracking-wide text-white/40" title={field.help}>
                        {field.label ?? field.key}
                    </span>
                    <SettingControl
                        def={field}
                        value={readPath(row, field.key)}
                        disabled={disabled}
                        onChange={(next) => updateRow(index, writePath(row !== null && typeof row === 'object' ? (row as Record<string, unknown>) : {}, field.key, next))}
                    />
                </div>
            ))}
        </div>
    );

    // One row, on its own, with a way back. Rendered instead of the list so a
    // zone's coordinates are not competing with the other zones for the page.
    if (nested && openRow !== null && rows[openRow] !== undefined) {
        return (
            <div className="flex w-full flex-col gap-[1vh]">
                <div className="flex items-center gap-[1vh] border-b border-white/10 pb-[1vh]">
                    <button
                        type="button"
                        onClick={() => setOpenRow(null)}
                        className="flex h-[3.2vh] flex-shrink-0 items-center gap-[0.7vh] rounded-[0.5vh] border border-white/10 px-[1.1vh] text-[1.3vh] font-semibold text-white/50 transition-colors hover:border-primary/40 hover:text-primary"
                    >
                        <i className="fas fa-chevron-left text-[1.1vh]" />
                        {t('settings_back')}
                    </button>

                    <span className="min-w-0 flex-1 truncate text-[1.6vh] font-bold text-white/90">{rowSummary(rows[openRow], itemFields!)}</span>

                    <span className="flex-shrink-0 font-mono text-[1.2vh] text-white/30">
                        {openRow + 1} / {rows.length}
                    </span>
                </div>

                {fieldGrid(rows[openRow], openRow)}
            </div>
        );
    }

    return (
        <div className="flex w-full flex-col gap-[0.8vh]">
            {paginated && (
                <div className="flex items-center gap-[1vh]">
                    {filterable ? (
                        <div className="relative min-w-0 flex-1">
                            <i className="fas fa-magnifying-glass pointer-events-none absolute left-[1vh] top-1/2 -translate-y-1/2 text-[1.2vh] text-white/25" />
                            <input
                                type="text"
                                value={filter}
                                placeholder={t('settings_filter_rows')}
                                onChange={(event) => {
                                    setFilter(event.target.value);
                                    setPage(0);
                                }}
                                className={`${INPUT} pl-[3vh]`}
                            />
                        </div>
                    ) : (
                        <span className="min-w-0 flex-1" />
                    )}

                    <span className="flex-shrink-0 font-mono text-[1.2vh] text-white/35">
                        {indices.length ? `${current * ROWS_PER_PAGE + 1}–${Math.min((current + 1) * ROWS_PER_PAGE, indices.length)} / ${indices.length}` : '0'}
                    </span>

                    <div className="flex flex-shrink-0 gap-[0.5vh]">
                        <button
                            type="button"
                            onClick={() => setPage(Math.max(0, current - 1))}
                            disabled={current === 0}
                            className={`flex h-[3vh] w-[3vh] items-center justify-center rounded-[0.5vh] border border-white/10 text-[1.2vh] transition-colors ${
                                current === 0 ? 'cursor-not-allowed text-white/15' : 'text-white/50 hover:border-primary/40 hover:text-primary'
                            }`}
                        >
                            <i className="fas fa-chevron-left" />
                        </button>
                        <button
                            type="button"
                            onClick={() => setPage(Math.min(pageCount - 1, current + 1))}
                            disabled={current >= pageCount - 1}
                            className={`flex h-[3vh] w-[3vh] items-center justify-center rounded-[0.5vh] border border-white/10 text-[1.2vh] transition-colors ${
                                current >= pageCount - 1 ? 'cursor-not-allowed text-white/15' : 'text-white/50 hover:border-primary/40 hover:text-primary'
                            }`}
                        >
                            <i className="fas fa-chevron-right" />
                        </button>
                    </div>
                </div>
            )}

            {paginated && indices.length === 0 && (
                <div className="py-[2vh] text-center text-[1.3vh] text-white/30">{t('settings_no_results')}</div>
            )}

            {paged.map((index) => {
                const row = rows[index];

                return nested ? (
                    <div key={index} className="flex items-center gap-[1vh] rounded-[0.6vh] border border-white/5 bg-neutral-950/40 p-[1vh]">
                        <button type="button" onClick={() => setOpenRow(index)} className="flex min-w-0 flex-1 items-center gap-[1vh] text-left">
                            <span className="flex h-[3.6vh] w-[3vh] flex-shrink-0 items-center justify-center rounded-[0.5vh] bg-white/5 font-mono text-[1.3vh] text-white/40">{index + 1}</span>
                            <span className="truncate text-[1.5vh] font-semibold text-white/80">{rowSummary(row, itemFields!)}</span>

                            {/* What is one level down, so the row says what
                                opening it is worth before it is opened. */}
                            <span className="ml-auto flex flex-shrink-0 items-center gap-[1vh]">
                                {nestedCounts(row, itemFields!).map((entry) => (
                                    <span key={entry.label} className="font-mono text-[1.2vh] text-white/35">
                                        {entry.count} {entry.label}
                                    </span>
                                ))}
                                <i className="fas fa-chevron-right text-[1.2vh] text-primary/70" />
                            </span>
                        </button>
                        {rowActions(index)}
                    </div>
                ) : (
                    <div key={index} className="flex items-center gap-[1vh] rounded-[0.6vh] border border-white/5 bg-neutral-950/40 p-[1vh]">
                        <span className="flex h-[3.4vh] w-[3vh] flex-shrink-0 items-center justify-center rounded-[0.5vh] bg-white/5 font-mono text-[1.3vh] text-white/40">{index + 1}</span>

                        {itemFields ? (
                            fieldGrid(row, index)
                        ) : coordsList ? (
                            <CoordsFields
                                value={(row ?? {}) as Partial<Coords>}
                                disabled={disabled}
                                onChange={(next) => updateRow(index, next)}
                            />
                        ) : (
                            <div className="min-w-0 flex-1">
                                <SettingControl
                                    def={{ type: (def.item_type as SettingType) ?? 'string', preview_from: def.preview_from }}
                                    value={row}
                                    disabled={disabled}
                                    onChange={(next) => updateRow(index, next)}
                                />
                            </div>
                        )}

                        {coordsList ? (
                            <RowActions
                                disabled={disabled}
                                actions={[
                                    placeAction(() => void replaceRow(index), replacingRow === index),
                                    teleportAction((row ?? {}) as Partial<Coords>),
                                    deleteAction(index),
                                ]}
                            />
                        ) : (
                            rowActions(index)
                        )}
                    </div>
                );
            })}

            {!disabled && coordsList && importText !== null && (
                <div className="flex flex-col gap-[0.8vh] rounded-[0.6vh] border border-primary/25 bg-primary/[0.04] p-[1.2vh]">
                    <span className="text-[1.3vh] text-white/50">{t('settings_bulk_hint')}</span>

                    <textarea
                        autoFocus
                        value={importText}
                        spellCheck={false}
                        onChange={(event) => setImportText(event.target.value)}
                        placeholder={'vector4(902.93, -1032.72, 34.97, 324.44),\nvector4(871.76, -1013.08, 30.93, 17.84),'}
                        className="h-[16vh] w-full resize-none rounded-[0.5vh] border border-white/10 bg-neutral-950/60 p-[1vh] font-mono text-[1.3vh] text-white/90 outline-none focus:border-primary/60 placeholder:text-white/20"
                    />

                    <div className="flex items-center gap-[1vh]">
                        <span className={`flex-1 font-mono text-[1.25vh] ${imported.length ? 'text-primary' : 'text-white/30'}`}>
                            {imported.length ? `${imported.length} ${t('settings_bulk_found')}` : t('settings_bulk_none')}
                        </span>

                        <button
                            type="button"
                            onClick={() => setImportText(null)}
                            className="flex h-[3vh] items-center rounded-[0.5vh] border border-white/10 px-[1.2vh] text-[1.3vh] font-semibold text-white/50 transition-colors hover:border-white/30 hover:text-white/80"
                        >
                            {t('settings_cancel')}
                        </button>
                        <button
                            type="button"
                            disabled={!imported.length}
                            onClick={() => {
                                onChange([...rows, ...imported]);
                                setImportText(null);
                                focusNewRow();
                            }}
                            className={`flex h-[3vh] items-center rounded-[0.5vh] border px-[1.2vh] text-[1.3vh] font-semibold transition-colors ${
                                imported.length ? 'border-primary/40 bg-primary/10 text-primary hover:bg-primary/20' : 'cursor-not-allowed border-white/5 text-white/20'
                            }`}
                        >
                            {t('settings_bulk_append')}
                        </button>
                        <button
                            type="button"
                            disabled={!imported.length}
                            onClick={() => {
                                onChange(imported);
                                setImportText(null);
                                setPage(0);
                                setFilter('');
                            }}
                            className={`flex h-[3vh] items-center rounded-[0.5vh] border px-[1.2vh] text-[1.3vh] font-semibold transition-colors ${
                                imported.length ? 'border-red-400/40 text-red-300 hover:bg-red-400/10' : 'cursor-not-allowed border-white/5 text-white/20'
                            }`}
                        >
                            {t('settings_bulk_replace')}
                        </button>
                    </div>
                </div>
            )}

            {!disabled &&
                (coordsList ? (
                    <div className="flex gap-[0.8vh]">
                        <button
                            type="button"
                            onClick={addPlacedRow}
                            disabled={!canAdd || placing}
                            className={`flex h-[3.4vh] flex-1 items-center justify-center gap-[0.8vh] rounded-[0.6vh] border text-[1.4vh] font-semibold transition-colors ${
                                canAdd && !placing
                                    ? 'border-primary/40 bg-primary/10 text-primary hover:bg-primary/20'
                                    : 'cursor-not-allowed border-white/5 text-white/20'
                            }`}
                        >
                            <i className={`fas ${placing ? 'fa-crosshairs fa-spin' : 'fa-location-crosshairs'} text-[1.2vh]`} />
                            {placing ? t('settings_placing') : t('settings_add_point')}
                        </button>

                        <button
                            type="button"
                            onClick={() => setImportText(importText === null ? '' : null)}
                            title={t('settings_bulk_import')}
                            className={`flex h-[3.4vh] w-[3.4vh] flex-shrink-0 items-center justify-center rounded-[0.6vh] border text-[1.4vh] transition-colors ${
                                importText !== null ? 'border-primary/40 bg-primary/10 text-primary' : 'border-white/15 text-white/50 hover:border-primary/40 hover:text-primary'
                            }`}
                        >
                            <i className="fas fa-paste" />
                        </button>
                    </div>
                ) : (
                    <button
                        type="button"
                        onClick={addRow}
                        disabled={!canAdd}
                        className={`flex h-[3.4vh] items-center justify-center gap-[0.8vh] rounded-[0.6vh] border border-dashed text-[1.4vh] font-semibold transition-colors ${
                            canAdd ? 'border-white/15 text-white/50 hover:border-primary/40 hover:text-primary' : 'cursor-not-allowed border-white/5 text-white/20'
                        }`}
                    >
                        <i className="fas fa-plus text-[1.2vh]" />
                        {t('settings_add_row')}
                    </button>
                ))}
        </div>
    );
}

//--------------------------------------------------
// MARK: Dispatch
//--------------------------------------------------

export default function SettingControl(props: ControlProps) {
    switch (props.def.type ?? 'string') {
        case 'boolean':
            return <BooleanControl {...props} />;
        case 'number':
        case 'integer':
        case 'percent':
            return <NumericControl {...props} />;
        case 'enum':
            return <EnumControl {...props} />;
        case 'color':
            return <ColorControl {...props} />;
        case 'ped':
            return <PedControl {...props} />;
        case 'coords':
            return <CoordsControl {...props} />;
        case 'blipcolor':
            return <BlipColorControl {...props} />;
        case 'blipsprite':
            return <BlipSpriteControl {...props} />;
        case 'time':
            return <TimeControl {...props} />;
        case 'keybind':
            return <KeybindControl {...props} />;
        case 'object':
            return <ObjectControl {...props} />;
        case 'list':
            return <ListControl {...props} />;
        default:
            return <StringControl {...props} />;
    }
}

/** Wide types claim the full row under the label instead of the trailing slot. */
export function isWideType(type: SettingType | undefined): boolean {
    return type === 'object' || type === 'list' || type === 'coords';
}
