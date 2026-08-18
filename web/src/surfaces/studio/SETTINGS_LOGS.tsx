import { useEffect, useState } from 'react';
import { t } from '@/data/useLang';
import { fetchNui, isEnvBrowser } from '@/lib/fetchNui';
import { highlight } from './settings-utils';

export type LogRow = {
    resource: string;
    path: string;
    action: string;
    actor?: string;
    changed_at?: string;
    old?: string;
    new?: string;
};

const ACTIONS: Record<string, { label: string; icon: string; tone: string }> = {
    change: { label: 'Changed', icon: 'fa-pen', tone: 'text-primary' },
    reset: { label: 'Reset', icon: 'fa-rotate-left', tone: 'text-white/50' },
    admin_add: { label: 'Admin Added', icon: 'fa-user-plus', tone: 'text-emerald-400' },
    admin_remove: { label: 'Admin Removed', icon: 'fa-user-minus', tone: 'text-red-400' },
};

/** Matches the server page size. */
const PAGE_SIZE = 25;

const MOCK: LogRow[] = [
    { resource: 'gg_studio', path: 'theme.primary_color', action: 'change', actor: 'Sag (license2:6e71…)', changed_at: '2026-08-17 11:42', old: 'rgb(252, 186, 3)', new: 'rgb(56, 189, 248)' },
    { resource: 'gg_taxijob', path: 'settings.depot.coords', action: 'change', actor: 'Sag (license2:6e71…)', changed_at: '2026-08-17 11:31', old: '{"x":894.99,"y":-179.17,"z":74.7,"heading":241.41}', new: '{"x":120.5,"y":-800.25,"z":31,"heading":90}' },
    { resource: 'gg_lib', path: 'license2:9f22c1aa77be…', action: 'admin_add', actor: 'Sag (license2:6e71…)', changed_at: '2026-08-17 10:58', new: 'Marlow' },
    { resource: 'gg_taxijob', path: 'settings.blip_theme.route_color', action: 'reset', actor: 'Marlow (license2:9f22…)', changed_at: '2026-08-16 22:14', old: '17', new: '46' },
];

export default function SETTINGS_LOGS({ query }: { query: string }) {
    const [rows, setRows] = useState<LogRow[] | null>(null);
    const [busy, setBusy] = useState(false);

    // Paging and filtering happen in SQL, not here. The table is capped at 5000
    // rows and pulling all of them to filter in the browser is the reason this
    // page felt heavy.
    const [page, setPage] = useState(1);
    const [total, setTotal] = useState(0);
    const [people, setPeople] = useState<string[]>([]);
    const [person, setPerson] = useState('');

    // Typing a letter should not fire a query per keystroke.
    const [debounced, setDebounced] = useState('');

    useEffect(() => {
        const timer = setTimeout(() => setDebounced(query.trim()), 250);
        return () => clearTimeout(timer);
    }, [query]);

    useEffect(() => {
        setPage(1);
    }, [debounced, person]);

    useEffect(() => {
        let cancelled = false;

        const load = async () => {
            setBusy(true);

            try {
                if (isEnvBrowser()) {
                    await new Promise((resolve) => setTimeout(resolve, 200));
                    if (cancelled) return;

                    setRows(MOCK);
                    setTotal(MOCK.length);
                    setPeople([...new Set(MOCK.map((row) => row.actor ?? '').filter(Boolean))]);
                    return;
                }

                const response = await fetchNui<{ ok: boolean; ROWS?: LogRow[]; TOTAL?: number; ACTORS?: string[] }>('logs_fetch', {
                    page,
                    size: PAGE_SIZE,
                    search: debounced,
                    actor: person,
                });

                if (cancelled) return;

                setRows(response?.ok ? (response.ROWS ?? []) : []);
                setTotal(response?.TOTAL ?? 0);
                setPeople(response?.ACTORS ?? []);
            } finally {
                if (!cancelled) setBusy(false);
            }
        };

        void load();

        return () => {
            cancelled = true;
        };
    }, [page, debounced, person]);

    const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    const visible = rows ?? [];

    if (rows === null && busy) {
        return (
            <div className="flex flex-1 items-center justify-center text-white/35">
                <i className="fas fa-spinner animate-spin text-[3vh]" />
            </div>
        );
    }

    return (
        <div className="relative min-h-0 min-w-0 flex-1 overflow-y-auto px-[2vh] py-[1.6vh]">
            <div className="mb-[1vh] flex items-center gap-[1vh] border-b border-white/5 pb-[0.8vh]">
                <i className="fas fa-clock-rotate-left text-[1.6vh] text-primary/80" />
                <h2 className="flex-shrink-0 text-[1.9vh] font-bold text-white/90">{t('logs_title')}</h2>

                <span className="min-w-0 flex-1" />

                <select
                    value={person}
                    onChange={(event) => setPerson(event.target.value)}
                    className="h-[3.2vh] max-w-[24vh] flex-shrink-0 rounded-[0.5vh] border border-white/10 bg-neutral-900 px-[0.8vh] text-[1.35vh] text-white/85 outline-none transition-colors focus:border-primary/60"
                >
                    <option value="">{t('logs_all_people')}</option>
                    {people.map((name) => (
                        <option key={name} value={name}>
                            {name}
                        </option>
                    ))}
                </select>

                <span className="flex-shrink-0 font-mono text-[1.2vh] text-white/30">
                    {total === 0 ? '0' : `${(page - 1) * PAGE_SIZE + 1}\u2013${Math.min(page * PAGE_SIZE, total)} ${t('logs_showing')} ${total}`}
                </span>

                <div className="flex flex-shrink-0 gap-[0.5vh]">
                    <button
                        type="button"
                        onClick={() => setPage((current) => Math.max(1, current - 1))}
                        disabled={page <= 1 || busy}
                        className={`flex h-[3vh] w-[3vh] items-center justify-center rounded-[0.5vh] border border-white/10 text-[1.2vh] transition-colors ${
                            page <= 1 || busy ? 'cursor-not-allowed text-white/15' : 'text-white/50 hover:border-primary/40 hover:text-primary'
                        }`}
                    >
                        <i className="fas fa-chevron-left" />
                    </button>
                    <button
                        type="button"
                        onClick={() => setPage((current) => Math.min(pages, current + 1))}
                        disabled={page >= pages || busy}
                        className={`flex h-[3vh] w-[3vh] items-center justify-center rounded-[0.5vh] border border-white/10 text-[1.2vh] transition-colors ${
                            page >= pages || busy ? 'cursor-not-allowed text-white/15' : 'text-white/50 hover:border-primary/40 hover:text-primary'
                        }`}
                    >
                        <i className="fas fa-chevron-right" />
                    </button>
                </div>
            </div>

            <div className="flex flex-col gap-[0.6vh]">
                {visible.map((row, index) => {
                    const action = ACTIONS[row.action] ?? ACTIONS.change;

                    return (
                        <div key={`${row.changed_at}-${row.path}-${index}`} className="rounded-[0.5vh] border border-white/10 bg-white/[0.02] p-[1.2vh]">
                            <div className="flex items-center gap-[0.9vh]">
                                <i className={`fas ${action.icon} w-[1.8vh] flex-shrink-0 text-center text-[1.3vh] ${action.tone}`} />

                                <span className="truncate font-mono text-[1.35vh] text-white/85">{highlight(row.path, query)}</span>

                                <span className="flex-shrink-0 rounded-[0.4vh] border border-white/10 px-[0.7vh] py-[0.1vh] font-mono text-[1.05vh] uppercase tracking-wide text-white/35">
                                    {highlight(row.resource, query)}
                                </span>

                                <span className="ml-auto flex-shrink-0 font-mono text-[1.15vh] text-white/30">{row.changed_at}</span>
                            </div>

                            {(row.old !== undefined || row.new !== undefined) && (
                                <div className="mt-[0.6vh] flex items-center gap-[0.8vh] pl-[2.7vh] font-mono text-[1.2vh]">
                                    <span className="max-w-[38%] truncate text-white/35 line-through">{row.old ?? t('logs_unset')}</span>
                                    <i className="fas fa-arrow-right text-[1vh] text-white/25" />
                                    <span className="max-w-[38%] truncate text-white/80">{row.new ?? t('logs_unset')}</span>
                                </div>
                            )}

                            <div className="mt-[0.5vh] pl-[2.7vh] text-[1.2vh] text-white/35">
                                {action.label} {t('logs_by')} {highlight(row.actor ?? 'unknown', query)}
                            </div>
                        </div>
                    );
                })}
            </div>

            {visible.length === 0 && (
                <div className="flex flex-col items-center gap-[1vh] py-[8vh] text-white/35">
                    <i className="fas fa-clock-rotate-left text-[3.5vh]" />
                    <span className="text-[1.5vh]">{rows && rows.length > 0 ? t('settings_no_results') : t('logs_empty')}</span>
                </div>
            )}
        </div>
    );
}
