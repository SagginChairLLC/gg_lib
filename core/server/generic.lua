--------------------------------------------------
-- MARK: Generic Settings
--------------------------------------------------

require("modules.settings.shared")

GenericSettings = {}
GenericSettings.resource = "gg_studio"

local PSEUDO = GenericSettings.resource
--------------------------------------------------
-- MARK: Schema
--------------------------------------------------

local groups = {
    { id = "appearance", label = "Appearance", icon = "fa-palette" },
    { id = "general",    label = "General",    icon = "fa-sliders" },
    { id = "interface",  label = "Interface",  icon = "fa-bell",      help = "Who draws notifications, progress bars and prompts for every GG script" },
    { id = "popup",      label = "Popups",     icon = "fa-comment",   help = "gg.popup, shared by every script that shows one" },
    { id = "reset",      label = "Daily Reset", icon = "fa-clock",    help = "When daily progress rolls over, for every script that has any" },
    { id = "fallback",   label = "Fallbacks",  icon = "fa-life-ring", help = "Used when a script's own model fails to load" },
}

local timezone_options = {}
for zone in pairs(settings.timezones) do timezone_options[#timezone_options + 1] = zone end
table.sort(timezone_options)

local order  = {}
local schema = {}

local function define(path, def)
    def.path = path
    def.type = def.type or "string"

    schema[path] = def
    order[#order + 1] = path
end

define("theme.apply_to_all", {
    group   = "appearance",
    label   = "Apply Theme to All UIs",
    help    = "On, every GG script paints its UI in the color below. Off, each script shows its own Primary Color setting and uses that instead.",
    type    = "boolean",
    default = true,
})

define("theme.primary_color", {
    group   = "appearance",
    label   = "Primary Color",
    help    = "Studio-wide accent color, used by every script while the toggle above is on.",
    type    = "color",
    default = "rgb(252, 186, 3)",
})

define("theme.fade_on_hover_out", {
    group   = "appearance",
    label   = "Fade When Not Hovered",
    help    = "Panels fade back when the pointer leaves them, so the world behind can be checked without closing anything.",
    type    = "boolean",
    default = true,
})

define("theme.fade_opacity", {
    group   = "appearance",
    label   = "Faded Opacity",
    help    = "How visible a panel stays once it fades. 100 is no fade at all.",
    type    = "integer",
    min     = 10,
    max     = 100,
    step    = 5,
    suffix  = "%",
    default = 90,
})

local CURRENCIES = [[
AED=UAE Dirham
AFN=Afghan Afghani
ALL=Albanian Lek
AMD=Armenian Dram
ANG=Netherlands Antillean Guilder
AOA=Angolan Kwanza
ARS=Argentine Peso
AUD=Australian Dollar
AWG=Aruban Florin
AZN=Azerbaijani Manat
BAM=Bosnia-Herzegovina Convertible Mark
BBD=Barbadian Dollar
BDT=Bangladeshi Taka
BGN=Bulgarian Lev
BHD=Bahraini Dinar
BIF=Burundian Franc
BMD=Bermudan Dollar
BND=Brunei Dollar
BOB=Bolivian Boliviano
BRL=Brazilian Real
BSD=Bahamian Dollar
BTN=Bhutanese Ngultrum
BWP=Botswanan Pula
BYN=Belarusian Ruble
BZD=Belize Dollar
CAD=Canadian Dollar
CDF=Congolese Franc
CHF=Swiss Franc
CLP=Chilean Peso
CNY=Chinese Yuan
COP=Colombian Peso
CRC=Costa Rican Colon
CUP=Cuban Peso
CVE=Cape Verdean Escudo
CZK=Czech Koruna
DJF=Djiboutian Franc
DKK=Danish Krone
DOP=Dominican Peso
DZD=Algerian Dinar
EGP=Egyptian Pound
ERN=Eritrean Nakfa
ETB=Ethiopian Birr
EUR=Euro
FJD=Fijian Dollar
FKP=Falkland Islands Pound
GBP=British Pound
GEL=Georgian Lari
GHS=Ghanaian Cedi
GIP=Gibraltar Pound
GMD=Gambian Dalasi
GNF=Guinean Franc
GTQ=Guatemalan Quetzal
GYD=Guyanaese Dollar
HKD=Hong Kong Dollar
HNL=Honduran Lempira
HTG=Haitian Gourde
HUF=Hungarian Forint
IDR=Indonesian Rupiah
ILS=Israeli New Shekel
INR=Indian Rupee
IQD=Iraqi Dinar
IRR=Iranian Rial
ISK=Icelandic Krona
JMD=Jamaican Dollar
JOD=Jordanian Dinar
JPY=Japanese Yen
KES=Kenyan Shilling
KGS=Kyrgystani Som
KHR=Cambodian Riel
KMF=Comorian Franc
KPW=North Korean Won
KRW=South Korean Won
KWD=Kuwaiti Dinar
KYD=Cayman Islands Dollar
KZT=Kazakhstani Tenge
LAK=Laotian Kip
LBP=Lebanese Pound
LKR=Sri Lankan Rupee
LRD=Liberian Dollar
LSL=Lesotho Loti
LYD=Libyan Dinar
MAD=Moroccan Dirham
MDL=Moldovan Leu
MGA=Malagasy Ariary
MKD=Macedonian Denar
MMK=Myanmar Kyat
MNT=Mongolian Tugrik
MOP=Macanese Pataca
MRU=Mauritanian Ouguiya
MUR=Mauritian Rupee
MVR=Maldivian Rufiyaa
MWK=Malawian Kwacha
MXN=Mexican Peso
MYR=Malaysian Ringgit
MZN=Mozambican Metical
NAD=Namibian Dollar
NGN=Nigerian Naira
NIO=Nicaraguan Cordoba
NOK=Norwegian Krone
NPR=Nepalese Rupee
NZD=New Zealand Dollar
OMR=Omani Rial
PAB=Panamanian Balboa
PEN=Peruvian Sol
PGK=Papua New Guinean Kina
PHP=Philippine Peso
PKR=Pakistani Rupee
PLN=Polish Zloty
PYG=Paraguayan Guarani
QAR=Qatari Riyal
RON=Romanian Leu
RSD=Serbian Dinar
RUB=Russian Ruble
RWF=Rwandan Franc
SAR=Saudi Riyal
SBD=Solomon Islands Dollar
SCR=Seychellois Rupee
SDG=Sudanese Pound
SEK=Swedish Krona
SGD=Singapore Dollar
SHP=Saint Helena Pound
SLE=Sierra Leonean Leone
SOS=Somali Shilling
SRD=Surinamese Dollar
SSP=South Sudanese Pound
STN=Sao Tome and Principe Dobra
SVC=Salvadoran Colon
SYP=Syrian Pound
SZL=Swazi Lilangeni
THB=Thai Baht
TJS=Tajikistani Somoni
TMT=Turkmenistani Manat
TND=Tunisian Dinar
TOP=Tongan Paanga
TRY=Turkish Lira
TTD=Trinidad and Tobago Dollar
TWD=New Taiwan Dollar
TZS=Tanzanian Shilling
UAH=Ukrainian Hryvnia
UGX=Ugandan Shilling
USD=US Dollar
UYU=Uruguayan Peso
UZS=Uzbekistani Som
VES=Venezuelan Bolivar
VND=Vietnamese Dong
VUV=Vanuatu Vatu
WST=Samoan Tala
XAF=Central African CFA Franc
XCD=East Caribbean Dollar
XOF=West African CFA Franc
XPF=CFP Franc
YER=Yemeni Rial
ZAR=South African Rand
ZMW=Zambian Kwacha
ZWL=Zimbabwean Dollar
]]

local currency_options = {}

for code, name in CURRENCIES:gmatch("(%u+)=([^\n]+)") do
    currency_options[#currency_options + 1] = { value = code, label = ("%s (%s)"):format(name, code) }
end

table.sort(currency_options, function(left, right) return left.label < right.label end)

define("general.currency_type", {
    group   = "general",
    label   = "Currency",
    help    = "Default currency for every GG script.",
    type    = "enum",
    default = "USD",
    options = currency_options,
})

define("general.number_format", {
    group   = "general",
    label   = "Number Format",
    help    = "How gg.util.formatNumber and formatMoney group digits in every GG script.",
    type    = "enum",
    default = "1,234.56",
    options = {
        { value = "1,234.56", label = "1,234.56" },
        { value = "1.234,56", label = "1.234,56" },
        { value = "1 234,56", label = "1 234,56" },
        { value = "1234.56",  label = "1234.56 (no grouping)" },
    },
})

--------------------------------------------------
-- MARK: Interface
--------------------------------------------------

local NOTIFY_OPTIONS = {
    { value = "ox",         label = "ox_lib" },
    { value = "qb",         label = "qb-core" },
    { value = "esx",        label = "es_extended" },
    { value = "mythic",     label = "mythic_notify" },
    { value = "old_mythic", label = "mythic_notify (legacy)" },
    { value = "pNotify",    label = "pNotify" },
    { value = "brutal",     label = "brutal_notify" },
    { value = "okok",       label = "okokNotify" },
    { value = "stNotify",   label = "stNotify" },
    { value = "sd",         label = "sd-notify" },
    { value = "wasabi",     label = "wasabi_notify" },
    { value = "custom",     label = "Custom (wired in gg.display)" },
}

local BAR_OPTIONS = {
    { value = "ox",  label = "ox_lib" },
    { value = "qb",  label = "qb-core" },
    { value = "esx", label = "es_extended" },
}

define("interface.notifications", {
    group   = "interface",
    label   = "Notifications",
    help    = "Who draws gg.display.notify. Every GG script uses this one.",
    type    = "enum",
    options = NOTIFY_OPTIONS,
    default = "ox",
})

define("interface.progressbar", {
    group   = "interface",
    label   = "Progress Bars",
    help    = "Who draws gg.display.ProgressBar.",
    type    = "enum",
    options = BAR_OPTIONS,
    default = "ox",
})

define("interface.textui", {
    group   = "interface",
    label   = "Text UI",
    help    = "Who draws gg.display.DoTextui, the prompt shown near an interaction.",
    type    = "enum",
    options = BAR_OPTIONS,
    default = "ox",
})

define("popup.enabled", {
    group   = "popup",
    label   = "Enable Popups",
    help    = "Master switch for gg.popup. Off means no script shows one.",
    type    = "boolean",
    default = true,
})

define("popup.position", {
    group   = "popup",
    label   = "Popup Anchor",
    help    = "Where popups sit on screen.",
    type    = "enum",
    default = "bottom-middle",
    options = {
        "bottom-middle", "right-middle", "left-middle", "top-middle",
        "top-left", "top-right", "bottom-left", "bottom-right",
    },
})

define("reset.daily_time", {
    group   = "reset",
    label   = "Daily Reset Time",
    help    = "Time of day daily progress rolls over, on a 24 hour clock.",
    type    = "time",
    default = "00:00",
})

define("reset.timezone", {
    group   = "reset",
    label   = "Reset Timezone",
    help    = "Which zone the reset time is measured in.",
    type    = "enum",
    default = "CST",
    options = timezone_options,
})

define("fallback.vehicle", {
    group   = "fallback",
    label   = "Fallback Vehicle",
    help    = "Spawned when a script's configured vehicle model is missing or fails to load.",
    type    = "string",
    default = "sultan",
})

define("fallback.ped", {
    group   = "fallback",
    label   = "Fallback Ped",
    help    = "Spawned when a script's configured ped model is missing or fails to load.",
    type    = "string",
    default = "a_m_m_business_01",
})

--------------------------------------------------
-- MARK: Storage
--------------------------------------------------

local function encode(value)
    return json.encode({ v = value })
end

local function loadOverrides()
    local rows = MySQL.query.await(
        "SELECT path, value FROM gg_studio_settings WHERE resource = ?",
        { PSEUDO }
    )

    local loaded = {}

    for _, row in ipairs(rows or {}) do
        local ok, wrapper = pcall(json.decode, row.value)
        if ok and type(wrapper) == "table" and wrapper.v ~= nil then
            loaded[row.path] = wrapper.v
        end
    end

    return loaded
end

local function loadRevision()
    local rows = MySQL.query.await(
        "SELECT revision FROM gg_studio_settings_meta WHERE resource = ?",
        { PSEUDO }
    )

    if rows and rows[1] then
        return tonumber(rows[1].revision) or 0
    end

    MySQL.insert.await(
        "INSERT IGNORE INTO gg_studio_settings_meta (resource, revision) VALUES (?, 0)",
        { PSEUDO }
    )

    return 0
end

local function bumpRevision()
    MySQL.query.await(
        "UPDATE gg_studio_settings_meta SET revision = revision + 1 WHERE resource = ?",
        { PSEUDO }
    )
end

--------------------------------------------------
-- MARK: Reads
--------------------------------------------------

function GenericSettings.get(path)
    local def = schema[path]
    if not def then return nil end

    local overrides = loadOverrides()
    local value = overrides[path]

    if value ~= nil then
        local ok, result = settings.validate(def, value)
        if ok then return result end
    end

    return settings.deepCopy(def.default)
end

function GenericSettings.describe()
    local overrides = loadOverrides()
    local entries = {}

    for index = 1, #order do
        local path = order[index]
        local def  = schema[path]

        local value = overrides[path]

        if value ~= nil then
            local ok, result = settings.validate(def, value)
            if ok then value = result else value = nil end
        end

        if value == nil then
            value = settings.deepCopy(def.default)
        end

        entries[#entries + 1] = {
            path    = path,
            label   = def.label,
            help    = def.help,
            type    = def.type,
            group   = def.group,
            options    = def.options,
            min        = def.min,
            max        = def.max,
            max_length = def.max_length,
            step       = def.step,
            suffix  = def.suffix,
            live    = true,
            default = def.default,
            value   = value,
        }
    end

    return {
        resource = PSEUDO,
        label    = "Generic Settings",
        icon     = "fa-layer-group",
        order    = 1000,
        generic  = true,
        version  = GetResourceMetadata("gg_lib", "version", 0),
        revision = loadRevision(),
        groups   = groups,
        entries  = entries,
    }
end

--------------------------------------------------
-- MARK: Replication
--------------------------------------------------

local subscribers = {}

local function resolvedValues(paths)
    local overrides = loadOverrides()
    local values = {}

    for _, path in ipairs(paths) do
        local def = schema[path]
        local value = overrides[path]

        if value ~= nil then
            local ok, result = settings.validate(def, value)
            if ok then value = result else value = nil end
        end

        if value == nil then
            value = settings.deepCopy(def.default)
        end

        values[path] = value
    end

    return values
end

function GenericSettings.snapshot(paths)
    return {
        revision = loadRevision(),
        values   = resolvedValues(paths or order),
    }
end

local function pushGeneric(changed)
    if #changed == 0 then return end

    local payload = GenericSettings.snapshot(changed)

    for resource in pairs(subscribers) do
        if GetResourceState(resource) == "started" then
            pcall(function()
                exports[resource]:ggGenericSync(payload)
            end)
        end
    end

    TriggerClientEvent("gg_lib:generic:sync", -1, payload)
end

exports("ggGenericFetch", function()
    local invoker = GetInvokingResource()

    if invoker and invoker ~= "gg_lib" then
        subscribers[invoker] = true
    end

    return GenericSettings.snapshot()
end)

lib.callback.register("gg_lib:generic:snapshot", function()
    return true, GenericSettings.snapshot()
end)

AddEventHandler("onResourceStop", function(resource)
    subscribers[resource] = nil
end)

--------------------------------------------------
-- MARK: Writes
--------------------------------------------------

function GenericSettings.apply(changes, actor, expectedRevision)
    if type(changes) ~= "table" then return false, { _ = "malformed payload" } end

    if expectedRevision ~= nil and tonumber(expectedRevision) ~= loadRevision() then
        return false, { _ = "settings changed since this page was opened -- refresh and try again" }
    end

    local accepted = {}
    local errors   = {}
    local changed  = {}

    for path, value in pairs(changes) do
        local def = schema[path]

        if not def then
            errors[path] = "is not a known setting"
        else
            local ok, result = settings.validate(def, value)

            if ok then
                accepted[path] = result
            else
                errors[path] = result
            end
        end
    end

    if next(errors) then return false, errors end

    local previous = loadOverrides()

    local queries = {}

    for path, value in pairs(accepted) do
        changed[#changed + 1] = path
        queries[#queries + 1] = {
            query = [[
                INSERT INTO gg_studio_settings (resource, path, value, updated_by)
                VALUES (?, ?, ?, ?)
                ON DUPLICATE KEY UPDATE value = VALUES(value), updated_by = VALUES(updated_by)
            ]],
            values = { PSEUDO, path, encode(value), actor },
        }
    end

    if #changed == 0 then return true, {} end

    local ok, err = pcall(function()
        MySQL.transaction.await(queries)
    end)

    if not ok then
        print(("^1[gg_lib] failed to persist generic settings: %s^0"):format(err))
        return false, { _ = "database write failed" }
    end

    local history = {}
    for path, value in pairs(accepted) do
        history[#history + 1] = { resource = PSEUDO, path = path, action = "change", old = previous[path], new = value }
    end

    if Logs then Logs.write(history, actor) end

    bumpRevision()

    pushGeneric(changed)
    TriggerEvent("gg_lib:generic:changed", changed)

    return true, changed
end

function GenericSettings.reset(paths, actor)
    if type(paths) ~= "table" then return false, { _ = "malformed payload" } end

    local targets = {}

    for _, path in ipairs(paths) do
        if schema[path] then
            targets[#targets + 1] = path
        end
    end

    if #targets == 0 then return true, {} end

    local previous = loadOverrides()

    local placeholders = string.rep("?", #targets, ",")
    local values = { PSEUDO }

    for index = 1, #targets do
        values[#values + 1] = targets[index]
    end

    local ok, err = pcall(function()
        MySQL.query.await(
            ("DELETE FROM gg_studio_settings WHERE resource = ? AND path IN (%s)"):format(placeholders),
            values
        )
    end)

    if not ok then
        print(("^1[gg_lib] failed to reset generic settings: %s^0"):format(err))
        return false, { _ = "database write failed" }
    end

    local history = {}
    for index = 1, #targets do
        local path = targets[index]
        history[#history + 1] = {
            resource = PSEUDO, path = path, action = "reset",
            old = previous[path], new = settings.deepCopy(schema[path].default),
        }
    end

    if Logs then Logs.write(history, actor) end

    bumpRevision()

    pushGeneric(targets)
    TriggerEvent("gg_lib:generic:changed", targets)

    if actor then
        print(("[gg_lib] %s reset %d generic setting(s)"):format(actor, #targets))
    end

    return true, targets
end

--------------------------------------------------
-- MARK: Schema Drift
--------------------------------------------------

local orphanedGeneric = {}

local function reconcileStoredRows()
    local loaded = loadOverrides()

    for path, def in pairs(schema) do
        local sources = type(def.renamed_from) == "string" and { def.renamed_from } or def.renamed_from

        if type(sources) == "table" and loaded[path] == nil then
            for _, old in ipairs(sources) do
                if loaded[old] ~= nil then
                    local ok = pcall(MySQL.query.await,
                        "UPDATE gg_studio_settings SET path = ? WHERE resource = ? AND path = ?",
                        { path, PSEUDO, old })

                    if ok then
                        loaded[path] = loaded[old]
                        loaded[old] = nil
                        print(("[gg_lib] generic settings: migrated stored override '%s' -> '%s'"):format(old, path))
                    end

                    break
                end
            end
        end
    end

    local names = {}

    for path in pairs(loaded) do
        if not schema[path] then
            orphanedGeneric[path] = true
            names[#names + 1] = path
        end
    end

    if #names > 0 then
        table.sort(names)
        print(("^3[gg_lib] generic settings: %d stored override(s) no longer match a declared setting (kept; prune via gg_settings_prune): %s^0")
            :format(#names, table.concat(names, ", ")))
    end
end

function GenericSettings.prune(actor)
    local targets = {}
    for path in pairs(orphanedGeneric) do targets[#targets + 1] = path end
    table.sort(targets)

    if #targets == 0 then return true, {} end

    local placeholders = string.rep("?", #targets, ",")
    local values = { PSEUDO }

    for index = 1, #targets do
        values[#values + 1] = targets[index]
    end

    local ok, err = pcall(function()
        MySQL.query.await(
            ("DELETE FROM gg_studio_settings WHERE resource = ? AND path IN (%s)"):format(placeholders),
            values
        )
    end)

    if not ok then
        print(("^1[gg_lib] failed to prune generic settings: %s^0"):format(err))
        return false, { _ = "database write failed" }
    end

    orphanedGeneric = {}
    print(("[gg_lib] %s pruned %d orphaned generic override(s)"):format(actor or "console", #targets))

    return true, targets
end

--------------------------------------------------
-- MARK: Boot
--------------------------------------------------

AddEventHandler("gg_lib:database:ready", function()
    loadRevision()
    reconcileStoredRows()
end)
