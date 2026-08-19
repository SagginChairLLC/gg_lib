--------------------------------------------------
-- MARK: Roles
--------------------------------------------------
-- What an admin is allowed to do, rather than whether they are one. Three roles
-- ship; a server owner can add more and say exactly which scripts each may read
-- and change.

Roles = {}

local ALL = "*"

--- The studio pages a role can be given, beyond the scripts themselves.
Roles.tools = {
    { id = "logs",      label = "Logs",      icon = "fa-clock-rotate-left" },
    { id = "bridges",   label = "Bridges",   icon = "fa-plug" },
    { id = "minigames", label = "Minigames", icon = "fa-gamepad" },
    { id = "items",     label = "Items",     icon = "fa-boxes-stacked" },
    { id = "vehicles",  label = "Vehicles",  icon = "fa-car" },
}

local function toolSet(...)
    local out = {}

    for _, id in ipairs({ ... }) do out[id] = true end

    return out
end

--------------------------------------------------
-- MARK: Built-ins
--------------------------------------------------
-- Shipped rather than stored: a server whose database is empty still has a way
-- back in, and the owner role can never be edited into locking everyone out.

local BUILTIN = {
    {
        id      = "god",
        label   = "Owner",
        icon    = "fa-crown",
        help    = "Everything, including who else gets in. Cannot be edited.",
        order   = 1,
        locked  = true,
        permissions = {
            manage_admins = true,
            view = ALL,
            edit = ALL,
            tools = toolSet("logs", "bridges", "minigames", "items", "vehicles"),
        },
    },
    {
        id      = "admin",
        label   = "Admin",
        icon    = "fa-user-shield",
        help    = "Every script and every tool, but cannot change who has access.",
        order   = 2,
        permissions = {
            manage_admins = false,
            view = ALL,
            edit = ALL,
            tools = toolSet("logs", "bridges", "minigames", "items", "vehicles"),
        },
    },
    {
        id      = "moderator",
        label   = "Moderator",
        icon    = "fa-eye",
        help    = "Can open the studio and read every setting, but changes nothing.",
        order   = 3,
        permissions = {
            manage_admins = false,
            view = ALL,
            edit = {},
            tools = toolSet("logs"),
        },
    },
}

Roles.DEFAULT = "admin"
Roles.OWNER   = "god"

local builtinById = {}

for _, role in ipairs(BUILTIN) do builtinById[role.id] = role end

local custom = {}

--------------------------------------------------
-- MARK: Shape
--------------------------------------------------

local function scopeOf(value)
    if value == ALL then return ALL end

    local out = {}

    if type(value) == "table" then
        for key, allowed in pairs(value) do
            -- Accepts both { gg_taxijob = true } and { "gg_taxijob" }.
            if allowed == true and type(key) == "string" then
                out[key] = true
            elseif type(allowed) == "string" then
                out[allowed] = true
            end
        end
    end

    return out
end

--- Normalize whatever was stored into the shape every check below expects.
function Roles.normalize(permissions)
    permissions = type(permissions) == "table" and permissions or {}

    return {
        manage_admins = permissions.manage_admins == true,
        view  = scopeOf(permissions.view),
        edit  = scopeOf(permissions.edit),
        tools = scopeOf(permissions.tools),
    }
end

local function serialize(role)
    local permissions = role.permissions

    local function scope(value)
        if value == ALL then return ALL end

        local out = {}
        for key in pairs(value) do out[#out + 1] = key end
        table.sort(out)

        return out
    end

    return {
        id      = role.id,
        label   = role.label,
        icon    = role.icon or "fa-user-shield",
        help    = role.help,
        builtin = builtinById[role.id] ~= nil,
        locked  = role.locked == true,
        order   = role.order or 50,
        permissions = {
            manage_admins = permissions.manage_admins,
            view  = scope(permissions.view),
            edit  = scope(permissions.edit),
            tools = scope(permissions.tools),
        },
    }
end

--------------------------------------------------
-- MARK: Store
--------------------------------------------------

local function load()
    local ok, rows = pcall(MySQL.query.await, "SELECT id, label, icon, permissions FROM gg_studio_roles")

    if not ok then return end

    local loaded = {}

    for _, row in ipairs(rows or {}) do
        -- A built-in name in the table would shadow the shipped role and could
        -- lock the owner out, so the shipped one always wins.
        if type(row.id) == "string" and not builtinById[row.id] then
            local decoded, permissions = pcall(json.decode, row.permissions)

            loaded[row.id] = {
                id          = row.id,
                label       = row.label or row.id,
                icon        = row.icon,
                permissions = Roles.normalize(decoded and permissions or nil),
            }
        end
    end

    custom = loaded
end

AddEventHandler("gg_lib:database:ready", load)

--------------------------------------------------
-- MARK: Reads
--------------------------------------------------

function Roles.get(id)
    if type(id) ~= "string" then return nil end

    return builtinById[id] or custom[id]
end

function Roles.exists(id)
    return Roles.get(id) ~= nil
end

--- Every role, shipped first, then the owner's own by name.
function Roles.list()
    local out = {}

    for _, role in ipairs(BUILTIN) do out[#out + 1] = serialize(role) end

    local names = {}
    for id in pairs(custom) do names[#names + 1] = id end
    table.sort(names)

    for _, id in ipairs(names) do out[#out + 1] = serialize(custom[id]) end

    return out
end

--------------------------------------------------
-- MARK: Checks
--------------------------------------------------

local function allows(scope, resource)
    if scope == ALL then return true end
    if type(scope) ~= "table" then return false end
    if resource == nil then return next(scope) ~= nil end

    return scope[resource] == true
end

--- Whether a role may do something.
---
--- action: "view" or "edit" (with an optional resource), "manage_admins", or a
--- tool id from Roles.tools. Passing no resource to view/edit asks whether the
--- role may do it to anything at all.
function Roles.can(id, action, resource)
    local role = Roles.get(id)
    if not role then return false end

    local permissions = role.permissions

    if action == "manage_admins" then return permissions.manage_admins end
    if action == "view" then
        -- Anything editable is readable; a role listing a script only under
        -- edit is a mistake that should not lock it out of its own page.
        return allows(permissions.view, resource) or allows(permissions.edit, resource)
    end
    if action == "edit" then return allows(permissions.edit, resource) end

    return allows(permissions.tools, action)
end

--------------------------------------------------
-- MARK: Writes
--------------------------------------------------

local function validId(id)
    if type(id) ~= "string" then return nil end

    local cleaned = id:lower():gsub("[^%a%d_]", "")

    if cleaned == "" then return nil end

    return cleaned:sub(1, 48)
end

--- Creates or updates one of the owner's own roles. Built-ins are never
--- writable: they are the way back in when a custom role goes wrong.
function Roles.save(data, actor)
    if type(data) ~= "table" then return false, "malformed payload" end

    local id = validId(data.id)
    if not id then return false, "that is not a usable role name" end
    if builtinById[id] then return false, "that role ships with gg_lib and cannot be changed" end

    local label = type(data.label) == "string" and data.label ~= "" and data.label:sub(1, 64) or id
    local icon  = type(data.icon) == "string" and data.icon:sub(1, 48) or "fa-user-shield"

    local permissions = Roles.normalize(data.permissions)

    -- Only the owner role hands out access; a custom role that could would let
    -- an admin quietly promote themselves.
    permissions.manage_admins = false

    local encoded = json.encode({
        manage_admins = permissions.manage_admins,
        view  = permissions.view  == ALL and ALL or permissions.view,
        edit  = permissions.edit  == ALL and ALL or permissions.edit,
        tools = permissions.tools == ALL and ALL or permissions.tools,
    })

    local ok = pcall(MySQL.query.await, [[
        INSERT INTO gg_studio_roles (id, label, icon, permissions, created_by)
        VALUES (?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE label = VALUES(label), icon = VALUES(icon), permissions = VALUES(permissions)
    ]], { id, label, icon, encoded, actor })

    if not ok then return false, "the database refused the role" end

    custom[id] = { id = id, label = label, icon = icon, permissions = permissions }

    return true, id
end

function Roles.delete(id)
    if builtinById[id] then return false, "that role ships with gg_lib and cannot be removed" end
    if not custom[id] then return false, "no such role" end

    local ok = pcall(MySQL.query.await, "DELETE FROM gg_studio_roles WHERE id = ?", { id })
    if not ok then return false, "the database refused the delete" end

    custom[id] = nil

    return true
end
