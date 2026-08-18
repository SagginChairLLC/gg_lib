import { motion } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';
import { t } from '@/data/useLang';
import { closePicker, usePicker, type PickerItem } from '@/data/usePicker';

const PAGE = 60;

const PANEL_WIDTH = '50vh';

function Row({ item, selected, onPick }: { item: PickerItem; selected: boolean; onPick: () => void }) {
    return (
        <button
            type="button"
            onClick={onPick}
            className={`flex w-full items-center gap-[1vh] rounded-[0.4vh] border px-[1.1vh] py-[0.8vh] text-left transition-colors ${
                selected ? 'border-primary/60 bg-primary/15 text-primary' : 'border-transparent text-white/75 hover:border-white/15 hover:bg-white/[0.05] hover:text-white/95'
            }`}
        >
            <i className={`fas ${selected ? 'fa-circle-dot' : 'fa-circle'} w-[1.5vh] flex-shrink-0 text-center text-[1vh] ${selected ? 'text-primary' : 'text-white/15'}`} />
            <span className="min-w-0 flex-1 truncate font-mono text-[1.35vh]">{item.label}</span>
            {item.sublabel && <span className="flex-shrink-0 font-mono text-[1.1vh] text-white/30">{item.sublabel}</span>}
        </button>
    );
}

function Tile({ item, selected, onPick }: { item: PickerItem; selected: boolean; onPick: () => void }) {
    const [source, setSource] = useState(item.image);
    const [failed, setFailed] = useState(false);

    useEffect(() => {
        setSource(item.image);
        setFailed(false);
    }, [item.image]);

    return (
        <button
            type="button"
            title={item.sublabel ? `${item.label} · ${item.sublabel}` : item.label}
            onClick={onPick}
            className={`gg-defer-tile group flex flex-col gap-[0.4vh] rounded-[0.5vh] border p-[0.5vh] text-left transition-colors ${
                selected ? 'border-primary/70 bg-primary/15' : 'border-transparent hover:border-white/20 hover:bg-white/[0.05]'
            }`}
        >
            <div className="relative aspect-square w-full overflow-hidden rounded-[0.4vh] bg-black/30">
                {item.swatch && <span className="absolute inset-0" style={{ backgroundColor: item.swatch }} />}

                {source && !failed && (
                    <img
                        src={source}
                        alt=""
                        loading="lazy"
                        decoding="async"
                        onError={() => (item.imageAlt && source !== item.imageAlt ? setSource(item.imageAlt) : setFailed(true))}
                        className="h-full w-full object-cover object-top"
                    />
                )}

                {!item.swatch && (!source || failed) && (
                    <span className="flex h-full w-full items-center justify-center text-white/20">
                        <i className="fas fa-image text-[1.8vh]" />
                    </span>
                )}
            </div>

            <span className={`w-full truncate text-center text-[1.15vh] ${selected ? 'text-primary' : 'text-white/55 group-hover:text-white/80'}`}>{item.label}</span>
        </button>
    );
}

export default function SETTINGS_PICKER() {
    const title = usePicker((state) => state.title);
    const items = usePicker((state) => state.items);
    const value = usePicker((state) => state.value);
    const allowCustom = usePicker((state) => state.allowCustom);
    const customHint = usePicker((state) => state.customHint);
    const columns = usePicker((state) => state.columns);
    const onSelect = usePicker((state) => state.onSelect);

    const [query, setQuery] = useState('');
    const [shown, setShown] = useState(PAGE);
    const [custom, setCustom] = useState('');
    const listRef = useRef<HTMLDivElement | null>(null);

    const needle = query.trim().toLowerCase();

    const matches = items.filter(
        (item) => !needle || item.label.toLowerCase().includes(needle) || (item.sublabel ?? '').toLowerCase().includes(needle) || String(item.id).toLowerCase() === needle,
    );

    useEffect(() => setShown(PAGE), [needle]);

    const pick = (next: string | number) => {
        onSelect?.(next);
        closePicker();
    };

    const submitCustom = () => {
        const trimmed = custom.trim();
        if (trimmed) pick(trimmed);
    };

    const visual = items.some((item) => item.image || item.swatch);

    return (
        <motion.div
            initial={{ width: 0 }}
            animate={{ width: PANEL_WIDTH }}
            exit={{ width: 0 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
            className="h-full flex-shrink-0 overflow-hidden border-l border-white/15 bg-neutral-950"
        >
            <div className="flex h-full flex-col" style={{ width: PANEL_WIDTH }}>
            <div className="flex min-h-[5.8vh] flex-shrink-0 items-center gap-[1.2vh] border-b border-white/10 px-[1.4vh]">
                <button
                    type="button"
                    onClick={closePicker}
                    title={t('picker_back')}
                    className="flex h-[3.4vh] w-[3.4vh] flex-shrink-0 items-center justify-center rounded-[0.4vh] border border-white/10 text-[1.4vh] text-white/60 transition-colors hover:border-primary/50 hover:text-primary"
                >
                    <i className="fas fa-arrow-left" />
                </button>

                <span className="min-w-0 flex-1 truncate text-[1.7vh] font-bold text-white/95">{title}</span>
                <span className="flex-shrink-0 font-mono text-[1.15vh] text-white/30">{matches.length}</span>
            </div>

            <div className="flex-shrink-0 border-b border-white/10 p-[1.2vh]">
                <div className="relative">
                    <i className="fas fa-magnifying-glass pointer-events-none absolute left-[1.1vh] top-1/2 -translate-y-1/2 text-[1.3vh] text-white/35" />
                    <input
                        autoFocus
                        type="text"
                        value={query}
                        onChange={(event) => setQuery(event.target.value)}
                        placeholder={t('picker_search')}
                        className="h-[3.4vh] w-full rounded-[0.4vh] border border-white/10 bg-white/[0.04] pl-[3.4vh] pr-[1vh] text-[1.4vh] text-white/90 placeholder:text-white/30 focus:border-primary/50"
                    />
                </div>
            </div>

            <div
                ref={listRef}
                onScroll={(event) => {
                    const node = event.currentTarget;
                    if (node.scrollTop + node.clientHeight < node.scrollHeight - 40) return;

                    setShown((count) => (count >= matches.length ? count : count + PAGE));
                }}
                className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-[1vh]"
            >
                {visual ? (
                    <div className="grid gap-[0.6vh]" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
                        {matches.slice(0, shown).map((item) => (
                            <Tile key={item.id} item={item} selected={item.id === value} onPick={() => pick(item.id)} />
                        ))}
                    </div>
                ) : (
                    <div className="flex flex-col gap-[0.3vh]">
                        {matches.slice(0, shown).map((item) => (
                            <Row key={item.id} item={item} selected={item.id === value} onPick={() => pick(item.id)} />
                        ))}
                    </div>
                )}

                {matches.length === 0 && (
                    <div className="flex flex-col items-center gap-[1vh] py-[6vh] text-white/35">
                        <i className="fas fa-magnifying-glass-minus text-[3vh]" />
                        <span className="text-[1.45vh]">{t('settings_no_results')}</span>
                    </div>
                )}
            </div>

            {allowCustom && (
                <div className="flex-shrink-0 border-t border-white/10 p-[1.2vh]">
                    <div className="flex items-center gap-[0.8vh]">
                        <input
                            type="text"
                            value={custom}
                            onChange={(event) => setCustom(event.target.value)}
                            onKeyDown={(event) => event.key === 'Enter' && submitCustom()}
                            placeholder={customHint}
                            className="h-[3.4vh] min-w-0 flex-1 rounded-[0.4vh] border border-white/10 bg-white/[0.04] px-[1vh] font-mono text-[1.35vh] text-white/90 placeholder:font-sans placeholder:text-white/30 focus:border-primary/50"
                        />
                        <button
                            type="button"
                            disabled={custom.trim() === ''}
                            onClick={submitCustom}
                            className="flex h-[3.4vh] flex-shrink-0 items-center gap-[0.7vh] rounded-[0.4vh] bg-primary px-[1.6vh] text-[1.35vh] font-bold text-neutral-900 transition-colors hover:bg-primary/90 disabled:bg-white/10 disabled:text-white/30"
                        >
                            <i className="fas fa-check text-[1.2vh]" />
                            {t('picker_use')}
                        </button>
                    </div>
                </div>
            )}
            </div>
        </motion.div>
    );
}
