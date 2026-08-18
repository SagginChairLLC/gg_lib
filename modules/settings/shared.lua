--------------------------------------------------
-- MARK: Settings Registry
--------------------------------------------------
-- gg_lib settings module (shared). A resource opts in with `gg_lib 'settings'`
-- in its fxmanifest and gains a database-backed config editor driven by
-- gg_lib's /jobsettings command.
--
-- Every tunable is declared once, and the declaration IS the config: it carries
-- the default, the type, the label and the help text that used to live in a
-- trailing comment. Defaults stay in Lua so a script update always ships its new
-- defaults; the database only ever stores the keys an admin actually changed.
--
-- Consumers are untouched -- declarations materialise into the same `cfg` table
-- the rest of the script already reads, so `cfg.settings.popup.position` keeps
-- working exactly as before.

settings = settings or {}
cfg = cfg or {}

settings.schema      = {}  -- path -> definition
settings.order       = {}  -- declaration order, so the editor reads top to bottom
settings.groups      = {}  -- group id -> meta
settings.group_order = {}

-- Identity of the owning script, shown in the editor's left-hand script list.
settings.info = {
    id    = GetCurrentResourceName(),
    label = GetCurrentResourceName(),
    icon  = "fa-gear",
    order = 100,
}

local derives  = {}
local listeners = {}
local resolved = false

-- This file is a shared_script, so it loads before core/lib brings gg.print into
-- existence -- and declarations run at that same early stage. Fall back to a
-- plain print until the logger is available.
local function logError(message)
    if gg and gg.print and gg.print.error then
        gg.print.error(message)
        return
    end

    print(("[ERROR] [settings] %s"):format(message))
end

local function logInfo(message)
    if gg and gg.print and gg.print.log then
        gg.print.log(message)
        return
    end

    print(("[settings] %s"):format(message))
end

--------------------------------------------------
-- MARK: Path Helpers
--------------------------------------------------

-- "settings.popup.meter_pos.x" -> { "settings", "popup", "meter_pos", "x" }
-- Numeric segments become numbers so array-shaped config ("levels.1.experience")
-- addresses the same slot Lua would.
local function splitPath(path)
    local parts = {}

    for part in string.gmatch(path, "[^%.%[%]]+") do
        parts[#parts + 1] = tonumber(part) or part
    end

    return parts
end

settings.splitPath = splitPath

local function deepCopy(value)
    if type(value) ~= "table" then return value end

    local copy = {}
    for key, entry in pairs(value) do
        copy[key] = deepCopy(entry)
    end

    return copy
end

settings.deepCopy = deepCopy

-- Read a dotted path out of any root table (defaults to `cfg`).
function settings.read(path, root)
    local node = root or cfg
    local parts = splitPath(path)

    for index = 1, #parts do
        if type(node) ~= "table" then return nil end
        node = node[parts[index]]
    end

    return node
end

-- Write a dotted path into any root table, building intermediate tables.
function settings.write(path, value, root)
    local node = root or cfg
    local parts = splitPath(path)

    for index = 1, #parts - 1 do
        local key = parts[index]

        if type(node[key]) ~= "table" then
            node[key] = {}
        end

        node = node[key]
    end

    node[parts[#parts]] = value

    return value
end

--------------------------------------------------
-- MARK: Validation
--------------------------------------------------
-- Every validator returns (ok, value_or_error). Coercion happens here too, so a
-- number arriving from the UI as the string "42" lands in `cfg` as 42.

local validators = {}

validators.boolean = function(_, value)
    if type(value) == "boolean" then return true, value end
    if value == "true"  then return true, true  end
    if value == "false" then return true, false end

    return false, "expected a true/false value"
end

validators.number = function(def, value)
    local number = tonumber(value)
    if not number then return false, "expected a number" end

    if def.min and number < def.min then
        return false, ("must be at least %s"):format(def.min)
    end

    if def.max and number > def.max then
        return false, ("must be at most %s"):format(def.max)
    end

    return true, number
end

validators.integer = function(def, value)
    local ok, number = validators.number(def, value)
    if not ok then return false, number end

    return true, math.floor(number + 0.5)
end

validators.percent = validators.number

-- Blip ids. The editor picks these from a list of the real game values, so the
-- server only has to reject anything outside the range a blip can hold -- a
-- hand-crafted payload, or a row left by an older schema.
validators.blipcolor = function(_, value)
    local number = tonumber(value)
    if not number then return false, "expected a blip color" end

    number = math.floor(number)
    if number < 0 or number > 85 then return false, "is not a blip color (0-85)" end

    return true, number
end

-- A ped model name. The editor offers the known list, but an addon or custom
-- ped is a perfectly good answer and cannot be enumerated, so this checks the
-- shape rather than membership: a bare model name, no spaces.
validators.ped = function(_, value)
    if type(value) ~= "string" then return false, "expected a ped model name" end

    local model = value:gsub("%s", "")
    if model == "" then return false, "cannot be empty" end

    if not model:match("^[%w_]+$") then
        return false, "is not a model name (letters, numbers and underscores only)"
    end

    return true, model:lower()
end

-- Same shape rule as a ped: the known list can never cover addon vehicles, so
-- this checks that it looks like a model name rather than that it is a real one.
validators.vehicle = validators.ped

-- A world position with a facing. Picked in game rather than typed, but still
-- validated here -- the editor is not the only thing that can send one.
validators.coords = function(_, value)
    local kind = type(value)

    -- A vector is not a table as far as type() is concerned, and a script
    -- declaring `default = vector4(...)` is the natural thing to write.
    if kind ~= "table" and kind ~= "userdata" and kind ~= "vector3" and kind ~= "vector4" then
        return false, "expected a position"
    end

    local out = {}

    for _, key in ipairs({ "x", "y", "z" }) do
        local number = tonumber(value[key])
        if not number then return false, ("is missing its %s"):format(key) end

        out[key] = number
    end

    -- vector4 spells the facing `w`; the stored shape spells it `heading`. Read
    -- either, so a script can declare `default = vector4(...)` and have it work.
    local heading = tonumber(value.heading) or tonumber(value.w) or 0
    out.heading = heading % 360

    return true, out
end

validators.blipsprite = function(_, value)
    local number = tonumber(value)
    if not number then return false, "expected a blip sprite" end

    number = math.floor(number)
    if number < 0 then return false, "is not a blip sprite" end

    return true, number
end

validators.string = function(def, value)
    if type(value) ~= "string" then return false, "expected text" end

    if def.max_length and #value > def.max_length then
        return false, ("must be %s characters or fewer"):format(def.max_length)
    end

    if def.pattern and not string.match(value, def.pattern) then
        return false, def.pattern_help or "does not match the required format"
    end

    return true, value
end

validators.enum = function(def, value)
    for _, option in ipairs(def.options or {}) do
        local candidate = type(option) == "table" and option.value or option
        if candidate == value then return true, value end
    end

    return false, "is not one of the allowed options"
end

-- Accepts "#fefefe", "rgb(252, 186, 3)" and "rgba(252, 186, 3, 0.5)" -- the same
-- formats cfg.settings.ui_theme already documents.
validators.color = function(_, value)
    if type(value) ~= "string" then return false, "expected a color string" end

    if string.match(value, "^#%x%x%x%x%x%x$")
        or string.match(value, "^#%x%x%x$")
        or string.match(value, "^rgba?%(%s*%d+%s*,%s*%d+%s*,%s*%d+%s*[,%)]")
    then
        return true, value
    end

    return false, "expected a hex or rgb() color"
end

-- "HH:MM" on a 24 hour clock, as cfg.settings.reset_time.daily uses.
validators.time = function(_, value)
    if type(value) ~= "string" then return false, "expected a HH:MM time" end

    local hour, minute = string.match(value, "^(%d%d?):(%d%d)$")
    if not hour then return false, "expected a HH:MM time" end

    hour, minute = tonumber(hour), tonumber(minute)
    if hour > 23 or minute > 59 then return false, "is not a valid time of day" end

    return true, ("%02d:%02d"):format(hour, minute)
end

validators.keybind = function(_, value)
    if type(value) ~= "string" or #value == 0 then return false, "expected a key" end

    return true, string.upper(value)
end

-- A fixed-shape table: `fields` describes each key, and unknown keys are dropped
-- rather than merged, so a tampered payload cannot smuggle extra data into cfg.
validators.object = function(def, value)
    if type(value) ~= "table" then return false, "expected a group of values" end

    local out = {}

    for _, field in ipairs(def.fields or {}) do
        local raw = settings.read(field.key, value)

        -- A nullable field is *meant* to be absent sometimes: an unset clothing
        -- slot means "leave the ped's own item alone", which gg.player.setClothing
        -- distinguishes from -1 ("clear it"). So a missing key is the value here,
        -- not a gap to backfill from the default -- and because the whole object
        -- is stored as one row, the absent key survives the JSON round-trip.
        if field.nullable then
            if raw ~= nil and raw ~= false then
                local ok, result = settings.validate(field, raw)
                if not ok then
                    return false, ("%s %s"):format(field.label or field.key, result)
                end

                settings.write(field.key, result, out)
            end

            goto continue
        end

        if raw == nil then
            raw = settings.read(field.key, def.default or {})
        end

        if raw ~= nil then
            local ok, result = settings.validate(field, raw)
            if not ok then
                return false, ("%s %s"):format(field.label or field.key, result)
            end

            settings.write(field.key, result, out)
        end

        ::continue::
    end

    return true, out
end

-- An array of rows, each validated against the same `item` field list.
validators.list = function(def, value)
    if type(value) ~= "table" then return false, "expected a list" end

    if def.min_items and #value < def.min_items then
        return false, ("needs at least %s entries"):format(def.min_items)
    end

    if def.max_items and #value > def.max_items then
        return false, ("allows at most %s entries"):format(def.max_items)
    end

    local out = {}

    for index = 1, #value do
        local row = value[index]

        -- A list of plain scalars (cfg.riderScenes) rather than of objects.
        if not def.item then
            local ok, result = settings.validate({ type = def.item_type or "string" }, row)
            if not ok then
                return false, ("entry %d %s"):format(index, result)
            end

            out[index] = result
        else
            local ok, result = validators.object({ fields = def.item, default = def.item_default }, row)
            if not ok then
                return false, ("entry %d: %s"):format(index, result)
            end

            out[index] = result
        end
    end

    return true, out
end

settings.validators = validators

-- Validate a value against a definition. Unknown types pass through untouched so
-- a script can declare a bespoke type and handle it in its own UI.
function settings.validate(def, value)
    local validator = validators[def.type or "string"]
    if not validator then return true, value end

    return validator(def, value)
end

--------------------------------------------------
-- MARK: Declaration
--------------------------------------------------

-- Identify the owning script. Called once per resource.
function settings.script(info)
    for key, value in pairs(info or {}) do
        settings.info[key] = value
    end

    return settings.info
end

-- Declare a section of the editor. Groups render in declaration order.
function settings.group(id, meta)
    if settings.groups[id] then
        for key, value in pairs(meta or {}) do
            settings.groups[id][key] = value
        end

        return settings.groups[id]
    end

    settings.groups[id] = {
        id    = id,
        label = (meta and meta.label) or id,
        icon  = meta and meta.icon,
        help  = meta and meta.help,
    }

    settings.group_order[#settings.group_order + 1] = id

    return settings.groups[id]
end

-- Declare one setting. `path` is where it lives in `cfg`; `def.default` seeds it
-- immediately so the rest of the script can read `cfg` at file scope as before.
-- `def.renamed_from = "old.path"` (or a list of them) migrates a stored
-- override from the old path on boot, so renaming a setting keeps its value.
function settings.define(path, def)
    if settings.schema[path] then
        logError(("Setting '%s' declared twice"):format(path))
        return
    end

    def.path  = path
    def.type  = def.type or "string"
    def.group = def.group or "general"
    def.label = def.label or path

    -- Live by default: most tunables can be swapped without a restart. Anything
    -- read once at spawn (blips, target zones) opts out with live = false and the
    -- editor badges it as restart-required instead of silently doing nothing.
    if def.live == nil then def.live = true end

    if not settings.groups[def.group] then
        settings.group(def.group, { label = def.group })
    end

    settings.schema[path] = def
    settings.order[#settings.order + 1] = path

    settings.write(path, deepCopy(def.default))

    return def
end

--------------------------------------------------
-- MARK: Derived Data
--------------------------------------------------
-- MARK: Table Shapes
--------------------------------------------------
-- The layouts that recur across scripts. A script says what shape its data is
-- and the editor renders it -- there is nothing script-specific in here, and
-- nothing in the editor that knows what a taxi is.
--
-- A script is free to declare a list by hand; these exist so the common ones
-- come out consistent, and so a fix here reaches every script at once.

settings.shape = {}
settings.column = {}

local function shaped(base, def)
    local out = {}

    for key, value in pairs(base) do out[key] = value end
    for key, value in pairs(def or {}) do out[key] = value end

    return out
end

--- A list of world positions: spawn points, patrol routes, pickup spots.
--- Rows are placed in game, pasted in bulk or typed.
function settings.shape.positions(def)
    return shaped({ type = "list", item_type = "coords" }, def)
end

--- A list of bare strings: scenario names, animation dictionaries, item names.
function settings.shape.strings(def)
    return shaped({ type = "list", item_type = "string" }, def)
end

--- A list of records. `item` names the columns, and a column may itself be a
--- nested list -- which is how a location carries its own positions.
function settings.shape.rows(def)
    return shaped({ type = "list" }, def)
end

--------------------------------------------------
-- Columns a record tends to have.
--------------------------------------------------

--- The key a row is stored under. Renaming one re-keys the entry, so scripts
--- should say in `help` what the id has to line up with.
function settings.column.id(help)
    return { key = "id", label = "ID", type = "string", help = help }
end

function settings.column.label(label)
    return { key = "label", label = label or "Name", type = "string" }
end

function settings.column.level(label)
    return { key = "level", label = label or "Unlocks At Level", type = "integer", min = 1 }
end

--- Positions hanging off a record.
---
--- Nullable on purpose: a row stored before this column existed keeps whatever
--- positions it already has, instead of the validator backfilling it to empty
--- and wiping them on the next boot.
function settings.column.positions(key, label)
    return { key = key, label = label, type = "list", item_type = "coords", nullable = true }
end

--------------------------------------------------
-- Several config files compile data out of the raw tables -- tier ids, level
-- unlock lists, vehicle ids. That work cannot run at file scope any more,
-- because database overrides land after every file has loaded. Register it here
-- and it runs once overrides are applied, and again whenever an override that
-- feeds it changes.

function settings.derive(fn)
    derives[#derives + 1] = fn

    -- A derive registered after the first resolve (a late-loading file) still
    -- needs to run, or its compiled data would never exist.
    if resolved then
        local ok, err = pcall(fn)
        if not ok then
            logError(("Settings derive failed: %s"):format(err))
        end
    end
end

local function runDerives()
    for index = 1, #derives do
        local ok, err = pcall(derives[index])
        if not ok then
            logError(("Settings derive failed: %s"):format(err))
        end
    end
end

-- Subscribe to live changes. Handlers receive the full list of changed paths so
-- a single rebuild can cover a batch save rather than firing per key.
function settings.onChange(fn)
    listeners[#listeners + 1] = fn
end

function settings.isResolved()
    return resolved
end

--------------------------------------------------
-- MARK: Overlay
--------------------------------------------------

-- Apply a map of { [path] = value } over the declared defaults.
--
-- This is the ONE place a fallback happens. Every stored value is checked
-- against its declaration here, and anything that fails -- wrong type, out of
-- range, a row left by an older schema, a hand-edited database -- is replaced
-- with the Lua default rather than written through. Past this point `cfg` only
-- ever holds values that satisfy the schema, which is why no call site
-- downstream needs a fallback of its own.
--
-- Rejections are always logged. A silently ignored row is indistinguishable
-- from a setting that never saved, and that is a miserable thing to debug.
function settings.apply(overrides)
    local changed = {}

    for path, value in pairs(overrides or {}) do
        local def = settings.schema[path]

        if def then
            local ok, result = settings.validate(def, value)

            if ok then
                settings.write(path, result)
            else
                settings.write(path, deepCopy(def.default))
                logError(("Stored value for '%s' %s -- falling back to the default"):format(path, result))
            end

            changed[#changed + 1] = path
        end
    end

    return changed
end

-- First-load path: overlay the stored overrides, compile derived data, then let
-- the script know config is final.
function settings.resolve(overrides)
    local applied = settings.apply(overrides)

    -- Says plainly whether the stored rows reached cfg. "0 stored override(s)"
    -- after saving something means the write never landed, not that it was
    -- rejected -- the two used to look identical from the console.
    if #applied > 0 then
        logInfo(("Settings: applied %d stored override(s)"):format(#applied))
    end

    runDerives()

    resolved = true

    -- Change handlers fire for the first load too, and this is load-bearing.
    --
    -- Stored values arrive late: the store has to round-trip the database (and
    -- on a client, the server) before resolve runs, while a script's own files
    -- have already run and its `<resource>:onResourceStart` has already fired.
    -- Anything built from cfg at that point -- a ped, a blip, a zone -- was
    -- built from the Lua defaults, because the stored values did not exist yet.
    --
    -- Without this, such a thing rebuilds when an admin edits a setting but
    -- never when the same value is loaded from the database at boot, so the
    -- edit appears to work and then reverts on the next restart. Firing here
    -- means anything that rebuilds on change also rebuilds when the real
    -- values land, which is the same contract settings.generic.onChange keeps.
    if #applied > 0 then
        for index = 1, #listeners do
            local ok, err = pcall(listeners[index], applied)
            if not ok then
                logError(("Settings change handler failed on resolve: %s"):format(err))
            end
        end

        TriggerEvent("gg_settings:changed", applied)
    end

    TriggerEvent("gg_settings:resolved")
end

-- Live path: overlay a change that arrived after boot, recompile, and notify.
function settings.applyLive(overrides)
    local changed = settings.apply(overrides)
    if #changed == 0 then return changed end

    runDerives()

    for index = 1, #listeners do
        local ok, err = pcall(listeners[index], changed)
        if not ok then
            logError(("Settings change handler failed: %s"):format(err))
        end
    end

    TriggerEvent("gg_settings:changed", changed)

    return changed
end

--------------------------------------------------
-- MARK: Generic Settings
--------------------------------------------------
-- Studio-wide values (theme, currency) served by gg_lib's store rather than
-- this resource's. They land under cfg.generic so consumers read them like any
-- other config -- cfg.generic.general.currency_type -- and live edits arrive
-- through the same overlay shape as the script's own settings. The generic
-- schema lives only in gg_lib: payloads arrive pre-validated, so this side
-- just writes and notifies.

local generic_listeners = {}
local generic_revision  = -1
local generic_resolved  = false

settings.generic = {}

-- Zone -> offset from UTC in seconds. Lives here rather than in gg_lib's store
-- so the script resolving a reset time uses the same table the editor offered
-- the choice from; a zone list and a zone lookup that disagree is a silent
-- hour-out-of-place bug.
settings.timezones = {
    UTC = 0, GMT = 0,
    EST = -5 * 3600, CST = -6 * 3600, MST = -7 * 3600, PST = -8 * 3600,
    AKST = -9 * 3600, HST = -10 * 3600,
    EDT = -4 * 3600, CDT = -5 * 3600, MDT = -6 * 3600, PDT = -7 * 3600,
    CET = 1 * 3600, EET = 2 * 3600, WET = 0,
    IST = 5.5 * 3600, CST_China = 8 * 3600, JST = 9 * 3600, KST = 9 * 3600,
    AEST = 10 * 3600, ACST = 9.5 * 3600, AWST = 8 * 3600,
}

-- Read one generic value; nil until the first payload from gg_lib lands.
-- The guard matters: settings.read falls back to the script's own cfg when the
-- root is nil, so before hydration this would answer from the wrong table.
function settings.generic.get(path)
    if not cfg.generic then return nil end

    return settings.read(path, cfg.generic)
end

-- The studio's daily rollover, resolved for a script that needs to schedule
-- against it. Returns hour, minute and the zone's offset from UTC in seconds,
-- so every script rolls over at the same moment instead of each parsing the
-- time and looking up the zone its own way.
function settings.generic.dailyReset()
    local clock = settings.generic.get("reset.daily_time") or "00:00"
    local zone  = settings.generic.get("reset.timezone")

    local hour, minute = clock:match("^(%d%d?):(%d%d)$")

    return tonumber(hour) or 0, tonumber(minute) or 0, settings.timezones[zone] or 0
end

function settings.generic.isResolved()
    return generic_resolved
end

-- Same contract as settings.onChange: handlers receive the changed-path list.
-- The first applied payload counts as a change, so a handler registered at file
-- scope runs as soon as real values exist. Listeners stay VM-local on purpose:
-- every GG script applies its own copy of a generic push, so a cross-resource
-- event here would fire once per running script.
function settings.generic.onChange(fn)
    generic_listeners[#generic_listeners + 1] = fn
end

-- Overlay a { revision, values = { [path] = value } } payload from gg_lib --
-- the full set on hydration, changed paths only on a live push.
function settings.generic.apply(payload)
    if type(payload) ~= "table" or type(payload.values) ~= "table" then return {} end

    -- Out-of-order or replayed pushes are dropped rather than applied backwards.
    -- A re-fetch after a gg_lib restart arrives with an unchanged revision and
    -- is dropped here too, which is correct: values cannot move while gg_lib --
    -- the only writer -- is down.
    local revision = tonumber(payload.revision)
    if revision and revision <= generic_revision then return {} end
    if revision then generic_revision = revision end

    cfg.generic = cfg.generic or {}

    local changed = {}

    for path, value in pairs(payload.values) do
        settings.write(path, value, cfg.generic)
        changed[#changed + 1] = path
    end

    generic_resolved = true

    if #changed == 0 then return changed end

    for index = 1, #generic_listeners do
        local ok, err = pcall(generic_listeners[index], changed)
        if not ok then
            logError(("Generic settings change handler failed: %s"):format(err))
        end
    end

    return changed
end

--------------------------------------------------
-- MARK: Description
--------------------------------------------------

-- The payload the editor renders: schema plus current values. Kept flat and
-- serialisable so it can cross a resource boundary or an NUI message unchanged.
-- `def.hidden` is a predicate run per describe, so a setting can drop out of
-- the editor when something else makes it irrelevant -- a script's own theme
-- color while the studio theme is applied to everything, say. The value stays
-- in cfg either way; only the row disappears.
local function isHidden(def)
    if not def.hidden then return false end

    local ok, hidden = pcall(def.hidden)
    if not ok then
        logError(("Settings '%s' hidden check failed: %s"):format(def.path, hidden))
        return false
    end

    return hidden == true
end

function settings.describe()
    local entries = {}

    for index = 1, #settings.order do
        local path = settings.order[index]
        local def  = settings.schema[path]

        if isHidden(def) then goto continue end

        entries[#entries + 1] = {
            path        = path,
            label       = def.label,
            help        = def.help,
            type        = def.type,
            group       = def.group,
            options     = def.options,
            fields      = def.fields,
            item        = def.item,
            item_type   = def.item_type,
            item_default= def.item_default,
            min_items   = def.min_items,
            max_items   = def.max_items,
            min         = def.min,
            max         = def.max,
            max_length  = def.max_length,
            step        = def.step,
            suffix      = def.suffix,
            docs        = def.docs,
            preview_from= def.preview_from,
            live        = def.live,
            advanced    = def.advanced,
            default     = def.default,
            value       = settings.read(path),
        }

        ::continue::
    end

    local groups = {}
    for index = 1, #settings.group_order do
        groups[#groups + 1] = settings.groups[settings.group_order[index]]
    end

    return {
        resource = settings.info.id,
        label    = settings.info.label,
        icon     = settings.info.icon,
        order    = settings.info.order,
        -- fxmanifest version, shown next to the config revision so an admin can
        -- report exactly which script build their settings were made against.
        version  = GetResourceMetadata(settings.info.id, "version", 0),
        groups   = groups,
        entries  = entries,
    }
end
