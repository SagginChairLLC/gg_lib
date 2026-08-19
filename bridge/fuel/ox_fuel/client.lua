gg.fuel = gg.fuel or {}

-- Fuel lives on the entity statebag here rather than behind an export.
--- Fuel level of a vehicle, 0-100.
gg.fuel.getFuel = function(veh)
    if type(veh) ~= "number" or veh == 0 or not DoesEntityExist(veh) then return nil end

    return Entity(veh).state.fuel
end

gg.fuel.setFuel = function(veh, level)
    if type(veh) ~= "number" or veh == 0 or not DoesEntityExist(veh) then return false end
    if type(level) ~= "number" then level = 100.0 end

    Entity(veh).state.fuel = level

    return true
end
