--------------------------------------------------
-- MARK: Admin Registry
--------------------------------------------------

Admins = {}

local CONFIG_FILE = "server_config.lua"

local ACE_EDIT = "gg.settings"
local ACE_VIEW = "gg.settings.view"

local KNOWN_TYPES = {
    license2 = true, license = true, steam = true,
    discord  = true, fivem   = true, xbl   = true,
    live     = true, ip      = true,
}

local DEFAULT_TYPE = "license2"

local config       = { ace = true }
local fromConfig   = {}   -- "type:value" -> entry as written
local fromDatabase = {}

--------------------------------------------------
-- MARK: Normalisation
--------------------------------------------------

local function normalize(entry)
    if type(entry) ~= "string" then return nil, "is not a string" end

    local value = entry:gsub("%s", ""):lower()
    if value == "" then return nil end

    local kind, rest = value:match("^([%a%d]+):(.+)$")

    if not kind then
        return ("%s:%s"):format(DEFAULT_TYPE, value)
    end

    if not KNOWN_TYPES[kind] then
        return nil, ("'%s:' is not a known identifier type"):format(kind)
    end

    return ("%s:%s"):format(kind, rest)
end

--------------------------------------------------
-- MARK: Config Load
--------------------------------------------------

local function loadConfig()
    local source = LoadResourceFile("gg_lib", CONFIG_FILE)

    if not source or source == "" then
        print(("^3[gg_lib] %s not found -- copy server_config.example.lua to %s and add your license2 to the admins list^0"):format(CONFIG_FILE, CONFIG_FILE))
        return false
    end

    local chunk, compileError = load(source, ("@@gg_lib/%s"):format(CONFIG_FILE), "t")

    if not chunk then
        print(("^1[gg_lib] %s has a syntax error: %s^0"):format(CONFIG_FILE, compileError))
        return false
    end

    local ok, result = pcall(chunk)

    if not ok or type(result) ~= "table" then
        print(("^1[gg_lib] %s did not return a table^0"):format(CONFIG_FILE))
        return false
    end

    local loaded = {}
    local count  = 0

    for _, entry in ipairs(result.admins or {}) do
        local key, problem = normalize(entry)

        if key then
            if not loaded[key] then count = count + 1 end
            loaded[key] = entry
        elseif problem then
            print(("^3[gg_lib] ignoring admin '%s' -- %s^0"):format(tostring(entry), problem))
        end
    end

    config     = result
    fromConfig = loaded

    return true, count
end

--------------------------------------------------
-- MARK: Lookups
--------------------------------------------------

function Admins.isConsole(source)
    return source == 0 or source == "0"
end

function Admins.license2(source)
    return GetPlayerIdentifierByType(source, "license2")
end

function Admins.actor(source)
    if Admins.isConsole(source) then return "console" end

    local identifier = Admins.license2(source)
        or GetPlayerIdentifierByType(source, "license")
        or GetPlayerIdentifierByType(source, "steam")

    return ("%s (%s)"):format(GetPlayerName(source) or "unknown", identifier or source)
end

function Admins.isAdmin(source)
    if Admins.isConsole(source) then return true end

    local player = tonumber(source)
    if not player then return false end

    for _, identifier in ipairs(GetPlayerIdentifiers(player) or {}) do
        local key = identifier:lower()

        if fromConfig[key] or fromDatabase[key] then return true end
    end

    return Admins.roleOf(source) ~= nil
end

function Admins.isConfigAdmin(identifier)
    return fromConfig[identifier] ~= nil
end

--------------------------------------------------
-- MARK: Server permissions
--------------------------------------------------
-- A server that already trusts someone should not have to say so twice.
-- Anyone holding one of the usual admin principals, or sitting in their
-- framework's admin group, gets the matching role here without being added
-- to a list by hand.
--
-- Never the owner role: managing who else gets in stays with the people
-- named in server_config.lua, because that file is the way back in when
-- everything else says no.

local ACE_ROLES = {
    -- Whole-server principals, then the ones each framework registers.
    ["group.god"]        = "admin",
    ["group.superadmin"] = "admin",
    ["group.admin"]      = "admin",
    ["qbcore.god"]       = "admin",
    ["qbcore.admin"]     = "admin",
    ["qbx.god"]          = "admin",
    ["qbx.admin"]        = "admin",
    ["group.mod"]        = "moderator",
    ["group.moderator"]  = "moderator",
}

-- Read straight off the running framework rather than through the bridge:
-- this is the only place gg_lib needs it, and the bridge is deliberately
-- free of permission calls.
local FRAMEWORK_GROUPS = {
    superadmin = "admin",
    god        = "admin",
    admin      = "admin",
    mod        = "moderator",
    moderator  = "moderator",
}

local function running(name)
    local state = GetResourceState(name)

    return state == "started" or state == "starting"
end

--- The group a framework says someone is in, lowercased, or nil.
local function frameworkGroup(source)
    if running("es_extended") then
        local ok, group = pcall(function()
            local core = exports.es_extended:getSharedObject()
            local player = core and core.GetPlayerFromId(source)

            return player and player.getGroup and player.getGroup()
        end)

        if ok and type(group) == "string" then return group:lower() end
    end

    if running("qb-core") then
        local ok, group = pcall(function()
            local core = exports["qb-core"]:GetCoreObject()
            if not (core and core.Functions and core.Functions.GetPermission) then return nil end

            local held = core.Functions.GetPermission(source)

            -- Older builds answer with the name, newer ones with a set of
            -- every group held.
            if type(held) == "string" then return held end

            if type(held) == "table" then
                for name, allowed in pairs(held) do
                    if allowed and FRAMEWORK_GROUPS[tostring(name):lower()] then return name end
                end
            end

            return nil
        end)

        if ok and type(group) == "string" then return group:lower() end
    end

    return nil
end

-- Said once per player per session: an admin appearing out of nowhere should
-- be explainable from the console.
local announced = {}

local function announce(source, role, why)
    local key = Admins.license2(source) or tostring(source)

    if announced[key] then return end

    announced[key] = true

    print(("[gg_lib] %s is %s here because of %s. Set auto_admin = false in server_config.lua to stop this."):format(
        Admins.actor(source), role, why))
end

AddEventHandler("playerDropped", function()
    local key = Admins.license2(source)

    if key then announced[key] = nil end
end)

--- The role a server's own permissions earn someone, or nil for none.
function Admins.serverRole(source)
    if config.auto_admin == false then return nil end
    if Admins.isConsole(source) then return nil end

    local best, why = nil, nil

    for ace, role in pairs(ACE_ROLES) do
        if IsPlayerAceAllowed(source, ace) then
            -- An edit role beats a view-only one, whichever is found first.
            if role == "admin" then return role, ace end

            best, why = best or role, why or ace
        end
    end

    local group = frameworkGroup(source)
    local fromGroup = group and FRAMEWORK_GROUPS[group]

    if fromGroup == "admin" then return fromGroup, ("the %s group"):format(group) end

    if fromGroup and not best then return fromGroup, ("the %s group"):format(group) end

    return best, why
end

--------------------------------------------------
-- MARK: Permissions
--------------------------------------------------

--- The role behind whoever is asking, or nil when they have no access at all.
---
--- server_config.lua admins are owners: that file is the way back in when the
--- database says otherwise. ACE falls in below them.
function Admins.roleOf(source)
    if Admins.isConsole(source) then return Roles.OWNER end

    local player = tonumber(source)

    if player then
        for _, identifier in ipairs(GetPlayerIdentifiers(player) or {}) do
            local key = identifier:lower()

            if fromConfig[key] then return Roles.OWNER end

            local granted = fromDatabase[key]

            if granted then
                local role = granted.role

                -- A role that was deleted out from under an admin leaves them
                -- with the default rather than with everything.
                return (Roles.exists(role) and role) or Roles.DEFAULT
            end
        end
    end

    if config.ace ~= false then
        if IsPlayerAceAllowed(source, ACE_EDIT) then return Roles.DEFAULT end
        if IsPlayerAceAllowed(source, ACE_VIEW) then return "moderator" end
    end

    -- Last: whatever the server already trusts them with.
    local earned, why = Admins.serverRole(source)

    if earned then
        announce(source, earned, why)

        return earned
    end

    return nil
end

--- Whether someone may do something. See Roles.can for the actions.
function Admins.can(source, action, resource)
    local role = Admins.roleOf(source)
    if not role then return false end

    return Roles.can(role, action, resource)
end

--- Passing no resource asks whether they may edit anything at all, which is
--- what the pages guarding a whole screen want to know.
function Admins.canEdit(source, resource)
    return Admins.can(source, "edit", resource)
end

function Admins.canView(source, resource)
    return Admins.can(source, "view", resource)
end

--- Managing access is the owner's alone.
function Admins.canManage(source)
    return Admins.can(source, "manage_admins")
end

exports("ggIsAdmin", function(source)
    return Admins.isAdmin(source)
end)

--------------------------------------------------
-- MARK: Database Admins
--------------------------------------------------

local function loadDatabase()
    local ok, rows = pcall(MySQL.query.await, "SELECT identifier, name, role FROM gg_studio_admins")

    if not ok then return end

    local loaded = {}

    for _, row in ipairs(rows or {}) do
        local key = normalize(row.identifier)

        if key then
            loaded[key] = {
                name = row.name or row.identifier,
                role = row.role or Roles.DEFAULT,
            }
        end
    end

    fromDatabase = loaded
end

AddEventHandler("gg_lib:database:ready", loadDatabase)

function Admins.grant(identifier, name, grantedBy, role)
    role = (Roles.exists(role) and role) or Roles.DEFAULT

    -- Owner is what server_config.lua confers; handing it out from the UI would
    -- make that file stop being the way back in.
    if role == Roles.OWNER then role = Roles.DEFAULT end

    local ok = pcall(MySQL.query.await, [[
        INSERT INTO gg_studio_admins (identifier, name, granted_by, role)
        VALUES (?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE name = VALUES(name), granted_by = VALUES(granted_by), role = VALUES(role)
    ]], { identifier, name, grantedBy, role })

    if not ok then return false end

    fromDatabase[identifier] = { name = name or identifier, role = role }

    return true
end

--- Moves an existing admin to another role, leaving everything else alone.
function Admins.setRole(identifier, role)
    local current = fromDatabase[identifier]
    if not current then return false, "that identifier is not an admin here" end
    if not Roles.exists(role) then return false, "no such role" end
    if role == Roles.OWNER then return false, "owner comes from server_config.lua" end

    local ok = pcall(MySQL.query.await,
        "UPDATE gg_studio_admins SET role = ? WHERE identifier = ?", { role, identifier })

    if not ok then return false, "the database refused the change" end

    current.role = role

    return true
end

function Admins.revoke(identifier)
    local ok = pcall(MySQL.query.await,
        "DELETE FROM gg_studio_admins WHERE identifier = ?", { identifier })

    if not ok then return false end

    fromDatabase[identifier] = nil

    return true
end

--------------------------------------------------
-- MARK: Editor Payload
--------------------------------------------------

local function onlineNames()
    local names = {}

    for _, player in ipairs(GetPlayers()) do
        local identifier = normalize(Admins.license2(player) or "")
        if identifier then names[identifier] = GetPlayerName(player) end
    end

    return names
end

local function listAdmins()
    local list = {}
    local seen = {}
    local names = onlineNames()

    for identifier in pairs(fromConfig) do
        seen[identifier] = true
        list[#list + 1] = {
            identifier = identifier,
            name       = names[identifier],
            source     = "config",
            role       = Roles.OWNER,
        }
    end

    local rows = MySQL.query.await([[
        SELECT identifier, name, granted_by, role,
               DATE_FORMAT(granted_at, '%Y-%m-%d') AS granted_at
        FROM gg_studio_admins
        ORDER BY granted_at
    ]])

    for _, row in ipairs(rows or {}) do
        local identifier = normalize(row.identifier)

        if identifier and not seen[identifier] then
            list[#list + 1] = {
                identifier = identifier,
                name       = names[identifier] or row.name,
                source     = "database",
                role       = (Roles.exists(row.role) and row.role) or Roles.DEFAULT,
                granted_by = row.granted_by,
                granted_at = row.granted_at,
            }
        end
    end

    -- Anyone online who is in on their server permissions rather than on
    -- either list. Shown so the page answers "who can get in" honestly, and
    -- read-only because it is not this page that granted it.
    for _, player in ipairs(GetPlayers()) do
        local identifier = normalize(Admins.license2(player) or "")
        local earned, why = Admins.serverRole(player)

        if identifier and earned and not seen[identifier] then
            seen[identifier] = true
            list[#list + 1] = {
                identifier = identifier,
                name       = names[identifier],
                source     = "server",
                role       = earned,
                granted_by = why,
            }
        end
    end

    local ORDER = { config = 1, server = 2, database = 3 }

    table.sort(list, function(left, right)
        local a, b = ORDER[left.source] or 9, ORDER[right.source] or 9

        if a ~= b then return a < b end

        return (left.name or left.identifier) < (right.name or right.identifier)
    end)

    return list
end

local function listPlayers()
    local list = {}

    for _, player in ipairs(GetPlayers()) do
        local identifier = normalize(Admins.license2(player) or "")

        if identifier then
            list[#list + 1] = {
                id         = tonumber(player),
                name       = GetPlayerName(player) or "unknown",
                identifier = identifier,
                admin      = (fromConfig[identifier] or fromDatabase[identifier]) ~= nil,
            }
        end
    end

    table.sort(list, function(left, right) return left.name < right.name end)

    return list
end

--------------------------------------------------
-- MARK: Editor Callbacks
--------------------------------------------------

lib.callback.register("gg_lib:admins:fetch", function(source)
    -- Anyone who can open the studio may see who else has access; only the
    -- owner may change it.
    if not Admins.canView(source) then
        print(("^3[gg_lib] blocked admin fetch from %s^0"):format(Admins.actor(source)))
        return false
    end

    return true, { admins = listAdmins(), players = listPlayers(), roles = Roles.list() }
end)

lib.callback.register("gg_lib:admins:grant", function(source, data)
    if not Admins.canManage(source) then
        print(("^1[gg_lib] blocked admin GRANT from %s^0"):format(Admins.actor(source)))
        return false, "you do not have permission to manage admins"
    end

    if type(data) ~= "table" then return false, "malformed payload" end

    local identifier, name

    if data.player then
        local player = tonumber(data.player)
        if not player or not GetPlayerName(player) then return false, "that player is no longer connected" end

        identifier = normalize(Admins.license2(player) or "")
        name       = GetPlayerName(player)

        if not identifier then return false, "that player has no license2 identifier" end
    else
        local problem
        identifier, problem = normalize(data.identifier)

        if not identifier then return false, problem or "that is not a valid identifier" end
    end

    if Admins.isConfigAdmin(identifier) then
        return false, "already an admin via server_config.lua"
    end

    if fromDatabase[identifier] then return false, "already an admin" end

    if not Admins.grant(identifier, name, Admins.actor(source), data.role) then
        return false, "database write failed"
    end

    print(("[gg_lib] %s granted admin to %s"):format(Admins.actor(source), identifier))

    if Logs then Logs.write({ { resource = "gg_lib", path = identifier, action = "admin_add", new = name or identifier } }, Admins.actor(source)) end

    return true, { admins = listAdmins(), players = listPlayers(), roles = Roles.list() }
end)

lib.callback.register("gg_lib:admins:setRole", function(source, data)
    if not Admins.canManage(source) then
        print(("^1[gg_lib] blocked role change from %s^0"):format(Admins.actor(source)))
        return false, "you do not have permission to manage admins"
    end

    if type(data) ~= "table" then return false, "malformed payload" end

    local identifier = normalize(data.identifier)
    if not identifier then return false, "that is not a valid identifier" end

    if Admins.isConfigAdmin(identifier) then
        return false, "set in server_config.lua -- remove it there"
    end

    local ok, problem = Admins.setRole(identifier, data.role)
    if not ok then return false, problem end

    print(("[gg_lib] %s moved %s to %s"):format(Admins.actor(source), identifier, data.role))

    if Logs then
        Logs.write({ { resource = "gg_lib", path = identifier, action = "admin_role", new = data.role } }, Admins.actor(source))
    end

    return true, { admins = listAdmins(), players = listPlayers(), roles = Roles.list() }
end)

lib.callback.register("gg_lib:admins:saveRole", function(source, data)
    if not Admins.canManage(source) then
        print(("^1[gg_lib] blocked role save from %s^0"):format(Admins.actor(source)))
        return false, "you do not have permission to manage admins"
    end

    local ok, problem = Roles.save(data, Admins.actor(source))
    if not ok then return false, problem end

    print(("[gg_lib] %s saved role %s"):format(Admins.actor(source), problem))

    return true, { admins = listAdmins(), players = listPlayers(), roles = Roles.list() }
end)

lib.callback.register("gg_lib:admins:deleteRole", function(source, data)
    if not Admins.canManage(source) then
        print(("^1[gg_lib] blocked role delete from %s^0"):format(Admins.actor(source)))
        return false, "you do not have permission to manage admins"
    end

    local id = type(data) == "table" and data.id or nil

    local ok, problem = Roles.delete(id)
    if not ok then return false, problem end

    -- Anyone left on it falls back to the default rather than to nothing.
    pcall(MySQL.query.await, "UPDATE gg_studio_admins SET role = ? WHERE role = ?", { Roles.DEFAULT, id })
    loadDatabase()

    print(("[gg_lib] %s deleted role %s"):format(Admins.actor(source), tostring(id)))

    return true, { admins = listAdmins(), players = listPlayers(), roles = Roles.list() }
end)

lib.callback.register("gg_lib:admins:revoke", function(source, data)
    if not Admins.canManage(source) then
        print(("^1[gg_lib] blocked admin REVOKE from %s^0"):format(Admins.actor(source)))
        return false, "you do not have permission to manage admins"
    end

    if type(data) ~= "table" then return false, "malformed payload" end

    local identifier = normalize(data.identifier)
    if not identifier then return false, "that is not a valid identifier" end

    if Admins.isConfigAdmin(identifier) then
        return false, "set in server_config.lua -- remove it there"
    end

    if not fromDatabase[identifier] then return false, "not an admin" end

    local wasNamed = fromDatabase[identifier]
    wasNamed = type(wasNamed) == "table" and wasNamed.name or wasNamed

    if not Admins.revoke(identifier) then return false, "database write failed" end

    print(("[gg_lib] %s revoked admin from %s"):format(Admins.actor(source), identifier))

    if Logs then Logs.write({ { resource = "gg_lib", path = identifier, action = "admin_remove", old = wasNamed } }, Admins.actor(source)) end

    return true, { admins = listAdmins(), players = listPlayers(), roles = Roles.list() }
end)

--------------------------------------------------
-- MARK: Boot
--------------------------------------------------

local ok, count = loadConfig()

if ok and count == 0 then
    print(("^3[gg_lib] no admins configured -- add your license2 to %s^0"):format(CONFIG_FILE))
end
