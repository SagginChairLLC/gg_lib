import { useEffect, useState } from 'react';
import { t } from '@/data/useLang';
import { fetchNui, isEnvBrowser } from '@/lib/fetchNui';
import { setActiveScript, useSettings } from '@/data/useSettings';
import Dropdown from './DROPDOWN';
import { highlight } from './settings-utils';

export type LogRow = {
    id?: number;
    resource: string;
    path: string;
    action: string;
    actor?: string;
    changed_at?: string;
    old?: string;
    new?: string;
    /** Untruncated, for the inspector. */
    old_full?: string;
    new_full?: string;
};

const ACTIONS: Record<string, { label: string; icon: string; tone: string }> = {
    change: { label: 'Changed', icon: 'fa-pen', tone: 'text-primary' },
    reset: { label: 'Reset', icon: 'fa-rotate-left', tone: 'text-white/50' },
    admin_add: { label: 'Admin Added', icon: 'fa-user-plus', tone: 'text-emerald-400' },
    admin_remove: { label: 'Admin Removed', icon: 'fa-user-minus', tone: 'text-red-400' },
};

const RETENTIONS = [7, 14, 30, 90, 365];

/** Matches the server page size. */
const PAGE_SIZE = 25;

const MOCK: LogRow[] = [
    { id: 4, resource: 'gg_studio', path: 'theme.primary_color', action: 'change', actor: 'Sag (license2:6e71…)', changed_at: '2026-08-17 11:42', old: 'rgb(252, 186, 3)', new: 'rgb(56, 189, 248)', old_full: 'rgb(252, 186, 3)', new_full: 'rgb(56, 189, 248)' },
    { id: 3, resource: 'gg_taxijob', path: 'settings.depot.coords', action: 'change', actor: 'Sag (license2:6e71…)', changed_at: '2026-08-17 11:31', old: '{"x":894.99,…}', new: '{"x":120.5,…}', old_full: '{\n  "x": 894.99,\n  "y": -179.17,\n  "z": 74.7,\n  "heading": 241.41\n}', new_full: '{\n  "x": 120.5,\n  "y": -800.25,\n  "z": 31,\n  "heading": 90\n}' },
    { id: 2, resource: 'gg_lib', path: 'license2:9f22c1aa77be…', action: 'admin_add', actor: 'Sag (license2:6e71…)', changed_at: '2026-08-17 10:58', new: 'Marlow', new_full: 'Marlow' },
    { id: 1, resource: 'gg_taxijob', path: 'settings.blip_theme.route_color', action: 'reset', actor: 'Marlow (license2:9f22…)', changed_at: '2026-08-16 22:14', old: '17', new: '46', old_full: '17', new_full: '46' },
];

//--------------------------------------------------
// MARK: Parts
//--------------------------------------------------

const CELL = 'flex-shrink-0 truncate text-[1.25vh]';

/** Just the name, without the identifier the server appends for the audit trail. */
function shortActor(actor?: string): string {
    if (!actor) return 'unknown';

    return actor.replace(/\s*\(.*\)\s*$/, '') || actor;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div className="flex min-w-0 gap-[1vh] py-[0.35vh]">
            <span className="w-[9vh] flex-shrink-0 text-[1.15vh] font-semibold uppercase tracking-widest text-white/30">{label}</span>
            <div className="min-w-0 flex-1">{children}</div>
        </div>
    );
}

function Value({ text, tone }: { text?: string; tone: string }) {
    if (text === undefined || text === null) return <span className="text-[1.25vh] italic text-white/25">{t('logs_unset')}</span>;

    return (
        <pre className={`max-h-[18vh] overflow-auto whitespace-pre-wrap break-all rounded-[0.4vh] bg-black/30 px-[0.8vh] py-[0.5vh] font-mono text-[1.2vh] ${tone}`}>
            {text}
        </pre>
    );
}

/** The inner breakdown, opened from a row rather than crowding it. */
function Inspector({ row, query }: { row: LogRow; query: string }) {
    const action = ACTIONS[row.action] ?? ACTIONS.change;

    const scripts = useSettings((state) => state.scripts);
    const target = scripts.find((script) => script.resource === row.resource);

    // Admin grants record an identifier rather than a setting path, so there is
    // nothing to jump to and nothing missing either.
    const settingRow = row.action === 'change' || row.action === 'reset';
    const exists = settingRow && Boolean(target?.entries.some((entry) => entry.path === row.path));

    return (
        <div className="border-t border-white/5 bg-black/20 px-[1.2vh] py-[0.9vh]">
            <Field label={t('logs_action')}>
                <span className={`text-[1.25vh] font-semibold ${action.tone}`}>
                    <i className={`fas ${action.icon} mr-[0.6vh] text-[1.15vh]`} />
                    {action.label}
                </span>
            </Field>

            <Field label={t('logs_what')}>
                <span className="break-all font-mono text-[1.25vh] text-white/80">{highlight(row.path, query)}</span>
            </Field>

            <Field label={t('logs_where')}>
                <span className="font-mono text-[1.25vh] text-white/60">{highlight(row.resource, query)}</span>
            </Field>

            <Field label={t('logs_who')}>
                <span className="break-all text-[1.25vh] text-white/60">{highlight(row.actor ?? 'unknown', query)}</span>
            </Field>

            <Field label={t('logs_when')}>
                <span className="font-mono text-[1.25vh] text-white/60">{row.changed_at}</span>
            </Field>

            <Field label={t('logs_before')}>
                <Value text={row.old_full ?? row.old} tone="text-white/40" />
            </Field>

            <Field label={t('logs_after')}>
                <Value text={row.new_full ?? row.new} tone="text-white/80" />
            </Field>

            <div className={`mt-[0.6vh] flex items-center gap-[1vh] pl-[10vh] ${settingRow ? '' : 'hidden'}`}>
                {exists ? (
                    <button
                        type="button"
                        onClick={() => setActiveScript(row.resource, row.path)}
                        className="flex h-[2.8vh] items-center gap-[0.7vh] rounded-[0.5vh] border border-primary/35 bg-primary/10 px-[1vh] text-[1.2vh] font-semibold text-primary transition-colors hover:bg-primary/20"
                    >
                        <i className="fas fa-arrow-up-right-from-square text-[1vh]" />
                        {t('logs_goto')}
                    </button>
                ) : (
                    <span className="text-[1.15vh] italic text-white/25">{t('logs_gone')}</span>
                )}
            </div>
        </div>
    );
}

function Row({ row, open, onToggle, query }: { row: LogRow; open: boolean; onToggle: () => void; query: string }) {
    const action = ACTIONS[row.action] ?? ACTIONS.change;

    return (
        <div className={`border-b border-white/5 ${open ? 'bg-white/[0.03]' : ''}`}>
            <button
                type="button"
                onClick={onToggle}
                className="flex w-full items-center gap-[1vh] px-[1.2vh] py-[0.6vh] text-left transition-colors hover:bg-white/[0.04]"
            >
                <i className={`fas fa-chevron-right w-[1.2vh] flex-shrink-0 text-[1vh] text-white/25 transition-transform ${open ? 'rotate-90' : ''}`} />

                <span className={`${CELL} w-[11vh] font-mono text-white/35`}>{row.changed_at}</span>

                <i className={`fas ${action.icon} w-[1.6vh] flex-shrink-0 text-center text-[1.15vh] ${action.tone}`} />

                <span className="min-w-0 flex-1 truncate font-mono text-[1.3vh] text-white/85">{highlight(row.path, query)}</span>

                <span className={`${CELL} w-[13vh] font-mono text-white/35`}>{highlight(row.resource, query)}</span>

                <span className={`${CELL} w-[14vh] text-right text-white/45`}>{highlight(shortActor(row.actor), query)}</span>
            </button>

            {open && <Inspector row={row} query={query} />}
        </div>
    );
}

//--------------------------------------------------
// MARK: Page
//--------------------------------------------------

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
    const [retention, setRetention] = useState(14);
    const [openId, setOpenId] = useState<number | string | null>(null);

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
        setOpenId(null);
    }, [page, debounced, person]);

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

                const response = await fetchNui<{ ok: boolean; ROWS?: LogRow[]; TOTAL?: number; ACTORS?: string[]; RETENTION?: number }>('logs_fetch', {
                    page,
                    size: PAGE_SIZE,
                    search: debounced,
                    actor: person,
                });

                if (cancelled) return;

                setRows(response?.ok ? (response.ROWS ?? []) : []);
                setTotal(response?.TOTAL ?? 0);
                setPeople(response?.ACTORS ?? []);
                if (response?.RETENTION) setRetention(response.RETENTION);
            } finally {
                if (!cancelled) setBusy(false);
            }
        };

        void load();

        return () => {
            cancelled = true;
        };
    }, [page, debounced, person]);

    const changeRetention = async (days: number) => {
        setRetention(days);

        if (isEnvBrowser()) return;

        await fetchNui('logs_retention', { days });
    };

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
        <div className="flex min-h-0 min-w-0 flex-1 flex-col px-[2vh] py-[1.6vh]">
            <div className="mb-[0.8vh] flex flex-shrink-0 items-center gap-[1vh]">
                <i className="fas fa-clock-rotate-left text-[1.5vh] text-primary/80" />
                <h2 className="flex-shrink-0 text-[1.8vh] font-bold text-white/90">{t('logs_title')}</h2>

                <span className="min-w-0 flex-1" />

                <Dropdown
                    value={person}
                    onChange={setPerson}
                    icon="fa-user"
                    width="20vh"
                    options={[{ value: '', label: t('logs_all_people') }, ...people.map((name) => ({ value: name, label: name }))]}
                />

                <Dropdown
                    value={String(retention)}
                    onChange={(next) => void changeRetention(Number(next))}
                    icon="fa-clock"
                    width="13vh"
                    options={RETENTIONS.map((days) => ({ value: String(days), label: `${t('logs_keep')} ${days}d` }))}
                />

                <span className="flex-shrink-0 font-mono text-[1.15vh] text-white/30">
                    {total === 0 ? '0' : `${(page - 1) * PAGE_SIZE + 1}–${Math.min(page * PAGE_SIZE, total)} ${t('logs_showing')} ${total}`}
                </span>

                <div className="flex flex-shrink-0 gap-[0.5vh]">
                    <button
                        type="button"
                        onClick={() => setPage((current) => Math.max(1, current - 1))}
                        disabled={page <= 1 || busy}
                        className={`flex h-[2.8vh] w-[2.8vh] items-center justify-center rounded-[0.5vh] border border-white/10 text-[1.15vh] transition-colors ${
                            page <= 1 || busy ? 'cursor-not-allowed text-white/15' : 'text-white/50 hover:border-primary/40 hover:text-primary'
                        }`}
                    >
                        <i className="fas fa-chevron-left" />
                    </button>
                    <button
                        type="button"
                        onClick={() => setPage((current) => Math.min(pages, current + 1))}
                        disabled={page >= pages || busy}
                        className={`flex h-[2.8vh] w-[2.8vh] items-center justify-center rounded-[0.5vh] border border-white/10 text-[1.15vh] transition-colors ${
                            page >= pages || busy ? 'cursor-not-allowed text-white/15' : 'text-white/50 hover:border-primary/40 hover:text-primary'
                        }`}
                    >
                        <i className="fas fa-chevron-right" />
                    </button>
                </div>
            </div>

            <div className="flex flex-shrink-0 items-center gap-[1vh] border-y border-white/10 bg-white/[0.02] px-[1.2vh] py-[0.4vh] text-[1.05vh] font-semibold uppercase tracking-widest text-white/25">
                <span className="w-[1.2vh] flex-shrink-0" />
                <span className="w-[11vh] flex-shrink-0">{t('logs_when')}</span>
                <span className="w-[1.6vh] flex-shrink-0" />
                <span className="min-w-0 flex-1">{t('logs_what')}</span>
                <span className="w-[13vh] flex-shrink-0">{t('logs_where')}</span>
                <span className="w-[14vh] flex-shrink-0 text-right">{t('logs_who')}</span>
            </div>

            <div className="min-h-0 min-w-0 flex-1 overflow-y-auto">
                {visible.map((row, index) => {
                    const key = row.id ?? `${row.changed_at}-${row.path}-${index}`;

                    return <Row key={key} row={row} open={openId === key} onToggle={() => setOpenId(openId === key ? null : key)} query={query} />;
                })}

                {visible.length === 0 && (
                    <div className="flex flex-col items-center gap-[1vh] py-[8vh] text-white/35">
                        <i className="fas fa-clock-rotate-left text-[3.5vh]" />
                        <span className="text-[1.5vh]">{rows && rows.length > 0 ? t('settings_no_results') : t('logs_empty')}</span>
                    </div>
                )}
            </div>
        </div>
    );
}
