gg.framework = gg.framework or {}

local ESX = exports.es_extended:getSharedObject()
local PlayerData = ESX.GetPlayerData()

gg.framework.getItemTable = function(item)
    local itemData = exports.ox_inventory:Items(item)
    return itemData or item
end

--- Get the player's job and gang information.
-- @return string, boolean: The player's job name and gang status (always false).
gg.framework.GetPlayerGroups = function()
    return PlayerData.job.name, false
end

--- Get detailed job information for the player.
-- @return table: A table containing job details (name, grade, label).
gg.framework.GetPlayerGroupInfo = function()
    local jobInfo = {
        name = PlayerData.job.name,
        grade = PlayerData.job.grade,
        label = PlayerData.job.label
    }
    return jobInfo
end

--- Get the player's sex.
-- @return number: 1 for Male, 2 for Female.
gg.framework.GetSex = function()
    return PlayerData.sex == 'm' and 1 or 2
end

-- @param outfit table | The outfit data to set for the player.
-- @return void
gg.framework.SetOutfit = function(outfit)
    if GetResourceState("rcore_clothing") == "started" or GetResourceState("rcore_clothing") == "starting" or GetResourceState("rcore_clothing") == "stopped" then
        if outfit then
            ESX.TriggerServerCallback('esx_skin:getPlayerSkin', function(skin, jobSkin)
                TriggerEvent('skinchanger:loadClothes', skin, outfit)
            end)
        else
            TriggerServerEvent('rcore_clothing:reloadSkin')
        end
    elseif GetResourceState("tgiann-clothing") == "started" or GetResourceState("tgiann-clothing") == "starting" or GetResourceState("tgiann-clothing") == "stopped" then
        if outfit then
            ESX.TriggerServerCallback('esx_skin:getPlayerSkin', function(skin, jobSkin)
                TriggerEvent('skinchanger:loadClothes', skin, outfit)
            end)
        else
            exports["tgiann-clothing"]:RefreshSkin()
        end
    elseif GetResourceState("illenium-appearance") == "started" or GetResourceState("illenium-appearance") == "starting" or GetResourceState("illenium-appearance") == "stopped" then
        if outfit then
            ESX.TriggerServerCallback('esx_skin:getPlayerSkin', function(skin, jobSkin)
                TriggerEvent('skinchanger:loadClothes', skin, outfit)
            end)
        else
            TriggerEvent("illenium-appearance:client:reloadSkin")
        end
    else
        if outfit then
            ESX.TriggerServerCallback('esx_skin:getPlayerSkin', function(skin, jobSkin)
                TriggerEvent('skinchanger:loadClothes', skin, outfit)
            end)
        else
            ESX.TriggerServerCallback('esx_skin:getPlayerSkin', function(skin, jobSkin)
                TriggerEvent('skinchanger:loadSkin', skin)
            end)
        end
    end
end


local cachedVehicles = {}
local lastVehicleRequest = 0
local cacheDuration = 600000    -- 10 Minutes until able to refresh

-- @param modelHash number | The vehicle model hash
gg.framework.ValidateVehicleHash = function(modelHash)
    if not modelHash then return 0 end

    if (GetGameTimer() - lastVehicleRequest) > cacheDuration then
        cachedVehicles = lib.callback.await(("%s:server:retrieveVehicleList"):format(GetCurrentResourceName()), false) or {}
        lastVehicleRequest = GetGameTimer()
    end

    for _, vehicle in pairs(cachedVehicles) do
        if joaat(vehicle.model) == modelHash then
            return vehicle.model
        end
    end

    return false
end

AddEventHandler('esx:onPlayerSpawn', function(noAnim)
    TriggerEvent(GetCurrentResourceName()..':client:OnPlayerLoaded')
    TriggerEvent(GetCurrentResourceName()..':client:onResourceStart')
end)

RegisterNetEvent('esx:setJob', function(job)
    PlayerData.job = job
end)

RegisterNetEvent('esx:playerLoaded', function()
    PlayerData = ESX.GetPlayerData()
    TriggerServerEvent(GetCurrentResourceName()..':server:OnPlayerLoaded')
end)
