gg.inventory = gg.inventory or {}

-- This one resolves its own icon path, extension included, and falls back to a
-- placeholder itself. Asking it beats guessing a file name, which is what the
-- other bridges have to do.
local function toNuiUrl(path)
    if type(path) ~= "string" or path == "" then return nil end

    return (path:gsub("^nui://", "https://cfx-nui-"))
end

gg.inventory.getImageUrl = function(item)
    return toNuiUrl(exports['jaksam_inventory']:getItemImagePath(item))
end

gg.inventory.getImageDirectory = function()
    return 'https://cfx-nui-jaksam_inventory/_images/'
end

gg.inventory.getItemTable = function(item)
    if not item then return exports['jaksam_inventory']:getStaticItemsList() end

    return exports['jaksam_inventory']:getStaticItem(item) or nil
end
