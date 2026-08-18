import { useCallback, useEffect, useState } from 'react';
import { t } from '@/data/useLang';
import { fetchNui, isEnvBrowser } from '@/lib/fetchNui';
import { useSettings } from '@/data/useSettings';
import { highlight } from './settings-utils';
import SettingControl from './SETTING_CONTROL';

export type BridgeCategory = {
    category: string;
    resource: string;
    source: string;
    state: string;
    loaded: boolean;
    stub: boolean;
    error?: string;
    /** Generic setting the selection is stored under. */
    path?: string;
    /** The stored choice; empty string means auto detect. */
    selected?: string;
    options?: { value: string; label: string }[];
    /** Chosen after boot: not wired until gg_lib restarts. */
    pending?: boolean;
};

export type Dependency = {
    resource: string;
    running: boolean;
};

export type Provider = {
    id: string;
    label: string;
    path?: string;
    options?: { value: string; label: string; requires?: string; available?: boolean }[];
    provider: string;
    resource: string;
    source: string;
    running: boolean;
    requires?: string;
    error?: string;
};

export type BridgeData = {
    dependencies: Dependency[];
    interface: Provider[];
    bridges: BridgeCategory[];
};

const CATEGORY_ICONS: Record<string, string> = {
    framework: 'fa-cubes',
    inventory: 'fa-boxes-stacked',
    target: 'fa-crosshairs',
    dispatch: 'fa-tower-broadcast',
};

const PROVIDER_ICONS: Record<string, string> = {
    notifications: 'fa-bell',
    progressbar: 'fa-bars-progress',
    textui: 'fa-comment-dots',
    context: 'fa-list-ul',
};

const MOCK: BridgeData = {
    dependencies: [
        { resource: 'ox_lib', running: true },
        { resource: 'oxmysql', running: true },
    ],
    interface: [
        { id: 'notifications', label: 'Notifications', path: 'interface.notifications', options: [{ value: 'ox', label: 'ox_lib', requires: 'ox_lib', available: true }, { value: 'qb', label: 'qb-core (not started)', requires: 'qb-core', available: false }, { value: 'okok', label: 'okokNotify', requires: 'okokNotify', available: true }], provider: 'ox', resource: 'ox_lib', source: 'default', running: true },
        { id: 'progressbar', label: 'Progress Bars', path: 'interface.progressbar', options: [{ value: 'ox', label: 'ox_lib', requires: 'ox_lib', available: true }, { value: 'esx', label: 'es_extended (not started)', requires: 'es_extended', available: false }], provider: 'ox', resource: 'ox_lib', source: 'default', running: true },
        { id: 'textui', label: 'Text UI', path: 'interface.textui', options: [{ value: 'ox', label: 'ox_lib', requires: 'ox_lib', available: true }, { value: 'qb', label: 'qb-core (not started)', requires: 'qb-core', available: false }], provider: 'ox', resource: 'ox_lib', source: 'default', running: true },
        { id: 'context', label: 'Context Menu', provider: 'ox', resource: 'ox_lib', source: 'detected', running: true },
    ],
    bridges: [
        { category: 'framework', resource: 'qbx_core', source: 'detected', state: 'started', loaded: true, stub: false },
        { category: 'inventory', resource: 'ox_inventory', source: 'detected', state: 'started', loaded: true, stub: false },
        { category: 'target', resource: 'ox_target', source: 'detected', state: 'started', loaded: true, stub: false },
        { category: 'dispatch', resource: 'default', source: 'default', state: 'started', loaded: true, stub: true },
    ],
};

function tone(ok: boolean, muted?: boolean) {
    if (!ok) return { icon: 'fa-circle-xmark', color: 'text-red-400', border: 'border-red-400/30' };
    if (muted) return { icon: 'fa-circle-minus', color: 'text-white/35', border: 'border-white/10' };

    return { icon: 'fa-circle-check', color: 'text-primary', border: 'border-primary/25' };
}

function Section({ icon, title, help, children }: { icon: string; title: string; help?: string; children: React.ReactNode }) {
    return (
        <div className="mb-[2vh]">
            <div className="mb-[1vh] flex items-baseline gap-[1vh] border-b border-white/5 pb-[0.7vh]">
                <i className={`fas ${icon} text-[1.5vh] text-primary/80`} />
                <h2 className="text-[1.75vh] font-bold text-white/90">{title}</h2>
                {help && <span className="min-w-0 flex-1 truncate text-[1.25vh] text-white/35">{help}</span>}
            </div>
            {children}
        </div>
    );
}

function Tile({
    icon,
    label,
    value,
    note,
    ok,
    muted,
    query,
}: {
    icon: string;
    label: string;
    value: string;
    note?: string;
    ok: boolean;
    muted?: boolean;
    query: string;
}) {
    const look = tone(ok, muted);

    return (
        <div className={`flex min-w-0 items-center gap-[1vh] rounded-[0.5vh] border ${look.border} bg-neutral-950/40 px-[1.1vh] py-[0.8vh]`}>
            <i className={`fas ${icon} w-[2vh] flex-shrink-0 text-[1.3vh] text-white/30`} />

            <div className="flex min-w-0 flex-1 flex-col">
                <span className="text-[1.1vh] font-semibold uppercase tracking-widest text-white/35">{label}</span>
                <span className="truncate font-mono text-[1.4vh] text-white/85">{highlight(value, query)}</span>
                {note && <span className={`truncate text-[1.15vh] ${ok ? 'text-white/30' : 'text-red-300/80'}`}>{note}</span>}
            </div>

            <i className={`fas ${look.icon} flex-shrink-0 text-[1.4vh] ${look.color}`} />
        </div>
    );
}

function sourceNote(entry: BridgeCategory): string {
    if (entry.source === 'stored') return t('bridge_from_stored');
    if (entry.source === 'override') return t('bridge_from_override');
    if (entry.source === 'detected') return t('bridge_from_detected');

    return t('bridge_from_default');
}

function providerNote(entry: Provider): string {
    if (entry.error) return entry.error;
    if (entry.source === 'configured') return t('bridge_from_stored');
    if (entry.source === 'detected') return t('bridge_from_detected');

    return t('bridge_provider_default');
}

function ProviderTile({ entry, disabled, onSaved, query }: { entry: Provider; disabled: boolean; onSaved: () => void; query: string }) {
    const [busy, setBusy] = useState(false);
    const look = tone(entry.running);

    const change = async (next: string) => {
        if (!entry.path || next === entry.provider) return;

        setBusy(true);

        try {
            await fetchNui('bridge_set_provider', { path: entry.path, value: next });
            onSaved();
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className={`flex min-w-0 items-center gap-[1vh] rounded-[0.5vh] border ${look.border} bg-neutral-950/40 px-[1.1vh] py-[0.8vh]`}>
            <i className={`fas ${PROVIDER_ICONS[entry.id] ?? 'fa-sliders'} w-[2vh] flex-shrink-0 text-[1.3vh] text-white/30`} />

            <div className="flex min-w-0 flex-1 flex-col gap-[0.3vh]">
                <span className="text-[1.1vh] font-semibold uppercase tracking-widest text-white/35">{entry.label}</span>

                {entry.path && entry.options && !disabled ? (
                    <SettingControl
                        def={{ type: 'enum', options: entry.options }}
                        value={entry.provider}
                        disabled={busy}
                        onChange={(next) => void change(String(next))}
                    />
                ) : (
                    <span className="truncate font-mono text-[1.4vh] text-white/85">{highlight(entry.resource, query)}</span>
                )}

                {entry.error ? (
                    <span className="truncate text-[1.15vh] text-red-300/80">{entry.error}</span>
                ) : (
                    <span className="truncate text-[1.15vh] text-white/30">
                        <span className={`font-mono font-semibold ${entry.source === 'detected' ? 'text-primary' : 'text-white/90'}`}>{entry.resource}</span>
                        {' '}— {providerNote(entry)}
                    </span>
                )}
            </div>

            <i className={`fas ${busy ? 'fa-spinner fa-spin' : look.icon} flex-shrink-0 text-[1.4vh] ${busy ? 'text-white/40' : look.color}`} />
        </div>
    );
}

function BridgeTile({ entry, disabled, onSaved, query }: { entry: BridgeCategory; disabled: boolean; onSaved: () => void; query: string }) {
    const [busy, setBusy] = useState(false);
    const look = tone(entry.loaded, entry.stub);

    const change = async (next: string) => {
        if (!entry.path || next === (entry.selected ?? '')) return;

        setBusy(true);

        try {
            await fetchNui('bridge_set_provider', { path: entry.path, value: next });
            onSaved();
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className={`flex min-w-0 items-center gap-[1vh] rounded-[0.5vh] border ${look.border} bg-neutral-950/40 px-[1.1vh] py-[0.8vh]`}>
            <i className={`fas ${CATEGORY_ICONS[entry.category] ?? 'fa-plug'} w-[2vh] flex-shrink-0 text-[1.3vh] text-white/30`} />

            <div className="flex min-w-0 flex-1 flex-col gap-[0.3vh]">
                <span className="text-[1.1vh] font-semibold uppercase tracking-widest text-white/35">{entry.category}</span>

                {entry.path && entry.options && !disabled ? (
                    <SettingControl
                        def={{
                            type: 'enum',
                            options: (entry.options ?? []).map((option) =>
                                option.value === '' && !entry.stub && (entry.selected ?? '') === ''
                                    ? { ...option, label: `${option.label} (${entry.resource})` }
                                    : option,
                            ),
                        }}
                        value={entry.selected ?? ''}
                        disabled={busy}
                        onChange={(next) => void change(String(next))}
                    />
                ) : (
                    <span className="truncate font-mono text-[1.4vh] text-white/85">{entry.stub ? t('bridge_none') : highlight(entry.resource, query)}</span>
                )}

                {entry.pending ? (
                    <span className="truncate text-[1.15vh] text-primary/80">{t('bridge_pending')}</span>
                ) : entry.error ? (
                    <span className="truncate text-[1.15vh] text-red-300/80">{entry.error}</span>
                ) : (
                    <span className="truncate text-[1.15vh] text-white/30">
                        {t('bridge_wired_to')}{' '}
                        <span className={`font-mono font-semibold ${entry.stub ? 'text-white/45' : entry.source === 'detected' ? 'text-primary' : 'text-white/90'}`}>
                            {entry.stub ? t('bridge_none') : entry.resource}
                        </span>
                        {' '}— {sourceNote(entry)}
                    </span>
                )}
            </div>

            <i className={`fas ${busy ? 'fa-spinner fa-spin' : look.icon} flex-shrink-0 text-[1.4vh] ${busy ? 'text-white/40' : look.color}`} />
        </div>
    );
}
export default function SETTINGS_BRIDGE({ query }: { query: string }) {
    const [data, setData] = useState<BridgeData | null>(null);
    const [busy, setBusy] = useState(false);
    const canEdit = useSettings((state) => state.canEdit);

    const reload = useCallback(async () => {
        if (isEnvBrowser()) return;

        const response = await fetchNui<{ ok: boolean; DATA?: BridgeData }>('bridge_fetch', {});
        setData(response?.ok ? (response.DATA ?? null) : null);
    }, []);

    useEffect(() => {
        let cancelled = false;

        const load = async () => {
            setBusy(true);

            try {
                if (isEnvBrowser()) {
                    await new Promise((resolve) => setTimeout(resolve, 200));
                    if (!cancelled) setData(MOCK);
                    return;
                }

                const response = await fetchNui<{ ok: boolean; DATA?: BridgeData }>('bridge_fetch', {});
                if (!cancelled) setData(response?.ok ? (response.DATA ?? null) : null);
            } finally {
                if (!cancelled) setBusy(false);
            }
        };

        void load();

        return () => {
            cancelled = true;
        };
    }, []);

    const problems =
        (data?.dependencies ?? []).filter((entry) => !entry.running).length +
        (data?.interface ?? []).filter((entry) => !entry.running).length +
        (data?.bridges ?? []).filter((entry) => !entry.loaded).length;

    return (
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto px-[2vh] py-[1.6vh]">
            {busy && data === null && (
                <div className="flex flex-col items-center gap-[1vh] py-[10vh] text-white/35">
                    <i className="fas fa-spinner fa-spin text-[3vh]" />
                </div>
            )}

            {!busy && data === null && (
                <div className="flex flex-col items-center gap-[1vh] py-[10vh] text-white/35">
                    <i className="fas fa-plug-circle-xmark text-[4vh]" />
                    <span className="text-[1.7vh]">{t('bridge_empty')}</span>
                </div>
            )}

            {data && (
                <>
                    {problems > 0 && (
                        <div className="mb-[1.6vh] flex items-center gap-[0.8vh] rounded-[0.5vh] border border-red-400/30 bg-red-500/10 px-[1.2vh] py-[0.8vh] text-[1.35vh] font-semibold text-red-300">
                            <i className="fas fa-triangle-exclamation text-[1.3vh]" />
                            {problems} {problems === 1 ? t('bridge_problem_one') : t('bridge_problem_many')}
                        </div>
                    )}

                    <Section icon="fa-cube" title={t('bridge_dependencies')} help={t('bridge_dependencies_help')}>
                        <div className="grid gap-[0.8vh]" style={{ gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
                            {data.dependencies.map((entry) => (
                                <Tile
                                    key={entry.resource}
                                    icon="fa-cube"
                                    label={t('bridge_required')}
                                    value={entry.resource}
                                    note={entry.running ? t('bridge_running') : t('bridge_not_running')}
                                    ok={entry.running}
                                    query={query}
                                />
                            ))}
                        </div>
                    </Section>

                    <Section icon="fa-sliders" title={t('bridge_interface')} help={t('bridge_interface_help')}>
                        <div className="grid gap-[0.8vh]" style={{ gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
                            {data.interface.map((entry) => (
                                <ProviderTile key={entry.id} entry={entry} disabled={!canEdit} onSaved={reload} query={query} />
                            ))}
                        </div>
                    </Section>

                    <Section icon="fa-plug" title={t('bridge_title')} help={t('bridge_help')}>
                        <div className="grid gap-[0.8vh]" style={{ gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
                            {data.bridges.map((entry) => (
                                <BridgeTile key={entry.category} entry={entry} disabled={!canEdit} onSaved={reload} query={query} />
                            ))}
                        </div>
                    </Section>
                </>
            )}
        </div>
    );
}
