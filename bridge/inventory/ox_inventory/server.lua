gg.inventory = gg.inventory or {}

gg.inventory.canCarryitem = function(src, data)
    return true -- Ox Handles inside base events
end

gg.inventory.hasItem = function(src, data)
    return true -- Ox Handles inside base events
end

gg.inventory.addItem = function(src, data)
    data.count = data?.count or 1

    local success, response = exports.ox_inventory:AddItem(src, data.item, data.count, data.metadata, data.slot, cb)
    if not success then 
        return success
    end
    return success
end

gg.inventory.removeItem = function(src, data)
    data.count = data?.count or 1

    local success, response = exports.ox_inventory:RemoveItem(src, data.item, data.count, data.metadata, data.slot, true)
    if not success then
        return success
    end
    return success
end

gg.inventory.getItemTable = function(item)
    if not item then return nil end
    return exports.ox_inventory:Items(item) or nil
end