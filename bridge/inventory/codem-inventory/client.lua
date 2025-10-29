gg.inventory = gg.inventory or {}

gg.inventory.getImageUrl = function(item)
    return string.format('https://cfx-nui-codem-inventory/html/itemimages/%s.png', item)
end

gg.inventory.getImageDirectory = function()
    return 'https://cfx-nui-codem-inventory/html/itemimages/'
end

gg.inventory.getItemTable = function(item)
    if not item then return nil end
    return exports['codem-inventory']:GetItemList(item) or nil
end
