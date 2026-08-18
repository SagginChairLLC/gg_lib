import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useMemo, useRef, useState } from 'react';
import { applyAppearance, applyTheme, hideEditor, t } from '@/data/useLang';
import { fetchAdmins } from '@/data/useAdmins';
import { fetchNui, isEnvBrowser } from '@/lib/fetchNui';
import {
    ADMINS_PAGE,
    LOGS_PAGE,
    GENERIC_RESOURCE,
    THEME_PATH,
    applyDraftLocally,
    applyScripts,
    discardDraft,
    setActiveScript,
    settingsEqual,
    stageReset,
    stageValue,
    unstage,
    useSettings,
    type SettingEntry,
    type SettingsScript,
} from '@/data/useSettings';
import SettingControl, { isWideType } from './SETTING_CONTROL';
import SETTINGS_ADMINS from './SETTINGS_ADMINS';
import SETTINGS_RESET from './SETTINGS_RESET';
import SETTINGS_LOGS from './SETTINGS_LOGS';
import SETTINGS_PICKER from './SETTINGS_PICKER';
import { usePicker } from '@/data/usePicker';
import { highlight, matchesQuery, previewValue, typeHint } from './settings-utils';

/**
 * The whole editor: a Script Studio rail on the left — every script, with the
 * active one's groups nested beneath it, and studio-wide Generic settings in
 * their own section — then the active script's groups as one big scroll on the
 * right, live search, and a dirty bar that batches edits into one save.
 */

type SaveResponse = { ok: boolean; errors?: Record<string, string>; changed?: string[] };
type RefreshResponse = { ok: boolean; SCRIPTS?: SettingsScript[]; CAN_EDIT?: boolean; UI_THEME?: string; UI_FADE?: boolean; UI_FADE_TO?: number };

/** A refresh carries the studio accent, so saving it repaints the editor too. */
function applyRefresh(response: RefreshResponse | undefined) {
    if (!response?.ok || !response.SCRIPTS) return;

    applyScripts(response.SCRIPTS, response.CAN_EDIT);
    applyAppearance(response);
}

/** How far down the viewport a section header sits before the rail marks it active. */
const SPY_OFFSET_RATIO = 0.25;

/** Stable fallback — a fresh `?? {}` per snapshot would loop the zustand selector. */
const EMPTY_DRAFT: Record<string, never> = {};

//--------------------------------------------------
// MARK: Entry Row
//--------------------------------------------------

/**
 * Lists open in their own pane instead of rendering inline.
 *
 * The taxi job's roster is 215 rows and its pickup zones carry 143 positions.
 * Drawn in the page they cost more to lay out than everything else combined,
 * and they bury the settings around them. The row becomes a summary that opens
 * the full editor on click.
 */
function isDrillIn(entry: SettingEntry): boolean {
    return entry.type === 'list';
}

/** "215 entries" — what a drill-in row shows in place of the control. */
function entryCount(value: unknown): number {
    return Array.isArray(value) ? value.length : 0;
}

function EntryRow({
    resource,
    entry,
    disabled,
    query,
    flash,
    innerRef,
    onOpen,
}: {
    resource: string;
    entry: SettingEntry;
    disabled: boolean;
    query: string;
    flash: boolean;
    innerRef: (node: HTMLDivElement | null) => void;
    onOpen: (path: string) => void;
}) {
    const staged = useSettings((state) => state.draft[resource]?.[entry.path]);
    const error = useSettings((state) => state.errors[entry.path]);

    const value = staged ? (staged.kind === 'reset' ? entry.default : staged.value) : entry.value;
    const modified = !settingsEqual(value, entry.default);
    const drill = isDrillIn(entry);
    const wide = isWideType(entry.type);
    const scalarDefault = !wide && entry.type !== 'boolean';
    const hint = typeHint(entry);

    // Live preview: the editor paints itself in the studio accent, so dragging
    // the picker repaints it as you go. Keyed on the effective value, so undo
    // and discard walk it back without any extra wiring.
    const isStudioTheme = resource === GENERIC_RESOURCE && entry.path === THEME_PATH;

    useEffect(() => {
        if (isStudioTheme) applyTheme(String(value ?? ''));
    }, [isStudioTheme, value]);

    return (
        <div
            ref={innerRef}
            className={`rounded-[0.5vh] border p-[1.4vh] transition-colors duration-300 ${
                flash ? 'border-primary/70 bg-primary/5' : staged ? 'border-primary/35 bg-primary/[0.04]' : 'border-white/10 bg-white/[0.02] hover:border-white/25'
            }`}
        >
            <div className="flex items-start justify-between gap-[2vh]">
                <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-[0.8vh]">
                        <span className="text-[1.65vh] font-semibold text-white/95">{highlight(entry.label, query)}</span>

                        {modified && (
                            <span className="flex items-center gap-[0.5vh] rounded-[0.4vh] bg-primary/15 px-[0.8vh] py-[0.2vh] text-[1.1vh] font-bold uppercase tracking-wide text-primary">
                                <span className="h-[0.7vh] w-[0.7vh] rounded-full bg-primary" />
                                {t('settings_modified')}
                            </span>
                        )}
                        {entry.live === false && (
                            <span className="flex items-center gap-[0.5vh] rounded-[0.4vh] border border-white/15 px-[0.8vh] py-[0.2vh] text-[1.1vh] font-semibold uppercase tracking-wide text-white/50">
                                <i className="fas fa-rotate-right text-[1vh]" />
                                {t('settings_restart_required')}
                            </span>
                        )}
                        {entry.advanced && (
                            <span className="rounded-[0.4vh] border border-white/10 px-[0.8vh] py-[0.2vh] text-[1.1vh] font-semibold uppercase tracking-wide text-white/35">{t('settings_advanced')}</span>
                        )}

                        {/* What the field accepts, since the control no longer
                            implies it the way a slider did. */}
                        {hint && <span className="font-mono text-[1.1vh] tracking-wide text-white/30">{hint}</span>}
                    </div>

                    {entry.help && <p className="mt-[0.5vh] text-[1.35vh] leading-snug text-white/45">{highlight(entry.help, query)}</p>}

                    {modified && scalarDefault && (
                        <p className="mt-[0.5vh] font-mono text-[1.2vh] text-white/30">
                            {t('settings_default_prefix')} {previewValue(entry.default)}
                        </p>
                    )}

                    {error && (
                        <p className="mt-[0.5vh] flex items-center gap-[0.6vh] text-[1.3vh] font-semibold text-red-400">
                            <i className="fas fa-triangle-exclamation text-[1.2vh]" />
                            {error}
                        </p>
                    )}
                </div>

                <div className={`flex flex-shrink-0 items-center gap-[0.8vh] ${wide && !drill ? '' : 'w-[28vh]'}`}>
                    {!disabled && staged && (
                        <button
                            type="button"
                            title={t('settings_undo')}
                            onClick={() => unstage(resource, entry.path)}
                            className="flex h-[3.2vh] w-[3.2vh] flex-shrink-0 items-center justify-center rounded-[0.5vh] border border-primary/30 text-[1.3vh] text-primary/80 transition-colors hover:bg-primary/10"
                        >
                            <i className="fas fa-rotate-left" />
                        </button>
                    )}
                    {!disabled && !staged && modified && (
                        <button
                            type="button"
                            title={t('settings_reset_default')}
                            onClick={() => stageReset(resource, entry.path)}
                            className="flex h-[3.2vh] w-[3.2vh] flex-shrink-0 items-center justify-center rounded-[0.5vh] border border-white/10 text-[1.3vh] text-white/40 transition-colors hover:border-white/30 hover:text-white/80"
                        >
                            <i className="fas fa-clock-rotate-left" />
                        </button>
                    )}

                    {drill && (
                        <button
                            type="button"
                            onClick={() => onOpen(entry.path)}
                            className="flex h-[3.4vh] flex-1 items-center justify-between gap-[1.2vh] rounded-[0.5vh] border border-white/10 bg-white/[0.03] px-[1.2vh] transition-colors hover:border-primary/40 hover:bg-primary/[0.06]"
                        >
                            <span className="font-mono text-[1.35vh] text-white/60">{entryCount(value)} {entryCount(value) === 1 ? t('settings_entry_one') : t('settings_entry_many')}</span>
                            <span className="flex items-center gap-[0.8vh] text-[1.35vh] font-semibold text-primary">
                                {disabled ? t('settings_view') : t('settings_edit')}
                                <i className="fas fa-chevron-right text-[1.1vh]" />
                            </span>
                        </button>
                    )}

                    {!wide && !drill && <SettingControl def={entry} value={value} disabled={disabled} onChange={(next) => stageValue(resource, entry.path, next)} />}
                </div>
            </div>

            {wide && !drill && (
                <div className="mt-[1.2vh]">
                    <SettingControl def={entry} value={value} disabled={disabled} onChange={(next) => stageValue(resource, entry.path, next)} />
                </div>
            )}
        </div>
    );
}

//--------------------------------------------------
// MARK: Detail Pane
//--------------------------------------------------

/**
 * One list, on its own. Nothing else in the script renders while this is open,
 * which is the point: the roster is the single most expensive thing to lay out
 * and it should only cost anything when it is being looked at.
 */
function DetailPane({
    resource,
    entry,
    disabled,
    onBack,
}: {
    resource: string;
    entry: SettingEntry;
    disabled: boolean;
    onBack: () => void;
}) {
    const staged = useSettings((state) => state.draft[resource]?.[entry.path]);
    const error = useSettings((state) => state.errors[entry.path]);

    const value = staged ? (staged.kind === 'reset' ? entry.default : staged.value) : entry.value;
    const modified = !settingsEqual(value, entry.default);

    return (
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
            <div className="flex flex-shrink-0 items-start gap-[1.2vh] border-b border-white/10 px-[2vh] py-[1.4vh]">
                <button
                    type="button"
                    onClick={onBack}
                    title={t('settings_back')}
                    className="flex h-[3.4vh] w-[3.4vh] flex-shrink-0 items-center justify-center rounded-[0.5vh] border border-white/10 text-[1.4vh] text-white/50 transition-colors hover:border-primary/40 hover:text-primary"
                >
                    <i className="fas fa-chevron-left" />
                </button>

                <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-[0.8vh]">
                        <h2 className="text-[1.9vh] font-bold text-white/95">{entry.label}</h2>

                        {modified && (
                            <span className="flex items-center gap-[0.5vh] rounded-[0.4vh] bg-primary/15 px-[0.8vh] py-[0.2vh] text-[1.1vh] font-bold uppercase tracking-wide text-primary">
                                <span className="h-[0.7vh] w-[0.7vh] rounded-full bg-primary" />
                                {t('settings_modified')}
                            </span>
                        )}
                        {entry.live === false && (
                            <span className="flex items-center gap-[0.5vh] rounded-[0.4vh] border border-white/15 px-[0.8vh] py-[0.2vh] text-[1.1vh] font-semibold uppercase tracking-wide text-white/50">
                                <i className="fas fa-rotate-right text-[1vh]" />
                                {t('settings_restart_required')}
                            </span>
                        )}
                    </div>

                    {entry.help && <p className="mt-[0.4vh] text-[1.35vh] leading-snug text-white/45">{entry.help}</p>}

                    {error && (
                        <p className="mt-[0.5vh] flex items-center gap-[0.6vh] text-[1.3vh] font-semibold text-red-400">
                            <i className="fas fa-triangle-exclamation text-[1.2vh]" />
                            {error}
                        </p>
                    )}
                </div>

                {!disabled && staged && (
                    <button
                        type="button"
                        title={t('settings_undo')}
                        onClick={() => unstage(resource, entry.path)}
                        className="flex h-[3.4vh] flex-shrink-0 items-center gap-[0.7vh] rounded-[0.5vh] border border-primary/30 px-[1.2vh] text-[1.3vh] font-semibold text-primary/80 transition-colors hover:bg-primary/10"
                    >
                        <i className="fas fa-rotate-left" />
                        {t('settings_undo')}
                    </button>
                )}
                {!disabled && !staged && modified && (
                    <button
                        type="button"
                        title={t('settings_reset_default')}
                        onClick={() => stageReset(resource, entry.path)}
                        className="flex h-[3.4vh] flex-shrink-0 items-center gap-[0.7vh] rounded-[0.5vh] border border-white/10 px-[1.2vh] text-[1.3vh] font-semibold text-white/40 transition-colors hover:border-white/30 hover:text-white/80"
                    >
                        <i className="fas fa-clock-rotate-left" />
                        {t('settings_reset_default')}
                    </button>
                )}
            </div>

            <div className="min-h-0 min-w-0 flex-1 overflow-y-auto px-[2vh] py-[1.6vh]">
                <SettingControl def={entry} value={value} disabled={disabled} onChange={(next) => stageValue(resource, entry.path, next)} />
            </div>
        </div>
    );
}

//--------------------------------------------------
// MARK: Script Page
//--------------------------------------------------

export default function SETTINGS_SCRIPT({ script, scripts }: { script: SettingsScript; scripts: SettingsScript[] }) {
    const canEdit = useSettings((state) => state.canEdit);
    const activeResource = useSettings((state) => state.activeResource);
    const pickerOpen = usePicker((state) => state.open);
    const search = useSettings((state) => state.search);
    const draft = useSettings((state) => state.draft[script.resource]) ?? EMPTY_DRAFT;
    const saving = useSettings((state) => state.saving);
    const generalError = useSettings((state) => state.errors._);
    const focusPath = useSettings((state) => state.focusPath);

    const [activeGroup, setActiveGroup] = useState<string>(script.groups[0]?.id ?? '');
    const [detailPath, setDetailPath] = useState<string | null>(null);
    const [flashPath, setFlashPath] = useState<string | null>(null);
    const [justSaved, setJustSaved] = useState(false);
    const [refreshing, setRefreshing] = useState(false);

    const containerRef = useRef<HTMLDivElement | null>(null);
    const sectionRefs = useRef<Record<string, HTMLElement | null>>({});
    const entryRefs = useRef<Record<string, HTMLDivElement | null>>({});
    const spyLockUntil = useRef(0);

    const query = search.trim();
    const dirtyCount = Object.keys(draft).length;

    // Resolved from the live schema rather than held in state, so a refresh
    // after a save re-enters the pane with the new values instead of a stale copy.
    const detailEntry = detailPath ? script.entries.find((candidate) => candidate.path === detailPath) : undefined;

    // The Admins page borrows this shell: same header and rail, different pane.
    const adminsPage = activeResource === ADMINS_PAGE;
    const logsPage = activeResource === LOGS_PAGE;
    const isPage = adminsPage || logsPage;

    const jobScripts = scripts.filter((candidate) => !candidate.generic);
    const genericScripts = scripts.filter((candidate) => candidate.generic);

    // Switching scripts reuses this component instance — reset the per-script
    // view state a remount used to handle.
    //
    // The ref maps are deliberately NOT cleared here: refs are attached during
    // render, and this runs after it. Clearing would empty maps that nothing
    // refills until the next render, leaving the scroll spy with no sections to
    // measure. They clean themselves up in the ref callbacks instead.
    useEffect(() => {
        setActiveGroup(script.groups[0]?.id ?? '');
        setDetailPath(null);
        containerRef.current?.scrollTo({ top: 0 });
    }, [script.resource, script.groups]);

    // A search is a search of the settings list, so it steps back out of a list
    // that was open -- otherwise typing appears to do nothing.
    useEffect(() => {
        if (query) setDetailPath(null);
    }, [query]);

    const groupLabels = useMemo(() => new Map(script.groups.map((group) => [group.id, group.label])), [script.groups]);

    const visibleByGroup = useMemo(() => {
        const map = new Map<string, SettingEntry[]>();

        for (const entry of script.entries) {
            if (!matchesQuery(entry, groupLabels.get(entry.group) ?? entry.group, query)) continue;

            const list = map.get(entry.group) ?? [];
            list.push(entry);
            map.set(entry.group, list);
        }

        return map;
    }, [script.entries, groupLabels, query]);

    const visibleGroups = script.groups.filter((group) => (visibleByGroup.get(group.id)?.length ?? 0) > 0);

    const modifiedByGroup = useMemo(() => {
        const map = new Map<string, number>();

        for (const entry of script.entries) {
            const staged = draft[entry.path];
            const value = staged ? (staged.kind === 'reset' ? entry.default : staged.value) : entry.value;

            if (!settingsEqual(value, entry.default)) {
                map.set(entry.group, (map.get(entry.group) ?? 0) + 1);
            }
        }

        return map;
    }, [script.entries, draft]);

    // Deep link from the global search: land on the entry, flash it, forget it.
    useEffect(() => {
        if (!focusPath) return;

        const timer = setTimeout(() => {
            entryRefs.current[focusPath]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            setFlashPath(focusPath);
            useSettings.setState({ focusPath: null });
            setTimeout(() => setFlashPath(null), 1800);
        }, 120);

        return () => clearTimeout(timer);
    }, [focusPath]);

    const jumpToGroup = (groupId: string) => {
        setActiveGroup(groupId);
        spyLockUntil.current = Date.now() + 900;

        // With a list open the sections are not mounted, so closing it has to
        // land before the scroll — the target does not exist until it repaints.
        if (detailPath) {
            setDetailPath(null);
            requestAnimationFrame(() => sectionRefs.current[groupId]?.scrollIntoView({ block: 'start' }));
            return;
        }

        sectionRefs.current[groupId]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };

    const onScroll = () => {
        if (Date.now() < spyLockUntil.current) return;

        const container = containerRef.current;
        if (!container) return;

        const threshold = container.scrollTop + container.clientHeight * SPY_OFFSET_RATIO;
        let current = visibleGroups[0]?.id ?? '';

        for (const group of visibleGroups) {
            const section = sectionRefs.current[group.id];
            if (section && section.offsetTop <= threshold) current = group.id;
        }

        if (current && current !== activeGroup) setActiveGroup(current);
    };

    //--------------------------------------------------
    // MARK: Rail Items
    //--------------------------------------------------
    // A script row, with the active script's group navigation nested beneath it.

    const renderScriptItem = (candidate: SettingsScript) => {
        const isCurrent = !isPage && candidate.resource === script.resource;
        const hasOverrides = candidate.entries.some((entry) => !settingsEqual(entry.value, entry.default));

        return (
            <div key={candidate.resource}>
                <button
                    type="button"
                    onClick={() => !isCurrent && setActiveScript(candidate.resource)}
                    className={`relative flex w-full items-center gap-[1vh] rounded-[0.4vh] px-[1vh] py-[0.9vh] text-left transition-colors duration-200 ${
                        isCurrent ? 'bg-white/[0.05] text-white' : 'text-white/60 hover:bg-white/[0.03] hover:text-white/90'
                    }`}
                >
                    <span className={`absolute left-0 top-1/2 h-[60%] w-[0.35vh] -translate-y-1/2 rounded-full ${isCurrent ? 'bg-primary' : 'bg-transparent'}`} />
                    <i className={`fas ${candidate.icon ?? 'fa-gear'} w-[2vh] text-center text-[1.5vh] ${isCurrent ? 'text-primary' : 'text-white/35'}`} />
                    <span className="min-w-0 flex-1 truncate text-[1.5vh] font-semibold">{candidate.label}</span>
                    {hasOverrides && <span className="h-[0.7vh] w-[0.7vh] flex-shrink-0 rounded-full bg-primary" />}
                </button>

                {isCurrent && (
                    <div className="mb-[0.6vh] ml-[1.9vh] mt-[0.3vh] flex flex-col gap-[0.2vh] border-l border-white/10 pl-[0.7vh]">
                        {visibleGroups.map((group) => {
                            const isActive = group.id === activeGroup;
                            const modifiedCount = modifiedByGroup.get(group.id) ?? 0;

                            return (
                                <button
                                    key={group.id}
                                    type="button"
                                    onClick={() => jumpToGroup(group.id)}
                                    className={`group flex items-center gap-[0.9vh] rounded-[0.4vh] px-[0.9vh] py-[0.7vh] text-left transition-colors duration-200 ${
                                        isActive ? 'bg-white/[0.05] text-white' : 'text-white/50 hover:bg-white/[0.03] hover:text-white/80'
                                    }`}
                                >
                                    <i className={`fas ${group.icon ?? 'fa-folder'} w-[1.8vh] text-center text-[1.3vh] transition-colors ${isActive ? 'text-primary' : 'text-white/30 group-hover:text-primary/70'}`} />
                                    <span className="min-w-0 flex-1 truncate text-[1.4vh] font-medium">{group.label}</span>
                                    <span className="font-mono text-[1.1vh] text-white/30">{visibleByGroup.get(group.id)?.length ?? 0}</span>
                                    {modifiedCount > 0 && <span className="h-[0.6vh] w-[0.6vh] flex-shrink-0 rounded-full bg-primary" />}
                                </button>
                            );
                        })}

                        {visibleGroups.length === 0 && <div className="px-[0.9vh] py-[1vh] text-[1.3vh] text-white/35">{t('settings_no_results')}</div>}
                    </div>
                )}
            </div>
        );
    };

    // Admins and Logs are pages rather than scripts, so they render the same
    // rail row without a script's groups nested under them.
    const renderPageItem = (page: string, icon: string, label: string, isCurrent: boolean) => (
        <button
            type="button"
            onClick={() => !isCurrent && setActiveScript(page)}
            className={`relative flex w-full items-center gap-[1vh] rounded-[0.4vh] px-[1vh] py-[0.9vh] text-left transition-colors duration-200 ${
                isCurrent ? 'bg-white/[0.05] text-white' : 'text-white/60 hover:bg-white/[0.03] hover:text-white/90'
            }`}
        >
            <span className={`absolute left-0 top-1/2 h-[60%] w-[0.35vh] -translate-y-1/2 rounded-full ${isCurrent ? 'bg-primary' : 'bg-transparent'}`} />
            <i className={`fas ${icon} w-[2vh] text-center text-[1.5vh] ${isCurrent ? 'text-primary' : 'text-white/35'}`} />
            <span className="min-w-0 flex-1 truncate text-[1.5vh] font-semibold">{label}</span>
        </button>
    );

    const handleClose = () => {
        hideEditor();
        fetchNui('settings_close');
    };

    const handleRefresh = async () => {
        if (refreshing) return;
        setRefreshing(true);

        try {
            if (adminsPage) {
                await fetchAdmins();
                return;
            }

            if (isEnvBrowser()) {
                await new Promise((resolve) => setTimeout(resolve, 400));
                return;
            }

            applyRefresh(await fetchNui<RefreshResponse>('settings_refresh'));
        } finally {
            setRefreshing(false);
        }
    };

    //--------------------------------------------------
    // MARK: Save / Discard
    //--------------------------------------------------

    const save = async () => {
        if (saving || dirtyCount === 0) return;

        const staged = useSettings.getState().draft[script.resource] ?? {};
        const changes: Record<string, unknown> = {};
        const resets: string[] = [];

        for (const [path, edit] of Object.entries(staged)) {
            if (edit.kind === 'set') changes[path] = edit.value;
            else resets.push(path);
        }

        useSettings.setState({ saving: true, errors: {} });

        try {
            if (isEnvBrowser()) {
                // Dev harness: pretend the server accepted everything.
                await new Promise((resolve) => setTimeout(resolve, 350));
                applyDraftLocally(script.resource);
            } else {
                // One round-trip: sets and resets land as a single batch. The
                // revision this page was rendered from rides along, so a save over
                // settings another admin changed in the meantime is rejected
                // instead of silently overwriting them (refresh, then retry).
                const response = await fetchNui<SaveResponse>('settings_save', { resource: script.resource, changes, resets, revision: script.revision });

                if (!response?.ok) {
                    useSettings.setState({ errors: response?.errors ?? { _: t('settings_error_generic') } });
                    return;
                }

                // Pull everything fresh so the page shows the values the server
                // actually stored (coercion included), then drop the draft.
                applyRefresh(await fetchNui<RefreshResponse>('settings_refresh'));

                discardDraft(script.resource);
            }

            setJustSaved(true);
            setTimeout(() => setJustSaved(false), 1600);
        } finally {
            useSettings.setState({ saving: false });
        }
    };

    //--------------------------------------------------
    // MARK: Layout
    //--------------------------------------------------

    return (
        <div className="relative flex h-full w-full flex-col overflow-hidden">
            {/* One quiet header: script name, a centered search, refresh, close. */}
            <div className="relative flex min-h-[5.8vh] items-center gap-[1.2vh] border-b border-white/10 px-[1.6vh]">
                <span className="truncate text-[1.9vh] font-bold text-white/95">{adminsPage ? t('admins_title') : logsPage ? t('logs_title') : script.label}</span>

                {/* Absolutely positioned so it centers on the window, not on the
                    space left over after the title and buttons. */}
                <div className="absolute left-1/2 top-1/2 w-[34vh] -translate-x-1/2 -translate-y-1/2">
                    <i className="fas fa-magnifying-glass pointer-events-none absolute left-[1.2vh] top-1/2 -translate-y-1/2 text-[1.4vh] text-white/35" />
                    <input
                        type="text"
                        value={search}
                        onChange={(event) => useSettings.setState({ search: event.target.value })}
                        placeholder={isPage ? t('admins_search') : t('settings_search_script')}
                        className="h-[3.6vh] w-full rounded-[0.4vh] border border-white/10 bg-white/[0.03] pl-[3.6vh] pr-[3vh] text-[1.5vh] text-white/90 transition-colors placeholder:text-white/30 focus:border-primary/50"
                    />
                    {query && (
                        <button type="button" onClick={() => useSettings.setState({ search: '' })} className="absolute right-[1vh] top-1/2 -translate-y-1/2 text-[1.4vh] text-white/40 hover:text-white/80">
                            <i className="fas fa-xmark" />
                        </button>
                    )}
                </div>

                <div className="ml-auto flex flex-shrink-0 items-center gap-[1.2vh]">
                    {!canEdit && <i className="fas fa-eye flex-shrink-0 text-[1.4vh] text-white/40" title={t('settings_view_only')} />}

                    <button
                        type="button"
                        title={t('settings_refresh')}
                        onClick={handleRefresh}
                        className="flex h-[3.4vh] w-[3.4vh] flex-shrink-0 items-center justify-center rounded-[0.4vh] border border-white/10 text-[1.3vh] text-white/50 transition-colors hover:border-primary/40 hover:text-primary"
                    >
                        <i className={`fas fa-arrows-rotate ${refreshing ? 'animate-spin' : ''}`} />
                    </button>

                    <span className="h-[2.4vh] w-px flex-shrink-0 bg-white/10" />

                    <button
                        type="button"
                        onClick={handleClose}
                        title={t('util_close_btn')}
                        className="flex h-[3.4vh] w-[3.4vh] flex-shrink-0 items-center justify-center rounded-[0.4vh] border border-white/10 text-[1.4vh] text-white/60 transition-colors hover:border-primary/50 hover:text-primary"
                    >
                        <i className="fas fa-xmark" />
                    </button>
                </div>
            </div>

            <div className="flex min-h-0 flex-1">
                {/* Script Studio rail: every script, the active one's groups nested. */}
                <div className="flex w-[27vh] flex-shrink-0 flex-col border-r border-white/10 bg-white/[0.015]">
                    <div className="flex items-center gap-[1vh] border-b border-white/10 px-[1.4vh] py-[1.2vh]">
                        <div className="flex h-[2.8vh] w-[2.8vh] flex-shrink-0 items-center justify-center rounded-[0.4vh] border border-primary/40 bg-primary/10">
                            <i className="fas fa-cubes text-[1.2vh] text-primary" />
                        </div>
                        <span className="truncate text-[1.6vh] font-bold text-white/95">{t('settings_studio')}</span>
                    </div>

                    <div className="flex flex-1 flex-col overflow-y-auto p-[1.2vh]">
                        <span className="px-[0.6vh] pb-[0.5vh] font-mono text-[1.05vh] uppercase tracking-[0.25em] text-white/25">{t('settings_scripts')}</span>

                        {jobScripts.map((candidate) => renderScriptItem(candidate))}

                        {genericScripts.length > 0 && (
                            <>
                                <span className="mt-[1.6vh] px-[0.6vh] pb-[0.5vh] font-mono text-[1.05vh] uppercase tracking-[0.25em] text-white/25">{t('settings_generic')}</span>
                                {genericScripts.map((candidate) => renderScriptItem(candidate))}
                            </>
                        )}

                        {/* Managing who gets in, and the record of what they did,
                            belong beside the settings themselves rather than
                            behind a console command. */}
                        {canEdit && (
                            <>
                                <span className="mt-[1.6vh] px-[0.6vh] pb-[0.5vh] font-mono text-[1.05vh] uppercase tracking-[0.25em] text-white/25">{t('settings_access')}</span>
                                {renderPageItem(ADMINS_PAGE, 'fa-user-shield', t('admins_title'), adminsPage)}
                                {renderPageItem(LOGS_PAGE, 'fa-clock-rotate-left', t('logs_title'), logsPage)}
                            </>
                        )}
                    </div>

                    {/* Which script build these settings belong to. The config
                        revision used to sit here too, but a save counter told an
                        admin nothing they could act on -- the Logs page answers
                        the question they actually had. The revision itself is
                        still sent and still guards concurrent saves. */}
                    {!isPage && (
                        <div className="truncate border-t border-white/10 px-[1.4vh] py-[1vh] font-mono text-[1.05vh] text-white/30">
                            {script.resource}
                            {script.version ? ` · v${script.version}` : ''}
                        </div>
                    )}
                </div>

                {adminsPage && <SETTINGS_ADMINS canEdit={canEdit} query={query} />}
                {logsPage && <SETTINGS_LOGS query={query} />}

                {/* One list, opened from its summary row. Rendered instead of
                    the sections, not over them, so nothing else is laid out
                    while a 215-row roster is on screen. */}
                {!isPage && detailEntry && (
                    <DetailPane
                        resource={script.resource}
                        entry={detailEntry}
                        disabled={!canEdit || saving}
                        onBack={() => setDetailPath(null)}
                    />
                )}

                {/* Sections */}
                {!isPage && !detailEntry && (
                <div ref={containerRef} onScroll={onScroll} className="relative min-h-0 min-w-0 flex-1 overflow-y-auto scroll-smooth px-[2vh] py-[1.6vh]">
                    {visibleGroups.map((group) => (
                        <section
                            key={group.id}
                            ref={(node) => {
                                if (node) sectionRefs.current[group.id] = node;
                                else delete sectionRefs.current[group.id];
                            }}
                            className="gg-defer mb-[2.4vh]"
                        >
                            <div className="mb-[1vh] flex items-baseline gap-[1vh] border-b border-white/5 pb-[0.8vh]">
                                <i className={`fas ${group.icon ?? 'fa-folder'} text-[1.6vh] text-primary/80`} />
                                <h2 className="text-[1.9vh] font-bold text-white/90">{group.label}</h2>
                                {group.help && <span className="min-w-0 flex-1 truncate text-[1.3vh] text-white/35">{group.help}</span>}
                            </div>

                            <div className="flex flex-col gap-[0.9vh]">
                                {(visibleByGroup.get(group.id) ?? []).map((entry) => (
                                    <EntryRow
                                        key={entry.path}
                                        resource={script.resource}
                                        entry={entry}
                                        disabled={!canEdit || saving}
                                        query={query}
                                        flash={flashPath === entry.path}
                                        innerRef={(node) => {
                                            if (node) entryRefs.current[entry.path] = node;
                                            else delete entryRefs.current[entry.path];
                                        }}
                                        onOpen={setDetailPath}
                                    />
                                ))}
                            </div>
                        </section>
                    ))}

                    {visibleGroups.length === 0 && (
                        <div className="flex flex-col items-center gap-[1vh] py-[10vh] text-white/35">
                            <i className="fas fa-magnifying-glass-minus text-[4vh]" />
                            <span className="text-[1.7vh]">{t('settings_no_results')}</span>
                        </div>
                    )}

                    {/* Past every setting, so it is reached on purpose. Hidden
                        while searching: a filtered page is not the place to be
                        offered a wipe of everything, including what is filtered
                        out of view. */}
                    {!query && <SETTINGS_RESET script={script} disabled={!canEdit} onDone={handleRefresh} />}
                </div>
                )}

                {/* A sibling of the content, not a layer over it: opening the
                    picker narrows the settings list rather than hiding part of
                    it, so the field being edited stays visible beside it.

                    Presence is decided here rather than inside the component.
                    A child that returns null when closed is simply gone as far
                    as AnimatePresence is concerned, so it would open with an
                    animation and vanish without one. */}
                <AnimatePresence>{pickerOpen && <SETTINGS_PICKER key="settings_picker" />}</AnimatePresence>
            </div>

            {/* Saved confirmation */}
            <AnimatePresence>
                {justSaved && dirtyCount === 0 && (
                    <motion.div
                        initial={{ opacity: 0, y: 14 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 14 }}
                        className="pointer-events-none absolute bottom-[2vh] left-1/2 z-50 flex -translate-x-1/2 items-center gap-[0.8vh] rounded-[0.5vh] border border-white/15 bg-neutral-900 px-[1.8vh] py-[0.9vh] text-[1.4vh] font-semibold text-primary shadow-xl"
                    >
                        <i className="fas fa-check" />
                        {t('settings_saved')}
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Dirty bar */}
            <AnimatePresence>
                {dirtyCount > 0 && canEdit && !isPage && (
                    <motion.div
                        initial={{ y: '100%' }}
                        animate={{ y: 0 }}
                        exit={{ y: '100%' }}
                        transition={{ duration: 0.22, ease: 'easeOut' }}
                        className="flex min-h-[6vh] flex-shrink-0 items-center justify-between border-t border-white/10 bg-white/[0.02] px-[2vh]"
                    >
                        <div className="flex items-center gap-[1.2vh]">
                            <span className="h-[0.8vh] w-[0.8vh] rounded-full bg-primary" />
                            <span className="text-[1.6vh] font-semibold text-white/90">
                                {dirtyCount} <span className="text-white/50">{t('settings_unsaved')}</span>
                            </span>
                            {generalError && (
                                <span className="flex items-center gap-[0.6vh] text-[1.4vh] font-semibold text-red-400">
                                    <i className="fas fa-triangle-exclamation" />
                                    {generalError}
                                </span>
                            )}
                        </div>

                        <div className="flex items-center gap-[1vh]">
                            <button
                                type="button"
                                disabled={saving}
                                onClick={() => discardDraft(script.resource)}
                                className="flex h-[3.6vh] items-center rounded-[0.4vh] border border-white/15 px-[1.6vh] text-[1.45vh] font-semibold text-white/60 transition-colors hover:border-white/30 hover:text-white/90 disabled:opacity-40"
                            >
                                {t('settings_discard')}
                            </button>
                            <button
                                type="button"
                                disabled={saving}
                                onClick={save}
                                className="flex h-[3.6vh] items-center gap-[0.9vh] rounded-[0.4vh] bg-primary px-[2vh] text-[1.45vh] font-bold text-neutral-900 transition-colors hover:bg-primary/90 disabled:opacity-60"
                            >
                                {saving ? <i className="fas fa-spinner animate-spin" /> : <i className="fas fa-floppy-disk" />}
                                {saving ? t('settings_saving') : t('settings_save')}
                            </button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
