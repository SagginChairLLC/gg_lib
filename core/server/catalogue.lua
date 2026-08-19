--------------------------------------------------
-- MARK: Catalogue
--------------------------------------------------
-- The items and vehicles the server actually has, for the studio's browser.
-- gg_lib does not import itself, so the bridges and catalogue modules are
-- loaded here on demand -- the first time an admin opens the tool, not at boot.

local RESOURCE = GetCurrentResourceName()

local ready = false

local function runFile(path)
    local source = LoadResourceFile(RESOURCE, path)
    if not source or source == "" then return false end

    local chunk = load(source, ("@@%s/%s"):format(RESOURCE, path), "t")
    if not chunk then return false end

    return (pcall(chunk))
end

--- Loads the same bridge a consumer script would get, so the catalogue reads
--- through the real dispatch rather than a copy of it.
local function ensure()
    if ready then return true end

    gg = gg or {}
    gg.context = "server"
    gg.print   = gg.print or { warn = function() end }
    gg.bridge  = gg.bridge or {}

    gg.bridge.framework = Bridges.wired("framework")
    gg.bridge.inventory = Bridges.wired("inventory")

    -- The inventories that read their items off the framework need it loaded
    -- first, so the order here matters.
    runFile(("bridge/framework/%s/server.lua"):format(gg.bridge.framework))
    runFile(("bridge/inventory/%s/server.lua"):format(gg.bridge.inventory))

    runFile("modules/items/shared.lua")
    runFile("modules/vehicles/shared.lua")

    ready = true

    return true
end

--------------------------------------------------
-- MARK: Reads
--------------------------------------------------

local function itemRows()
    if not (gg.items and gg.items.list) then return {} end

    local ok, rows = pcall(gg.items.list)

    return ok and rows or {}
end

local function vehicleRows()
    if not (gg.vehicles and gg.vehicles.list) then return {} end

    local ok, rows = pcall(gg.vehicles.list)

    return ok and rows or {}
end

lib.callback.register("gg_lib:catalogue:fetch", function(source, data)
    -- Either tool is enough to read the catalogue; each list is gated where it
    -- is handed back below.
    local seeItems    = Admins.can(source, "items")
    local seeVehicles = Admins.can(source, "vehicles")

    if not seeItems and not seeVehicles then
        print(("^3[gg_lib] blocked catalogue fetch from %s^0"):format(Admins.actor(source)))
        return false
    end

    ensure()

    -- Refetch means the server owner changed something and wants to see it, so
    -- the cached catalogues are rebuilt rather than handed back as they were.
    if type(data) == "table" and data.refresh == true then
        if gg.items and gg.items.refresh then pcall(gg.items.refresh) end
        if gg.vehicles and gg.vehicles.refresh then pcall(gg.vehicles.refresh) end
    end

    return true, {
        items     = seeItems and itemRows() or {},
        vehicles  = seeVehicles and vehicleRows() or {},
        can_give  = Admins.canEdit(source),
        image_url = GenericSettings.get("items.image_url") or "",
        wired     = { framework = gg.bridge.framework, inventory = gg.bridge.inventory },
    }
end)

--- The path item icons are served from. Some inventories are not bridged, and
--- then the built-in path points at a resource that is not there.
lib.callback.register("gg_lib:catalogue:setImageUrl", function(source, data)
    if not Admins.can(source, "items") or not Admins.canEdit(source) then
        return false, "you do not have permission to change that"
    end

    local pattern = type(data) == "table" and data.pattern or ""

    if type(pattern) ~= "string" then return false, "malformed payload" end

    local ok, errors = GenericSettings.apply({ ["items.image_url"] = pattern }, Admins.actor(source))

    if not ok then
        return false, (type(errors) == "table" and (errors["items.image_url"] or errors._)) or "rejected"
    end

    ensure()

    -- The catalogue holds resolved URLs, so it has to be rebuilt for the new
    -- path to show up rather than waiting for a restart.
    if gg.items and gg.items.refresh then pcall(gg.items.refresh) end

    return true
end)

--------------------------------------------------
-- MARK: Giving
--------------------------------------------------
-- Handing out items is a change to the world, so it needs edit rights rather
-- than the read the browser itself takes.

lib.callback.register("gg_lib:catalogue:giveItem", function(source, data)
    if not Admins.can(source, "items") or not Admins.canEdit(source) then
        print(("^1[gg_lib] blocked item spawn from %s^0"):format(Admins.actor(source)))
        return false, "you do not have permission to spawn items"
    end

    if type(data) ~= "table" or type(data.item) ~= "string" then return false, "malformed payload" end

    ensure()

    local count = math.max(math.floor(tonumber(data.count) or 1), 1)

    if not gg.items or not gg.items.exists(data.item) then
        return false, ("'%s' is not an item on this server"):format(data.item)
    end

    if not (gg.inventory and gg.inventory.addItem) then
        return false, "no inventory is wired up"
    end

    local ok, gave = pcall(gg.inventory.addItem, source, { item = data.item, count = count })

    if not ok or gave == false then return false, "the inventory refused it, they may be full" end

    print(("[gg_lib] %s spawned %dx %s"):format(Admins.actor(source), count, data.item))

    if Logs then
        Logs.write({ {
            resource = "gg_lib",
            path     = data.item,
            action   = "item_spawn",
            new      = ("%dx %s"):format(count, data.item),
        } }, Admins.actor(source))
    end

    return true
end)

--- The client does the spawning; the server only says whether they may, and
--- keeps the record of it.
lib.callback.register("gg_lib:catalogue:spawnVehicle", function(source, data)
    if not Admins.can(source, "vehicles") or not Admins.canEdit(source) then
        print(("^1[gg_lib] blocked vehicle spawn from %s^0"):format(Admins.actor(source)))
        return false, "you do not have permission to spawn vehicles"
    end

    if type(data) ~= "table" or type(data.model) ~= "string" then return false, "malformed payload" end

    ensure()

    if gg.vehicles and gg.vehicles.ready() and not gg.vehicles.exists(data.model) then
        return false, ("'%s' is not a vehicle on this server"):format(data.model)
    end

    print(("[gg_lib] %s spawned %s"):format(Admins.actor(source), data.model))

    if Logs then
        Logs.write({ {
            resource = "gg_lib",
            path     = data.model,
            action   = "vehicle_spawn",
            new      = data.model,
        } }, Admins.actor(source))
    end

    return true
end)
