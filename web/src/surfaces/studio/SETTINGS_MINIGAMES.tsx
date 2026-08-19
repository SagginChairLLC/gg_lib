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
import SettingControl, { RowActions, type RowAction } from './SETTING_CONTROL';
import { applyRefresh, type RefreshResponse, type SaveResponse } from './SETTINGS_SCRIPT';
import { highlight } from './settings-utils';
import { copyText } from '@/lib/clipboard';

/**
 * One game per row, with the selected one open in the panel beside it, so
 * tuning a game never costs a trip away from the list. The values are the same
 * stored generic entries, staged through the same draft and saved through the
 * same host, so validation, logging and factory reset all keep working.
 */

type Game = (typeof MINIGAMES)[number];

/**
 * The ready-to-paste call for one game, with the current values baked in as
 * overrides — tune the defaults, copy, and any script plays exactly what the
 * page shows, stored defaults or not.
 */
export function exportSnippet(game: Game, entry: SettingEntry | undefined, value: unknown): string {
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

function useGameState(game: Game, entry: SettingEntry | undefined) {
    const staged = useSettings((state) => state.draft[GENERIC_RESOURCE]?.[game.setting]);

    const value = entry ? (staged ? (staged.kind === 'reset' ? entry.default : staged.value) : entry.value) : undefined;
    const modified = entry ? !settingsEqual(value, entry.default) : false;

    return { staged, value, modified };
}

function gameActions({
    game,
    entry,
    value,
    staged,
    modified,
    canEdit,
    running,
    onTry,
    onCopied,
    onOpen,
}: {
    game: Game;
    entry: SettingEntry | undefined;
    value: unknown;
    staged: unknown;
    modified: boolean;
    canEdit: boolean;
    running: boolean;
    onTry: () => void;
    onCopied: () => void;
    onOpen?: () => void;
}): RowAction[] {
    const actions: RowAction[] = [
        { id: 'try', label: t('minigames_try'), icon: 'fa-play', disabled: running, run: onTry },
        {
            id: 'copy',
            label: t('minigames_copy'),
            icon: 'fa-code',
            run: () => {
                if (copyText(exportSnippet(game, entry, value))) onCopied();
            },
        },
    ];

    if (onOpen) actions.push({ id: 'settings', label: t('minigames_settings'), icon: 'fa-sliders', run: onOpen });

    if (canEdit && staged) {
        actions.push({
            id: 'undo',
            label: t('settings_undo'),
            icon: 'fa-rotate-left',
            danger: true,
            run: () => unstage(GENERIC_RESOURCE, game.setting),
        });
    } else if (canEdit && modified) {
        actions.push({
            id: 'reset',
            label: t('settings_reset_default'),
            icon: 'fa-clock-rotate-left',
            danger: true,
            run: () => stageReset(GENERIC_RESOURCE, game.setting),
        });
    }

    return actions;
}

function CopiedChip() {
    return (
        <span className="flex items-center gap-[0.5vh] rounded-[0.4vh] bg-primary/15 px-[0.7vh] py-[0.3vh] text-[1.1vh] font-bold uppercase tracking-wide text-primary">
            <i className="fas fa-check text-[1vh]" />
            {t('minigames_copied')}
        </span>
    );
}

function GameRow({
    game,
    entry,
    selected,
    query,
    onSelect,
}: {
    game: Game;
    entry: SettingEntry | undefined;
    selected: boolean;
    query: string;
    onSelect: () => void;
}) {
    const { staged, modified } = useGameState(game, entry);

    return (
        <button
            type="button"
            onClick={onSelect}
            className={`flex w-full items-center gap-[1vh] border-b border-white/5 px-[1.1vh] py-[0.8vh] text-left transition-colors ${
                selected ? 'bg-primary/[0.09]' : 'hover:bg-white/[0.04]'
            }`}
        >
            <span
                className={`flex h-[3.2vh] w-[3.2vh] flex-shrink-0 items-center justify-center rounded-[0.5vh] ${
                    selected ? 'bg-primary/15 text-primary' : 'bg-white/[0.06] text-white/40'
                }`}
            >
                <i className={`fas ${game.icon} text-[1.4vh]`} />
            </span>

            <span className="flex min-w-0 flex-1 flex-col">
                <span className={`truncate text-[1.4vh] font-semibold ${selected ? 'text-primary' : 'text-white/90'}`}>
                    {highlight(game.label, query)}
                </span>
                <span className="truncate text-[1.1vh] text-white/30">{highlight(game.description, query)}</span>
            </span>

            <span className="flex-shrink-0 rounded-[0.35vh] border border-white/10 px-[0.6vh] text-[1vh] font-semibold uppercase tracking-widest text-white/25">
                {game.category === 'skillcheck' ? t('minigames_kind_check') : t('minigames_kind_game')}
            </span>

            {(staged || modified) && <span className="h-[0.7vh] w-[0.7vh] flex-shrink-0 rounded-full bg-primary" />}
        </button>
    );
}

function GameDetail({
    game,
    entry,
    canEdit,
    running,
    onTry,
}: {
    game: Game;
    entry: SettingEntry | undefined;
    canEdit: boolean;
    running: boolean;
    onTry: () => void;
}) {
    const { staged, value, modified } = useGameState(game, entry);
    const error = useSettings((state) => state.errors[game.setting]);
    const saving = useSettings((state) => state.saving);

    const [copied, setCopied] = useState(false);

    const copiedNow = () => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
    };

    const snippet = exportSnippet(game, entry, value);

    return (
        <div className="flex min-h-0 w-[36vh] flex-shrink-0 flex-col rounded-[0.6vh] border border-white/10 bg-white/[0.02]">
            <div className="flex flex-shrink-0 items-center gap-[0.9vh] border-b border-white/10 px-[1.1vh] py-[0.9vh]">
                <i className={`fas ${game.icon} flex-shrink-0 text-[1.5vh] text-primary`} />

                <div className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-[1.55vh] font-bold text-white/95">{game.label}</span>
                    <span className="truncate font-mono text-[1.05vh] text-white/30">{game.name}</span>
                </div>

                {copied && <CopiedChip />}

                {modified && !copied && (
                    <span className="flex-shrink-0 rounded-[0.35vh] bg-primary/15 px-[0.6vh] py-[0.1vh] text-[1vh] font-bold uppercase tracking-widest text-primary">
                        {t('settings_modified')}
                    </span>
                )}

                <RowActions
                    actions={gameActions({
                        game,
                        entry,
                        value,
                        staged,
                        modified,
                        canEdit,
                        running,
                        onTry,
                        onCopied: copiedNow,
                    })}
                />
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-[1.1vh] py-[1vh]">
                <p className="mb-[1.1vh] text-[1.25vh] leading-snug text-white/45">{game.description}</p>

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
                    <p className="mt-[0.8vh] flex items-center gap-[0.6vh] text-[1.3vh] font-semibold text-red-400">
                        <i className="fas fa-triangle-exclamation text-[1.2vh]" />
                        {error}
                    </p>
                )}
            </div>

            <div className="flex flex-shrink-0 gap-[0.6vh] border-t border-white/10 p-[0.9vh]">
                <button
                    type="button"
                    disabled={running}
                    onClick={onTry}
                    className={`flex h-[3vh] flex-1 items-center justify-center gap-[0.7vh] rounded-[0.4vh] border text-[1.25vh] font-bold transition-colors ${
                        running
                            ? 'cursor-not-allowed border-white/5 text-white/20'
                            : 'border-primary/45 bg-primary/[0.12] text-primary hover:bg-primary/25'
                    }`}
                >
                    <i className="fas fa-play text-[1.05vh]" />
                    {t('minigames_try')}
                </button>

                <button
                    type="button"
                    title={snippet}
                    onClick={() => {
                        if (copyText(snippet)) copiedNow();
                    }}
                    className="flex h-[3vh] flex-shrink-0 items-center gap-[0.6vh] rounded-[0.4vh] border border-white/10 px-[1.1vh] text-[1.2vh] font-semibold text-white/45 transition-colors hover:border-primary/40 hover:text-primary"
                >
                    <i className="fas fa-code text-[1.05vh]" />
                    {t('minigames_copy')}
                </button>
            </div>
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
    const [openGame, setOpenGame] = useState<string | null>(null);

    const dirty = Object.keys(draft ?? {}).length;

    const needle = query.trim().toLowerCase();

    const visible = MINIGAMES.filter(
        (game) => !needle || game.label.toLowerCase().includes(needle) || game.description.toLowerCase().includes(needle),
    );

    const entryOf = (path: string) => generic?.entries.find((entry) => entry.path === path);

    const opened = openGame ? MINIGAMES.find((game) => game.name === openGame) : undefined;

    const tryGame = (game: Game) => {
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
            <div className="flex min-h-0 min-w-0 flex-1 flex-col px-[2vh] py-[1.6vh]">
                {generalError && (
                    <p className="mb-[1vh] flex items-center gap-[0.6vh] text-[1.35vh] font-semibold text-red-400">
                        <i className="fas fa-triangle-exclamation text-[1.2vh]" />
                        {generalError}
                    </p>
                )}

                <div className="mb-[0.9vh] flex flex-shrink-0 items-baseline gap-[1vh] border-b border-white/5 pb-[0.7vh]">
                    <i className="fas fa-gamepad text-[1.6vh] text-primary/80" />
                    <h2 className="text-[1.8vh] font-bold text-white/90">{t('minigames_title')}</h2>
                    <span className="min-w-0 flex-1 truncate text-[1.25vh] text-white/35">{t('minigames_help')}</span>
                </div>

                {/* One game per row, with the one you picked open beside it, so
                    tuning a game never means leaving the list. */}
                <div className="flex min-h-0 min-w-0 flex-1 gap-[1.2vh]">
                    <div className="min-h-0 min-w-0 flex-1 overflow-y-auto">
                        {visible.map((game) => (
                            <GameRow
                                key={game.name}
                                game={game}
                                entry={entryOf(game.setting)}
                                selected={game.name === openGame}
                                query={query}
                                onSelect={() => setOpenGame(game.name === openGame ? null : game.name)}
                            />
                        ))}

                        {visible.length === 0 && (
                            <div className="flex flex-col items-center gap-[1vh] py-[8vh] text-white/35">
                                <i className="fas fa-magnifying-glass-minus text-[3.5vh]" />
                                <span className="text-[1.5vh]">{t('settings_no_results')}</span>
                            </div>
                        )}
                    </div>

                    {opened ? (
                        <GameDetail
                            game={opened}
                            entry={entryOf(opened.setting)}
                            canEdit={canEdit}
                            running={running !== null}
                            onTry={() => tryGame(opened)}
                        />
                    ) : (
                        <div className="flex w-[36vh] flex-shrink-0 flex-col items-center justify-center gap-[1vh] rounded-[0.6vh] border border-white/10 bg-white/[0.02] text-white/20">
                            <i className="fas fa-gamepad text-[3vh]" />
                            <span className="px-[2vh] text-center text-[1.3vh] leading-snug">{t('minigames_pick')}</span>
                        </div>
                    )}
                </div>
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
