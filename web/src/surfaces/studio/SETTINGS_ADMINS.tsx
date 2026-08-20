import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { t } from '@/data/useLang';
import { clearAdminsError, fetchAdmins, grantAdmin, revokeAdmin, setAdminRole, useAdmins, type AdminEntry, type OnlinePlayer, type RoleEntry } from '@/data/useAdmins';
import SETTINGS_ROLES from './SETTINGS_ROLES';
import Dropdown from './DROPDOWN';
import { copyText } from '@/lib/clipboard';
import { useSettings } from '@/data/useSettings';
import { highlight } from './settings-utils';

function shortIdentifier(identifier: string): string {
    const [kind, value] = identifier.split(':');
    if (!value) return identifier;

    return `${kind}:${value.slice(0, 8)}…`;
}

function initial(name: string | undefined, identifier: string): string {
    const source = name?.trim() || identifier.split(':')[1] || identifier;

    return source.charAt(0).toUpperCase();
}

//--------------------------------------------------
// MARK: Parts
//--------------------------------------------------

function Stat({ icon, label, value, strong }: { icon: string; label: string; value: number; strong?: boolean }) {
    return (
        <div className={`flex min-w-0 flex-1 items-center gap-[1vh] rounded-[0.5vh] border px-[1.2vh] py-[0.9vh] ${strong ? 'border-primary/25 bg-primary/[0.05]' : 'border-white/10 bg-white/[0.02]'}`}>
            <i className={`fas ${icon} flex-shrink-0 text-[1.5vh] ${strong ? 'text-primary' : 'text-white/25'}`} />

            <div className="flex min-w-0 flex-col">
                <span className={`font-mono text-[1.9vh] font-bold leading-none ${strong ? 'text-primary' : 'text-white/85'}`}>{value}</span>
                <span className="mt-[0.3vh] truncate text-[1.05vh] font-semibold uppercase tracking-widest text-white/30">{label}</span>
            </div>
        </div>
    );
}

/** The identifier with a click to copy it — admins pass these around constantly. */
function Identifier({ identifier, query }: { identifier: string; query: string }) {
    const [copied, setCopied] = useState(false);

    return (
        <button
            type="button"
            title={t('admins_copy')}
            onClick={(event) => {
                event.stopPropagation();

                if (!copyText(identifier)) return;

                setCopied(true);
                setTimeout(() => setCopied(false), 1400);
            }}
            className="group flex min-w-0 items-center gap-[0.5vh] text-left"
        >
            <span className="truncate font-mono text-[1.15vh] text-white/30 transition-colors group-hover:text-white/60">
                {highlight(shortIdentifier(identifier), query)}
            </span>
            <i className={`fas ${copied ? 'fa-check text-primary' : 'fa-copy text-white/15 group-hover:text-white/40'} flex-shrink-0 text-[1vh]`} />
        </button>
    );
}

function Avatar({ label, tone, dot }: { label: string; tone: string; dot?: boolean }) {
    return (
        <div className="relative flex-shrink-0">
            <div className={`flex h-[3.4vh] w-[3.4vh] items-center justify-center rounded-[0.5vh] text-[1.5vh] font-bold ${tone}`}>{label}</div>

            {dot && (
                <span className="absolute -bottom-[0.2vh] -right-[0.2vh] h-[1.1vh] w-[1.1vh] rounded-full border-[0.25vh] border-neutral-950 bg-primary" />
            )}
        </div>
    );
}

//--------------------------------------------------
// MARK: Roster Row
//--------------------------------------------------

function AdminRow({
    entry,
    role,
    roles,
    online,
    query,
    disabled,
    onRevoke,
}: {
    entry: AdminEntry;
    role?: RoleEntry;
    roles: RoleEntry[];
    online: boolean;
    query: string;
    disabled: boolean;
    onRevoke: () => void;
}) {
    const [confirming, setConfirming] = useState(false);
    const isConfig = entry.source === 'config';

    // Neither of these was granted here, so neither can be taken away
    // here: one lives in server_config.lua, the other in whatever gave
    // them the permission.
    const isServer = entry.source === 'server';
    const locked = isConfig || isServer;

    useEffect(() => {
        if (!confirming) return;

        const timer = setTimeout(() => setConfirming(false), 4000);
        return () => clearTimeout(timer);
    }, [confirming]);

    return (
        <div
            className={`group flex items-center gap-[1.1vh] border-b border-white/5 px-[1.2vh] py-[0.9vh] transition-colors ${
                isConfig ? 'bg-primary/[0.03]' : 'hover:bg-white/[0.03]'
            }`}
        >
            <Avatar
                label={initial(entry.name, entry.identifier)}
                tone={isConfig ? 'bg-primary/15 text-primary' : 'bg-white/[0.07] text-white/45'}
                dot={online}
            />

            <div className="flex min-w-0 flex-1 flex-col">
                <div className="flex min-w-0 items-center gap-[0.7vh]">
                    <span className="truncate text-[1.45vh] font-semibold text-white/95">
                        {entry.name ? highlight(entry.name, query) : <span className="italic text-white/40">{t('admins_unnamed')}</span>}
                    </span>

                    {isServer && (
                        <span
                            title={entry.granted_by ? `${t('admins_from_server_help')} ${entry.granted_by}` : t('admins_from_server_help')}
                            className="flex flex-shrink-0 items-center gap-[0.4vh] rounded-[0.35vh] border border-sky-400/30 bg-sky-400/10 px-[0.6vh] py-[0.1vh] text-[1vh] font-bold uppercase tracking-widest text-sky-300/90"
                        >
                            <i className="fas fa-server text-[0.9vh]" />
                            {t('admins_from_server')}
                        </span>
                    )}

                    {isConfig && (
                        <span className="flex flex-shrink-0 items-center gap-[0.4vh] rounded-[0.35vh] bg-primary/15 px-[0.6vh] py-[0.1vh] text-[1vh] font-bold uppercase tracking-widest text-primary">
                            <i className="fas fa-lock text-[0.9vh]" />
                            {t('admins_locked')}
                        </span>
                    )}

                    {online && <span className="flex-shrink-0 text-[1.05vh] font-semibold uppercase tracking-widest text-primary/70">{t('admins_online_now')}</span>}
                </div>

                <Identifier identifier={entry.identifier} query={query} />

                {entry.granted_by && (
                    <span className="truncate text-[1.1vh] text-white/25">
                        {t('admins_granted_by')} {entry.granted_by}
                        {entry.granted_at ? ` · ${entry.granted_at}` : ''}
                    </span>
                )}
            </div>

            {/* The owner role comes from server_config.lua, so it is shown but never chosen. */}
            {locked ? (
                <span
                    className="flex flex-shrink-0 items-center gap-[0.5vh] px-[0.8vh] text-[1.2vh] text-white/35"
                    title={isServer ? `${t('admins_from_server_help')} ${entry.granted_by ?? ''}`.trim() : t('admins_config_hint')}
                >
                    <i className={`fas ${role?.icon ?? 'fa-crown'} text-[1.15vh]`} />
                    <span className="text-[1.2vh] font-semibold">{role?.label ?? entry.role}</span>
                </span>
            ) : (
                <Dropdown
                    value={entry.role}
                    disabled={disabled}
                    width="15vh"
                    align="right"
                    onChange={(next) => void setAdminRole(entry.identifier, next)}
                    options={roles
                        .filter((candidate) => !candidate.locked)
                        .map((candidate) => ({ value: candidate.id, label: candidate.label, icon: candidate.icon }))}
                />
            )}

            {locked ? null : (
                <button
                    type="button"
                    disabled={disabled}
                    onClick={() => (confirming ? onRevoke() : setConfirming(true))}
                    className={`flex h-[2.9vh] flex-shrink-0 items-center gap-[0.6vh] rounded-[0.4vh] border px-[1vh] text-[1.2vh] font-semibold transition-all disabled:opacity-40 ${
                        confirming
                            ? 'border-red-500/60 bg-red-500/15 text-red-300'
                            : 'border-white/10 text-white/40 opacity-0 hover:border-red-500/40 hover:text-red-300 group-hover:opacity-100'
                    }`}
                >
                    <i className={`fas ${confirming ? 'fa-triangle-exclamation' : 'fa-user-minus'} text-[1.1vh]`} />
                    {confirming ? t('admins_confirm_revoke') : t('admins_revoke')}
                </button>
            )}
        </div>
    );
}

function PlayerRow({ player, query, disabled, onGrant }: { player: OnlinePlayer; query: string; disabled: boolean; onGrant: () => void }) {
    return (
        <button
            type="button"
            disabled={disabled}
            onClick={onGrant}
            className="group flex w-full items-center gap-[1vh] border-b border-white/5 px-[1.1vh] py-[0.7vh] text-left transition-colors hover:bg-primary/[0.06] disabled:opacity-40"
        >
            <span className="flex h-[2.6vh] w-[2.6vh] flex-shrink-0 items-center justify-center rounded-[0.4vh] bg-white/[0.06] font-mono text-[1.15vh] text-white/40">
                {player.id}
            </span>

            <div className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-[1.35vh] font-semibold text-white/85">{highlight(player.name, query)}</span>
                <span className="truncate font-mono text-[1.1vh] text-white/25">{shortIdentifier(player.identifier)}</span>
            </div>

            <i className="fas fa-user-plus flex-shrink-0 text-[1.2vh] text-white/20 transition-colors group-hover:text-primary" />
        </button>
    );
}

//--------------------------------------------------
// MARK: Page
//--------------------------------------------------

export default function SETTINGS_ADMINS({ query }: { query: string }) {
    const admins = useAdmins((state) => state.admins);
    const roles = useAdmins((state) => state.roles);
    const canManage = useSettings((state) => state.canManage);
    const players = useAdmins((state) => state.players);
    const loaded = useAdmins((state) => state.loaded);
    const busy = useAdmins((state) => state.busy);
    const error = useAdmins((state) => state.error);

    const [manual, setManual] = useState('');
    const [showRoles, setShowRoles] = useState(false);

    const roleOf = (id: string) => roles.find((role) => role.id === id);

    useEffect(() => {
        if (!loaded) void fetchAdmins();
    }, [loaded]);

    const term = query.trim().toLowerCase();

    const onlineIds = new Set(players.map((player) => player.identifier));

    const visibleAdmins = admins.filter(
        (entry) => !term || entry.identifier.toLowerCase().includes(term) || (entry.name ?? '').toLowerCase().includes(term),
    );

    const grantable = players.filter(
        (player) => !player.admin && (!term || player.name.toLowerCase().includes(term) || player.identifier.toLowerCase().includes(term)),
    );

    const fromConfig = admins.filter((entry) => entry.source === 'config').length;

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
        <div className="flex min-h-0 min-w-0 flex-1 flex-col px-[2vh] py-[1.6vh]">
            <div className="mb-[1.2vh] flex flex-shrink-0 gap-[0.8vh]">
                <Stat icon="fa-user-shield" label={t('admins_stat_total')} value={admins.length} strong />
                <Stat icon="fa-file-shield" label={t('admins_stat_config')} value={fromConfig} />
                <Stat icon="fa-key" label={t('admins_stat_granted')} value={admins.length - fromConfig} />
                <Stat icon="fa-signal" label={t('admins_stat_online')} value={admins.filter((entry) => onlineIds.has(entry.identifier)).length} />
            </div>

            <div className="flex min-h-0 min-w-0 flex-1 gap-[1.2vh]">
                <div className="flex min-h-0 min-w-0 flex-1 flex-col">
                    <div className="flex flex-shrink-0 items-baseline gap-[1vh] border-b border-white/10 pb-[0.6vh]">
                        <i className="fas fa-user-shield text-[1.4vh] text-primary/80" />
                        <h2 className="text-[1.65vh] font-bold text-white/90">{t('admins_current')}</h2>
                        <span className="min-w-0 flex-1 truncate text-[1.15vh] text-white/30">{t('admins_config_hint')}</span>
                    </div>

                    <div className="min-h-0 min-w-0 flex-1 overflow-y-auto">
                        {visibleAdmins.map((entry) => (
                            <AdminRow
                                key={entry.identifier}
                                entry={entry}
                                role={roleOf(entry.role)}
                                roles={roles}
                                online={onlineIds.has(entry.identifier)}
                                query={query}
                                disabled={!canManage || busy}
                                onRevoke={() => void revokeAdmin(entry.identifier)}
                            />
                        ))}

                        {visibleAdmins.length === 0 && (
                            <div className="flex flex-col items-center gap-[1vh] py-[6vh] text-white/30">
                                <i className="fas fa-user-shield text-[3vh]" />
                                <span className="text-[1.4vh]">{t('admins_none')}</span>
                            </div>
                        )}
                    </div>
                </div>

                <div className="flex w-[34vh] min-h-0 flex-shrink-0 flex-col rounded-[0.6vh] border border-white/10 bg-white/[0.02]">
                    <div className="flex flex-shrink-0 gap-[0.4vh] border-b border-white/10 p-[0.5vh]">
                        {[
                            { id: 'people', icon: 'fa-user-plus', label: t('admins_add') },
                            { id: 'roles', icon: 'fa-shield-halved', label: t('admins_tab_roles') },
                        ].map((tab) => {
                            const active = (tab.id === 'roles') === showRoles;

                            return (
                                <button
                                    key={tab.id}
                                    type="button"
                                    onClick={() => setShowRoles(tab.id === 'roles')}
                                    className={`flex h-[2.8vh] min-w-0 flex-1 items-center justify-center gap-[0.6vh] rounded-[0.4vh] text-[1.25vh] font-semibold transition-colors ${
                                        active ? 'bg-primary/15 text-primary' : 'text-white/40 hover:bg-white/[0.04] hover:text-white/75'
                                    }`}
                                >
                                    <i className={`fas ${tab.icon} text-[1.1vh]`} />
                                    <span className="truncate">{tab.label}</span>
                                </button>
                            );
                        })}
                    </div>

                    {showRoles && <SETTINGS_ROLES canManage={canManage} />}

                    {!showRoles && (
                    <>
                    <span className="flex-shrink-0 px-[1.1vh] pb-[0.4vh] pt-[0.8vh] text-[1.05vh] font-semibold uppercase tracking-widest text-white/25">
                        {t('admins_online')}
                    </span>

                    <div className="min-h-0 flex-1 overflow-y-auto">
                        {grantable.map((player) => (
                            <PlayerRow
                                key={player.id}
                                player={player}
                                query={query}
                                disabled={!canManage || busy}
                                onGrant={() => void grantAdmin({ player: player.id })}
                            />
                        ))}

                        {grantable.length === 0 && (
                            <div className="px-[1.1vh] py-[2.5vh] text-center text-[1.2vh] text-white/25">{t('admins_nobody_online')}</div>
                        )}
                    </div>

                    <div className="flex-shrink-0 border-t border-white/10 px-[1.1vh] py-[0.9vh]">
                        <span className="text-[1.05vh] font-semibold uppercase tracking-widest text-white/25">{t('admins_by_identifier')}</span>

                        <div className="mt-[0.6vh] flex items-center gap-[0.6vh]">
                            <input
                                type="text"
                                value={manual}
                                disabled={!canManage || busy}
                                onChange={(event) => setManual(event.target.value)}
                                onKeyDown={(event) => event.key === 'Enter' && void submitManual()}
                                placeholder="license2:…"
                                className="h-[3vh] min-w-0 flex-1 rounded-[0.4vh] border border-white/10 bg-black/30 px-[0.9vh] font-mono text-[1.2vh] text-white/90 transition-colors placeholder:font-sans placeholder:text-white/25 focus:border-primary/50 disabled:opacity-40"
                            />
                            <button
                                type="button"
                                disabled={!canManage || busy || manual.trim() === ''}
                                onClick={() => void submitManual()}
                                className="flex h-[3vh] w-[3vh] flex-shrink-0 items-center justify-center rounded-[0.4vh] bg-primary text-[1.2vh] font-bold text-neutral-900 transition-colors hover:bg-primary/90 disabled:opacity-30"
                            >
                                <i className="fas fa-plus" />
                            </button>
                        </div>

                        <p className="mt-[0.6vh] text-[1.1vh] leading-snug text-white/25">{t('admins_identifier_hint')}</p>
                    </div>
                    </>
                    )}
                </div>
            </div>

            <AnimatePresence>
                {error && (
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 10 }}
                        className="mt-[1vh] flex flex-shrink-0 items-center gap-[0.9vh] rounded-[0.5vh] border border-red-500/40 bg-red-500/10 px-[1.4vh] py-[0.9vh] text-[1.35vh] font-semibold text-red-300"
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
