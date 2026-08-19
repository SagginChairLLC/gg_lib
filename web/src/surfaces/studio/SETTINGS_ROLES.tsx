import { useState } from 'react';
import { t } from '@/data/useLang';
import { deleteRole, saveRole, useAdmins, type RoleEntry, type RolePermissions } from '@/data/useAdmins';
import { useSettings } from '@/data/useSettings';

/**
 * What each role may reach. A role is a view scope, an edit scope and a set of
 * studio tools; the three that ship cover most servers, and the rest are the
 * owner's own.
 */

const TOOLS = [
    { id: 'logs', label: 'Logs', icon: 'fa-clock-rotate-left' },
    { id: 'bridges', label: 'Bridges', icon: 'fa-plug' },
    { id: 'minigames', label: 'Minigames', icon: 'fa-gamepad' },
];

const ALL = '*';

function has(scope: string[] | '*', key: string): boolean {
    return scope === ALL || scope.includes(key);
}

function scopeLabel(scope: string[] | '*'): string {
    if (scope === ALL) return t('admins_role_all');
    if (scope.length === 0) return t('admins_role_none');

    return scope.join(', ');
}

function emptyRole(): RoleEntry {
    return {
        id: '',
        label: '',
        icon: 'fa-user-shield',
        builtin: false,
        locked: false,
        permissions: { manage_admins: false, view: [], edit: [], tools: [] },
    };
}

//--------------------------------------------------
// MARK: Parts
//--------------------------------------------------

function Chip({ label, on, disabled, onClick }: { label: string; on: boolean; disabled?: boolean; onClick: () => void }) {
    return (
        <button
            type="button"
            disabled={disabled}
            onClick={onClick}
            className={`flex h-[2.6vh] items-center gap-[0.5vh] rounded-[0.4vh] border px-[0.9vh] text-[1.2vh] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                on ? 'border-primary/50 bg-primary/15 text-primary' : 'border-white/10 text-white/40 hover:border-white/30 hover:text-white/75'
            }`}
        >
            <i className={`fas ${on ? 'fa-check' : 'fa-minus'} text-[0.95vh]`} />
            {label}
        </button>
    );
}

/** One script's read and write boxes, side by side. */
function ScriptScopes({
    resource,
    label,
    permissions,
    disabled,
    onChange,
}: {
    resource: string;
    label: string;
    permissions: RolePermissions;
    disabled: boolean;
    onChange: (next: RolePermissions) => void;
}) {
    const viewing = has(permissions.view, resource);
    const editing = has(permissions.edit, resource);

    // A wildcard has to become a real list before one entry can be dropped.
    const listOf = (scope: string[] | '*', every: string[]) => (scope === ALL ? [...every] : [...scope]);

    const toggle = (key: 'view' | 'edit', every: string[]) => {
        const current = listOf(permissions[key], every);
        const next = current.includes(resource) ? current.filter((entry) => entry !== resource) : [...current, resource];

        const changed = { ...permissions, [key]: next };

        // Editing something you cannot open is not a state worth storing.
        if (key === 'edit' && next.includes(resource) && !has(changed.view, resource)) {
            changed.view = [...listOf(changed.view, every), resource];
        }
        if (key === 'view' && !next.includes(resource)) {
            changed.edit = listOf(changed.edit, every).filter((entry) => entry !== resource);
        }

        onChange(changed);
    };

    return (
        <div className="flex items-center gap-[1vh] border-b border-white/5 py-[0.5vh]">
            <span className="min-w-0 flex-1 truncate font-mono text-[1.25vh] text-white/70">{label}</span>

            <Chip label={t('admins_role_view')} on={viewing} disabled={disabled} onClick={() => toggle('view', [])} />
            <Chip label={t('admins_role_edit')} on={editing} disabled={disabled} onClick={() => toggle('edit', [])} />
        </div>
    );
}

function RoleCard({
    role,
    count,
    selected,
    canManage,
    onOpen,
}: {
    role: RoleEntry;
    count: number;
    selected: boolean;
    canManage: boolean;
    onOpen: () => void;
}) {
    return (
        <button
            type="button"
            onClick={onOpen}
            className={`flex w-full items-center gap-[1vh] border-b border-white/5 px-[1.1vh] py-[0.8vh] text-left transition-colors ${
                selected ? 'bg-primary/[0.07]' : 'hover:bg-white/[0.03]'
            }`}
        >
            <span
                className={`flex h-[3vh] w-[3vh] flex-shrink-0 items-center justify-center rounded-[0.5vh] ${
                    role.builtin ? 'bg-primary/15 text-primary' : 'bg-white/[0.07] text-white/45'
                }`}
            >
                <i className={`fas ${role.icon} text-[1.3vh]`} />
            </span>

            <div className="flex min-w-0 flex-1 flex-col">
                <div className="flex items-center gap-[0.6vh]">
                    <span className="truncate text-[1.4vh] font-semibold text-white/90">{role.label}</span>

                    {role.locked && <i className="fas fa-lock flex-shrink-0 text-[1vh] text-primary/70" title={t('admins_role_locked')} />}
                </div>

                <span className="truncate text-[1.1vh] text-white/30">
                    {role.permissions.manage_admins ? `${t('admins_role_manage')} · ` : ''}
                    {t('admins_role_edit')}: {scopeLabel(role.permissions.edit)}
                </span>
            </div>

            {count > 0 && (
                <span className="flex-shrink-0 rounded-[0.35vh] border border-white/10 px-[0.6vh] text-[1.05vh] font-mono text-white/35">{count}</span>
            )}

            {canManage && !role.locked && <i className="fas fa-chevron-right flex-shrink-0 text-[1vh] text-white/20" />}
        </button>
    );
}

//--------------------------------------------------
// MARK: Editor
//--------------------------------------------------

function RoleEditor({ role, onClose }: { role: RoleEntry; onClose: () => void }) {
    const scripts = useSettings((state) => state.scripts);
    const busy = useAdmins((state) => state.busy);

    const [draft, setDraft] = useState<RoleEntry>(role);
    const [confirming, setConfirming] = useState(false);

    const locked = role.locked || role.builtin;
    const creating = role.id === '';

    const permissions = draft.permissions;

    const setPermissions = (next: RolePermissions) => setDraft({ ...draft, permissions: next });

    const toggleTool = (id: string) => {
        const current = permissions.tools === ALL ? TOOLS.map((tool) => tool.id) : [...permissions.tools];
        const next = current.includes(id) ? current.filter((entry) => entry !== id) : [...current, id];

        setPermissions({ ...permissions, tools: next });
    };

    const everything = (key: 'view' | 'edit') => {
        const next = { ...permissions, [key]: permissions[key] === ALL ? [] : ALL };

        if (key === 'view' && next.view !== ALL) next.edit = [];
        if (key === 'edit' && next.edit === ALL) next.view = ALL;

        setPermissions(next);
    };

    const save = async () => {
        if (await saveRole({ id: draft.id, label: draft.label || draft.id, icon: draft.icon, permissions: draft.permissions })) {
            onClose();
        }
    };

    return (
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
            <div className="flex flex-shrink-0 items-center gap-[1vh] border-b border-white/10 px-[1.2vh] py-[0.9vh]">
                <button
                    type="button"
                    onClick={onClose}
                    className="flex h-[2.8vh] w-[2.8vh] flex-shrink-0 items-center justify-center rounded-[0.4vh] border border-white/10 text-[1.2vh] text-white/45 transition-colors hover:border-white/30 hover:text-white/85"
                >
                    <i className="fas fa-chevron-left" />
                </button>

                <i className={`fas ${draft.icon} flex-shrink-0 text-[1.4vh] text-primary`} />

                <span className="min-w-0 flex-1 truncate text-[1.6vh] font-bold text-white/90">{draft.label || draft.id || t('admins_new_role')}</span>

                {locked && <span className="flex-shrink-0 text-[1.15vh] italic text-white/30">{t('admins_role_builtin')}</span>}
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-[1.2vh] py-[1vh]">
                {!locked && (
                    <div className="mb-[1.2vh] flex items-center gap-[0.8vh]">
                        <input
                            type="text"
                            value={draft.id}
                            disabled={!creating || busy}
                            placeholder={t('admins_role_name')}
                            onChange={(event) => setDraft({ ...draft, id: event.target.value })}
                            className="h-[3vh] w-[16vh] flex-shrink-0 rounded-[0.4vh] border border-white/10 bg-black/30 px-[0.9vh] font-mono text-[1.2vh] text-white/85 outline-none transition-colors placeholder:font-sans placeholder:text-white/25 focus:border-primary/50 disabled:opacity-40"
                        />
                        <input
                            type="text"
                            value={draft.label}
                            disabled={busy}
                            placeholder={t('admins_role_label')}
                            onChange={(event) => setDraft({ ...draft, label: event.target.value })}
                            className="h-[3vh] min-w-0 flex-1 rounded-[0.4vh] border border-white/10 bg-black/30 px-[0.9vh] text-[1.25vh] text-white/85 outline-none transition-colors placeholder:text-white/25 focus:border-primary/50"
                        />
                    </div>
                )}

                {role.help && <p className="mb-[1vh] text-[1.2vh] leading-snug text-white/35">{role.help}</p>}

                <div className="mb-[0.5vh] flex items-center gap-[1vh]">
                    <span className="text-[1.05vh] font-semibold uppercase tracking-widest text-white/30">{t('admins_role_scripts')}</span>
                    <span className="min-w-0 flex-1" />
                    <Chip label={`${t('admins_role_view')} ${t('admins_role_all')}`} on={permissions.view === ALL} disabled={locked} onClick={() => everything('view')} />
                    <Chip label={`${t('admins_role_edit')} ${t('admins_role_all')}`} on={permissions.edit === ALL} disabled={locked} onClick={() => everything('edit')} />
                </div>

                {scripts.map((script) => (
                    <ScriptScopes
                        key={script.resource}
                        resource={script.resource}
                        label={script.label}
                        permissions={permissions}
                        disabled={locked}
                        onChange={setPermissions}
                    />
                ))}

                <div className="mb-[0.5vh] mt-[1.4vh] text-[1.05vh] font-semibold uppercase tracking-widest text-white/30">{t('admins_role_tools')}</div>

                <div className="flex flex-wrap gap-[0.6vh]">
                    {TOOLS.map((tool) => (
                        <Chip
                            key={tool.id}
                            label={tool.label}
                            on={has(permissions.tools, tool.id)}
                            disabled={locked}
                            onClick={() => toggleTool(tool.id)}
                        />
                    ))}
                </div>

                {permissions.manage_admins && (
                    <p className="mt-[1.2vh] flex items-center gap-[0.6vh] text-[1.15vh] text-primary/80">
                        <i className="fas fa-key text-[1vh]" />
                        {t('admins_role_manage')}
                    </p>
                )}
            </div>

            {!locked && (
                <div className="flex flex-shrink-0 items-center gap-[0.8vh] border-t border-white/10 px-[1.2vh] py-[0.9vh]">
                    {!creating && !role.builtin && (
                        <button
                            type="button"
                            disabled={busy}
                            onClick={() => (confirming ? void deleteRole(role.id).then(onClose) : setConfirming(true))}
                            className={`flex h-[3vh] items-center gap-[0.6vh] rounded-[0.4vh] border px-[1vh] text-[1.2vh] font-semibold transition-colors ${
                                confirming ? 'border-red-500/60 bg-red-500/15 text-red-300' : 'border-white/10 text-white/40 hover:border-red-500/40 hover:text-red-300'
                            }`}
                        >
                            <i className="fas fa-trash text-[1.05vh]" />
                            {confirming ? t('settings_confirm') : t('admins_role_delete')}
                        </button>
                    )}

                    <span className="min-w-0 flex-1" />

                    <button
                        type="button"
                        disabled={busy || draft.id.trim() === ''}
                        onClick={() => void save()}
                        className="flex h-[3vh] items-center gap-[0.7vh] rounded-[0.4vh] border border-primary/50 bg-primary/15 px-[1.3vh] text-[1.25vh] font-bold text-primary transition-colors hover:bg-primary/25 disabled:opacity-30"
                    >
                        <i className={`fas ${busy ? 'fa-spinner fa-spin' : 'fa-floppy-disk'} text-[1.1vh]`} />
                        {t('admins_role_save')}
                    </button>
                </div>
            )}
        </div>
    );
}

//--------------------------------------------------
// MARK: Panel
//--------------------------------------------------

export default function SETTINGS_ROLES({ canManage }: { canManage: boolean }) {
    const roles = useAdmins((state) => state.roles);
    const admins = useAdmins((state) => state.admins);

    const [editing, setEditing] = useState<RoleEntry | null>(null);

    if (editing) return <RoleEditor role={editing} onClose={() => setEditing(null)} />;

    const countOf = (id: string) => admins.filter((entry) => entry.role === id).length;

    return (
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
            <div className="flex flex-shrink-0 items-baseline gap-[0.8vh] border-b border-white/10 px-[1.1vh] py-[0.8vh]">
                <i className="fas fa-shield-halved text-[1.3vh] text-primary/80" />
                <h2 className="text-[1.55vh] font-bold text-white/90">{t('admins_tab_roles')}</h2>
                <span className="min-w-0 flex-1 truncate text-[1.1vh] text-white/30">{t('admins_roles_help')}</span>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto">
                {roles.map((role) => (
                    <RoleCard
                        key={role.id}
                        role={role}
                        count={countOf(role.id)}
                        selected={false}
                        canManage={canManage}
                        onOpen={() => setEditing(role)}
                    />
                ))}
            </div>

            {canManage && (
                <div className="flex-shrink-0 border-t border-white/10 px-[1.1vh] py-[0.8vh]">
                    <button
                        type="button"
                        onClick={() => setEditing(emptyRole())}
                        className="flex h-[3vh] w-full items-center justify-center gap-[0.7vh] rounded-[0.4vh] border border-white/10 text-[1.25vh] font-semibold text-white/50 transition-colors hover:border-primary/40 hover:text-primary"
                    >
                        <i className="fas fa-plus text-[1.1vh]" />
                        {t('admins_new_role')}
                    </button>
                </div>
            )}
        </div>
    );
}
