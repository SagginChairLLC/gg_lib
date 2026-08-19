gg.keys = gg.keys or {}

--- Hand the player keys to a vehicle.
gg.keys.AddKeys = function(veh)
    if type(veh) ~= "number" or veh == 0 or not DoesEntityExist(veh) then return false end

    local plate = GetVehicleNumberPlateText(veh)

    TriggerServerEvent('bhd_garage:keys:CreateKey', plate)

    return true
end

gg.keys.RemoveKeys = function(veh)
    if type(veh) ~= "number" or veh == 0 or not DoesEntityExist(veh) then return false end

    local plate = GetVehicleNumberPlateText(veh)

    TriggerServerEvent('bhd_garage:keys:DeleteKey', 1, plate)

    return true
end
