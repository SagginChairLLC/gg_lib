import { create } from 'zustand';
import { parseColor } from '@/lib/color-utils';

export const defaultLang: Record<string, string> = {
    util_close_btn: 'Close',
    util_esc_btn: 'ESC',
    settings_title: 'Server Settings',
    settings_search_script: 'Search these settings…',
    settings_all_scripts: 'All Scripts',
    settings_scripts: 'Scripts',
    settings_count: 'Settings',
    settings_groups: 'Groups',
    settings_modified: 'Modified',
    settings_view_only: 'View Only',
    settings_advanced: 'Advanced',
    settings_show_advanced: 'Advanced',
    settings_restart_required: 'Restart Required',
    settings_reset_default: 'Reset to default',
    settings_undo: 'Undo this change',
    settings_default_prefix: 'Default:',
    settings_unsaved: 'Unsaved Changes',
    settings_save: 'Save Changes',
    settings_discard: 'Discard',
    settings_saving: 'Saving',
    settings_saved: 'Settings Saved',
    settings_no_results: 'No settings match your search',
    settings_no_scripts: 'No scripts reported a settings panel',
    settings_error_generic: 'Some changes could not be saved',
    settings_refresh: 'Refresh',
    settings_add_row: 'Add Entry',
    settings_remove_row: 'Remove',
    settings_filter_rows: 'Filter entries...',
    settings_add_point: 'Place New Point',
    settings_back: 'Back',
    settings_edit: 'Edit',
    settings_view: 'View',
    settings_entry_one: 'entry',
    settings_entry_many: 'entries',
    settings_cancel: 'Cancel',
    settings_bulk_import: 'Paste positions in bulk',
    settings_bulk_hint: 'Paste vector4(x, y, z, heading) entries — separated by commas or new lines. vector3 and bare numbers work too.',
    settings_bulk_found: 'positions found',
    settings_bulk_none: 'Nothing recognised yet',
    settings_bulk_append: 'Append',
    settings_bulk_replace: 'Replace All',
    settings_teleport: 'Teleport Here',
    settings_press_key: 'Press a key…',
    settings_unset: 'Unset',
    settings_results: 'Results',
    settings_studio: 'Script Studio',
    settings_generic: 'Generic',
    settings_access: 'Access',
    settings_blip_search_color: 'Search colors…',
    settings_blip_search_sprite: 'Search blip icons…',
    settings_ped_search: 'Search peds, or type a custom model…',
    settings_ped_custom: 'Custom',
    picker_back: 'Back',
    picker_search: 'Search…',
    picker_use: 'Use',
    picker_hint_ped: 'Or type a custom ped model',
    picker_hint_id: 'Or type an id',
    settings_ped_use: 'Use',
    settings_place_in_world: 'Place in World',
    settings_place_new: 'Place New Position',
    settings_edit_position: 'Edit Position',
    settings_placing: 'Placing…',
    settings_factory_reset: 'Factory Reset',
    settings_factory_reset_help: 'Restores every setting on this page to the value the script ships with, and deletes the stored overrides.',
    settings_factory_reset_clean: 'Nothing has been changed yet.',
    settings_factory_reset_one: 'setting is changed.',
    settings_factory_reset_many: 'settings are changed.',
    settings_factory_reset_prompt: 'This cannot be undone. Type',
    settings_factory_reset_do: 'Reset',
    logs_title: 'Logs',
    logs_help: 'Most recent first',
    logs_by: 'by',
    logs_unset: 'unset',
    logs_empty: 'Nothing has been changed yet',
    logs_search: 'Search by person, script or setting…',
    logs_all_people: 'Everyone',
    logs_showing: 'of',
    access_title: 'You do not have access',
    access_subtitle: 'Add your license below to open Script Studio',
    access_your_license: 'Your license',
    access_file: 'Add it to this file',
    access_copy: 'Copy',
    access_how: 'How to add it',
    access_step_open: 'Open that file on the server (copy server_config.example.lua first if it is not there).',
    access_step_paste: 'Paste your license into the admins list, exactly as shown.',
    access_step_restart: 'Restart gg_lib, then run the command again.',
    access_close_hint: 'Press ESC to close',
    bridge_title: 'Bridges',
    bridge_help: 'What each script detected, and whether it took',
    bridge_empty: 'No script has reported a bridge yet',
    bridge_ok: 'Bridged',
    bridge_failed: 'Failed to bridge',
    bridge_none: 'None detected',
    bridge_from_override: 'Forced in utility.lua',
    bridge_from_stored: 'Selected here',
    bridge_from_detected: 'Auto detected',
    bridge_from_default: 'No resource found, using the stub',
    bridge_problem_one: 'problem',
    bridge_problem_many: 'problems',
    minigames_title: 'Minigames',
    minigames_help: 'The shared game set every GG script can call',
    minigames_try: 'Try It',
    minigames_defaults: 'Defaults',
    minigames_skillchecks: 'Skill Checks',
    minigames_skillchecks_help: 'Quick reflex prompts — small, at the bottom of the screen',
    minigames_boardgames: 'Minigames',
    minigames_boardgames_help: 'Full puzzles — bigger, in the center of the screen',
    minigames_no_entry: 'Settings not loaded — is gg_lib fully started?',
    minigames_copy: 'Copy to clipboard',
    minigames_try_tip: 'Play it right now',
    bridge_dependencies: 'Dependencies',
    bridge_dependencies_help: 'gg_lib will not run without these',
    bridge_required: 'Required',
    bridge_running: 'Running',
    bridge_not_running: 'Not started',
    bridge_interface: 'Interface',
    bridge_interface_help: 'Who draws notifications, progress bars and menus',
    bridge_provider_default: 'Default (ox_lib)',
    bridge_pending: 'Saved — restart gg_lib and your scripts to apply',
    bridge_wired_to: 'Wired to',
    admins_title: 'Admins',
    admins_search: 'Search admins and players…',
    admins_current: 'Has Access',
    admins_online: 'Online Players',
    admins_by_identifier: 'Add by Identifier',
    admins_none: 'No admins match your search',
    admins_nobody_online: 'Everyone online already has access',
    admins_grant: 'Grant',
    admins_revoke: 'Revoke',
    admins_confirm_revoke: 'Confirm',
    admins_source_config: 'Config File',
    admins_config_hint: 'Set in server_config.lua — remove it there',
    admins_granted_by: 'Granted by',
    admins_identifier_placeholder: 'license2:0000000000000000000000000000000000000000',
    admins_identifier_hint: 'A bare value is read as a license2. Prefix steam:, discord:, fivem: or license: for another type.',
};

type LangState = {
    visible: boolean;
    placing: boolean;
    fade: boolean;
    fadeOpacity: number;
    lang: Record<string, string>;
};

export const useLang = create<LangState>(() => ({
    visible: false,
    placing: false,
    fade: true,
    fadeOpacity: 90,
    lang: defaultLang,
}));

export function applyAppearance(data: { UI_THEME?: string; UI_FADE?: boolean; UI_FADE_TO?: number }) {
    applyTheme(data.UI_THEME);

    useLang.setState((state) => ({
        fade: typeof data.UI_FADE === 'boolean' ? data.UI_FADE : state.fade,
        fadeOpacity: typeof data.UI_FADE_TO === 'number' ? data.UI_FADE_TO : state.fadeOpacity,
    }));
}

export function t(key: string): string {
    return useLang.getState().lang[key] ?? defaultLang[key] ?? key;
}

export function applyTheme(color?: string) {
    if (!color) return;

    const parsed = parseColor(color);

    if (parsed.spaceSeparated) {
        document.documentElement.style.setProperty('--primary', parsed.spaceSeparated);
        document.documentElement.style.setProperty('--primary-rgb', parsed.commaSeparated);
    }
}

export function showEditor(uiLang?: Record<string, string>) {
    useLang.setState({
        visible: true,
        lang: { ...defaultLang, ...(uiLang ?? {}) },
    });
}

export function hideEditor() {
    useLang.setState({ visible: false });
}
