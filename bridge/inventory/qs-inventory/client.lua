gg.inventory = gg.inventory or {}

gg.inventory.getImageUrl = function(item)
    return string.format('https://cfx-nui-qs-inventory/html/images/%s.png', item)
end

gg.inventory.getImageDirectory = function()
    return 'https://cfx-nui-qs-inventory/html/images/'
end

gg.inventory.getItemTable = function(item)
    if not item then return nil end
    local itemList = exports['qs-inventory']:GetItemList()
    return itemList[item] or nil
end