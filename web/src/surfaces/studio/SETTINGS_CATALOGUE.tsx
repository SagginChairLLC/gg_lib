import { useEffect, useMemo, useState } from 'react';
import { t } from '@/data/useLang';
import {
    fetchCatalogue,
    giveItem,
    setImageUrl,
    spawnVehicle,
    useCatalogue,
    type CatalogueItem,
    type CatalogueVehicle,
} from '@/data/useCatalogue';
import { copyText } from '@/lib/clipboard';
import Dropdown from './DROPDOWN';
import { highlight } from './settings-utils';

/**
 * What the server has on record, in the same table the logs use: a row per
 * entry, and the rest of it underneath when you open one.
 */

/** Vehicle art is not something a framework ships, so it comes from a CDN. */
const VEHICLE_IMAGE = 'https://cdn.sky-systems.net/vehicles/%s.png';

const PER_PAGE = 25;

export type CatalogueKind = 'items' | 'vehicles';

type Row = {
    id: string;
    label: string;
    image?: string;
    /** The middle columns, already formatted for the row. */
    cells: string[];
    facts: { label: string; value: string }[];
    description?: string;
};

//--------------------------------------------------
// MARK: Parts
//--------------------------------------------------

function Art({ src, fallback, className }: { src?: string; fallback: string; className: string }) {
    const [failed, setFailed] = useState(false);

    useEffect(() => {
        setFailed(false);
    }, [src]);

    if (!src || failed) return <i className={`fas ${fallback} text-white/15 ${className}`} />;

    return <img src={src} alt="" loading="lazy" onError={() => setFailed(true)} className="max-h-full max-w-full object-contain" />;
}

/**
 * The opened row's picture, lit by a blurred copy of itself. Taking the colour
 * from the image means a red car glows red without anyone tagging it as one,
 * and it reads as part of the panel rather than a picture sat in a box.
 */
function GlowArt({ src, fallback }: { src?: string; fallback: string }) {
    const [failed, setFailed] = useState(false);

    useEffect(() => {
        setFailed(false);
    }, [src]);

    if (!src || failed) {
        return (
            <div className="flex h-full w-full items-center justify-center">
                <i className={`fas ${fallback} text-[2.6vh] text-white/10`} />
            </div>
        );
    }

    return (
        <div className="relative flex h-full w-full items-center justify-center">
            <img
                src={src}
                alt=""
                aria-hidden
                className="pointer-events-none absolute inset-0 m-auto max-h-full max-w-full scale-105 object-contain opacity-40 blur-[0.7vh] saturate-[1.6]"
            />

            <img
                src={src}
                alt=""
                loading="lazy"
                onError={() => setFailed(true)}
                className="relative max-h-full max-w-full object-contain drop-shadow-[0_0.4vh_0.7vh_rgba(0,0,0,0.6)]"
            />
        </div>
    );
}

function CopyName({ name }: { name: string }) {
    const [copied, setCopied] = useState(false);

    return (
        <button
            type="button"
            onClick={() => {
                if (!copyText(name)) return;

                setCopied(true);
                setTimeout(() => setCopied(false), 1400);
            }}
            className="group flex min-w-0 items-center gap-[0.5vh] text-left"
        >
            <span className="truncate font-mono text-[1.25vh] text-white/70 group-hover:text-white/95">{name}</span>
            <i className={`fas ${copied ? 'fa-check text-primary' : 'fa-copy text-white/20 group-hover:text-primary/70'} flex-shrink-0 text-[1.05vh]`} />
        </button>
    );
}

function Counter({ value, onChange, disabled }: { value: number; onChange: (next: number) => void; disabled: boolean }) {
    const step = (by: number) => onChange(Math.min(1000, Math.max(1, value + by)));

    return (
        <div className="flex flex-shrink-0 items-center gap-[0.35vh]">
            <button
                type="button"
                disabled={disabled || value <= 1}
                onClick={() => step(-1)}
                className="flex h-[2.6vh] w-[2.6vh] items-center justify-center rounded-[0.4vh] border border-white/10 text-[1.1vh] text-white/45 transition-colors hover:border-white/30 hover:text-white/85 disabled:opacity-25"
            >
                <i className="fas fa-minus" />
            </button>

            <input
                type="number"
                value={value}
                disabled={disabled}
                onChange={(event) => onChange(Math.min(1000, Math.max(1, Math.floor(Number(event.target.value) || 1))))}
                className="h-[2.6vh] w-[5.5vh] rounded-[0.4vh] border border-white/10 bg-black/30 text-center font-mono text-[1.2vh] text-white/90 outline-none transition-colors focus:border-primary/50 disabled:opacity-30"
            />

            <button
                type="button"
                disabled={disabled}
                onClick={() => step(1)}
                className="flex h-[2.6vh] w-[2.6vh] items-center justify-center rounded-[0.4vh] border border-white/10 text-[1.1vh] text-white/45 transition-colors hover:border-white/30 hover:text-white/85 disabled:opacity-25"
            >
                <i className="fas fa-plus" />
            </button>
        </div>
    );
}

//--------------------------------------------------
// MARK: Inspector
//--------------------------------------------------

/** Opened from a row rather than crowding it, the same as the log inspector. */
function Inspector({ kind, row, canGive, onError }: { kind: CatalogueKind; row: Row; canGive: boolean; onError: (message: string | null) => void }) {
    const [count, setCount] = useState(1);
    const [busy, setBusy] = useState(false);
    const [done, setDone] = useState(false);

    const run = async () => {
        setBusy(true);

        try {
            const result = kind === 'items' ? await giveItem(row.id, count) : await spawnVehicle(row.id);

            onError(result.error);

            if (!result.error) {
                setDone(true);
                setTimeout(() => setDone(false), 1600);
            }
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="flex gap-[1.6vh] px-[1.2vh] pb-[1vh] pt-[0.2vh]">
            <div className="h-[7.5vh] w-[12vh] flex-shrink-0">
                <GlowArt src={row.image} fallback={kind === 'items' ? 'fa-cube' : 'fa-car-side'} />
            </div>

            <div className="flex min-w-0 flex-1 flex-col gap-[0.35vh]">
                <CopyName name={row.id} />

                <div className="flex min-w-0 flex-wrap items-baseline gap-x-[1.4vh] gap-y-[0.2vh]">
                    {row.facts.map((fact) => (
                        <span key={fact.label} className="flex min-w-0 items-baseline gap-[0.5vh]">
                            <span className="flex-shrink-0 text-[1.05vh] font-semibold uppercase tracking-widest text-white/25">{fact.label}</span>
                            <span className="truncate text-[1.25vh] text-white/75">{fact.value}</span>
                        </span>
                    ))}
                </div>

                {row.description && <p className="text-[1.2vh] leading-snug text-white/45">{row.description}</p>}

                {row.image && <span className="truncate font-mono text-[1.05vh] text-white/20">{row.image}</span>}
            </div>

            {/* Pinned to the bottom right rather than floating in the middle of
                the strip, so the action sits where an action is looked for. */}
            {canGive && (
                <div className="flex flex-shrink-0 flex-col justify-end gap-[0.5vh]">
                    {kind === 'items' && <Counter value={count} onChange={setCount} disabled={busy} />}

                    <button
                        type="button"
                        disabled={busy}
                        onClick={() => void run()}
                        className={`flex h-[2.9vh] items-center justify-center gap-[0.7vh] rounded-[0.4vh] border px-[1.3vh] text-[1.25vh] font-bold transition-colors disabled:opacity-40 ${
                            done ? 'border-primary/60 bg-primary/20 text-primary' : 'border-primary/45 bg-primary/[0.12] text-primary hover:bg-primary/25'
                        }`}
                    >
                        <i className={`fas ${busy ? 'fa-spinner fa-spin' : done ? 'fa-check' : kind === 'items' ? 'fa-hand-holding' : 'fa-car-side'} text-[1.1vh]`} />
                        {done ? t('catalogue_done') : kind === 'items' ? t('catalogue_give') : t('catalogue_spawn')}
                    </button>
                </div>
            )}
        </div>
    );
}

//--------------------------------------------------
// MARK: Icon path
//--------------------------------------------------

/**
 * Not every inventory is one gg_lib bridges, and the built-in icon path then
 * points at a resource that is not installed. This is where that gets fixed
 * without touching a file.
 */
function IconPath({ onClose }: { onClose: () => void }) {
    const stored = useCatalogue((state) => state.imageUrl);
    const wired = useCatalogue((state) => state.wired);

    const [draft, setDraft] = useState(stored);
    const [busy, setBusy] = useState(false);
    const [problem, setProblem] = useState<string | null>(null);

    const save = async () => {
        setBusy(true);

        try {
            const result = await setImageUrl(draft.trim());

            setProblem(result.error);
            if (result.ok) onClose();
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="mb-[0.8vh] flex flex-shrink-0 flex-col gap-[0.6vh] rounded-[0.5vh] border border-primary/25 bg-primary/[0.04] px-[1.2vh] py-[0.9vh]">
            <div className="flex items-center gap-[0.8vh]">
                <i className="fas fa-image text-[1.2vh] text-primary/80" />
                <span className="flex-shrink-0 text-[1.3vh] font-bold text-white/90">{t('catalogue_image_path')}</span>

                {wired.inventory && (
                    <span className="min-w-0 truncate font-mono text-[1.1vh] text-white/30">
                        {t('catalogue_wired')} {wired.inventory}
                    </span>
                )}

                <span className="min-w-0 flex-1" />

                <button
                    type="button"
                    onClick={onClose}
                    className="flex h-[2.6vh] w-[2.6vh] items-center justify-center rounded-[0.4vh] border border-white/10 text-[1.1vh] text-white/40 transition-colors hover:border-white/30 hover:text-white/80"
                >
                    <i className="fas fa-xmark" />
                </button>
            </div>

            <div className="flex items-center gap-[0.6vh]">
                <input
                    type="text"
                    value={draft}
                    disabled={busy}
                    placeholder="https://cfx-nui-ox_inventory/web/images/%s.png"
                    onChange={(event) => setDraft(event.target.value)}
                    onKeyDown={(event) => event.key === 'Enter' && void save()}
                    className="h-[2.9vh] min-w-0 flex-1 rounded-[0.4vh] border border-white/10 bg-black/30 px-[0.9vh] font-mono text-[1.2vh] text-white/90 outline-none transition-colors placeholder:text-white/20 focus:border-primary/50 disabled:opacity-40"
                />

                <button
                    type="button"
                    disabled={busy || draft === stored}
                    onClick={() => void save()}
                    className="flex h-[2.9vh] flex-shrink-0 items-center gap-[0.6vh] rounded-[0.4vh] border border-primary/45 bg-primary/[0.12] px-[1.2vh] text-[1.2vh] font-bold text-primary transition-colors hover:bg-primary/25 disabled:opacity-30"
                >
                    <i className={`fas ${busy ? 'fa-spinner fa-spin' : 'fa-floppy-disk'} text-[1.05vh]`} />
                    {t('catalogue_save')}
                </button>
            </div>

            <p className="text-[1.1vh] leading-snug text-white/30">{t('catalogue_image_help')}</p>

            {problem && <p className="text-[1.15vh] font-semibold text-red-400">{problem}</p>}
        </div>
    );
}

//--------------------------------------------------
// MARK: Page
//--------------------------------------------------

export default function SETTINGS_CATALOGUE({ kind, query }: { kind: CatalogueKind; query: string }) {
    const items = useCatalogue((state) => state.items);
    const vehicles = useCatalogue((state) => state.vehicles);
    const canGive = useCatalogue((state) => state.canGive);
    const loaded = useCatalogue((state) => state.loaded);
    const busy = useCatalogue((state) => state.busy);

    const [page, setPage] = useState(1);
    const [error, setError] = useState<string | null>(null);
    const [category, setCategory] = useState('');
    const [open, setOpen] = useState<string | null>(null);
    const [pathOpen, setPathOpen] = useState(false);

    useEffect(() => {
        if (!loaded) void fetchCatalogue();
    }, [loaded]);

    useEffect(() => {
        setPage(1);
        setOpen(null);
    }, [kind, query, category]);

    // A class filter left set while switching to items would silently narrow a
    // list that has no classes at all.
    useEffect(() => {
        setCategory('');
    }, [kind]);

    const needle = query.trim().toLowerCase();

    const categories = useMemo(() => {
        const seen = new Set<string>();

        for (const vehicle of vehicles) {
            if (vehicle.category) seen.add(vehicle.category);
        }

        return [...seen].sort();
    }, [vehicles]);

    const columns = kind === 'items'
        ? [t('catalogue_spawn_name'), t('catalogue_weight')]
        : [t('catalogue_spawn_name'), t('catalogue_brand'), t('catalogue_class')];

    // Matching the spawn name and the label both, since an admin knows a thing
    // by whichever of the two they last saw.
    const rows: Row[] = useMemo(() => {
        if (kind === 'items') {
            return items
                .filter((item: CatalogueItem) => !needle || item.name.toLowerCase().includes(needle) || item.label.toLowerCase().includes(needle))
                .map((item) => ({
                    id: item.name,
                    label: item.label,
                    image: item.image,
                    cells: [item.name, item.weight > 0 ? `${item.weight}g` : '—'],
                    description: item.description,
                    facts: [
                        { label: t('catalogue_weight'), value: item.weight > 0 ? `${item.weight}g` : '—' },
                        { label: t('catalogue_stack'), value: item.stack === false ? t('catalogue_no') : t('catalogue_yes') },
                    ],
                }));
        }

        return vehicles
            .filter((vehicle: CatalogueVehicle) => {
                if (category && vehicle.category !== category) return false;
                if (!needle) return true;

                return (
                    vehicle.model.toLowerCase().includes(needle) ||
                    vehicle.label.toLowerCase().includes(needle) ||
                    (vehicle.brand ?? '').toLowerCase().includes(needle)
                );
            })
            .map((vehicle) => ({
                id: vehicle.model,
                label: vehicle.label,
                image: VEHICLE_IMAGE.replace('%s', vehicle.model),
                cells: [vehicle.model, vehicle.brand ?? '—', vehicle.category ?? '—'],
                facts: [
                    ...(vehicle.brand ? [{ label: t('catalogue_brand'), value: vehicle.brand }] : []),
                    ...(vehicle.category ? [{ label: t('catalogue_class'), value: vehicle.category }] : []),
                    ...(vehicle.price !== undefined ? [{ label: t('catalogue_price'), value: `$${vehicle.price.toLocaleString()}` }] : []),
                ],
            }));
    }, [kind, items, vehicles, needle, category]);

    const total = rows.length;
    const pages = Math.max(1, Math.ceil(total / PER_PAGE));
    const current = Math.min(page, pages);
    const shown = rows.slice((current - 1) * PER_PAGE, current * PER_PAGE);

    if (!loaded && busy) {
        return (
            <div className="flex flex-1 items-center justify-center text-white/35">
                <i className="fas fa-spinner animate-spin text-[3vh]" />
            </div>
        );
    }

    return (
        <div className="flex min-h-0 min-w-0 flex-1 flex-col px-[2vh] py-[1.6vh]">
            <div className="mb-[0.8vh] flex flex-shrink-0 items-center gap-[1vh]">
                <i className={`fas ${kind === 'items' ? 'fa-boxes-stacked' : 'fa-car'} text-[1.5vh] text-primary/80`} />
                <h2 className="flex-shrink-0 text-[1.8vh] font-bold text-white/90">{kind === 'items' ? t('catalogue_items') : t('catalogue_vehicles')}</h2>

                {/* The search lives in the editor's own bar; saying so here is
                    what stops someone hunting for a second one on the page. */}
                {needle ? (
                    <span className="flex min-w-0 items-center gap-[0.5vh] rounded-[0.35vh] bg-primary/15 px-[0.7vh] py-[0.15vh] text-[1.1vh] font-semibold text-primary">
                        <i className="fas fa-magnifying-glass text-[0.95vh]" />
                        <span className="truncate">{query.trim()}</span>
                    </span>
                ) : (
                    <span className="min-w-0 truncate text-[1.2vh] text-white/25">{t('catalogue_search_hint')}</span>
                )}

                <span className="min-w-0 flex-1" />

                {kind === 'vehicles' && categories.length > 0 && (
                    <Dropdown
                        value={category}
                        onChange={setCategory}
                        icon="fa-filter"
                        width="16vh"
                        options={[{ value: '', label: t('catalogue_all_classes') }, ...categories.map((name) => ({ value: name, label: name }))]}
                    />
                )}

                <span className="flex-shrink-0 font-mono text-[1.15vh] text-white/30">
                    {total === 0 ? '0' : `${(current - 1) * PER_PAGE + 1}–${Math.min(current * PER_PAGE, total)} ${t('catalogue_of')} ${total}`}
                </span>

                <div className="flex flex-shrink-0 gap-[0.5vh]">
                    <button
                        type="button"
                        onClick={() => setPage(Math.max(1, current - 1))}
                        disabled={current <= 1}
                        className={`flex h-[2.8vh] w-[2.8vh] items-center justify-center rounded-[0.5vh] border border-white/10 text-[1.15vh] transition-colors ${
                            current <= 1 ? 'cursor-not-allowed text-white/15' : 'text-white/50 hover:border-primary/40 hover:text-primary'
                        }`}
                    >
                        <i className="fas fa-chevron-left" />
                    </button>
                    <button
                        type="button"
                        onClick={() => setPage(Math.min(pages, current + 1))}
                        disabled={current >= pages}
                        className={`flex h-[2.8vh] w-[2.8vh] items-center justify-center rounded-[0.5vh] border border-white/10 text-[1.15vh] transition-colors ${
                            current >= pages ? 'cursor-not-allowed text-white/15' : 'text-white/50 hover:border-primary/40 hover:text-primary'
                        }`}
                    >
                        <i className="fas fa-chevron-right" />
                    </button>
                </div>

                {kind === 'items' && canGive && (
                    <button
                        type="button"
                        onClick={() => setPathOpen((state) => !state)}
                        title={t('catalogue_image_path')}
                        className={`flex h-[2.8vh] w-[2.8vh] flex-shrink-0 items-center justify-center rounded-[0.5vh] border text-[1.15vh] transition-colors ${
                            pathOpen ? 'border-primary/50 bg-primary/10 text-primary' : 'border-white/10 text-white/45 hover:border-primary/40 hover:text-primary'
                        }`}
                    >
                        <i className="fas fa-image" />
                    </button>
                )}

                <button
                    type="button"
                    onClick={() => {
                        setError(null);
                        void fetchCatalogue(true);
                    }}
                    disabled={busy}
                    title={t('catalogue_refresh')}
                    className="flex h-[2.8vh] w-[2.8vh] flex-shrink-0 items-center justify-center rounded-[0.5vh] border border-white/10 text-[1.15vh] text-white/45 transition-colors hover:border-primary/40 hover:text-primary disabled:opacity-40"
                >
                    <i className={`fas ${busy ? 'fa-spinner fa-spin' : 'fa-rotate-right'}`} />
                </button>
            </div>

            {pathOpen && kind === 'items' && <IconPath onClose={() => setPathOpen(false)} />}

            {error && (
                <p className="mb-[0.8vh] flex flex-shrink-0 items-center gap-[0.6vh] text-[1.3vh] font-semibold text-red-400">
                    <i className="fas fa-triangle-exclamation text-[1.2vh]" />
                    {error}
                </p>
            )}

            <div className="flex flex-shrink-0 items-center gap-[1vh] border-y border-white/10 bg-white/[0.02] px-[1.2vh] py-[0.4vh] text-[1.05vh] font-semibold uppercase tracking-widest text-white/25">
                <span className="w-[1.2vh] flex-shrink-0" />
                <span className="w-[2.4vh] flex-shrink-0" />
                <span className="min-w-0 flex-1">{kind === 'items' ? t('catalogue_item') : t('catalogue_vehicle')}</span>
                {columns.map((column) => (
                    <span key={column} className="w-[12vh] flex-shrink-0">
                        {column}
                    </span>
                ))}
            </div>

            <div className="min-h-0 min-w-0 flex-1 overflow-y-auto">
                {shown.map((row) => {
                    const expanded = row.id === open;

                    return (
                        <div key={row.id} className={`border-b border-white/5 ${expanded ? 'bg-white/[0.03]' : ''}`}>
                            <button
                                type="button"
                                onClick={() => setOpen(expanded ? null : row.id)}
                                className="flex w-full items-center gap-[1vh] px-[1.2vh] py-[0.55vh] text-left transition-colors hover:bg-white/[0.04]"
                            >
                                <i className={`fas fa-chevron-right w-[1.2vh] flex-shrink-0 text-[1vh] text-white/25 transition-transform ${expanded ? 'rotate-90' : ''}`} />

                                <span className="flex h-[2.4vh] w-[2.4vh] flex-shrink-0 items-center justify-center">
                                    <Art src={row.image} fallback={kind === 'items' ? 'fa-cube' : 'fa-car'} className="text-[1.3vh]" />
                                </span>

                                <span className={`min-w-0 flex-1 truncate text-[1.3vh] font-semibold ${expanded ? 'text-primary' : 'text-white/85'}`}>
                                    {highlight(row.label, query)}
                                </span>

                                {row.cells.map((value, index) => (
                                    <span key={index} className="w-[12vh] flex-shrink-0 truncate font-mono text-[1.2vh] text-white/35">
                                        {highlight(value, query)}
                                    </span>
                                ))}
                            </button>

                            {expanded && <Inspector kind={kind} row={row} canGive={canGive} onError={setError} />}
                        </div>
                    );
                })}

                {total === 0 && (
                    <div className="flex flex-col items-center gap-[1vh] py-[8vh] text-white/30">
                        <i className={`fas ${kind === 'items' ? 'fa-boxes-stacked' : 'fa-car'} text-[3.5vh]`} />
                        <span className="text-[1.5vh]">{needle ? t('settings_no_results') : t('catalogue_empty')}</span>
                    </div>
                )}
            </div>
        </div>
    );
}
