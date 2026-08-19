gg.keys = gg.keys or {}

--- Hand the player keys to a vehicle.
gg.keys.AddKeys = function(veh)
    if type(veh) ~= "number" or veh == 0 or not DoesEntityExist(veh) then return false end

    local plate = GetVehicleNumberPlateText(veh)

    return exports.wasabi_carlock:GiveKey(plate)
end

gg.keys.RemoveKeys = function(veh)
    if type(veh) ~= "number" or veh == 0 or not DoesEntityExist(veh) then return false end

    local plate = GetVehicleNumberPlateText(veh)

    return exports.wasabi_carlock:RemoveKey(plate)
end
