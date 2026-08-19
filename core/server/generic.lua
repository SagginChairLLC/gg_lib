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
    { id = "popup",      label = "Popups",     icon = "fa-comment",   help = "gg.popup, shared by every script that shows one" },
    { id = "reset",      label = "Daily Reset", icon = "fa-clock",    help = "When daily progress rolls over, for every script that has any" },
    { id = "fallback",   label = "Fallbacks",  icon = "fa-life-ring", help = "Used when a script's own model fails to load" },
    { id = "screenshot", label = "Screenshots", icon = "fa-camera",    help = "Where vehicle images are captured and where they are stored" },
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

--- Whether a path's value must never leave the server: upload keys, tokens,
--- anything a player has no business holding.
local function isSecret(path)
    local def = schema[path]

    return def ~= nil and def.server_only == true
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
-- MARK: Bridge Overrides
--------------------------------------------------
-- Which resource each bridge category is forced to, edited from the Bridges
-- page. Empty means auto detect. The group is deliberately not listed above,
-- so these never render as a generic tab.

local bridgeManifest do
    local raw = LoadResourceFile(GetCurrentResourceName(), "bridge/manifest.lua")
    local chunk = raw and load(raw, "@bridge/manifest.lua", "t")
    local ok, value = pcall(chunk or function() end)

    bridgeManifest = ok and type(value) == "table" and value or { categories = {}, category_order = {} }
end

for _, category in ipairs(bridgeManifest.category_order or {}) do
    local options = { { value = "", label = "Auto detect" } }

    for _, candidate in ipairs(bridgeManifest.categories[category] or {}) do
        options[#options + 1] = { value = candidate, label = candidate }
    end

    define(("bridge.%s"):format(category), {
        group   = "bridge",
        label   = category:sub(1, 1):upper() .. category:sub(2),
        type    = "enum",
        options = options,
        default = "",
    })
end

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

define("interface.contextmenu", {
    group   = "interface",
    label   = "Context Menu",
    help    = "Who draws gg.menu -- menus, inputs and alerts.",
    type    = "enum",
    options = {
        { value = "auto",   label = "Auto detect" },
        { value = "ox",     label = "ox_lib" },
        { value = "lation", label = "lation_ui" },
    },
    default = "auto",
})

define("interface.textui", {
    group   = "interface",
    label   = "Text UI",
    help    = "Who draws gg.display.DoTextui, the prompt shown near an interaction.",
    type    = "enum",
    options = BAR_OPTIONS,
    default = "ox",
})

-- ox_lib ships more than one shape for these two, and no other provider gives
-- a choice. The Bridges page shows them only while ox_lib is the one drawing.

define("interface.ox_progress_style", {
    group   = "interface",
    label   = "ox_lib Style",
    help    = "Which of ox_lib's two progress widgets to draw.",
    type    = "enum",
    options = {
        { value = "circle", label = "Circle" },
        { value = "bar",    label = "Bar" },
    },
    default = "circle",
})

define("interface.ox_progress_position", {
    group   = "interface",
    label   = "ox_lib Position",
    help    = "Where the circle sits. The bar is always along the bottom.",
    type    = "enum",
    options = {
        { value = "bottom", label = "Bottom" },
        { value = "middle", label = "Middle" },
    },
    default = "bottom",
})

define("interface.ox_textui_position", {
    group   = "interface",
    label   = "ox_lib Position",
    help    = "Which edge ox_lib anchors the prompt to.",
    type    = "enum",
    options = {
        { value = "right-center", label = "Right" },
        { value = "left-center",  label = "Left" },
        { value = "top-center",   label = "Top" },
    },
    default = "right-center",
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
-- MARK: Minigames
--------------------------------------------------
-- The default tuning for each game in the set. A script can override any of
-- these per call; what is set here is what an unconfigured call gets.

define("minigames.skillcheck", {
    group  = "minigames",
    label  = "Needle Drop",
    help   = "A needle sweeps a ring -- press the key while it crosses the marked arc.",
    type   = "object",
    fields = {
        { key = "rounds", label = "Rounds",       type = "integer", min = 1, max = 10 },
        { key = "zone",   label = "Arc Size",     type = "integer", min = 8, max = 90, suffix = "deg" },
        { key = "speed",  label = "Needle Speed", type = "integer", min = 60, max = 600, suffix = "deg/s" },
        { key = "key",    label = "Key",          type = "string", max_length = 12, help = "One key, several to pick from (EFG), or empty to draw one at random." },
    },
    default = { rounds = 3, zone = 40, speed = 220, key = "" },
})

define("minigames.keymash", {
    group  = "minigames",
    label  = "Key Mash",
    help   = "Mash the key to fill the bar before the clock empties.",
    type   = "object",
    fields = {
        { key = "time",  label = "Time Limit", type = "integer", min = 2, max = 30, suffix = "s" },
        { key = "decay", label = "Drain",      type = "integer", min = 0, max = 100, suffix = "%/s" },
        { key = "gain",  label = "Per Press",  type = "integer", min = 1, max = 50, suffix = "%" },
        { key = "key",   label = "Key",        type = "string", max_length = 12, help = "One key, several to pick from (EFG), or empty to draw one at random." },
    },
    default = { time = 6, decay = 16, gain = 6, key = "" },
})

define("minigames.timing", {
    group  = "minigames",
    label  = "Timing Bar",
    help   = "Stop the sweeping marker inside the zone. The zone shrinks each round.",
    type   = "object",
    fields = {
        { key = "rounds", label = "Rounds",      type = "integer", min = 1, max = 10 },
        { key = "zone",   label = "Zone Size",   type = "integer", min = 4, max = 40, suffix = "%" },
        { key = "speed",  label = "Sweep Speed", type = "number", min = 0.3, max = 3, step = 0.05, suffix = "bars/s" },
        { key = "key",    label = "Key",         type = "string", max_length = 12, help = "One key, several to pick from (EFG), or empty to draw one at random." },
    },
    default = { rounds = 3, zone = 16, speed = 0.7, key = "" },
})

define("minigames.sequence", {
    group  = "minigames",
    label  = "Key Sequence",
    help   = "Type the shown keys in order before the timer empties.",
    type   = "object",
    fields = {
        { key = "length", label = "Keys",       type = "integer", min = 3, max = 12 },
        { key = "time",   label = "Time Limit", type = "integer", min = 2, max = 30, suffix = "s" },
    },
    default = { length = 6, time = 5 },
})

define("minigames.memory", {
    group  = "minigames",
    label  = "Memory Grid",
    help   = "Tiles flash and go dark -- click every tile that lit up.",
    type   = "object",
    fields = {
        { key = "size",    label = "Grid",       type = "integer", min = 3, max = 6 },
        { key = "flashes", label = "Tiles",      type = "integer", min = 2, max = 12 },
        { key = "time",    label = "Time Limit", type = "integer", min = 3, max = 30, suffix = "s" },
    },
    default = { size = 4, flashes = 5, time = 8 },
})

define("minigames.connect", {
    group  = "minigames",
    label  = "Connect Circuits",
    help   = "Drag a wire between every pair of matching dots without crossing.",
    type   = "object",
    fields = {
        { key = "pairs", label = "Circuits",   type = "integer", min = 3, max = 5 },
        { key = "time",  label = "Time Limit", type = "integer", min = 10, max = 120, suffix = "s" },
    },
    default = { pairs = 4, time = 45 },
})

define("minigames.wordwiz", {
    group  = "minigames",
    label  = "Word Scramble",
    help   = "Unscramble the word and type it before the timer empties.",
    type   = "object",
    fields = {
        { key = "length", label = "Word Length", type = "integer", min = 4, max = 8 },
        { key = "time",   label = "Time Limit",  type = "integer", min = 3, max = 30, suffix = "s" },
    },
    default = { length = 6, time = 10 },
})

define("minigames.hold", {
    group  = "minigames",
    label  = "Hold Steady",
    help   = "Hold the key to raise the pressure, then release inside the band.",
    type   = "object",
    fields = {
        { key = "rounds", label = "Rounds",     type = "integer", min = 1, max = 8 },
        { key = "zone",   label = "Band Size",  type = "integer", min = 4, max = 40, suffix = "%" },
        { key = "speed",  label = "Fill Speed", type = "integer", min = 10, max = 200, suffix = "%/s" },
        { key = "time",   label = "Time Limit", type = "integer", min = 3, max = 30, suffix = "s" },
        { key = "key",    label = "Key",        type = "string", max_length = 12, help = "One key, several to pick from (EFG), or empty to draw one at random." },
    },
    default = { rounds = 3, zone = 18, speed = 55, time = 8, key = "" },
})

define("minigames.reflex", {
    group  = "minigames",
    label  = "Reflex Rush",
    help   = "A key appears somewhere new inside a closing ring -- hit each one in time.",
    type   = "object",
    fields = {
        { key = "rounds", label = "Keys",       type = "integer", min = 1, max = 10 },
        { key = "window", label = "Per Key",    type = "number", min = 0.4, max = 4, step = 0.1, suffix = "s" },
        { key = "key",    label = "Key",        type = "string", max_length = 12, help = "One key, several to pick from (EFG), or empty to draw one at random." },
    },
    default = { rounds = 4, window = 1.3, key = "" },
})

define("minigames.breach", {
    group  = "minigames",
    label  = "Breach Protocol",
    help   = "Pull a code sequence out of a matrix, alternating rows and columns, before the buffer fills.",
    type   = "object",
    fields = {
        { key = "size",   label = "Grid",       type = "integer", min = 4, max = 6 },
        { key = "length", label = "Sequence",   type = "integer", min = 3, max = 6 },
        { key = "time",   label = "Time Limit", type = "integer", min = 10, max = 120, suffix = "s" },
    },
    default = { size = 5, length = 4, time = 30 },
})

define("minigames.lockpick", {
    group  = "minigames",
    label  = "Lock Pick",
    help   = "Turn the pick with A and D and set each pin where the tension peaks.",
    type   = "object",
    fields = {
        { key = "rounds", label = "Pins",       type = "integer", min = 1, max = 6 },
        { key = "zone",   label = "Pin Size",   type = "integer", min = 8, max = 80, suffix = "deg" },
        { key = "speed",  label = "Turn Speed", type = "integer", min = 40, max = 400, suffix = "deg/s" },
        { key = "time",   label = "Time Limit", type = "integer", min = 10, max = 90, suffix = "s" },
        { key = "key",    label = "Set Key",    type = "string", max_length = 12, help = "One key, several to pick from (EFG), or empty to draw one at random. A and D are never used." },
    },
    default = { rounds = 3, zone = 34, speed = 150, time = 25, key = "" },
})

define("minigames.codecrack", {
    group  = "minigames",
    label  = "Code Cracker",
    help   = "Guess the digit code from marked feedback. Digits never repeat within a code.",
    type   = "object",
    fields = {
        { key = "length", label = "Digits",     type = "integer", min = 3, max = 5 },
        { key = "rounds", label = "Guesses",    type = "integer", min = 2, max = 8 },
        { key = "time",   label = "Time Limit", type = "integer", min = 15, max = 120, suffix = "s" },
    },
    default = { length = 4, rounds = 5, time = 45 },
})

--------------------------------------------------
-- MARK: Items
--------------------------------------------------
-- Unlisted like the bridge and minigame entries: the Items tool owns this one.

define("items.image_url", {
    group   = "items",
    label   = "Item Image Path",
    help    = "Where item icons are served from, when the running inventory is not one gg_lib bridges. Put %s where the file name goes. Empty means use the detected inventory's own path.",
    type    = "string",
    default = "",
})

--------------------------------------------------
-- MARK: Logs
--------------------------------------------------
-- Unlisted like the bridge and minigame entries: the Logs page owns this one.

define("logs.retention_days", {
    group   = "logs",
    label   = "Keep History For",
    help    = "Entries older than this are removed automatically.",
    type    = "enum",
    options = {
        { value = 7,   label = "7 days" },
        { value = 14,  label = "14 days" },
        { value = 30,  label = "30 days" },
        { value = 90,  label = "90 days" },
        { value = 365, label = "1 year" },
    },
    default = 14,
})

--------------------------------------------------
-- MARK: Screenshots
--------------------------------------------------

define("screenshot.upload_key", {
    group       = "screenshot",
    label       = "Upload API Key",
    help        = "Leave empty to save images into the script's own web folder instead of uploading them. Stored on the server only -- once set it is never sent back out, so it can be replaced but not read.",
    type        = "string",
    server_only = true,
    default     = "",
})

define("screenshot.location", {
    group   = "screenshot",
    label   = "Capture Spot",
    help    = "Where vehicles are spawned to be photographed. Somewhere flat, empty and far from players.",
    type    = "coords",
    default = { x = -1324.13, y = -2257.61, z = 48.77, heading = 260.0 },
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

--- The choices a path offers, for pages that draw their own control instead of
--- going through describe. Nil for anything that is not a list of options.
function GenericSettings.options(path)
    local def = schema[path]

    return def and def.options or nil
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

        local entry = {
            path    = path,
            label   = def.label,
            help    = def.help,
            type    = def.type,
            group   = def.group,
            fields  = def.fields,
            options    = def.options,
            min        = def.min,
            max        = def.max,
            max_length = def.max_length,
            step       = def.step,
            suffix  = def.suffix,
            live    = true,
        }

        -- This payload goes to a player's UI. A server-only entry carries no
        -- value and no default, only whether something is stored, so an owner
        -- can see the key is set without the key crossing the wire.
        if def.server_only then
            entry.server_only = true
            entry.stored      = value ~= nil and value ~= ""
        else
            entry.default = def.default
            entry.value   = value
        end

        entries[#entries + 1] = entry
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

--- The same snapshot with every server-only value dropped. Server VMs get the
--- full one through ggGenericFetch; anything bound for a client comes through
--- here first.
local function forClients(snapshot)
    local values = {}

    for path, value in pairs(snapshot.values) do
        if not isSecret(path) then values[path] = value end
    end

    return { revision = snapshot.revision, values = values }
end

-- What a log row may carry. The log page is readable by anyone holding the
-- logs tool, so a server-only setting records that it changed and by whom --
-- never what it changed from or to.
local HIDDEN = "<server only>"

local function loggable(path, value)
    if isSecret(path) then return HIDDEN end

    return value
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

    TriggerClientEvent("gg_lib:generic:sync", -1, forClients(payload))
end

exports("ggGenericFetch", function()
    local invoker = GetInvokingResource()

    if invoker and invoker ~= "gg_lib" then
        subscribers[invoker] = true
    end

    return GenericSettings.snapshot()
end)

lib.callback.register("gg_lib:generic:snapshot", function()
    return true, forClients(GenericSettings.snapshot())
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
        history[#history + 1] = { resource = PSEUDO, path = path, action = "change", old = loggable(path, previous[path]), new = loggable(path, value) }
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
            old = loggable(path, previous[path]), new = loggable(path, settings.deepCopy(schema[path].default)),
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
