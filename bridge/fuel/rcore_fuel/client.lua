gg.fuel = gg.fuel or {}

--- Fuel level of a vehicle, 0-100.
gg.fuel.getFuel = function(veh)
    if type(veh) ~= "number" or veh == 0 or not DoesEntityExist(veh) then return nil end

    return exports['rcore_fuel']:GetVehicleFuelLiters(veh)
end

gg.fuel.setFuel = function(veh, level)
    if type(veh) ~= "number" or veh == 0 or not DoesEntityExist(veh) then return false end
    if type(level) ~= "number" then level = 100.0 end

    return exports['rcore_fuel']:SetVehicleFuel(veh, level)
end
