--------------------------------------------------
-- MARK: Change Log
--------------------------------------------------

Logs = {}

-- A hard ceiling on top of the age cutoff, so a burst of edits inside the
-- retention window still cannot grow the table without bound.
local KEEP_ROWS = 5000
local DEFAULT_DAYS = 14

local trim_pending = false

local function retentionDays()
    local stored = GenericSettings and GenericSettings.get and GenericSettings.get("logs.retention_days")

    return math.max(math.floor(tonumber(stored) or DEFAULT_DAYS), 1)
end

local function trim()
    if trim_pending then return end
    trim_pending = true

    SetTimeout(5000, function()
        trim_pending = false

        pcall(MySQL.query.await,
            "DELETE FROM gg_studio_log WHERE changed_at < (NOW() - INTERVAL ? DAY)",
            { retentionDays() })

        pcall(MySQL.query.await, [[
            DELETE FROM gg_studio_log
            WHERE id <= (
                SELECT id FROM (
                    SELECT id FROM gg_studio_log ORDER BY id DESC LIMIT 1 OFFSET ?
                ) AS cutoff
            )
        ]], { KEEP_ROWS })
    end)
end

-- Rows also age out on their own, or a quiet server would keep them forever.
CreateThread(function()
    while true do
        Wait(6 * 60 * 60 * 1000)
        trim()
    end
end)

local MAX_VALUE = 4000

local function encode(value)
    if value == nil then return nil end

    local ok, encoded = pcall(json.encode, { v = value })
    if not ok then return nil end

    if #encoded > MAX_VALUE then
        local size = type(value) == "table" and #value or 0
        local summary = size > 0 and ("%d entries"):format(size) or "too large to record"

        encoded = json.encode({ v = ("<%s>"):format(summary) })
    end

    return encoded
end

--------------------------------------------------
-- MARK: Write
--------------------------------------------------

function Logs.write(rows, actor)
    if type(rows) ~= "table" or #rows == 0 then return false end

    local queries = {}

    for index = 1, #rows do
        local row = rows[index]

        if type(row) == "table" and type(row.resource) == "string" and type(row.path) == "string" then
            queries[#queries + 1] = {
                query = [[
                    INSERT INTO gg_studio_log (resource, path, action, old_value, new_value, actor)
                    VALUES (?, ?, ?, ?, ?, ?)
                ]],
                values = {
                    row.resource,
                    row.path,
                    row.action or "change",
                    encode(row.old),
                    encode(row.new),
                    actor or row.actor or "unknown",
                },
            }
        end
    end

    if #queries == 0 then return false end

    local ok, err = pcall(function()
        return MySQL.transaction.await(queries)
    end)

    if not ok then
        print(("^3[gg_lib] could not write %d log row(s): %s^0"):format(#queries, err))
        return false
    end

    trim()

    return true
end

exports("ggLogChange", function(rows, actor)
    local invoker = GetInvokingResource()

    if invoker then
        for index = 1, #(rows or {}) do
            if type(rows[index]) == "table" then rows[index].resource = invoker end
        end
    end

    return Logs.write(rows, actor)
end)

--------------------------------------------------
-- MARK: Read
--------------------------------------------------

local function decode(raw)
    if raw == nil then return nil end

    local ok, wrapper = pcall(json.decode, raw)
    if not ok or type(wrapper) ~= "table" then return nil end

    return wrapper.v
end

local PREVIEW_MAX = 120

--- One line for the table row. Every kind is capped, not just encoded tables:
--- a long string would otherwise stretch the row it is meant to fit inside.
local function preview(value)
    if value == nil then return nil end

    local kind = type(value)
    local text

    if kind == "boolean" then
        text = value and "On" or "Off"
    elseif kind == "number" or kind == "string" then
        text = tostring(value)
    else
        local ok, encoded = pcall(json.encode, value)
        text = ok and encoded or "?"
    end

    if #text > PREVIEW_MAX then return text:sub(1, PREVIEW_MAX - 3) .. "..." end

    return text
end

--- The untruncated value, laid out for the inspector rather than the row.
local function expand(value)
    if value == nil then return nil end

    local kind = type(value)

    if kind == "boolean" then return value and "On" or "Off" end
    if kind == "number" or kind == "string" then return tostring(value) end

    local ok, encoded = pcall(json.encode, value, { indent = true })
    if not ok then return "?" end

    return encoded
end

local PAGE_SIZE = 25
local MAX_PAGE_SIZE = 100

--- One page of history, newest first.
---
--- opts: page (1 based), size, search (matches actor, resource or path),
---       actor (exact match, from the filter list)
---
--- Returns rows, total, actors -- total drives the pager, and actors fills the
--- filter without a second round trip.
function Logs.page(opts)
    opts = type(opts) == "table" and opts or {}

    local size   = math.min(math.max(tonumber(opts.size) or PAGE_SIZE, 1), MAX_PAGE_SIZE)
    local page   = math.max(math.floor(tonumber(opts.page) or 1), 1)
    local offset = (page - 1) * size

    local search = type(opts.search) == "string" and opts.search:gsub("^%s+", ""):gsub("%s+$", "") or ""
    local actor  = type(opts.actor) == "string" and opts.actor ~= "" and opts.actor or nil

    -- Built rather than fixed, so an unused filter costs nothing in the query
    -- plan instead of being a no-op comparison on every row.
    local where, args = {}, {}

    if search ~= "" then
        local like = "%" .. search .. "%"
        where[#where + 1] = "(actor LIKE ? OR resource LIKE ? OR path LIKE ?)"
        args[#args + 1], args[#args + 2], args[#args + 3] = like, like, like
    end

    if actor then
        where[#where + 1] = "actor = ?"
        args[#args + 1] = actor
    end

    local clause = #where > 0 and (" WHERE " .. table.concat(where, " AND ")) or ""

    local rowArgs = {}
    for index = 1, #args do rowArgs[index] = args[index] end
    rowArgs[#rowArgs + 1] = size
    rowArgs[#rowArgs + 1] = offset

    local ok, rows = pcall(MySQL.query.await, [[
        SELECT id, resource, path, action, old_value, new_value, actor,
               DATE_FORMAT(changed_at, '%Y-%m-%d %H:%i') AS changed_at
        FROM gg_studio_log
    ]] .. clause .. [[
        ORDER BY id DESC
        LIMIT ? OFFSET ?
    ]], rowArgs)

    if not ok then return {}, 0, {} end

    local counted, total = pcall(MySQL.scalar.await,
        "SELECT COUNT(*) FROM gg_studio_log" .. clause, args)

    -- Every name that has ever changed something, for the filter. Cheap enough
    -- at the 5000 row ceiling the table is trimmed to.
    local listed, actors = pcall(MySQL.query.await, [[
        SELECT DISTINCT actor FROM gg_studio_log
        WHERE actor IS NOT NULL AND actor <> ''
        ORDER BY actor
    ]])

    local names = {}
    if listed then
        for _, row in ipairs(actors or {}) do names[#names + 1] = row.actor end
    end

    local out = {}

    for _, row in ipairs(rows or {}) do
        local old, new = decode(row.old_value), decode(row.new_value)

        out[#out + 1] = {
            id         = row.id,
            resource   = row.resource,
            path       = row.path,
            action     = row.action,
            actor      = row.actor,
            changed_at = row.changed_at,
            old        = preview(old),
            new        = preview(new),
            old_full   = expand(old),
            new_full   = expand(new),
        }
    end

    return out, counted and total or 0, names
end

lib.callback.register("gg_lib:logs:fetch", function(source, data)
    if not Admins.can(source, "logs") then
        print(("^3[gg_lib] blocked log fetch from %s^0"):format(Admins.actor(source)))
        return false
    end

    local rows, total, actors = Logs.page(data)

    return true, {
        rows      = rows,
        total     = total,
        actors    = actors,
        retention = retentionDays(),
    }
end)

lib.callback.register("gg_lib:logs:setRetention", function(source, days)
    if not Admins.can(source, "logs") then return false end

    local ok = GenericSettings.apply({ ["logs.retention_days"] = math.floor(tonumber(days) or DEFAULT_DAYS) }, Admins.actor(source))

    if ok then trim() end

    return ok == true
end)
