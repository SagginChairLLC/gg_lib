--------------------------------------------------
-- MARK: Change Log
--------------------------------------------------

Logs = {}

local KEEP_ROWS = 5000

local trim_pending = false

local function trim()
    if trim_pending then return end
    trim_pending = true

    SetTimeout(5000, function()
        trim_pending = false

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

local function preview(value)
    if value == nil then return nil end

    local kind = type(value)

    if kind == "boolean" then return value and "On" or "Off" end
    if kind == "number" or kind == "string" then return tostring(value) end

    local ok, encoded = pcall(json.encode, value)
    if not ok then return "?" end

    if #encoded > 120 then return encoded:sub(1, 117) .. "..." end

    return encoded
end

function Logs.recent(limit)
    limit = math.min(math.max(tonumber(limit) or 200, 1), 500)

    local ok, rows = pcall(MySQL.query.await, [[
        SELECT resource, path, action, old_value, new_value, actor,
               DATE_FORMAT(changed_at, '%Y-%m-%d %H:%i') AS changed_at
        FROM gg_studio_log
        ORDER BY id DESC
        LIMIT ?
    ]], { limit })

    if not ok then return {} end

    local out = {}

    for _, row in ipairs(rows or {}) do
        out[#out + 1] = {
            resource   = row.resource,
            path       = row.path,
            action     = row.action,
            actor      = row.actor,
            changed_at = row.changed_at,
            old        = preview(decode(row.old_value)),
            new        = preview(decode(row.new_value)),
        }
    end

    return out
end

lib.callback.register("gg_lib:logs:fetch", function(source, data)
    if not Admins.canEdit(source) then
        print(("^3[gg_lib] blocked log fetch from %s^0"):format(Admins.actor(source)))
        return false
    end

    return true, Logs.recent(data and data.limit)
end)
