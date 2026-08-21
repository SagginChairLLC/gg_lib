import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { useLang } from '@/data/useLang';
import { usePopup } from '@/data/usePopup';
import { usePanel } from '@/data/usePanel';
import { applyDevSurface, writeDevSurface, type DevSurfaceId } from '@/lib/devSurface';

type DevRow = { id: DevSurfaceId; label: string };

const SETTINGS_ROWS: DevRow[] = [{ id: 'editor', label: 'Script Editor' }];

const POPUP_ROWS: DevRow[] = [{ id: 'popup', label: 'Message Popup' }];

const PANEL_ROWS: DevRow[] = [{ id: 'panel', label: 'Job Popup' }];

export default function DevSurfaceSwitcher() {
    const [open, setOpen] = useState(false);
    const visible = useLang((state) => state.visible);
    const popupEnabled = usePopup((state) => state.enabled);
    const panelEnabled = usePanel((state) => state.enabled);

    let activeId: DevSurfaceId = 'none';
    if (visible) activeId = 'editor';
    else if (popupEnabled) activeId = 'popup';
    else if (panelEnabled) activeId = 'panel';

    const activeLabel = [...SETTINGS_ROWS, ...POPUP_ROWS, ...PANEL_ROWS].find((row) => row.id === activeId)?.label ?? 'Hidden';

    useEffect(() => {
        writeDevSurface(activeId);
    }, [activeId]);

    const select = (id: DevSurfaceId) => applyDevSurface(activeId === id ? 'none' : id);

    const renderGroup = (title: string, rows: DevRow[]) => (
        <div className="flex flex-col">
            <span className="px-2 pb-1 pt-2 text-[10px] font-bold uppercase tracking-widest text-zinc-500">{title}</span>
            {rows.map((row) => {
                const isActive = activeId === row.id;

                return (
                    <button
                        key={row.id}
                        onClick={() => select(row.id)}
                        className={`flex items-center gap-2 rounded px-2 py-1.5 text-left text-[12px] transition-colors ${
                            isActive ? 'bg-emerald-500/15 text-emerald-300' : 'text-zinc-300 hover:bg-zinc-700/50'
                        }`}
                    >
                        <span className={`h-1.5 w-1.5 flex-shrink-0 rounded-full ${isActive ? 'bg-emerald-400' : 'bg-zinc-600'}`} />
                        {row.label}
                    </button>
                );
            })}
        </div>
    );

    return (
        <div className="fixed left-3 top-3 z-[9999] font-mono">
            <button
                onClick={() => setOpen((value) => !value)}
                className="flex items-center gap-2 rounded-md border border-zinc-700 bg-zinc-900/95 px-2.5 py-1.5 text-[11px] text-zinc-200 shadow-lg backdrop-blur transition-colors hover:border-zinc-500"
            >
                <i className={`fas fa-sliders-h text-[11px] ${activeId === 'none' ? 'text-zinc-500' : 'text-emerald-400'}`} />
                <span className="font-bold tracking-widest text-zinc-500">DEV</span>
                <span className="max-w-[140px] truncate text-zinc-300">{activeLabel}</span>
                <i className={`fas fa-chevron-down text-[9px] text-zinc-500 transition-transform ${open ? 'rotate-180' : ''}`} />
            </button>

            <AnimatePresence>
                {open && (
                    <motion.div
                        initial={{ opacity: 0, y: -6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -6 }}
                        transition={{ duration: 0.15, ease: 'easeOut' }}
                        data-dev-panel
                        className="mt-1.5 flex max-h-[80vh] w-[220px] flex-col overflow-y-auto rounded-md border border-zinc-700 bg-zinc-900/95 p-1.5 shadow-2xl backdrop-blur"
                    >
                        {renderGroup('Settings', SETTINGS_ROWS)}
                        {renderGroup('Popup', POPUP_ROWS)}
                        {renderGroup('Job Panel', PANEL_ROWS)}

                        <div className="mt-2 border-t border-zinc-700/70 pt-1.5">
                            <button
                                onClick={() => applyDevSurface('none')}
                                className={`w-full rounded px-2 py-1.5 text-left text-[12px] transition-colors ${
                                    activeId === 'none' ? 'bg-zinc-700/60 text-zinc-200' : 'text-zinc-400 hover:bg-zinc-700/50'
                                }`}
                            >
                                Hide All
                            </button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
