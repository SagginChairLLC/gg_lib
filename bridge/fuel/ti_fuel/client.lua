gg.fuel = gg.fuel or {}

-- Takes a fuel grade; RON91 is the ordinary one.
--- Fuel level of a vehicle, 0-100.
gg.fuel.getFuel = function(veh)
    if type(veh) ~= "number" or veh == 0 or not DoesEntityExist(veh) then return nil end

    return exports['ti_fuel']:getFuel(veh)
end

gg.fuel.setFuel = function(veh, level)
    if type(veh) ~= "number" or veh == 0 or not DoesEntityExist(veh) then return false end
    if type(level) ~= "number" then level = 100.0 end

    return exports['ti_fuel']:setFuel(veh, level, "RON91")
end
