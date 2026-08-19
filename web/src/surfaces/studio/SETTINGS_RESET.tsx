import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { t } from '@/data/useLang';
import { fetchNui, isEnvBrowser } from '@/lib/fetchNui';
import { discardDraft, settingsEqual, useSettings, type SettingsScript } from '@/data/useSettings';

const CONFIRM_WORD = 'RESET';

type ResetResponse = { ok: boolean; errors?: Record<string, string> };

export default function SETTINGS_RESET({ script, disabled, onDone }: { script: SettingsScript; disabled: boolean; onDone: () => Promise<void> | void }) {
    const [arming, setArming] = useState(false);
    const [typed, setTyped] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        setArming(false);
        setTyped('');
        setError(null);
    }, [script.resource]);

    // A server-only entry never reports its value, so `stored` is what says
    // whether resetting this script would clear anything of it.
    const changed = script.entries.filter((entry) => (entry.server_only ? entry.stored === true : !settingsEqual(entry.value, entry.default)));
    const nothingToDo = changed.length === 0;
    const confirmed = typed.trim().toUpperCase() === CONFIRM_WORD;

    const run = async () => {
        if (!confirmed || busy || nothingToDo) return;

        setBusy(true);
        setError(null);

        try {
            if (isEnvBrowser()) {
                await new Promise((resolve) => setTimeout(resolve, 300));

                useSettings.setState((state) => ({
                    scripts: state.scripts.map((candidate) =>
                        candidate.resource !== script.resource
                            ? candidate
                            : {
                                  ...candidate,
                                  revision: (candidate.revision ?? 0) + 1,
                                  entries: candidate.entries.map((entry) => ({ ...entry, value: JSON.parse(JSON.stringify(entry.default ?? null)) })),
                              },
                    ),
                }));
            } else {
                const response = await fetchNui<ResetResponse>('settings_reset', {
                    resource: script.resource,
                    paths: changed.map((entry) => entry.path),
                });

                if (!response?.ok) {
                    setError(response?.errors?._ ?? t('settings_error_generic'));
                    return;
                }

                await onDone();
            }

            discardDraft(script.resource);

            setArming(false);
            setTyped('');
        } finally {
            setBusy(false);
        }
    };

    if (disabled) return null;

    return (
        <section className="mb-[2.4vh] mt-[3.2vh] rounded-[0.5vh] border border-red-500/30 bg-red-500/[0.04] p-[1.6vh]">
            <div className="flex items-start justify-between gap-[2vh]">
                <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-[0.8vh]">
                        <i className="fas fa-triangle-exclamation text-[1.5vh] text-red-400" />
                        <span className="text-[1.65vh] font-bold text-white/95">{t('settings_factory_reset')}</span>
                    </div>

                    <p className="mt-[0.5vh] text-[1.35vh] leading-snug text-white/45">
                        {t('settings_factory_reset_help')}{' '}
                        {nothingToDo ? (
                            <span className="text-white/35">{t('settings_factory_reset_clean')}</span>
                        ) : (
                            <span className="font-semibold text-red-300">
                                {changed.length} {changed.length === 1 ? t('settings_factory_reset_one') : t('settings_factory_reset_many')}
                            </span>
                        )}
                    </p>
                </div>

                {!arming && (
                    <button
                        type="button"
                        disabled={nothingToDo}
                        onClick={() => setArming(true)}
                        className="flex h-[3.4vh] flex-shrink-0 items-center gap-[0.8vh] rounded-[0.4vh] border border-red-500/40 px-[1.6vh] text-[1.4vh] font-semibold text-red-300 transition-colors hover:border-red-500/70 hover:bg-red-500/10 disabled:cursor-not-allowed disabled:border-white/10 disabled:text-white/25 disabled:hover:bg-transparent"
                    >
                        <i className="fas fa-rotate-left text-[1.25vh]" />
                        {t('settings_factory_reset')}
                    </button>
                )}
            </div>

            <AnimatePresence>
                {arming && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.16, ease: 'easeOut' }}
                        className="overflow-hidden"
                    >
                        <div className="mt-[1.4vh] border-t border-red-500/20 pt-[1.4vh]">
                            <p className="text-[1.35vh] text-white/60">
                                {t('settings_factory_reset_prompt')} <span className="font-mono font-bold text-red-300">{CONFIRM_WORD}</span>
                            </p>

                            <div className="mt-[0.9vh] flex items-center gap-[0.9vh]">
                                <input
                                    autoFocus
                                    type="text"
                                    value={typed}
                                    disabled={busy}
                                    onChange={(event) => setTyped(event.target.value)}
                                    onKeyDown={(event) => event.key === 'Enter' && void run()}
                                    placeholder={CONFIRM_WORD}
                                    className="h-[3.4vh] w-[14vh] rounded-[0.4vh] border border-white/15 bg-white/[0.04] px-[1vh] font-mono text-[1.4vh] uppercase tracking-widest text-white/90 placeholder:tracking-normal placeholder:text-white/20 focus:border-red-500/60"
                                />

                                <button
                                    type="button"
                                    disabled={!confirmed || busy}
                                    onClick={() => void run()}
                                    className="flex h-[3.4vh] items-center gap-[0.8vh] rounded-[0.4vh] bg-red-500/90 px-[1.6vh] text-[1.4vh] font-bold text-white transition-colors hover:bg-red-500 disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-white/30"
                                >
                                    {busy ? <i className="fas fa-spinner animate-spin" /> : <i className="fas fa-trash-can text-[1.25vh]" />}
                                    {t('settings_factory_reset_do')} {changed.length}
                                </button>

                                <button
                                    type="button"
                                    disabled={busy}
                                    onClick={() => {
                                        setArming(false);
                                        setTyped('');
                                        setError(null);
                                    }}
                                    className="flex h-[3.4vh] items-center rounded-[0.4vh] border border-white/15 px-[1.4vh] text-[1.4vh] font-semibold text-white/60 transition-colors hover:border-white/30 hover:text-white/90"
                                >
                                    {t('settings_discard')}
                                </button>
                            </div>

                            {error && (
                                <p className="mt-[0.8vh] flex items-center gap-[0.6vh] text-[1.3vh] font-semibold text-red-400">
                                    <i className="fas fa-triangle-exclamation text-[1.2vh]" />
                                    {error}
                                </p>
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </section>
    );
}
