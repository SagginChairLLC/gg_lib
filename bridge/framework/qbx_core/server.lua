gg.framework = gg.framework or {}

local qbx_core = exports['qbx_core']
local ox_inventory = exports['ox_inventory']
local utility = require("utility")

gg.framework.GetIdentifier = function(source)
    if not source then return nil end
    local player = qbx_core:GetPlayer(source)
    if not player then return nil end
    return tostring(player.PlayerData.citizenid)
end

gg.framework.GetName = function(source)
    local player = qbx_core:GetPlayer(source)
    if not player then return "" end
    return player.PlayerData.charinfo.firstname .. ' ' .. player.PlayerData.charinfo.lastname
end

gg.framework.GetNameByIdentifier = function(identifier)
    if identifier then
        local result = MySQL.query.await('SELECT charinfo FROM players WHERE citizenid = ?', { identifier })
        if result and result[1] then
            local charInfo = json.decode(result[1].charinfo)
            return charInfo.firstname .. ' ' .. charInfo.lastname
        end
    end
    identifier = identifier or "No Id"
    return "No Name Found - " .. identifier
end

gg.framework.GetJobCount = function(source, job)
    local amount = 0
    local players = qbx_core:GetQBPlayers()
    for _, v in pairs(players) do
        if v and v.PlayerData.job.name == job then
            amount = amount + 1
        end
    end
    return amount
end

gg.framework.GetPlayers = function()
    local players = qbx_core:GetQBPlayers()
    local formattedPlayers = {}
    for _, v in pairs(players) do
        local player = {
            job = v.PlayerData.job.name,
            gang = v.PlayerData.gang.name,
            source = v.PlayerData.source,
            onDuty = v.PlayerData.job.onduty,
        }
        table.insert(formattedPlayers, player)
    end
    return formattedPlayers
end

gg.framework.GetPlayerGroups = function(source)
    local player = qbx_core:GetPlayer(source)
    return player.PlayerData.job, player.PlayerData.gang
end

gg.framework.GetPlayerJobInfo = function(source)
    local player = qbx_core:GetPlayer(source)
    local job = player.PlayerData.job
    return {
        name = job.name,
        label = job.label,
        grade = job.grade,
        gradeName = job.grade.name,
    }
end

gg.framework.GetPlayerGangInfo = function(source)
    local player = qbx_core:GetPlayer(source)
    local gang = player.PlayerData.gang
    return {
        name = gang.name,
        label = gang.label,
        grade = gang.grade,
        gradeName = gang.grade.name,
    }
end

gg.framework.GetDob = function(source)
    local player = qbx_core:GetPlayer(source)
    return player.PlayerData.charinfo.birthdate
end

gg.framework.GetSex = function(source)
    local player = qbx_core:GetPlayer(source)
    return player.PlayerData.charinfo.gender
end

gg.framework.GetInventory = function(source)
    local player = qbx_core:GetPlayer(source)
    local items = {}
    local data = ox_inventory and exports.ox_inventory:GetInventoryItems(source) or player.PlayerData.items
    for slot, item in pairs(data) do
        table.insert(items, {
            name = item.name,
            label = item.label,
            slot = slot,
            count = ox_inventory and item.count or item.amount,
            weight = item.weight,
            metadata = ox_inventory and item.metadata or item.info
        })
    end
    return items
end

gg.framework.GetItemData = function(item)
    return "Item Data" -- Qbox Inventory Handles This
end

gg.framework.RegisterUsableItem = function(item, cb)
    qbx_core:CreateUseableItem(item, cb)
end

gg.framework.GetMoney = function(source, accountname)
    local Player = qbx_core:GetPlayer(source).PlayerData
    if accountname == 'cash' then
        return Player.money.cash
    elseif accountname == 'bank' then
        return Player.money.bank
    end
end

gg.framework.AddMoney = function(source, accountname, amount, reason)
    local Player = qbx_core:GetPlayer(source)
    if accountname == 'cash' then
        return Player.Functions.AddMoney('cash', amount, reason)
    elseif accountname == 'bank' then
        return Player.Functions.AddMoney('bank', amount, reason)
    end
end

gg.framework.RemoveMoney = function(source, accountname, amount, reason)
    local Player = qbx_core:GetPlayer(source)
    if accountname == 'cash' then
        return Player.Functions.RemoveMoney('cash', amount, reason)
    elseif accountname == 'bank' then
        return Player.Functions.RemoveMoney('bank', amount, reason)
    end
end

gg.framework.SetJob = function(source, jobId, grade)
    local Player = qbx_core:GetPlayer(source)
    if not Player then return false end
    Player.Functions.SetJob(jobId, tonumber(grade) or 0)
    return true
end

gg.framework.GetVehicle = function(vehicle)
    if not vehicle then return vehicle or "" end
    local vehicle_data = qbx_core:GetVehiclesByName(vehicle)
    if type(vehicle_data) == "table" and vehicle_data.name then
        return vehicle_data.name
    end
    return vehicle
end

gg.framework.getItemLabel = function(item)
    local itemData = exports.ox_inventory:Items(item)
    return (itemData and itemData.label) or item
end

gg.framework.GetVehicleTable = function()
    local out = {}
    local vehicles = qbx_core:GetVehiclesByName()
    if type(vehicles) == "table" then
        for model, data in pairs(vehicles) do
            out[#out + 1] = { model = type(data.model) == "string" and data.model or tostring(model), label = data.name or tostring(model) }
        end
    end
    return out
end

local cached_admins = {}
gg.framework.HasPermission = function(source)
    if not source or source == 0 or type(source) ~= "number" then
        return false
    end

    if cached_admins[source] ~= nil then
        return cached_admins[source]
    end

    for _, id in pairs(GetPlayerIdentifiers(source)) do
        if id:find("license") or id:find("license2") then
            if utility.admins[id] then
                cached_admins[source] = true
                return true
            end
        end
    end

    if qbx_core:HasPermission(source, "admin") then
        cached_admins[source] = true
        return true
    end

    cached_admins[source] = false
    return false
end

gg.framework.GetUniquePlate = function()
    local letters, numbers = {}, {}

    for c = 65, 90 do letters[#letters+1] = string.char(c) end
    for c = 48, 57 do numbers[#numbers+1] = string.char(c) end

    local function rand(tbl)
        return tbl[math.random(#tbl)]
    end

    while true do
        local plate = ""

        plate = plate .. rand(numbers)
        plate = plate .. rand(letters)
        plate = plate .. rand(letters)
        plate = plate .. rand(numbers)
        plate = plate .. rand(numbers)
        plate = plate .. rand(numbers)
        plate = plate .. rand(letters)
        plate = plate .. rand(letters)
        
        local exists = MySQL.scalar.await(
            "SELECT 1 FROM player_vehicles WHERE plate = ? LIMIT 1",
            { plate }
        )

        if not exists then
            return plate
        end
    end
end

gg.framework.InsertVehiclePlayerGarage = function(payload)
    local src = payload.source
    local identifier = gg.framework.GetIdentifier(src)
    local license = GetPlayerIdentifierByType(src, "license2")

    if not license or license == "" then
        for _, v in ipairs(GetPlayerIdentifiers(src)) do
            if v:sub(1, 8) == "license2:" then
                license = v
                break
            end
        end
    end

    local valid_plate = payload.plate
    local result = MySQL.scalar.await(
        "SELECT 1 FROM player_vehicles WHERE plate = ? LIMIT 1",
        { valid_plate }
    )

    if result then
        valid_plate = gg.framework.GetUniquePlate()
    end

    MySQL.insert(
        "INSERT INTO player_vehicles (license, citizenid, vehicle, hash, mods, plate, state, garage) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        {
            license,
            identifier,
            payload.vehicle,
            GetHashKey(payload.vehicle),
            json.encode(payload.mods),
            valid_plate,
            payload.state or 0,
            payload.garage or nil,
        }
    )

    return true
end
