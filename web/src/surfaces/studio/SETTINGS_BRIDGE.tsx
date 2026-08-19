import { useCallback, useEffect, useState } from 'react';
import { hideEditor, showEditor, t } from '@/data/useLang';
import { fetchNui, isEnvBrowser } from '@/lib/fetchNui';
import { useSettings } from '@/data/useSettings';
import { highlight } from './settings-utils';
import SettingControl from './SETTING_CONTROL';

/** Read off the resource's own fxmanifest, so the page reports what is really running. */
export type ResourceInfo = {
    resource: string;
    state: string;
    version?: string;
    author?: string;
    fx?: string;
    game?: string;
    lua54?: boolean;
    description?: string;
};

export type BridgeCategory = {
    category: string;
    resource: string;
    source: string;
    state: string;
    loaded: boolean;
    stub: boolean;
    error?: string;
    info?: ResourceInfo;
    /** Generic setting the selection is stored under. */
    path?: string;
    /** The stored choice; empty string means auto detect. */
    selected?: string;
    options?: { value: string; label: string }[];
    /** Chosen after boot: not wired until gg_lib restarts. */
    pending?: boolean;
    /** Scripts cannot work without it; the rest are nice to have. */
    required?: boolean;
};

export type Dependency = {
    resource: string;
    running: boolean;
    info?: ResourceInfo;
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
    info?: ResourceInfo;
    /** ox_lib-only extras; the server sends none for any other provider. */
    tuning?: ProviderTuning[];
};

export type ProviderTuning = {
    path: string;
    label: string;
    value: string;
    options?: { value: string; label: string }[];
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
        { resource: 'ox_lib', running: true, info: { resource: 'ox_lib', state: 'started', version: '3.30.6', author: 'Overextended', fx: 'cerulean', lua54: true } },
        { resource: 'oxmysql', running: true, info: { resource: 'oxmysql', state: 'started', version: '2.13.0', author: 'Overextended', fx: 'bodacious' } },
    ],
    interface: [
        { id: 'notifications', label: 'Notifications', path: 'interface.notifications', options: [{ value: 'ox', label: 'ox_lib', requires: 'ox_lib', available: true }, { value: 'okok', label: 'okokNotify', requires: 'okokNotify', available: true }], provider: 'ox', resource: 'ox_lib', source: 'default', running: true, info: { resource: 'ox_lib', state: 'started', version: '3.30.6', author: 'Overextended', fx: 'cerulean' } },
        { id: 'progressbar', label: 'Progress Bars', path: 'interface.progressbar', options: [{ value: 'ox', label: 'ox_lib', requires: 'ox_lib', available: true }], provider: 'ox', resource: 'ox_lib', source: 'default', running: true, info: { resource: 'ox_lib', state: 'started', version: '3.30.6', author: 'Overextended', fx: 'cerulean' }, tuning: [{ path: 'interface.ox_progress_style', label: 'Style', value: 'circle', options: [{ value: 'circle', label: 'Circle' }, { value: 'bar', label: 'Bar' }] }, { path: 'interface.ox_progress_position', label: 'Position', value: 'bottom', options: [{ value: 'bottom', label: 'Bottom' }, { value: 'middle', label: 'Middle' }] }] },
        { id: 'textui', label: 'Text UI', path: 'interface.textui', options: [{ value: 'ox', label: 'ox_lib', requires: 'ox_lib', available: true }], provider: 'ox', resource: 'ox_lib', source: 'default', running: true, info: { resource: 'ox_lib', state: 'started', version: '3.30.6', author: 'Overextended', fx: 'cerulean' }, tuning: [{ path: 'interface.ox_textui_position', label: 'Position', value: 'right-center', options: [{ value: 'right-center', label: 'Right' }, { value: 'left-center', label: 'Left' }, { value: 'top-center', label: 'Top' }] }] },
        { id: 'context', label: 'Context Menu', path: 'interface.contextmenu', options: [{ value: 'auto', label: 'Auto detect' }, { value: 'ox', label: 'ox_lib' }, { value: 'lation', label: 'lation_ui' }], provider: 'auto', resource: 'ox_lib', source: 'detected', running: true, info: { resource: 'ox_lib', state: 'started', version: '3.30.6', author: 'Overextended', fx: 'cerulean' } },
    ],
    bridges: [
        { category: 'framework', resource: 'qbx_core', source: 'detected', state: 'started', loaded: true, stub: false, required: true, info: { resource: 'qbx_core', state: 'started', version: '1.24.1', author: 'Qbox Project', fx: 'cerulean', lua54: true } },
        { category: 'inventory', resource: 'ox_inventory', source: 'detected', state: 'started', loaded: true, stub: false, info: { resource: 'ox_inventory', state: 'started', version: '2.44.1', author: 'Overextended', fx: 'cerulean' } },
        { category: 'target', resource: 'ox_target', source: 'stored', state: 'started', loaded: true, stub: false, info: { resource: 'ox_target', state: 'started', version: '1.19.0', author: 'Overextended', fx: 'cerulean' } },
        { category: 'dispatch', resource: 'default', source: 'default', state: 'started', loaded: true, stub: true, required: true },
        { category: 'fuel', resource: 'ox_fuel', source: 'detected', state: 'started', loaded: true, stub: false, info: { resource: 'ox_fuel', state: 'started', version: '1.3.0', author: 'Overextended', fx: 'cerulean' } },
        { category: 'keys', resource: 'default', source: 'default', state: 'started', loaded: true, stub: true },
    ],
};

//--------------------------------------------------
// MARK: Parts
//--------------------------------------------------

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

/** The small uppercase tag saying where the choice came from. */
function SourceTag({ label, strong }: { label: string; strong?: boolean }) {
    return (
        <span
            className={`flex-shrink-0 rounded-[0.35vh] px-[0.6vh] py-[0.15vh] text-[1vh] font-bold uppercase tracking-widest ${
                strong ? 'bg-primary/15 text-primary' : 'border border-white/10 text-white/35'
            }`}
        >
            {label}
        </span>
    );
}

/** Version, manifest target and author — whatever the resource actually declares. */
function Manifest({ info, missing }: { info?: ResourceInfo; missing?: boolean }) {
    if (!info) {
        return <span className="truncate text-[1.15vh] text-white/25">{missing ? t('bridge_not_installed') : t('bridge_no_version')}</span>;
    }

    const bits = [info.version ? `v${info.version}` : t('bridge_no_version'), info.fx, info.author].filter(Boolean) as string[];

    return (
        <div className="flex min-w-0 items-center gap-[0.6vh]">
            {bits.map((bit, index) => (
                <span key={bit + index} className="flex min-w-0 items-center gap-[0.6vh]">
                    {index > 0 && <span className="text-[1vh] text-white/15">•</span>}
                    <span className={`truncate font-mono text-[1.15vh] ${index === 0 ? 'text-white/55' : 'text-white/30'}`}>{bit}</span>
                </span>
            ))}
            {info.lua54 && <span className="flex-shrink-0 rounded-[0.3vh] border border-white/10 px-[0.5vh] text-[0.95vh] font-bold text-white/25">LUA54</span>}
        </div>
    );
}

/**
 * One row: what it is on the left, the resource carrying it underneath with its
 * real manifest details, and the picker below.
 */
function Card({
    icon,
    label,
    resource,
    resourceTone,
    tag,
    tagStrong,
    info,
    missing,
    status,
    note,
    noteTone,
    query,
    children,
    actions,
}: {
    icon: string;
    label: string;
    resource: string;
    resourceTone?: string;
    tag?: string;
    tagStrong?: boolean;
    info?: ResourceInfo;
    missing?: boolean;
    status: { icon: string; color: string; border: string };
    note?: string;
    noteTone?: string;
    query: string;
    children?: React.ReactNode;
    actions?: React.ReactNode;
}) {
    return (
        <div className={`flex min-w-0 flex-col gap-[0.7vh] rounded-[0.5vh] border ${status.border} bg-neutral-950/40 px-[1.1vh] py-[0.9vh]`}>
            <div className="flex min-w-0 items-center gap-[0.8vh]">
                <i className={`fas ${icon} w-[1.8vh] flex-shrink-0 text-[1.25vh] text-white/30`} />
                <span className="flex-shrink-0 text-[1.1vh] font-semibold uppercase tracking-widest text-white/35">{label}</span>

                <span className="min-w-0 flex-1" />

                {tag && <SourceTag label={tag} strong={tagStrong} />}
                <i className={`fas ${status.icon} flex-shrink-0 text-[1.35vh] ${status.color}`} />
            </div>

            <div className="flex min-w-0 items-center gap-[0.8vh]">
                <div className="flex min-w-0 flex-1 flex-col">
                    <span className={`truncate font-mono text-[1.55vh] font-semibold ${resourceTone ?? 'text-white/90'}`}>{highlight(resource, query)}</span>
                    <Manifest info={info} missing={missing} />
                </div>

                {actions}
            </div>

            {note && <span className={`truncate text-[1.15vh] ${noteTone ?? 'text-white/30'}`}>{note}</span>}

            {children}
        </div>
    );
}

function bridgeTag(entry: BridgeCategory) {
    if (entry.stub) return { label: entry.required ? t('bridge_src_stub') : t('bridge_src_none'), strong: false };
    if (entry.source === 'stored') return { label: t('bridge_src_manual'), strong: true };
    if (entry.source === 'override') return { label: t('bridge_src_utility'), strong: true };

    return { label: t('bridge_src_auto'), strong: false };
}

function providerTag(entry: Provider) {
    if (entry.source === 'configured') return { label: t('bridge_src_manual'), strong: true };
    if (entry.source === 'detected') return { label: t('bridge_src_auto'), strong: false };

    return { label: t('bridge_src_default'), strong: false };
}

//--------------------------------------------------
// MARK: Tiles
//--------------------------------------------------

function TestButton({ entry }: { entry: Provider }) {
    const [busy, setBusy] = useState(false);

    const run = async () => {
        if (busy) return;

        setBusy(true);

        // The editor steps aside so the tested UI owns the screen, then comes
        // back to the same page once the test answers.
        hideEditor();

        try {
            // The tuning goes along with the provider. The test reads its
            // settings out of what this sends, so anything left out falls back
            // to a default and the test shows something the server would not.
            await fetchNui('bridge_test', {
                id: entry.id,
                path: entry.path,
                value: entry.provider,
                tuning: entry.tuning?.map((option) => ({ path: option.path, value: option.value })),
            });
        } finally {
            showEditor();
            setBusy(false);
        }
    };

    return (
        <button
            type="button"
            disabled={busy || !entry.running}
            onClick={() => void run()}
            className={`flex h-[3vh] flex-shrink-0 items-center gap-[0.6vh] rounded-[0.5vh] border px-[1vh] text-[1.2vh] font-semibold transition-colors ${
                !entry.running
                    ? 'cursor-not-allowed border-white/5 text-white/15'
                    : 'border-primary/35 bg-primary/10 text-primary hover:bg-primary/20'
            }`}
        >
            <i className={`fas ${busy ? 'fa-spinner fa-spin' : 'fa-play'} text-[1vh]`} />
            {busy ? t('bridge_testing') : t('bridge_test')}
        </button>
    );
}

function ProviderTile({ entry, disabled, onSaved, query }: { entry: Provider; disabled: boolean; onSaved: () => void; query: string }) {
    const [busy, setBusy] = useState(false);
    const look = tone(entry.running);
    const tag = providerTag(entry);

    const save = async (path: string, next: string, current: string) => {
        if (next === current) return;

        setBusy(true);

        try {
            await fetchNui('bridge_set_provider', { path, value: next });
            onSaved();
        } finally {
            setBusy(false);
        }
    };

    const change = async (next: string) => {
        if (!entry.path) return;

        await save(entry.path, next, entry.provider);
    };

    return (
        <Card
            icon={PROVIDER_ICONS[entry.id] ?? 'fa-sliders'}
            label={entry.label}
            resource={entry.resource}
            resourceTone={entry.running ? 'text-primary' : 'text-red-300/80'}
            tag={tag.label}
            tagStrong={tag.strong}
            info={entry.info}
            missing={!entry.info}
            status={busy ? { icon: 'fa-spinner fa-spin', color: 'text-white/40', border: look.border } : look}
            note={entry.error}
            noteTone="text-red-300/80"
            query={query}
            actions={<TestButton entry={entry} />}
        >
            {entry.path && entry.options && !disabled && (
                <SettingControl
                    def={{ type: 'enum', options: entry.options }}
                    value={entry.provider}
                    disabled={busy}
                    onChange={(next) => void change(String(next))}
                />
            )}

            {/* Only ox_lib sends these. Indented under the provider it belongs
                to, so it reads as part of that choice rather than a new one. */}
            {entry.tuning && !disabled && (
                <div className="mt-[0.2vh] flex flex-col gap-[0.6vh] border-l border-white/10 pl-[1.1vh]">
                    {entry.tuning.map((option) => (
                        <div key={option.path} className="flex min-w-0 items-center gap-[0.8vh]">
                            <span className="w-[7vh] flex-shrink-0 text-[1.15vh] font-semibold uppercase tracking-widest text-white/30">{option.label}</span>

                            <div className="min-w-0 flex-1">
                                <SettingControl
                                    def={{ type: 'enum', options: option.options }}
                                    value={option.value}
                                    disabled={busy}
                                    onChange={(next) => void save(option.path, String(next), option.value)}
                                />
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </Card>
    );
}

function BridgeTile({ entry, disabled, onSaved, query }: { entry: BridgeCategory; disabled: boolean; onSaved: () => void; query: string }) {
    const [busy, setBusy] = useState(false);
    const look = tone(entry.loaded, entry.stub);
    const tag = bridgeTag(entry);

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
        <Card
            icon={CATEGORY_ICONS[entry.category] ?? 'fa-plug'}
            label={entry.category}
            resource={entry.stub ? t('bridge_none') : entry.resource}
            resourceTone={entry.stub ? 'text-white/40' : entry.loaded ? 'text-primary' : 'text-red-300/80'}
            tag={tag.label}
            tagStrong={tag.strong}
            info={entry.info}
            missing={!entry.stub && !entry.info}
            status={busy ? { icon: 'fa-spinner fa-spin', color: 'text-white/40', border: look.border } : look}
            note={entry.pending ? t('bridge_pending') : entry.error}
            noteTone={entry.pending ? 'text-primary/80' : 'text-red-300/80'}
            query={query}
        >
            {entry.path && entry.options && !disabled && (
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
            )}
        </Card>
    );
}

//--------------------------------------------------
// MARK: Page
//--------------------------------------------------

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
        (data?.bridges ?? []).filter((entry) => !entry.loaded || (entry.stub && entry.required)).length;

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
                                <Card
                                    key={entry.resource}
                                    icon="fa-cube"
                                    label={t('bridge_required')}
                                    resource={entry.resource}
                                    resourceTone={entry.running ? 'text-primary' : 'text-red-300/80'}
                                    info={entry.info}
                                    missing={!entry.info}
                                    status={tone(entry.running)}
                                    note={entry.running ? undefined : t('bridge_not_running')}
                                    noteTone="text-red-300/80"
                                    query={query}
                                />
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

                    <Section icon="fa-sliders" title={t('bridge_interface')} help={t('bridge_interface_help')}>
                        <div className="grid gap-[0.8vh]" style={{ gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
                            {data.interface.map((entry) => (
                                <ProviderTile key={entry.id} entry={entry} disabled={!canEdit} onSaved={reload} query={query} />
                            ))}
                        </div>
                    </Section>
                </>
            )}
        </div>
    );
}
