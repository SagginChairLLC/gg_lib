import type { SettingEntry, SettingField, SettingsScript } from './useSettings';

function deepCopy<T>(value: T): T {
    return value === undefined ? value : JSON.parse(JSON.stringify(value));
}

function entry(partial: Omit<SettingEntry, 'value' | 'live'> & { value?: unknown; live?: boolean }): SettingEntry {
    return {
        live: true,
        ...partial,
        value: partial.value !== undefined ? partial.value : deepCopy(partial.default),
    };
}

//--------------------------------------------------
// MARK: Taxi — Uniform slots
//--------------------------------------------------

const COMPONENT_SLOTS = [
    ['face', 'Face'],
    ['mask', 'Mask'],
    ['hair', 'Hair'],
    ['arms', 'Arms'],
    ['pants', 'Pants'],
    ['bag', 'Bag'],
    ['shoes', 'Shoes'],
    ['accessory', 'Accessory'],
    ['undershirt', 'Undershirt'],
    ['kevlar', 'Kevlar'],
    ['badge', 'Badge'],
    ['jacket', 'Jacket'],
] as const;

const PROP_SLOTS = [
    ['hat', 'Hat'],
    ['glasses', 'Glasses'],
    ['ear', 'Earpiece'],
    ['watch', 'Watch'],
    ['bracelet', 'Bracelet'],
] as const;

function slotFields(slots: readonly (readonly [string, string])[]): SettingField[] {
    return slots.flatMap(([key, label]) => [
        { key: `${key}.drawable`, label: `${label} Drawable`, type: 'integer' as const, min: -1, nullable: true, help: "Leave unset to keep the player's own item. -1 clears the slot." },
        { key: `${key}.texture`, label: `${label} Texture`, type: 'integer' as const, min: 0 },
    ]);
}

const DEFAULT_COMPONENTS = {
    arms: { drawable: 11, texture: 0 },
    pants: { drawable: 15, texture: 0 },
    shoes: { drawable: 12, texture: 0 },
    undershirt: { drawable: 15, texture: 0 },
    jacket: { drawable: 95, texture: 0 },
    face: { texture: 0 },
    mask: { texture: 0 },
    hair: { texture: 0 },
    bag: { texture: 0 },
    accessory: { texture: 0 },
    kevlar: { texture: 0 },
    badge: { texture: 0 },
};

const DEFAULT_PROPS = {
    hat: { drawable: -1, texture: 0 },
    glasses: { texture: 0 },
    ear: { texture: 0 },
    watch: { texture: 0 },
    bracelet: { texture: 0 },
};

//--------------------------------------------------
// MARK: Taxi schema
//--------------------------------------------------

const TIMEZONES = ['ACST', 'AEST', 'AKST', 'AWST', 'CDT', 'CET', 'CST', 'CST_China', 'CUSTOM', 'EDT', 'EET', 'EST', 'GMT', 'HST', 'IST', 'JST', 'KST', 'MDT', 'MST', 'PDT', 'PST', 'UTC', 'WET'];

function buildTaxiScript(): SettingsScript {
    return {
        resource: 'gg_taxijob',
        label: 'Advanced Taxi Job',
        icon: 'fa-taxi',
        order: 10,
        revision: 4,
        version: '1.2.7',
        groups: [
            { id: 'appearance', label: 'Appearance', icon: 'fa-palette', help: 'Colors used by the tablet UI and the world map.' },
            { id: 'general', label: 'General', icon: 'fa-sliders' },
            { id: 'daily', label: 'Daily Reset', icon: 'fa-clock', help: 'When daily progress rolls over.' },
            { id: 'popup', label: 'Popups', icon: 'fa-comment', help: 'The on-screen hints, despawn timer and fare meter.' },
            { id: 'contracts', label: 'Contracts', icon: 'fa-clipboard-list', help: 'How the contract board fills, expires and refills.' },
            { id: 'fares', label: 'Payouts', icon: 'fa-money-bill' },
            { id: 'interaction', label: 'Interaction', icon: 'fa-hand-pointer' },
            { id: 'performance', label: 'Performance', icon: 'fa-gauge-high' },
            { id: 'uniform', label: 'Uniform', icon: 'fa-shirt', help: 'The outfit applied when a driver swaps into work clothes.' },
        ],
        entries: [
            entry({
                path: 'settings.ui_theme.primary_color',
                group: 'appearance',
                label: 'Primary Color',
                help: 'Accent color across the whole tablet UI.',
                type: 'color',
                default: 'rgb(252, 186, 3)',
            }),
            entry({
                path: 'settings.blip_theme.blip_color',
                group: 'appearance',
                label: 'Blip Color',
                help: 'Color of the taxi depot blips on the map.',
                type: 'integer',
                min: 0,
                max: 85,
                default: 46,
                docs: 'https://docs.fivem.net/docs/game-references/blips/#blip-colors',
                live: false,
                value: 5,
            }),
            entry({
                path: 'settings.blip_theme.route_color',
                group: 'appearance',
                label: 'Route Color',
                help: 'Color of the GPS route drawn to a pickup or drop-off.',
                type: 'integer',
                min: 0,
                max: 85,
                default: 46,
                docs: 'https://docs.fivem.net/docs/game-references/blips/#blip-colors',
            }),
            entry({
                path: 'settings.general.clothing_enabled',
                group: 'general',
                label: 'Uniform Swapping',
                help: 'Offer a change of clothes at job locations.',
                type: 'boolean',
                default: true,
            }),
            entry({
                path: 'settings.general.currency_type',
                group: 'general',
                label: 'Currency',
                help: 'Currency symbol shown on fares and rewards.',
                type: 'enum',
                default: 'USD',
                options: [
                    { value: 'USD', label: 'US Dollar' },
                    { value: 'EUR', label: 'Euro' },
                    { value: 'GBP', label: 'British Pound' },
                    { value: 'JPY', label: 'Japanese Yen' },
                    { value: 'CAD', label: 'Canadian Dollar' },
                    { value: 'AUD', label: 'Australian Dollar' },
                    { value: 'CNY', label: 'Chinese Yuan' },
                    { value: 'INR', label: 'Indian Rupee' },
                    { value: 'BRL', label: 'Brazilian Real' },
                ],
            }),
            entry({
                path: 'settings.general.number_format',
                group: 'general',
                label: 'Number Format',
                help: 'Locale used to group digits. Not wired up yet.',
                type: 'enum',
                default: 'en-US',
                advanced: true,
                options: [
                    { value: 'en-US', label: 'US English' },
                    { value: 'en-GB', label: 'UK English' },
                    { value: 'de-DE', label: 'German' },
                    { value: 'fr-FR', label: 'French' },
                    { value: 'ja-JP', label: 'Japanese' },
                    { value: 'zh-CN', label: 'Chinese (Simplified)' },
                    { value: 'hi-IN', label: 'Hindi' },
                    { value: 'pt-BR', label: 'Portuguese (Brazil)' },
                ],
            }),
            entry({
                path: 'settings.defaults.ped_default',
                group: 'general',
                label: 'Fallback Ped Model',
                help: 'Used when a configured rider model does not exist on the server.',
                type: 'string',
                default: 'a_m_y_skater_01',
                advanced: true,
            }),
            entry({
                path: 'settings.reset_time.daily',
                group: 'daily',
                label: 'Reset Time',
                help: 'Time of day daily progress rolls over, on a 24 hour clock.',
                type: 'time',
                default: '00:00',
            }),
            entry({
                path: 'settings.reset_time.timezone_offset',
                group: 'daily',
                label: 'Timezone',
                help: 'Which zone the reset time is measured in.',
                type: 'enum',
                default: 'CST',
                options: TIMEZONES,
            }),
            entry({
                path: 'settings.popup.enabled',
                group: 'popup',
                label: 'Enable Popups',
                help: 'Master switch. Off means no keybind hint, no despawn timer and no fare meter.',
                type: 'boolean',
                default: true,
            }),
            entry({
                path: 'settings.popup.position',
                group: 'popup',
                label: 'Popup Anchor',
                help: 'Where hint popups sit on screen. The fare meter is positioned separately.',
                type: 'enum',
                default: 'bottom-middle',
                options: ['bottom-middle', 'right-middle', 'left-middle', 'top-middle', 'top-left', 'top-right', 'bottom-left', 'bottom-right'],
            }),
            entry({
                path: 'settings.popup.show_taxi_meter',
                group: 'popup',
                label: 'Live Fare Meter',
                help: 'Show a running fare while a passenger is aboard. Off shows a plain drop-off hint instead.',
                type: 'boolean',
                default: true,
            }),
            entry({
                path: 'settings.popup.meter_pos',
                group: 'popup',
                label: 'Fare Meter Position',
                help: 'The meter ignores the popup anchor and uses these percentages, so it can be moved clear of a speedometer HUD.',
                type: 'object',
                fields: [
                    { key: 'x', label: 'Horizontal', type: 'integer', min: 0, max: 83, suffix: '%', help: '0 left, 41 center, 83 right' },
                    { key: 'y', label: 'Vertical', type: 'integer', min: 1, max: 92, suffix: '%', help: '1 top, 46 center, 92 bottom' },
                ],
                default: { x: 0, y: 92 },
            }),
            entry({
                path: 'settings.contracts.caps',
                group: 'contracts',
                label: 'Board Size by Level',
                help: 'How many contracts a driver can have on the board at once. The highest tier the player qualifies for wins, so keep this sorted by level ascending.',
                type: 'list',
                item: [
                    { key: 'level', label: 'Level', type: 'integer', min: 1 },
                    { key: 'max', label: 'Board Slots', type: 'integer', min: 1, max: 30 },
                ],
                item_default: { level: 1, max: 3 },
                min_items: 1,
                default: [
                    { level: 1, max: 3 },
                    { level: 10, max: 5 },
                    { level: 17, max: 7 },
                    { level: 25, max: 10 },
                ],
            }),
            entry({
                path: 'settings.contracts.lifetime',
                group: 'contracts',
                label: 'Contract Lifetime',
                help: 'How long an unaccepted contract stays on the board. Rolled per contract so a whole region does not expire on the same tick.',
                type: 'object',
                fields: [
                    { key: 'min', label: 'Minimum', type: 'integer', min: 30, suffix: 's' },
                    { key: 'max', label: 'Maximum', type: 'integer', min: 30, suffix: 's' },
                ],
                default: { min: 240, max: 480 },
            }),
            entry({
                path: 'settings.contracts.respawn_delay',
                group: 'contracts',
                label: 'Respawn Delay',
                help: 'Seconds before a replacement contract is generated in that region.',
                type: 'integer',
                min: 0,
                max: 600,
                suffix: 's',
                default: 15,
                value: 30,
            }),
            entry({
                path: 'settings.contracts.check_interval',
                group: 'contracts',
                label: 'Sweep Interval',
                help: 'How often the server sweeps for expired contracts.',
                type: 'integer',
                min: 1,
                max: 60,
                suffix: 's',
                default: 5,
                advanced: true,
            }),
            entry({
                path: 'settings.contracts.prune_grace',
                group: 'contracts',
                label: 'Prune Grace',
                help: 'Seconds the server waits past expiry before dropping a contract, so the UI can play its grey-out first.',
                type: 'integer',
                min: 0,
                max: 30,
                suffix: 's',
                default: 3,
                advanced: true,
            }),
            entry({
                path: 'settings.defaults.payment_defaults',
                group: 'fares',
                label: 'Payment Accounts',
                help: 'Which account each kind of payment moves through.',
                type: 'object',
                fields: [
                    { key: 'player_ride', label: 'Player Fares', type: 'enum', options: ['cash', 'bank'] },
                    { key: 'npc_ride', label: 'NPC Fares', type: 'enum', options: ['cash', 'bank'] },
                    { key: 'daily_reward', label: 'Daily Reward', type: 'enum', options: ['cash', 'bank'] },
                    { key: 'challenge_reward', label: 'Challenge Reward', type: 'enum', options: ['cash', 'bank'] },
                    { key: 'rentals', label: 'Vehicle Rentals', type: 'enum', options: ['cash', 'bank'] },
                ],
                default: {
                    player_ride: 'cash',
                    npc_ride: 'cash',
                    daily_reward: 'cash',
                    challenge_reward: 'cash',
                    rentals: 'cash',
                },
            }),
            entry({
                path: 'settings.autopayout.riderExitsVehicle',
                group: 'fares',
                label: 'Pay on Early Exit',
                help: 'If a rider leaves the vehicle at any point, the driver is compensated automatically.',
                type: 'boolean',
                default: true,
            }),
            entry({
                path: 'settings.taxiInteraction.openMenuKeybind',
                group: 'interaction',
                label: 'Open Menu Key',
                help: 'Key that opens the taxi menu while on duty.',
                type: 'keybind',
                default: 'O',
            }),
            entry({
                path: 'settings.action_timeouts.return_vehicle',
                group: 'interaction',
                label: 'Return Vehicle Cooldown',
                help: 'Cooldown between vehicle returns, in milliseconds.',
                type: 'integer',
                min: 0,
                max: 120000,
                step: 500,
                suffix: 'ms',
                default: 10000,
            }),
            entry({
                path: 'settings.syncing.network_npc_riders',
                group: 'performance',
                label: 'Network NPC Riders',
                help: 'Make rider peds visible to every player rather than only the driver. Costs entity slots on a busy server.',
                type: 'boolean',
                default: false,
                live: false,
            }),
            entry({
                path: 'settings.clothing.male.components',
                group: 'uniform',
                label: 'Male Components',
                type: 'object',
                fields: slotFields(COMPONENT_SLOTS),
                default: deepCopy(DEFAULT_COMPONENTS),
            }),
            entry({
                path: 'settings.clothing.male.props',
                group: 'uniform',
                label: 'Male Props',
                type: 'object',
                fields: slotFields(PROP_SLOTS),
                default: deepCopy(DEFAULT_PROPS),
            }),
            entry({
                path: 'settings.clothing.female.components',
                group: 'uniform',
                label: 'Female Components',
                type: 'object',
                fields: slotFields(COMPONENT_SLOTS),
                default: deepCopy(DEFAULT_COMPONENTS),
            }),
            entry({
                path: 'settings.clothing.female.props',
                group: 'uniform',
                label: 'Female Props',
                type: 'object',
                fields: slotFields(PROP_SLOTS),
                default: deepCopy(DEFAULT_PROPS),
            }),
        ],
    };
}

//--------------------------------------------------
// MARK: Stand-in peers
//--------------------------------------------------

function buildTowScript(): SettingsScript {
    return {
        resource: 'gg_towjob',
        label: 'Advanced Tow Job',
        icon: 'fa-truck-fast',
        order: 20,
        revision: 2,
        version: '2.0.3',
        groups: [
            { id: 'appearance', label: 'Appearance', icon: 'fa-palette' },
            { id: 'dispatch', label: 'Dispatch', icon: 'fa-tower-broadcast', help: 'How wreck calls generate and expire.' },
            { id: 'payouts', label: 'Payouts', icon: 'fa-money-bill' },
        ],
        entries: [
            entry({ path: 'settings.ui_theme.primary_color', group: 'appearance', label: 'Primary Color', help: 'Accent color across the tow tablet UI.', type: 'color', default: 'rgb(59, 130, 246)' }),
            entry({ path: 'settings.dispatch.max_calls', group: 'dispatch', label: 'Active Calls', help: 'Wreck calls on the board at once.', type: 'integer', min: 1, max: 20, default: 6 }),
            entry({ path: 'settings.dispatch.call_lifetime', group: 'dispatch', label: 'Call Lifetime', help: 'Seconds before an unanswered wreck call expires.', type: 'integer', min: 60, max: 900, suffix: 's', default: 300, value: 420 }),
            entry({ path: 'settings.dispatch.night_only_specials', group: 'dispatch', label: 'Night Specials', help: 'High-value recovery jobs only spawn between 22:00 and 05:00.', type: 'boolean', default: false }),
            entry({ path: 'settings.payouts.commission', group: 'payouts', label: 'Commission', help: 'Company cut taken from every completed tow.', type: 'percent', min: 0, max: 100, suffix: '%', default: 15, value: 22 }),
            entry({ path: 'settings.payouts.impound_fee', group: 'payouts', label: 'Impound Fee', help: 'Flat fee paid on delivery to the impound lot.', type: 'integer', min: 0, max: 5000, default: 250 }),
            entry({ path: 'settings.payouts.account', group: 'payouts', label: 'Payout Account', type: 'enum', options: ['cash', 'bank'], default: 'bank' }),
        ],
    };
}

function buildCarwashScript(): SettingsScript {
    return {
        resource: 'gg_carwash',
        label: 'Car Wash',
        icon: 'fa-droplet',
        order: 30,
        revision: 1,
        version: '1.0.4',
        groups: [
            { id: 'general', label: 'General', icon: 'fa-sliders' },
            { id: 'pricing', label: 'Pricing', icon: 'fa-tag' },
        ],
        entries: [
            entry({ path: 'settings.general.open_time', group: 'general', label: 'Opening Time', help: 'When the wash bays power on each day.', type: 'time', default: '08:00' }),
            entry({ path: 'settings.general.queue_size', group: 'general', label: 'Queue Size', help: 'Vehicles that can wait in line per bay.', type: 'integer', min: 1, max: 10, default: 4 }),
            entry({ path: 'settings.pricing.basic_wash', group: 'pricing', label: 'Basic Wash', type: 'integer', min: 0, max: 1000, default: 50 }),
            entry({ path: 'settings.pricing.express_enabled', group: 'pricing', label: 'Express Lane', help: 'Offer a double-price instant wash.', type: 'boolean', default: true }),
        ],
    };
}

function buildGenericScript(): SettingsScript {
    return {
        resource: 'gg_studio',
        label: 'Generic Settings',
        icon: 'fa-layer-group',
        order: 1000,
        revision: 7,
        generic: true,
        groups: [
            { id: 'appearance', label: 'Appearance', icon: 'fa-palette' },
            { id: 'general', label: 'General', icon: 'fa-sliders' },
        ],
        entries: [
            entry({
                path: 'theme.primary_color',
                group: 'appearance',
                label: 'Primary Color',
                help: 'Studio-wide accent color, for scripts that follow the shared theme.',
                type: 'color',
                default: 'rgb(252, 186, 3)',
            }),
            entry({
                path: 'general.currency_type',
                group: 'general',
                label: 'Currency',
                help: 'Default currency for every GG script.',
                type: 'enum',
                default: 'USD',
                options: [
                    { value: 'USD', label: 'US Dollar' },
                    { value: 'EUR', label: 'Euro' },
                    { value: 'GBP', label: 'British Pound' },
                    { value: 'JPY', label: 'Japanese Yen' },
                    { value: 'CAD', label: 'Canadian Dollar' },
                    { value: 'AUD', label: 'Australian Dollar' },
                    { value: 'CNY', label: 'Chinese Yuan' },
                    { value: 'INR', label: 'Indian Rupee' },
                    { value: 'BRL', label: 'Brazilian Real' },
                ],
            }),
        ],
    };
}

export function buildMockSettingsScripts(): SettingsScript[] {
    return [buildTaxiScript(), buildTowScript(), buildCarwashScript(), buildGenericScript()];
}
