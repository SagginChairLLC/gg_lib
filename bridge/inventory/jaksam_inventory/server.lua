gg.inventory = gg.inventory or {}

-- A player's inventory id is their server id here.
local INVENTORY = 'jaksam_inventory'

local function toNuiUrl(path)
    if type(path) ~= "string" or path == "" then return nil end

    return (path:gsub("^nui://", "https://cfx-nui-"))
end

gg.inventory.canCarryitem = function(src, data)
    return exports[INVENTORY]:canCarryItem(src, data.item, data.count or 1)
end

gg.inventory.hasItem = function(src, data)
    return exports[INVENTORY]:hasItem(src, data.item, data.count or 1)
end

gg.inventory.addItem = function(src, data)
    data.count = data.count or 1

    if not gg.inventory.canCarryitem(src, data) then return false end

    -- It answers with a reason as well as a result; only the result matters to
    -- a caller that just wanted the item handed over.
    local success = exports[INVENTORY]:addItem(src, data.item, data.count, data.metadata, data.slot)

    return success == true
end

gg.inventory.removeItem = function(src, data)
    data.count = data.count or 1

    if not gg.inventory.hasItem(src, data) then return false end

    local success = exports[INVENTORY]:removeItem(src, data.item, data.count, data.metadata, data.slot)

    return success == true
end

gg.inventory.getItemTable = function(item)
    if not item then return exports[INVENTORY]:getStaticItemsList() end

    return exports[INVENTORY]:getStaticItem(item) or nil
end

gg.inventory.getImageUrl = function(item)
    return toNuiUrl(exports[INVENTORY]:getItemImagePath(item))
end
