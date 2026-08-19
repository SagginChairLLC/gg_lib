gg.keys = gg.keys or {}

--- Hand the player keys to a vehicle.
gg.keys.AddKeys = function(veh)
    if type(veh) ~= "number" or veh == 0 or not DoesEntityExist(veh) then return false end

    local plate = GetVehicleNumberPlateText(veh)
    local displayName = GetDisplayNameFromVehicleModel(GetEntityModel(veh))

    return exports['qs-vehiclekeys']:GiveKeys(plate, displayName, true)
end

gg.keys.RemoveKeys = function(veh)
    if type(veh) ~= "number" or veh == 0 or not DoesEntityExist(veh) then return false end

    local plate = GetVehicleNumberPlateText(veh)
    local displayName = GetDisplayNameFromVehicleModel(GetEntityModel(veh))

    return exports['qs-vehiclekeys']:RemoveKeys(plate, displayName)
end
