import { useState } from 'react';
import { t } from '@/data/useLang';
import { fetchNui, isEnvBrowser } from '@/lib/fetchNui';
import { MINIGAMES, startMinigame, useMinigames } from '@/data/useMinigames';
import {
    GENERIC_RESOURCE,
    applyDraftLocally,
    discardDraft,
    effectiveValue,
    settingsEqual,
    stageReset,
    stageValue,
    unstage,
    useSettings,
    type SettingEntry,
} from '@/data/useSettings';
import SettingControl from './SETTING_CONTROL';
import { applyRefresh, type RefreshResponse, type SaveResponse } from './SETTINGS_SCRIPT';
import { Tip, highlight } from './settings-utils';
import { copyText } from '@/lib/clipboard';

/**
 * The minigame catalogue with every game's defaults edited right here — no
 * hopping to Generic Settings. The values are still the same stored generic
 * entries, staged through the same draft and saved through the same host, so
 * validation, logging and factory reset all keep working.
 */

/**
 * The ready-to-paste call for one game, with the card's current values baked
 * in as overrides — tune the sliders, copy, and any script plays exactly what
 * the card shows, stored defaults or not.
 */
export function exportSnippet(game: (typeof MINIGAMES)[number], entry: SettingEntry | undefined, value: unknown): string {
    const name = `gg${game.name.charAt(0).toUpperCase()}${game.name.slice(1)}`;

    const record = value !== null && typeof value === 'object' ? (value as Record<string, unknown>) : {};

    const parts = (entry?.fields ?? [])
        .map((field) => {
            const raw = record[field.key];
            if (raw === undefined || raw === null) return null;

            return `${field.key} = ${typeof raw === 'string' ? `"${raw}"` : String(raw)}`;
        })
        .filter(Boolean);

    return parts.length ? `exports.gg_lib:${name}({ ${parts.join(', ')} })` : `exports.gg_lib:${name}()`;
}

function GameCard({
    game,
    entry,
    canEdit,
    running,
    query,
    onTry,
}: {
    game: (typeof MINIGAMES)[number];
    entry: SettingEntry | undefined;
    canEdit: boolean;
    running: boolean;
    query: string;
    onTry: () => void;
}) {
    const staged = useSettings((state) => state.draft[GENERIC_RESOURCE]?.[game.setting]);
    const error = useSettings((state) => state.errors[game.setting]);
    const saving = useSettings((state) => state.saving);

    const [copied, setCopied] = useState(false);

    const value = entry ? (staged ? (staged.kind === 'reset' ? entry.default : staged.value) : entry.value) : undefined;
    const modified = entry ? !settingsEqual(value, entry.default) : false;

    const copy = () => {
        const done = copyText(exportSnippet(game, entry, value));

        setCopied(done);
        if (done) setTimeout(() => setCopied(false), 1500);
    };

    return (
        <div
            className={`flex flex-col gap-[1.2vh] rounded-[0.6vh] border p-[1.4vh] transition-colors ${
                staged ? 'border-primary/35 bg-primary/[0.04]' : 'border-white/10 bg-white/[0.02]'
            }`}
        >
            <div className="flex items-center gap-[1vh]">
                <span className="flex h-[4vh] w-[4vh] flex-shrink-0 items-center justify-center rounded-[0.6vh] border border-primary/25 bg-primary/10">
                    <i className={`fas ${game.icon} text-[1.7vh] text-primary`} />
                </span>

                <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-[0.8vh]">
                        <h3 className="text-[1.65vh] font-semibold text-white/95">{highlight(game.label, query)}</h3>

                        {modified && (
                            <span className="flex items-center gap-[0.5vh] rounded-[0.4vh] bg-primary/15 px-[0.7vh] py-[0.15vh] text-[1vh] font-bold uppercase tracking-wide text-primary">
                                <span className="h-[0.6vh] w-[0.6vh] rounded-full bg-primary" />
                                {t('settings_modified')}
                            </span>
                        )}
                    </div>
                    <span className="font-mono text-[1.1vh] text-white/30">{game.name}</span>
                </div>

                {canEdit && staged && (
                    <Tip label={t('settings_undo')}>
                    <button
                        type="button"
                        onClick={() => unstage(GENERIC_RESOURCE, game.setting)}
                        className="flex h-[3.2vh] w-[3.2vh] flex-shrink-0 items-center justify-center rounded-[0.5vh] border border-primary/30 text-[1.3vh] text-primary/80 transition-colors hover:bg-primary/10"
                    >
                        <i className="fas fa-rotate-left" />
                    </button>
                    </Tip>
                )}
                {canEdit && !staged && modified && (
                    <Tip label={t('settings_reset_default')}>
                    <button
                        type="button"
                        onClick={() => stageReset(GENERIC_RESOURCE, game.setting)}
                        className="flex h-[3.2vh] w-[3.2vh] flex-shrink-0 items-center justify-center rounded-[0.5vh] border border-white/10 text-[1.3vh] text-white/40 transition-colors hover:border-white/30 hover:text-white/80"
                    >
                        <i className="fas fa-clock-rotate-left" />
                    </button>
                    </Tip>
                )}

                <Tip label={t('minigames_copy')}>
                <button
                    type="button"
                    onClick={copy}
                    className={`flex h-[3.2vh] w-[3.2vh] flex-shrink-0 items-center justify-center rounded-[0.5vh] border text-[1.3vh] transition-colors ${
                        copied ? 'border-primary/50 bg-primary/15 text-primary' : 'border-white/10 text-white/40 hover:border-primary/40 hover:text-primary'
                    }`}
                >
                    <i className={`fas ${copied ? 'fa-check' : 'fa-code'}`} />
                </button>
                </Tip>

                <Tip label={t('minigames_try_tip')}>
                <button
                    type="button"
                    disabled={running}
                    onClick={onTry}
                    className={`flex h-[3.2vh] flex-shrink-0 items-center gap-[0.7vh] rounded-[0.5vh] border px-[1.2vh] text-[1.3vh] font-semibold transition-colors ${
                        running ? 'cursor-not-allowed border-white/5 text-white/20' : 'border-primary/40 bg-primary/10 text-primary hover:bg-primary/20'
                    }`}
                >
                    <i className="fas fa-play text-[1.1vh]" />
                    {t('minigames_try')}
                </button>
                </Tip>
            </div>

            <p className="text-[1.3vh] leading-snug text-white/45">{highlight(game.description, query)}</p>

            {entry ? (
                <SettingControl
                    def={entry}
                    value={value}
                    disabled={!canEdit || saving}
                    onChange={(next) => stageValue(GENERIC_RESOURCE, game.setting, next)}
                />
            ) : (
                <span className="text-[1.25vh] text-white/30">{t('minigames_no_entry')}</span>
            )}

            {error && (
                <p className="flex items-center gap-[0.6vh] text-[1.3vh] font-semibold text-red-400">
                    <i className="fas fa-triangle-exclamation text-[1.2vh]" />
                    {error}
                </p>
            )}
        </div>
    );
}

export default function SETTINGS_MINIGAMES({ query }: { query: string }) {
    const running = useMinigames((state) => state.active);
    const canEdit = useSettings((state) => state.canEdit);
    const generic = useSettings((state) => state.scripts.find((script) => script.resource === GENERIC_RESOURCE));
    const draft = useSettings((state) => state.draft[GENERIC_RESOURCE]);
    const saving = useSettings((state) => state.saving);
    const generalError = useSettings((state) => state.errors._);

    const [justSaved, setJustSaved] = useState(false);

    const dirty = Object.keys(draft ?? {}).length;

    const needle = query.trim().toLowerCase();

    const visible = MINIGAMES.filter(
        (game) => !needle || game.label.toLowerCase().includes(needle) || game.description.toLowerCase().includes(needle),
    );

    const entryOf = (path: string) => generic?.entries.find((entry) => entry.path === path);

    const tryGame = (game: (typeof MINIGAMES)[number]) => {
        if (running) return;

        if (isEnvBrowser()) {
            const entry = entryOf(game.setting);
            const stored = entry ? (effectiveValue(GENERIC_RESOURCE, entry) as Record<string, unknown>) : {};

            startMinigame(game.name, { ...game.preview, ...stored });
            return;
        }

        void fetchNui('minigame_try', { name: game.name });
    };

    // The editor's own dirty bar saves the script it has open, which on this
    // page is not the one being edited — so the page carries its own, pinned
    // to the studio-wide resource the minigame defaults live in.
    const save = async () => {
        if (saving || dirty === 0) return;

        const staged = useSettings.getState().draft[GENERIC_RESOURCE] ?? {};
        const changes: Record<string, unknown> = {};
        const resets: string[] = [];

        for (const [path, edit] of Object.entries(staged)) {
            if (edit.kind === 'set') changes[path] = edit.value;
            else resets.push(path);
        }

        useSettings.setState({ saving: true, errors: {} });

        try {
            if (isEnvBrowser()) {
                await new Promise((resolve) => setTimeout(resolve, 350));
                applyDraftLocally(GENERIC_RESOURCE);
            } else {
                const response = await fetchNui<SaveResponse>('settings_save', {
                    resource: GENERIC_RESOURCE,
                    changes,
                    resets,
                    revision: generic?.revision,
                });

                if (!response?.ok) {
                    useSettings.setState({ errors: response?.errors ?? { _: t('settings_error_generic') } });
                    return;
                }

                applyRefresh(await fetchNui<RefreshResponse>('settings_refresh'));

                discardDraft(GENERIC_RESOURCE);
            }

            setJustSaved(true);
            setTimeout(() => setJustSaved(false), 1600);
        } finally {
            useSettings.setState({ saving: false });
        }
    };

    return (
        <div className="relative flex min-h-0 min-w-0 flex-1 flex-col">
            <div className="min-h-0 min-w-0 flex-1 overflow-y-auto px-[2vh] py-[1.6vh]">
                <div className="mb-[1.4vh] flex items-baseline gap-[1vh] border-b border-white/5 pb-[0.8vh]">
                    <i className="fas fa-gamepad text-[1.6vh] text-primary/80" />
                    <h2 className="text-[1.9vh] font-bold text-white/90">{t('minigames_title')}</h2>
                    <span className="min-w-0 flex-1 truncate text-[1.3vh] text-white/35">{t('minigames_help')}</span>
                </div>

                {generalError && (
                    <p className="mb-[1vh] flex items-center gap-[0.6vh] text-[1.35vh] font-semibold text-red-400">
                        <i className="fas fa-triangle-exclamation text-[1.2vh]" />
                        {generalError}
                    </p>
                )}

                {visible.length === 0 && (
                    <div className="flex flex-col items-center gap-[1vh] py-[10vh] text-white/35">
                        <i className="fas fa-magnifying-glass-minus text-[4vh]" />
                        <span className="text-[1.7vh]">{t('settings_no_results')}</span>
                    </div>
                )}

                {(['skillcheck', 'minigame'] as const).map((category) => {
                    const games = visible.filter((game) => game.category === category);
                    if (!games.length) return null;

                    return (
                        <div key={category} className="mb-[2vh]">
                            <div className="mb-[1vh] flex items-baseline gap-[1vh]">
                                <i className={`fas ${category === 'skillcheck' ? 'fa-bolt' : 'fa-chess-board'} text-[1.4vh] text-primary/70`} />
                                <h3 className="text-[1.6vh] font-bold uppercase tracking-wider text-white/70">
                                    {category === 'skillcheck' ? t('minigames_skillchecks') : t('minigames_boardgames')}
                                </h3>
                                <span className="min-w-0 flex-1 truncate text-[1.2vh] text-white/30">
                                    {category === 'skillcheck' ? t('minigames_skillchecks_help') : t('minigames_boardgames_help')}
                                </span>
                            </div>

                            <div className="grid gap-[1.2vh]" style={{ gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
                                {games.map((game) => (
                                    <GameCard
                                        key={game.name}
                                        game={game}
                                        entry={entryOf(game.setting)}
                                        canEdit={canEdit}
                                        running={running !== null}
                                        query={query}
                                        onTry={() => tryGame(game)}
                                    />
                                ))}
                            </div>
                        </div>
                    );
                })}
            </div>

            {justSaved && dirty === 0 && (
                <div className="pointer-events-none absolute bottom-[2vh] left-1/2 flex -translate-x-1/2 items-center gap-[0.8vh] rounded-[0.6vh] border border-primary/40 bg-neutral-900 px-[1.6vh] py-[0.9vh] text-[1.4vh] font-semibold text-primary shadow-2xl">
                    <i className="fas fa-check" />
                    {t('settings_saved')}
                </div>
            )}

            {dirty > 0 && canEdit && (
                <div className="flex items-center gap-[1.2vh] border-t border-white/10 bg-neutral-950/95 px-[2vh] py-[1.2vh]">
                    <span className="text-[1.4vh] font-semibold text-primary">
                        {dirty} <span className="text-white/50">{t('settings_unsaved')}</span>
                    </span>

                    <span className="min-w-0 flex-1" />

                    <button
                        type="button"
                        disabled={saving}
                        onClick={() => discardDraft(GENERIC_RESOURCE)}
                        className="flex h-[3.4vh] items-center rounded-[0.5vh] border border-white/15 px-[1.4vh] text-[1.35vh] font-semibold text-white/50 transition-colors hover:border-white/30 hover:text-white/80"
                    >
                        {t('settings_discard')}
                    </button>

                    <button
                        type="button"
                        disabled={saving}
                        onClick={() => void save()}
                        className="flex h-[3.4vh] items-center gap-[0.8vh] rounded-[0.5vh] border border-primary/50 bg-primary/15 px-[1.6vh] text-[1.35vh] font-bold text-primary transition-colors hover:bg-primary/25 disabled:opacity-50"
                    >
                        <i className={`fas ${saving ? 'fa-spinner fa-spin' : 'fa-floppy-disk'} text-[1.2vh]`} />
                        {saving ? t('settings_saving') : t('settings_save')}
                    </button>
                </div>
            )}
        </div>
    );
}
