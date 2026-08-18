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

const MOCK: LogRow[] = [
    { resource: 'gg_studio', path: 'theme.primary_color', action: 'change', actor: 'Sag (license2:6e71…)', changed_at: '2026-08-17 11:42', old: 'rgb(252, 186, 3)', new: 'rgb(56, 189, 248)' },
    { resource: 'gg_taxijob', path: 'settings.depot.coords', action: 'change', actor: 'Sag (license2:6e71…)', changed_at: '2026-08-17 11:31', old: '{"x":894.99,"y":-179.17,"z":74.7,"heading":241.41}', new: '{"x":120.5,"y":-800.25,"z":31,"heading":90}' },
    { resource: 'gg_lib', path: 'license2:9f22c1aa77be…', action: 'admin_add', actor: 'Sag (license2:6e71…)', changed_at: '2026-08-17 10:58', new: 'Marlow' },
    { resource: 'gg_taxijob', path: 'settings.blip_theme.route_color', action: 'reset', actor: 'Marlow (license2:9f22…)', changed_at: '2026-08-16 22:14', old: '17', new: '46' },
];

export default function SETTINGS_LOGS({ query }: { query: string }) {
    const [rows, setRows] = useState<LogRow[] | null>(null);
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        let cancelled = false;

        const load = async () => {
            setBusy(true);

            try {
                if (isEnvBrowser()) {
                    await new Promise((resolve) => setTimeout(resolve, 200));
                    if (!cancelled) setRows(MOCK);
                    return;
                }

                const response = await fetchNui<{ ok: boolean; ROWS?: LogRow[] }>('logs_fetch', { limit: 200 });
                if (!cancelled) setRows(response?.ok ? (response.ROWS ?? []) : []);
            } finally {
                if (!cancelled) setBusy(false);
            }
        };

        void load();

        return () => {
            cancelled = true;
        };
    }, []);

    const needle = query.trim().toLowerCase();

    const visible = (rows ?? []).filter(
        (row) =>
            !needle ||
            row.path.toLowerCase().includes(needle) ||
            row.resource.toLowerCase().includes(needle) ||
            (row.actor ?? '').toLowerCase().includes(needle),
    );

    if (rows === null && busy) {
        return (
            <div className="flex flex-1 items-center justify-center text-white/35">
                <i className="fas fa-spinner animate-spin text-[3vh]" />
            </div>
        );
    }

    return (
        <div className="relative min-h-0 min-w-0 flex-1 overflow-y-auto px-[2vh] py-[1.6vh]">
            <div className="mb-[1vh] flex items-baseline gap-[1vh] border-b border-white/5 pb-[0.8vh]">
                <i className="fas fa-clock-rotate-left text-[1.6vh] text-primary/80" />
                <h2 className="text-[1.9vh] font-bold text-white/90">{t('logs_title')}</h2>
                <span className="font-mono text-[1.2vh] text-white/30">{visible.length}</span>
                <span className="min-w-0 flex-1 truncate text-[1.3vh] text-white/35">{t('logs_help')}</span>
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
