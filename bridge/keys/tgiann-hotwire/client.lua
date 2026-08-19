gg.keys = gg.keys or {}

--- Hand the player keys to a vehicle.
gg.keys.AddKeys = function(veh)
    if type(veh) ~= "number" or veh == 0 or not DoesEntityExist(veh) then return false end

    local plate = GetVehicleNumberPlateText(veh)

    return exports['tgiann-hotwire']:GiveKeyVehicle(veh, true)
end

gg.keys.RemoveKeys = function(veh)
    if type(veh) ~= "number" or veh == 0 or not DoesEntityExist(veh) then return false end

    -- This one has no way to take a key back again.
    return false
end
