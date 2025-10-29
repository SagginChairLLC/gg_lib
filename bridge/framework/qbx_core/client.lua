gg.framework = gg.framework or {}

local qbx_core = exports['qbx_core']

-- @param oldClothes table | A table of the old clothes components and their values.
-- @return table | A table with converted clothes components, where the keys are the component names and values include item and texture.
-- @param oldClothes table | A table containing the old clothing data.
-- @return table A table of converted clothing items with component names and their textures.
local function GetConvertedClothes(oldClothes)
    local clothes = {}
    local components = {
        ['arms'] = "arms",
        ['tshirt_1'] = "t-shirt", 
        ['torso_1'] = "torso2", 
        ['bproof_1'] = "vest",
        ['decals_1'] = "decals", 
        ['pants_1'] = "pants", 
        ['shoes_1'] = "shoes", 
        ['helmet_1'] = "hat", 
        ['chain_1'] = "accessory", 
    }
    local textures = {
        ['tshirt_1'] = 'tshirt_2', 
        ['torso_1'] = 'torso_2',
        ['bproof_1'] = 'bproof_2',
        ['decals_1'] = 'decals_2',
        ['pants_1'] = 'pants_2',
        ['shoes_1'] = 'shoes_2',
        ['helmet_1'] = 'helmet_2',
        ['chain_1'] = 'chain_2',
    }
    for k,v in pairs(oldClothes) do 
        local component = components[k]
        if component then 
            local texture = textures[k] and (oldClothes[textures[k]] or 0) or 0
            clothes[component] = {item = v, texture = texture}
        end
    end
    return clothes
end

gg.framework.getItemTable = function(item)
    local itemData = exports.ox_inventory:Items(item)
    return itemData or item
end

-- @return string, string | The player's job and gang names.
gg.framework.GetPlayerGroups = function()
    local Player = qbx_core:GetPlayerData()
    return Player.job.name, Player.gang.name
end

-- @param job boolean | A flag to determine if job info or gang info is returned.
-- @return table | The player's job or gang information including name, grade, and label.
gg.framework.GetPlayerGroupInfo = function(job)
    local Player = qbx_core:GetPlayerData()
    local info 
    if job then 
        info = {
            name = Player.job.name,
            grade = Player.job.grade.level,
            label = Player.job.label
        }
    else 
        info = {
            name = Player.gang.name,
            grade = Player.gang.grade.level,
            label = Player.gang.label
        }
    end
    return info
end

-- @return string | The player's gender (either 'male' or 'female').
gg.framework.GetSex = function()
    local Player = qbx_core:GetPlayerData()
    return Player.charinfo.gender + 1
end

-- @param outfit table | The outfit data to set for the player.
-- @return void
gg.framework.SetOutfit = function(outfit)
    if GetResourceState("rcore_clothing") == "started" or GetResourceState("rcore_clothing") == "starting" or GetResourceState("rcore_clothing") == "stopped" then
        if outfit then
            TriggerEvent('qb-clothing:client:loadOutfit', {outfitData = GetConvertedClothes(outfit)})
        else
            TriggerServerEvent('rcore_clothing:reloadSkin')
        end
    elseif GetResourceState("tgiann-clothing") == "started" or GetResourceState("tgiann-clothing") == "starting" or GetResourceState("tgiann-clothing") == "stopped" then
        if outfit then
            TriggerEvent('qb-clothing:client:loadOutfit', {outfitData = GetConvertedClothes(outfit)})
        else
            exports["tgiann-clothing"]:RefreshSkin()
        end
    elseif GetResourceState("illenium-appearance") == "started" or GetResourceState("illenium-appearance") == "starting" or GetResourceState("illenium-appearance") == "stopped" then
        if outfit then
            TriggerEvent('qb-clothing:client:loadOutfit', {outfitData = GetConvertedClothes(outfit)})
        else
            TriggerEvent("illenium-appearance:client:reloadSkin")
        end
    else
        if outfit then
            TriggerEvent('qb-clothing:client:loadOutfit', {outfitData = GetConvertedClothes(outfit)})
        else
            TriggerEvent("illenium-appearance:client:reloadSkin")
        end
    end
end

-- @param vehicle string | The vehicles model name
gg.framework.ValidateVehicleHash = function(modelHash)
    if not modelHash then return modelHash or 0 end
    local vehicle_data = qbx_core:GetVehiclesByName()

    for k,v in pairs(vehicle_data) do
        if joaat(v.model) == modelHash then
            return v.model
        end
    end

    return false
end

RegisterNetEvent('QBCore:Client:OnPlayerLoaded', function()
    TriggerEvent(GetCurrentResourceName()..':client:OnPlayerLoaded')
    TriggerEvent(GetCurrentResourceName()..':client:onResourceStart')
    TriggerServerEvent(GetCurrentResourceName()..':server:OnPlayerLoaded')
end)

RegisterNetEvent('QBCore:Player:SetPlayerData', function(val)
    PlayerData = val
end)
