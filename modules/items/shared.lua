--------------------------------------------------
-- MARK: Item Catalogue
--------------------------------------------------
-- Scripts used to ask the inventory for its item list themselves, once per UI
-- mount, and got back whatever shape that inventory happens to use. This reads
-- the list once and hands out one record shape no matter what is installed.

gg.items = gg.items or {}

local catalogue = nil
local resolved = false

--------------------------------------------------
-- MARK: Normalize
--------------------------------------------------

--- The filename an item's icon is stored under, which is not always its name.
local function imageBase(record, key)
    local named = record.image

    if type(named) ~= "string" or named == "" then
        local client = record.client

        named = type(client) == "table" and client.image or nil
    end

    if type(named) == "string" and named ~= "" then
        return (named:gsub("%.%w+$", ""))
    end

    return record.name or key
end

--- The server owner's own image path, when the running inventory is not one
--- gg_lib bridges and the built-in path would point at the wrong resource.
--- A '%s' in the pattern is where the item's file name goes.
local function storedPattern()
    local stored

    if settings and settings.generic and settings.generic.get then
        stored = settings.generic.get("items.image_url")
    end

    -- gg_lib's own VM holds the generic store directly rather than the module.
    if (stored == nil or stored == "") and GenericSettings and GenericSettings.get then
        stored = GenericSettings.get("items.image_url")
    end

    if type(stored) ~= "string" or stored == "" then return nil end

    return stored
end

--- Turn one raw inventory record into the shape every script can rely on.
--- Returns nil for anything that is not a usable item.
function gg.items.normalize(key, record)
    if type(record) ~= "table" then return nil end

    local name = record.name or key

    if type(name) ~= "string" or name == "" then return nil end

    local base  = imageBase(record, key)
    local image

    local pattern = storedPattern()

    if pattern then
        -- A pattern with no %s, or a stray one, must not take the whole
        -- catalogue down with it.
        local ok, built = pcall(string.format, pattern, base)

        image = ok and built or nil
    elseif gg.inventory and gg.inventory.getImageUrl then
        local ok, url = pcall(gg.inventory.getImageUrl, base)

        image = ok and url or nil
    end

    return {
        name        = name,
        label       = record.label or name,
        weight      = tonumber(record.weight) or 0,
        description = record.description,
        stack       = record.stack ~= false,
        image       = image,
    }
end

--------------------------------------------------
-- MARK: Build
--------------------------------------------------

local function rawTable()
    if not (gg.inventory and gg.inventory.getItemTable) then return nil end

    local ok, list = pcall(gg.inventory.getItemTable)

    if ok and type(list) == "table" then return list end

    -- Inventories that read their items off the framework have nothing to read
    -- on an ESX or Qbox server, and answer with a placeholder string. ox holds
    -- the real list on those servers.
    if GetResourceState("ox_inventory") == "started" then
        local fellback, items = pcall(function() return exports.ox_inventory:Items() end)

        if fellback and type(items) == "table" then return items end
    end

    return nil
end

local function build()
    local list = rawTable()
    if not list then return false end

    local out, total = {}, 0

    for key, record in pairs(list) do
        local item = gg.items.normalize(key, record)

        if item then
            out[item.name] = item
            total = total + 1
        end
    end

    if total == 0 then return false end

    catalogue = out
    resolved  = true

    return true
end

--------------------------------------------------
-- MARK: Reads
--------------------------------------------------

--- Every catalogued item, keyed by item name.
function gg.items.all()
    if not resolved then build() end

    return catalogue or {}
end

--- One item, or nil when the inventory has never heard of that name.
function gg.items.get(name)
    if type(name) ~= "string" then return nil end

    return gg.items.all()[name]
end

--- The label to show a player. Falls back to the raw name so a missing item
--- still reads as something rather than blank.
function gg.items.label(name)
    local item = gg.items.get(name)

    return item and item.label or name
end

--- The icon URL, or nil when there is no such item.
function gg.items.image(name)
    local item = gg.items.get(name)

    return item and item.image or nil
end

--- Whether an item exists, for validating what a script was configured with.
function gg.items.exists(name)
    return gg.items.get(name) ~= nil
end

--- The catalogue as a sorted array, for pickers and menus.
function gg.items.list()
    local out = {}

    for _, item in pairs(gg.items.all()) do out[#out + 1] = item end

    table.sort(out, function(a, b) return a.label:lower() < b.label:lower() end)

    return out
end

function gg.items.ready()
    return resolved
end

--- Blocks until the catalogue is warm, for code running before the inventory
--- finished starting. False when it never arrives.
function gg.items.await(timeout)
    local deadline = GetGameTimer() + (tonumber(timeout) or 30000)

    while not resolved do
        if GetGameTimer() > deadline then return false end

        Wait(100)
    end

    return true
end

--- Rebuilds the catalogue from the inventory as it stands now.
function gg.items.refresh()
    local previous, wasResolved = catalogue, resolved

    resolved, catalogue = false, nil

    if build() then return true end

    -- A failed rebuild keeps what was already there. Blanking every label in
    -- every UI because the inventory hiccuped is worse than a stale one.
    catalogue, resolved = previous, wasResolved

    return false
end

--------------------------------------------------
-- MARK: Warm up
--------------------------------------------------

local WARM_TRIES = 60

-- Servers warm the catalogue at boot so the first script to ask never waits on
-- the inventory. Clients build on first read instead, since the call is local
-- and every resource would otherwise hold its own copy for nothing.
if gg.context == "server" then
    CreateThread(function()
        local wired = gg.bridge and gg.bridge.inventory

        -- The stub means no inventory is installed; nothing to catalogue.
        if not wired or wired == "default" then return end

        for _ = 1, WARM_TRIES do
            if GetResourceState(wired) == "started" and build() then return end

            Wait(1000)
        end

        if gg.print and gg.print.warn then
            gg.print.warn(("could not read the item list from %s"):format(wired))
        end
    end)
end
