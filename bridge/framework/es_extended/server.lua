gg.framework = gg.framework or {}

local ESX = exports.es_extended:getSharedObject()
local ox_inventory = GetResourceState('ox_inventory') == 'started' and true or false
local utility = require("utility")

--- Get the player's identifier.
-- @param source number: The player's server ID.
-- @return string: The player's identifier.
gg.framework.GetIdentifier = function(source)
    if not source then return nil end
    local player = ESX.GetPlayerFromId(source)
    if not player then return nil end
    return tostring(player.getIdentifier())
end

--- Get the player's name.
-- @param source number: The player's server ID.
-- @return string: The player's name.
gg.framework.GetName = function(source)
    local player = ESX.GetPlayerFromId(source)
    if not player then return "" end
    return player.getName()
end

-- @param identifier string | The player's unique identifier.
-- @return string The player's full name.
gg.framework.GetNameByIdentifier = function(identifier)
    if not identifier then return nil end
    
    if identifier then
        local result = MySQL.query.await('SELECT firstname, lastname FROM users WHERE identifier = ?', { identifier })
        if result and result[1] then
            local fn, ln = result[1].firstname, result[1].lastname
            local name = fn..' '..ln
            return name
        end
    end
    return "Unknown"
end

gg.framework.GetItemData = function(item)
    return "Item Data" -- ESX inventories handle this
end

--- Get the count of players with a specific job.
-- @param source number: The player's server ID.
-- @param job string: The job name to search for.
-- @return table: A list of players with the given job.
gg.framework.GetJobCount = function(source, job)
    return ESX.GetExtendedPlayers('job', job)
end

--- Get the player's group/job information.
-- @param source number: The player's server ID.
-- @return string, boolean: The player's job name and gang status (always false).
gg.framework.GetPlayerGroups = function(source)
    local player = ESX.GetPlayerFromId(source)
    local job = player.getJob()
    return job.name, false
end

--- Get detailed job information for a player.
-- @param source number: The player's server ID.
-- @return table: A table containing job details (name, label, grade, and gradeName).
gg.framework.GetPlayerJobInfo = function(source)
    local player = ESX.GetPlayerFromId(source)
    local job = player.getJob()
    local jobInfo = {
        name = job.name,
        label = job.label,
        grade = job.grade,
        gradeName = job.grade_label,
    }
    return jobInfo
end

--- Get gang information for a player (always false).
-- @param source number: The player's server ID.
-- @return boolean: Always returns false.
gg.framework.GetPlayerGangInfo = function(source)
    return false
end

--- Get all players and their basic information.
-- @return table: A list of players with job, gang, and source information.
gg.framework.GetPlayers = function()
    local players = ESX.GetExtendedPlayers()
    local formattedPlayers = {}
    for _, v in pairs(players) do
        local player = {
            job = v.getJob().name,
            gang = false,
            source = v.source,
            onDuty = false,
        }
        table.insert(formattedPlayers, player)
    end
    return formattedPlayers
end

--- Get the player's date of birth.
-- @param source number: The player's server ID.
-- @return string: The player's date of birth.
gg.framework.GetDob = function(source)
    local player = ESX.GetPlayerFromId(source)
    return player.variables.dateofbirth
end

--- Get the player's sex.
-- @param source number: The player's server ID.
-- @return string: The player's sex.
gg.framework.GetSex = function(source)
    local player = ESX.GetPlayerFromId(source)
    return player.variables.sex
end

--- Get a player's inventory.
-- @param source number: The player's server ID.
-- @return table: A list of inventory items with details (name, label, count, weight, metadata).
gg.framework.GetInventory = function(source)
    local player = ESX.GetPlayerFromId(source)
    local items = {}
    local data = ox_inventory and exports.ox_inventory:GetInventoryItems(source) or player.getInventory()
    for i = 1, #data do
        local item = data[i]
        items[#items + 1] = {
            name = item.name,
            label = item.label,
            count = ox_inventory and item.count or item.amount,
            weight = item.weight,
            metadata = ox_inventory and item.metadata or item.info
        }
    end
    return items
end

--- Register a usable item.
-- @param item string: The item's name.
-- @param cb function: The callback function triggered when the item is used.
gg.framework.RegisterUsableItem = function(item, cb)
    ESX.RegisterUsableItem(item, cb)
end

gg.framework.GetMoney = function(src, accountname)
    local xPlayer = ESX.GetPlayerFromId(src)
    if accountname == 'cash' then
        return tonumber(xPlayer.getAccount("money").money)
    elseif accountname == 'bank' then
        return tonumber(xPlayer.getAccount("bank").money)
    end
end

gg.framework.AddMoney = function(src, accountname, amount, reason)
    local xPlayer = ESX.GetPlayerFromId(src)
    if accountname == 'cash' then
        xPlayer.addAccountMoney("money", amount)
        return true
    elseif accountname == 'bank' then
        xPlayer.addAccountMoney("bank", amount)
        return true
    end
end

gg.framework.RemoveMoney = function(src, accountname, amount, reason)
    local xPlayer = ESX.GetPlayerFromId(src)
    if accountname == 'cash' then
        if gg.framework.GetMoney(src, accountname) >= tonumber(amount) then
            xPlayer.removeAccountMoney("money", amount)
            return true
        end
        return false
    elseif accountname == 'bank' then
        if gg.framework.GetMoney(src, accountname) >= tonumber(amount) then
            xPlayer.removeAccountMoney("bank", amount)
            return true
        end
        return false
    end
end


local vehicle_storage = {}
local last_ret = 0

--- GetVehicle
--- @param vehicle string The vehicle model name to lookup
--- @return string|nil Returns vehicle name if model is found, otherwise nil
gg.framework.GetVehicle = function(vehicle)
    if not vehicle or type(vehicle) ~= "string" then
        return nil
    end

    if (last_ret + 600) < os.time() then
        vehicle_storage = {}


        local function safeQuery(sql, retries, delay)
            retries = retries or 5
            delay = delay or 1000

            for i = 1, retries do
                local ok, result = pcall(function()
                    return MySQL.query.await(sql)
                end)

                if ok and result and #result > 0 then
                    return result
                end

                Wait(delay)
            end

            return {}
        end

        local results = safeQuery("SELECT name, model FROM vehicles", 10, 3000)

        if results and type(results) == "table" then
            for _, row in ipairs(results) do
                if row.model and row.name then
                    vehicle_storage[row.model] = row.name
                end
            end
        end

        last_ret = os.time()
    end

    return vehicle_storage[vehicle] or vehicle
end

local vehicle_list = {}
local last_request = 0
lib.callback.register(GetCurrentResourceName()..":server:retrieveVehicleList", function()
     if (last_request + 600) < os.time() then
        vehicle_list = {}
        local results = MySQL.query.await("SELECT model FROM vehicles")
        if not results or next(results) == nil then
            return {}
        end
        vehicle_list = results
        last_request = os.time()
    end

    return vehicle_list or {}
end)


gg.framework.getItemLabel = function(item)
    if not item then return nil end

    if GetResourceState("qs-inventory") == "started" then
        local itemList = exports["qs-inventory"]:GetItemList()
        return (itemList[item] and itemList[item].label) or item
    elseif GetResourceState("core_inventory") == "started" then
        return item
    elseif GetResourceState("ox_inventory") == "started" then
        local itemData = exports.ox_inventory:Items(item)
        return (itemData and itemData.label) or item
    end

    return item
end


local cached_admins = {}
gg.framework.HasPermission = function(source)
    if cached_admins[source] ~= nil then
        return cached_admins[source]
    end

    local xPlayer = ESX.GetPlayerFromId(source)
    if xPlayer.admin then
        cached_admins[source] = true
        return true
    end

    for _, id in pairs(GetPlayerIdentifiers(source)) do
        if id:find("license") or id:find("license2") then
            if utility.admins[id] then
                cached_admins[source] = true
                return true
            end
        end
    end

    cached_admins[source] = false
    return false
end

gg.framework.GetUniquePlate = function()
    local charset = {}
    for c = 65, 90 do charset[#charset+1] = string.char(c) end
    for c = 48, 57 do charset[#charset+1] = string.char(c) end

    while true do
        local plate, hasLetter, hasNumber = "", false, false

        for i = 1, 8 do
            local char = charset[math.random(#charset)]
            if char:match("%a") then hasLetter = true end
            if char:match("%d") then hasNumber = true end
            plate = plate .. char
        end

        if hasLetter and hasNumber then
            local exists = MySQL.scalar.await(
                "SELECT 1 FROM owned_vehicles WHERE plate = ? LIMIT 1",
                { plate }
            )
            if not exists then return plate end
        end
    end
end

gg.framework.InsertVehiclePlayerGarage = function(payload)
    local src = payload.source
    local identifier = gg.framework.GetIdentifier(src)
    local license = GetPlayerIdentifierByType(src, "license")

    if not license or license == "" then
        for _, v in ipairs(GetPlayerIdentifiers(src)) do
            if v:sub(1, 8) == "license:" then
                license = v
                break
            end
        end
    end

    local valid_plate = payload.plate
    local result = MySQL.scalar.await(
        "SELECT 1 FROM owned_vehicles WHERE plate = ? LIMIT 1",
        { valid_plate }
    )

    if result then
        valid_plate = gg.framework.GetUniquePlate()
    end

    -- mods may need to use this ESX.Game.GetVehicleProperties(currentDisplayVehicle)

    MySQL.insert(
        "INSERT INTO owned_vehicles (owner, plate, vehicle, type, job, stored, parking, pound, mileage, glovebox, trunk) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        {
            identifier,
            valid_plate,
            json.encode(payload.mods or {}),
            payload.type or "car",
            payload.job or nil,
            0,
            nil,
            nil, 
            0.0,
            json.encode({}),
            json.encode({})
        }
    )

    return true
end
