--------------------------------------------------
-- MARK: Admin Registry
--------------------------------------------------
-- Admins come from server_config.lua and from gg_studio_admins. Both lists are
-- checked independently so a database outage cannot lock the owner out, and
-- the config list is never written to -- it is the route that cannot be
-- revoked from in game.
--
-- Managed entirely through the /ggsettings editor; there are no admin commands.

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

-- Fold to lowercase "type:value" so a pasted identifier matches whatever case
-- the platform returns. A bare value is read as a license2.
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

-- Read off disk rather than through files{}, so the config never ships to a
-- client. Any failure keeps the list already in memory.
local function loadConfig()
    local source = LoadResourceFile("gg_lib", CONFIG_FILE)

    if not source or source == "" then
        print(("^1[gg_lib] %s is missing^0"):format(CONFIG_FILE))
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

-- nil is not the console: a caller that lost its source fails closed.
function Admins.isConsole(source)
    return source == 0 or source == "0"
end

function Admins.license2(source)
    return GetPlayerIdentifierByType(source, "license2")
end

-- Name + license2, for logs. license2 leads so a denial line can be pasted
-- straight into the admin list.
function Admins.actor(source)
    if Admins.isConsole(source) then return "console" end

    local identifier = Admins.license2(source)
        or GetPlayerIdentifierByType(source, "license")
        or GetPlayerIdentifierByType(source, "steam")

    return ("%s (%s)"):format(GetPlayerName(source) or "unknown", identifier or source)
end

-- Server-side identifiers cannot be forged, so the whole set is fair game --
-- that is what lets a steam:/discord: entry work.
function Admins.isAdmin(source)
    if Admins.isConsole(source) then return true end

    local player = tonumber(source)
    if not player then return false end

    for _, identifier in ipairs(GetPlayerIdentifiers(player) or {}) do
        local key = identifier:lower()

        if fromConfig[key] or fromDatabase[key] then return true end
    end

    return false
end

function Admins.isConfigAdmin(identifier)
    return fromConfig[identifier] ~= nil
end

--------------------------------------------------
-- MARK: Permissions
--------------------------------------------------
-- The single gate for the editor and for admin management. Checked on the
-- server for every call; the UI hiding a control is cosmetic.

function Admins.canEdit(source)
    if Admins.isConsole(source) then return true end
    if Admins.isAdmin(source) then return true end
    if config.ace == false then return false end

    return IsPlayerAceAllowed(source, ACE_EDIT)
end

function Admins.canView(source)
    if Admins.canEdit(source) then return true end
    if config.ace == false then return false end

    return IsPlayerAceAllowed(source, ACE_VIEW)
end

exports("ggIsAdmin", function(source)
    return Admins.isAdmin(source)
end)

--------------------------------------------------
-- MARK: Database Admins
--------------------------------------------------

local function loadDatabase()
    local rows = MySQL.query.await("SELECT identifier, name FROM gg_studio_admins")
    local loaded = {}

    for _, row in ipairs(rows or {}) do
        local key = normalize(row.identifier)
        if key then loaded[key] = row.name or row.identifier end
    end

    fromDatabase = loaded
end

AddEventHandler("gg_lib:database:ready", loadDatabase)

function Admins.grant(identifier, name, grantedBy)
    local ok = pcall(MySQL.query.await, [[
        INSERT INTO gg_studio_admins (identifier, name, granted_by)
        VALUES (?, ?, ?)
        ON DUPLICATE KEY UPDATE name = VALUES(name), granted_by = VALUES(granted_by)
    ]], { identifier, name, grantedBy })

    if not ok then return false end

    fromDatabase[identifier] = name or identifier

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

-- Names of everyone online, so a config entry (which stores no name) still
-- shows as a person while its owner is connected.
local function onlineNames()
    local names = {}

    for _, player in ipairs(GetPlayers()) do
        local identifier = normalize(Admins.license2(player) or "")
        if identifier then names[identifier] = GetPlayerName(player) end
    end

    return names
end

-- Config entries first, then database rows, each tagged with where it came
-- from so the editor knows which ones it may revoke.
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
        }
    end

    local rows = MySQL.query.await([[
        SELECT identifier, name, granted_by,
               DATE_FORMAT(granted_at, '%Y-%m-%d') AS granted_at
        FROM gg_studio_admins
        ORDER BY granted_at
    ]])

    for _, row in ipairs(rows or {}) do
        local identifier = normalize(row.identifier)

        -- An identifier promoted into server_config.lua after being granted in
        -- game is listed once, as config, since that is what makes it stick.
        if identifier and not seen[identifier] then
            list[#list + 1] = {
                identifier = identifier,
                name       = names[identifier] or row.name,
                source     = "database",
                granted_by = row.granted_by,
                granted_at = row.granted_at,
            }
        end
    end

    table.sort(list, function(left, right)
        if left.source ~= right.source then return left.source == "config" end

        return (left.name or left.identifier) < (right.name or right.identifier)
    end)

    return list
end

-- Everyone online, so an admin can grant without copying identifiers around.
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
-- Every call re-checks on the server. A hand-crafted event from a player
-- without rights dies here regardless of what the client claims.

lib.callback.register("gg_lib:admins:fetch", function(source)
    if not Admins.canEdit(source) then
        print(("^3[gg_lib] blocked admin fetch from %s^0"):format(Admins.actor(source)))
        return false
    end

    return true, { admins = listAdmins(), players = listPlayers() }
end)

lib.callback.register("gg_lib:admins:grant", function(source, data)
    if not Admins.canEdit(source) then
        print(("^1[gg_lib] blocked admin GRANT from %s^0"):format(Admins.actor(source)))
        return false, "you do not have permission to manage admins"
    end

    if type(data) ~= "table" then return false, "malformed payload" end

    local identifier, name

    -- A server id from the player picker, or a pasted identifier.
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

    if not Admins.grant(identifier, name, Admins.actor(source)) then
        return false, "database write failed"
    end

    print(("[gg_lib] %s granted admin to %s"):format(Admins.actor(source), identifier))

    if Logs then Logs.write({ { resource = "gg_lib", path = identifier, action = "admin_add", new = name or identifier } }, Admins.actor(source)) end

    return true, { admins = listAdmins(), players = listPlayers() }
end)

lib.callback.register("gg_lib:admins:revoke", function(source, data)
    if not Admins.canEdit(source) then
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

    -- Read before revoking; the revoke clears this entry.
    local wasNamed = fromDatabase[identifier]

    if not Admins.revoke(identifier) then return false, "database write failed" end

    print(("[gg_lib] %s revoked admin from %s"):format(Admins.actor(source), identifier))

    if Logs then Logs.write({ { resource = "gg_lib", path = identifier, action = "admin_remove", old = wasNamed } }, Admins.actor(source)) end

    return true, { admins = listAdmins(), players = listPlayers() }
end)

--------------------------------------------------
-- MARK: Boot
--------------------------------------------------

local ok, count = loadConfig()

if ok and count == 0 then
    print(("^3[gg_lib] no admins configured -- add your license2 to %s^0"):format(CONFIG_FILE))
end
