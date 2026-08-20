import { useState } from 'react';
import { t } from '@/data/useLang';
import { fetchNui, isEnvBrowser } from '@/lib/fetchNui';
import { MINIGAMES, startMinigame, useMinigames } from '@/data/useMinigames';
import { RowActions, type RowAction } from './SETTING_CONTROL';
import { highlight } from './settings-utils';
import { copyText } from '@/lib/clipboard';

/**
 * The game set, to look at and to try. Nothing here is stored: the tuning is a
 * code default a script overrides per call, so this page shows what each game
 * is, lets you play it, and hands you the line to paste.
 */

type Game = (typeof MINIGAMES)[number];

/** Games that ask for a key, and can therefore be given a list of them. */
const KEYED = new Set(['skillcheck', 'keymash', 'timing', 'hold', 'lockpick']);

function luaValue(value: unknown): string {
    if (typeof value === 'string') return `"${value}"`;
    if (Array.isArray(value)) return `{ ${value.map(luaValue).join(', ')} }`;

    return String(value);
}

/**
 * The ready-to-paste call, built from the game's own defaults. Keyed games
 * carry a `keys` table even though one is not required, because a list is the
 * part worth showing: it is asked for a round at a time.
 */
export function exportSnippet(game: Game): string {
    const name = `gg${game.name.charAt(0).toUpperCase()}${game.name.slice(1)}`;

    const options: Record<string, unknown> = { ...game.preview };

    if (KEYED.has(game.name)) options.keys = ['E'];
    else delete options.keys;

    const parts = Object.entries(options).map(([key, value]) => `${key} = ${luaValue(value)}`);

    return `exports.gg_lib:${name}({ ${parts.join(', ')} })`;
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
    selected,
    query,
    onSelect,
}: {
    game: Game;
    selected: boolean;
    query: string;
    onSelect: () => void;
}) {
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
        </button>
    );
}

function GameDetail({ game, running, onTry }: { game: Game; running: boolean; onTry: () => void }) {
    const [copied, setCopied] = useState(false);

    const copiedNow = () => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
    };

    const snippet = exportSnippet(game);

    const actions: RowAction[] = [
        { id: 'try', label: t('minigames_try'), icon: 'fa-play', disabled: running, run: onTry },
        {
            id: 'copy',
            label: t('minigames_copy'),
            icon: 'fa-code',
            run: () => {
                if (copyText(snippet)) copiedNow();
            },
        },
    ];

    return (
        <div className="flex min-h-0 w-[36vh] flex-shrink-0 flex-col rounded-[0.6vh] border border-white/10 bg-white/[0.02]">
            <div className="flex flex-shrink-0 items-center gap-[0.9vh] border-b border-white/10 px-[1.1vh] py-[0.9vh]">
                <i className={`fas ${game.icon} flex-shrink-0 text-[1.5vh] text-primary`} />

                <div className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-[1.55vh] font-bold text-white/95">{game.label}</span>
                    <span className="truncate font-mono text-[1.05vh] text-white/30">{game.name}</span>
                </div>

                {copied && <CopiedChip />}

                <RowActions actions={actions} />
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-[1.1vh] py-[1vh]">
                <p className="mb-[1.1vh] text-[1.25vh] leading-snug text-white/45">{game.description}</p>

                {/* The call, with the game's own defaults filled in. Shown rather
                    than hidden behind the copy button, because reading it is how
                    you learn the shape. */}
                <div className="rounded-[0.5vh] border border-white/10 bg-neutral-950/60 p-[0.9vh]">
                    <span className="mb-[0.5vh] block text-[1.05vh] font-semibold uppercase tracking-widest text-white/25">
                        {t('minigames_usage')}
                    </span>

                    <code className="block whitespace-pre-wrap break-all font-mono text-[1.15vh] leading-relaxed text-primary/80">{snippet}</code>
                </div>

                {KEYED.has(game.name) && (
                    <p className="mt-[1vh] text-[1.2vh] leading-snug text-white/35">{t('minigames_keys_help')}</p>
                )}

                <p className="mt-[1vh] text-[1.2vh] leading-snug text-white/30">{t('minigames_defaults_help')}</p>
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

    const [openGame, setOpenGame] = useState<string | null>(null);

    const needle = query.trim().toLowerCase();

    const visible = MINIGAMES.filter(
        (game) => !needle || game.label.toLowerCase().includes(needle) || game.description.toLowerCase().includes(needle),
    );

    const opened = openGame ? MINIGAMES.find((game) => game.name === openGame) : undefined;

    const tryGame = (game: Game) => {
        if (running) return;

        if (isEnvBrowser()) {
            startMinigame(game.name, game.preview);
            return;
        }

        void fetchNui('minigame_try', { name: game.name });
    };

    return (
        <div className="relative flex min-h-0 min-w-0 flex-1 flex-col">
            <div className="flex min-h-0 min-w-0 flex-1 flex-col px-[2vh] py-[1.6vh]">
                <div className="mb-[0.9vh] flex flex-shrink-0 items-baseline gap-[1vh] border-b border-white/5 pb-[0.7vh]">
                    <i className="fas fa-gamepad text-[1.6vh] text-primary/80" />
                    <h2 className="text-[1.8vh] font-bold text-white/90">{t('minigames_title')}</h2>
                    <span className="min-w-0 flex-1 truncate text-[1.25vh] text-white/35">{t('minigames_help')}</span>
                </div>

                <div className="flex min-h-0 min-w-0 flex-1 gap-[1.2vh]">
                    <div className="min-h-0 min-w-0 flex-1 overflow-y-auto">
                        {visible.map((game) => (
                            <GameRow
                                key={game.name}
                                game={game}
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
                        <GameDetail game={opened} running={running !== null} onTry={() => tryGame(opened)} />
                    ) : (
                        <div className="flex w-[36vh] flex-shrink-0 flex-col items-center justify-center gap-[1vh] rounded-[0.6vh] border border-white/10 bg-white/[0.02] text-white/20">
                            <i className="fas fa-gamepad text-[3vh]" />
                            <span className="px-[2vh] text-center text-[1.3vh] leading-snug">{t('minigames_pick')}</span>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
