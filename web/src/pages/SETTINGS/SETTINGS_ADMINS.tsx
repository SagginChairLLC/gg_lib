import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { t } from '@/data/useLang';
import { clearAdminsError, fetchAdmins, grantAdmin, revokeAdmin, useAdmins, type AdminEntry } from '@/data/useAdmins';
import { highlight } from './settings-utils';

function shortIdentifier(identifier: string): string {
    const [kind, value] = identifier.split(':');
    if (!value) return identifier;

    return `${kind}:${value.slice(0, 8)}…`;
}

//--------------------------------------------------
// MARK: Admin Row
//--------------------------------------------------

function AdminRow({ entry, query, disabled, onRevoke }: { entry: AdminEntry; query: string; disabled: boolean; onRevoke: () => void }) {
    const [confirming, setConfirming] = useState(false);
    const isConfig = entry.source === 'config';

    useEffect(() => {
        if (!confirming) return;

        const timer = setTimeout(() => setConfirming(false), 4000);
        return () => clearTimeout(timer);
    }, [confirming]);

    return (
        <div className={`flex items-center gap-[1.4vh] rounded-[0.5vh] border p-[1.4vh] transition-colors ${isConfig ? 'border-primary/25 bg-primary/[0.04]' : 'border-white/10 bg-white/[0.02] hover:border-white/25'}`}>
            <div className={`flex h-[3.4vh] w-[3.4vh] flex-shrink-0 items-center justify-center rounded-[0.4vh] ${isConfig ? 'bg-primary/15 text-primary' : 'bg-white/[0.06] text-white/40'}`}>
                <i className={`fas ${isConfig ? 'fa-file-shield' : 'fa-user-shield'} text-[1.4vh]`} />
            </div>

            <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-[0.8vh]">
                    <span className="text-[1.6vh] font-semibold text-white/95">{highlight(entry.name ?? shortIdentifier(entry.identifier), query)}</span>

                    {isConfig && (
                        <span className="rounded-[0.4vh] bg-primary/15 px-[0.8vh] py-[0.2vh] text-[1.1vh] font-bold uppercase tracking-wide text-primary">{t('admins_source_config')}</span>
                    )}
                </div>

                <p className="mt-[0.3vh] truncate font-mono text-[1.2vh] text-white/35">{highlight(entry.identifier, query)}</p>

                {entry.granted_by && (
                    <p className="mt-[0.3vh] text-[1.2vh] text-white/30">
                        {t('admins_granted_by')} {entry.granted_by}
                        {entry.granted_at ? ` · ${entry.granted_at}` : ''}
                    </p>
                )}
            </div>

            {isConfig ? (
                <span className="flex-shrink-0 text-[1.25vh] text-white/30" title={t('admins_config_hint')}>
                    <i className="fas fa-lock" />
                </span>
            ) : (
                <button
                    type="button"
                    disabled={disabled}
                    onClick={() => (confirming ? onRevoke() : setConfirming(true))}
                    className={`flex h-[3.2vh] flex-shrink-0 items-center gap-[0.7vh] rounded-[0.4vh] border px-[1.2vh] text-[1.35vh] font-semibold transition-colors disabled:opacity-40 ${
                        confirming ? 'border-red-500/60 bg-red-500/15 text-red-300' : 'border-white/10 text-white/50 hover:border-red-500/40 hover:text-red-300'
                    }`}
                >
                    <i className={`fas ${confirming ? 'fa-triangle-exclamation' : 'fa-user-minus'}`} />
                    {confirming ? t('admins_confirm_revoke') : t('admins_revoke')}
                </button>
            )}
        </div>
    );
}

//--------------------------------------------------
// MARK: Admins Page
//--------------------------------------------------

export default function SETTINGS_ADMINS({ canEdit, query }: { canEdit: boolean; query: string }) {
    const admins = useAdmins((state) => state.admins);
    const players = useAdmins((state) => state.players);
    const loaded = useAdmins((state) => state.loaded);
    const busy = useAdmins((state) => state.busy);
    const error = useAdmins((state) => state.error);

    const [manual, setManual] = useState('');

    useEffect(() => {
        if (!loaded) void fetchAdmins();
    }, [loaded]);

    const term = query.trim().toLowerCase();

    const visibleAdmins = admins.filter(
        (entry) => !term || entry.identifier.toLowerCase().includes(term) || (entry.name ?? '').toLowerCase().includes(term),
    );

    const grantable = players.filter((player) => !player.admin && (!term || player.name.toLowerCase().includes(term) || player.identifier.toLowerCase().includes(term)));

    const submitManual = async () => {
        const identifier = manual.trim();
        if (!identifier || busy) return;

        if (await grantAdmin({ identifier })) setManual('');
    };

    if (!loaded && busy) {
        return (
            <div className="flex flex-1 items-center justify-center text-white/35">
                <i className="fas fa-spinner animate-spin text-[3vh]" />
            </div>
        );
    }

    return (
        <div className="relative min-h-0 min-w-0 flex-1 overflow-y-auto px-[2vh] py-[1.6vh]">
            <section className="mb-[2.4vh]">
                <div className="mb-[1vh] flex items-baseline gap-[1vh] border-b border-white/5 pb-[0.8vh]">
                    <i className="fas fa-user-shield text-[1.6vh] text-primary/80" />
                    <h2 className="text-[1.9vh] font-bold text-white/90">{t('admins_current')}</h2>
                    <span className="font-mono text-[1.2vh] text-white/30">{admins.length}</span>
                </div>

                <div className="flex flex-col gap-[0.9vh]">
                    {visibleAdmins.map((entry) => (
                        <AdminRow key={entry.identifier} entry={entry} query={query} disabled={!canEdit || busy} onRevoke={() => void revokeAdmin(entry.identifier)} />
                    ))}

                    {visibleAdmins.length === 0 && <div className="py-[2vh] text-center text-[1.4vh] text-white/35">{t('admins_none')}</div>}
                </div>
            </section>

            <section className="mb-[2.4vh]">
                <div className="mb-[1vh] flex items-baseline gap-[1vh] border-b border-white/5 pb-[0.8vh]">
                    <i className="fas fa-users text-[1.6vh] text-primary/80" />
                    <h2 className="text-[1.9vh] font-bold text-white/90">{t('admins_online')}</h2>
                    <span className="font-mono text-[1.2vh] text-white/30">{grantable.length}</span>
                </div>

                <div className="flex flex-col gap-[0.9vh]">
                    {grantable.map((player) => (
                        <div key={player.id} className="flex items-center gap-[1.4vh] rounded-[0.5vh] border border-white/10 bg-white/[0.02] p-[1.4vh] transition-colors hover:border-white/25">
                            <span className="flex h-[3.4vh] w-[3.4vh] flex-shrink-0 items-center justify-center rounded-[0.4vh] bg-white/[0.06] font-mono text-[1.3vh] text-white/50">{player.id}</span>

                            <div className="min-w-0 flex-1">
                                <span className="text-[1.6vh] font-semibold text-white/95">{highlight(player.name, query)}</span>
                                <p className="mt-[0.3vh] truncate font-mono text-[1.2vh] text-white/35">{highlight(player.identifier, query)}</p>
                            </div>

                            <button
                                type="button"
                                disabled={!canEdit || busy}
                                onClick={() => void grantAdmin({ player: player.id })}
                                className="flex h-[3.2vh] flex-shrink-0 items-center gap-[0.7vh] rounded-[0.4vh] border border-white/10 px-[1.2vh] text-[1.35vh] font-semibold text-white/60 transition-colors hover:border-primary/50 hover:text-primary disabled:opacity-40"
                            >
                                <i className="fas fa-user-plus" />
                                {t('admins_grant')}
                            </button>
                        </div>
                    ))}

                    {grantable.length === 0 && <div className="py-[2vh] text-center text-[1.4vh] text-white/35">{t('admins_nobody_online')}</div>}
                </div>
            </section>

            <section>
                <div className="mb-[1vh] flex items-baseline gap-[1vh] border-b border-white/5 pb-[0.8vh]">
                    <i className="fas fa-keyboard text-[1.6vh] text-primary/80" />
                    <h2 className="text-[1.9vh] font-bold text-white/90">{t('admins_by_identifier')}</h2>
                </div>

                <div className="flex items-center gap-[1vh]">
                    <input
                        type="text"
                        value={manual}
                        disabled={!canEdit || busy}
                        onChange={(event) => setManual(event.target.value)}
                        onKeyDown={(event) => event.key === 'Enter' && void submitManual()}
                        placeholder={t('admins_identifier_placeholder')}
                        className="h-[3.6vh] flex-1 rounded-[0.4vh] border border-white/10 bg-white/[0.03] px-[1.2vh] font-mono text-[1.4vh] text-white/90 transition-colors placeholder:font-sans placeholder:text-white/30 focus:border-primary/50 disabled:opacity-40"
                    />
                    <button
                        type="button"
                        disabled={!canEdit || busy || manual.trim() === ''}
                        onClick={() => void submitManual()}
                        className="flex h-[3.6vh] flex-shrink-0 items-center gap-[0.8vh] rounded-[0.4vh] bg-primary px-[1.8vh] text-[1.4vh] font-bold text-neutral-900 transition-colors hover:bg-primary/90 disabled:opacity-40"
                    >
                        <i className="fas fa-user-plus" />
                        {t('admins_grant')}
                    </button>
                </div>

                <p className="mt-[0.8vh] text-[1.25vh] text-white/30">{t('admins_identifier_hint')}</p>
            </section>

            <AnimatePresence>
                {error && (
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 10 }}
                        className="sticky bottom-0 mt-[1.6vh] flex items-center gap-[0.9vh] rounded-[0.5vh] border border-red-500/40 bg-red-500/10 px-[1.4vh] py-[1vh] text-[1.4vh] font-semibold text-red-300"
                    >
                        <i className="fas fa-triangle-exclamation" />
                        <span className="flex-1">{error}</span>
                        <button type="button" onClick={clearAdminsError} className="text-red-300/70 hover:text-red-200">
                            <i className="fas fa-xmark" />
                        </button>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
