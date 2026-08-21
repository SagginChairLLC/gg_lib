--------------------------------------------------
-- MARK: Settings Registry
--------------------------------------------------

settings = settings or {}
cfg = cfg or {}

settings.schema      = {}  -- path -> definition
settings.order       = {}  -- declaration order, so the editor reads top to bottom
settings.groups      = {}  -- group id -> meta
settings.group_order = {}

settings.info = {
    id    = GetCurrentResourceName(),
    label = GetCurrentResourceName(),
    icon  = "fa-gear",
    order = 100,
}

local derives  = {}
local listeners = {}
local resolved = false

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

-- Routine boot chatter (nobody asked for it, it happens on every start) goes
-- here so a normal console stays quiet. Only prints under utility.debugMode.
-- Anything a person actually did -- storing, resetting, pruning -- stays on
-- logInfo so the audit trail is always visible.
local function logDebug(message)
    if gg and gg.print and gg.print.debug then
        gg.print.debug(message)
    end
end

--------------------------------------------------
-- MARK: Path Helpers
--------------------------------------------------

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

function settings.read(path, root)
    local node = root or cfg
    local parts = splitPath(path)

    for index = 1, #parts do
        if type(node) ~= "table" then return nil end
        node = node[parts[index]]
    end

    return node
end

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

validators.blipcolor = function(_, value)
    local number = tonumber(value)
    if not number then return false, "expected a blip color" end

    number = math.floor(number)
    if number < 0 or number > 85 then return false, "is not a blip color (0-85)" end

    return true, number
end

validators.ped = function(_, value)
    if type(value) ~= "string" then return false, "expected a ped model name" end

    local model = value:gsub("%s", "")
    if model == "" then return false, "cannot be empty" end

    if not model:match("^[%w_]+$") then
        return false, "is not a model name (letters, numbers and underscores only)"
    end

    return true, model:lower()
end

validators.vehicle = validators.ped

--- An outfit: a body per gender, each with component and prop slots.
---
--- A slot with no drawable is kept rather than dropped. Unset means "leave
--- whatever the player already had", which is a different instruction from
--- zero, and collapsing the two would shave everyone bald the first time a
--- uniform was handed out.
local function outfitSlots(value)
    if type(value) ~= "table" then return {} end

    local out = {}

    for name, slot in pairs(value) do
        if type(name) == "string" and type(slot) == "table" then
            local drawable = tonumber(slot.drawable)

            -- A texture with no garment under it changes nothing, so it is not
            -- kept: what is stored is exactly what will be applied.
            if drawable then
                out[name] = {
                    drawable = math.floor(drawable),
                    texture  = math.max(0, math.floor(tonumber(slot.texture) or 0)),
                }
            end
        end
    end

    return out
end

validators.outfit = function(_, value)
    if type(value) ~= "table" then return false, "expected an outfit" end

    local out = {}

    for _, gender in ipairs({ "male", "female" }) do
        local body = value[gender]

        out[gender] = {
            components = outfitSlots(type(body) == "table" and body.components or nil),
            props      = outfitSlots(type(body) == "table" and body.props or nil),
        }
    end

    return true, out
end

--- An inventory name. Same shape as a model name, and deliberately not
--- checked against the running inventory: a script may be configured before
--- the item exists, and refusing to store it would make that unfixable.
validators.item = function(_, value)
    if type(value) ~= "string" then return false, "expected an item name" end

    local name = value:gsub("%s", "")
    if name == "" then return false, "cannot be empty" end

    if not name:match("^[%w_]+$") then
        return false, "is not an item name (letters, numbers and underscores only)"
    end

    return true, name:lower()
end

validators.coords = function(_, value)
    local kind = type(value)

    if kind ~= "table" and kind ~= "userdata" and kind ~= "vector3" and kind ~= "vector4" then
        return false, "expected a position"
    end

    local out = {}

    for _, key in ipairs({ "x", "y", "z" }) do
        local number = tonumber(value[key])
        if not number then return false, ("is missing its %s"):format(key) end

        out[key] = number
    end

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

validators.object = function(def, value)
    if type(value) ~= "table" then return false, "expected a group of values" end

    local out = {}

    for _, field in ipairs(def.fields or {}) do
        local raw = settings.read(field.key, value)

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

function settings.validate(def, value)
    local validator = validators[def.type or "string"]
    if not validator then return true, value end

    return validator(def, value)
end

--------------------------------------------------
-- MARK: Declaration
--------------------------------------------------

--- What a script needs from the server before it can work: items the running
--- inventory has to carry, resources that have to be started.
---
--- A need is a name, or a table with a reason attached. Optional ones are
--- worth mentioning but will not stop anything:
---
---   settings.requires({
---       items     = { "bandage", { name = "radio", why = "Called between fares" } },
---       resources = { "ox_target", { name = "gg_phone", optional = true } },
---   })
---
--- Nothing is checked here. Declaring is this script's job; checking against
--- the live server is the studio's, because that is what knows the inventory.
local function normalizeNeeds(list)
    if type(list) ~= "table" then return {} end

    local out = {}

    for index = 1, #list do
        local need = list[index]

        if type(need) == "string" and need ~= "" then
            out[#out + 1] = { name = need }
        elseif type(need) == "table" and type(need.name) == "string" and need.name ~= "" then
            out[#out + 1] = {
                name     = need.name,
                why      = type(need.why) == "string" and need.why or nil,
                optional = need.optional == true or nil,
            }
        end
    end

    return out
end

function settings.requires(spec)
    settings.info.requires = {
        items     = normalizeNeeds(spec and spec.items),
        resources = normalizeNeeds(spec and spec.resources),
    }

    return settings.info.requires
end

function settings.script(info)
    for key, value in pairs(info or {}) do
        if key == "requires" then
            settings.requires(value)
        else
            settings.info[key] = value
        end
    end

    return settings.info
end

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

--- Whether a path's value must never leave the server: upload keys, tokens,
--- anything a player has no business holding. Marked with `server_only = true`
--- on the definition.
function settings.isSecret(path)
    local def = settings.schema[path]

    return def ~= nil and def.server_only == true
end

function settings.define(path, def)
    if settings.schema[path] then
        logError(("Setting '%s' declared twice"):format(path))
        return
    end

    def.path  = path
    def.type  = def.type or "string"
    def.group = def.group or "general"
    def.label = def.label or path

    if def.live == nil then def.live = true end

    -- The definition ships to both VMs -- a config file is a shared script --
    -- so a default holding a real secret is on every client's disk before this
    -- ever runs. The value belongs in the settings page, never in the config.
    if def.server_only and def.default ~= nil and def.default ~= "" then
        logError(("Setting '%s' is server only but ships a default value; set it on the settings page instead"):format(path))
    end

    if not settings.groups[def.group] then
        settings.group(def.group, { label = def.group })
    end

    settings.schema[path] = def
    settings.order[#settings.order + 1] = path

    -- Nothing is seeded on the client for a server-only path. A client reading
    -- one gets nil, which is the truth, rather than a default that looks like
    -- the real value and silently is not.
    if def.server_only and not IsDuplicityVersion() then
        return def
    end

    settings.write(path, deepCopy(def.default))

    return def
end

--------------------------------------------------
-- MARK: Derived Data
--------------------------------------------------
-- MARK: Table Shapes
--------------------------------------------------

--- Where money goes. Every framework bridge speaks these three names and
--- maps them to whatever the framework calls them, so a setting that picks
--- an account uses this rather than listing its own and forgetting one.
settings.accounts = {
    { value = "cash",  label = "Cash" },
    { value = "bank",  label = "Bank" },
    { value = "black", label = "Black Money" },
}


settings.shape = {}
settings.column = {}
--- A field that picks an account, ready to drop into a list or an object.
function settings.column.account(key, label)
    return {
        key     = key or "account",
        label   = label or "Account",
        type    = "enum",
        options = settings.accounts,
    }
end

local function shaped(base, def)
    local out = {}

    for key, value in pairs(base) do out[key] = value end
    for key, value in pairs(def or {}) do out[key] = value end

    return out
end

function settings.shape.positions(def)
    return shaped({ type = "list", item_type = "coords" }, def)
end

function settings.shape.strings(def)
    return shaped({ type = "list", item_type = "string" }, def)
end

function settings.shape.rows(def)
    return shaped({ type = "list" }, def)
end

--------------------------------------------------
--------------------------------------------------

function settings.column.id(help)
    return { key = "id", label = "ID", type = "string", help = help }
end

function settings.column.label(label)
    return { key = "label", label = label or "Name", type = "string" }
end

function settings.column.level(label)
    return { key = "level", label = label or "Unlocks At Level", type = "integer", min = 1 }
end

---
--- A list of world positions on a table row.
--- @param options table optional { model = "taxi", gap = 4.0 } -- the entity the
---        world editor stands in for each point, and the closest two may sit.
--- An area on a table row: the corners of a polygon, edited as a zone rather
--- than as loose points. It encloses nothing until it has three corners.
function settings.column.zone(key, label)
    return {
        key = key,
        label = label,
        type = "list",
        item_type = "coords",
        nullable = true,
        edit_mode = "polygon",
    }
end

function settings.column.positions(key, label, options)
    options = options or {}

    return {
        key = key,
        label = label,
        type = "list",
        item_type = "coords",
        nullable = true,
        preview_model = options.model,
        min_gap = options.gap,
    }
end

--------------------------------------------------

function settings.derive(fn)
    derives[#derives + 1] = fn

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

function settings.onChange(fn)
    listeners[#listeners + 1] = fn
end

function settings.isResolved()
    return resolved
end

--------------------------------------------------
-- MARK: Overlay
--------------------------------------------------

-- A list setting stores the WHOLE list as one override, which would shadow
-- any entry later added to the shipped default. merge_key names the row's
-- identity field: stored rows stay authoritative (edits, order, tuning), and
-- default rows whose key is absent from the store are appended -- so content
-- added to the config keeps surfacing in the editor even while an override
-- exists. The flip side is deliberate: a config-shipped row deleted in the
-- editor comes back on the next resolve. Removing shipped content for good
-- means removing it from the config default.
local function mergeKeyedDefaults(def, value)
    if type(value) ~= "table" then return value end

    local present = {}

    for index = 1, #value do
        local row = value[index]

        if type(row) == "table" and row[def.merge_key] ~= nil then
            present[row[def.merge_key]] = true
        end
    end

    for _, row in ipairs(def.default or {}) do
        if type(row) == "table" and row[def.merge_key] ~= nil and not present[row[def.merge_key]] then
            value[#value + 1] = deepCopy(row)
        end
    end

    return value
end

function settings.apply(overrides)
    local changed = {}

    for path, value in pairs(overrides or {}) do
        local def = settings.schema[path]

        if def then
            local ok, result = settings.validate(def, value)

            if ok then
                if def.merge_key then
                    result = mergeKeyedDefaults(def, result)
                end

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

function settings.resolve(overrides)
    local applied = settings.apply(overrides)

    if #applied > 0 then
        logDebug(("Settings: applied %d stored override(s)"):format(#applied))
    end

    runDerives()

    resolved = true

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

local generic_listeners = {}
local generic_revision  = -1
local generic_resolved  = false

settings.generic = {}

settings.timezones = {
    UTC = 0, GMT = 0,
    EST = -5 * 3600, CST = -6 * 3600, MST = -7 * 3600, PST = -8 * 3600,
    AKST = -9 * 3600, HST = -10 * 3600,
    EDT = -4 * 3600, CDT = -5 * 3600, MDT = -6 * 3600, PDT = -7 * 3600,
    CET = 1 * 3600, EET = 2 * 3600, WET = 0,
    IST = 5.5 * 3600, CST_China = 8 * 3600, JST = 9 * 3600, KST = 9 * 3600,
    AEST = 10 * 3600, ACST = 9.5 * 3600, AWST = 8 * 3600,
}

function settings.generic.get(path)
    if not cfg.generic then return nil end

    return settings.read(path, cfg.generic)
end

function settings.generic.dailyReset()
    local clock = settings.generic.get("reset.daily_time") or "00:00"
    local zone  = settings.generic.get("reset.timezone")

    local hour, minute = clock:match("^(%d%d?):(%d%d)$")

    return tonumber(hour) or 0, tonumber(minute) or 0, settings.timezones[zone] or 0
end

function settings.generic.isResolved()
    return generic_resolved
end

function settings.generic.onChange(fn)
    generic_listeners[#generic_listeners + 1] = fn
end

function settings.generic.apply(payload)
    if type(payload) ~= "table" or type(payload.values) ~= "table" then return {} end

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

--- Whether a stored secret is actually set, without saying what it is.
local function isFilled(value)
    return value ~= nil and value ~= ""
end

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

        local entry = {
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
            weight_key  = def.weight_key,
            max_items   = def.max_items,
            min         = def.min,
            max         = def.max,
            max_length  = def.max_length,
            step        = def.step,
            suffix      = def.suffix,
            docs        = def.docs,
            preview_from= def.preview_from,
            preview_model= def.preview_model,
            min_gap     = def.min_gap,
            edit_mode   = def.edit_mode,
            live        = def.live,
            advanced    = def.advanced,
        }

        -- This payload goes to a player's UI. A server-only entry carries no
        -- value and no default, only whether something is stored, so an owner
        -- can see the key is set without the key crossing the wire.
        if def.server_only then
            entry.server_only = true
            entry.stored      = isFilled(settings.read(path))
        else
            entry.default = def.default
            entry.value   = settings.read(path)
        end

        entries[#entries + 1] = entry

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
        version  = GetResourceMetadata(settings.info.id, "version", 0),
        groups   = groups,
        entries  = entries,
        requires = settings.info.requires,
    }
end
