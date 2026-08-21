gg.util = gg.util or {}

-- Stood in when a script's own model will not load. Deliberately not a
-- setting: what an owner needs is to be told which model is broken, not a
-- page for choosing what replaces it.
gg.util.FALLBACK_VEHICLE = "sultan"
gg.util.FALLBACK_PED     = "a_m_m_business_01"

--- True when the model is loaded and ready to spawn.
---
--- A model that does not exist used to fail silently, which is how a typo in
--- a config turns into an hour of wondering why nothing spawns.
gg.util.loadModel = function(model)
    if not IsModelValid(model) then
        print(("^3[gg_lib]^7 model '%s' is not in this game"):format(tostring(model)))

        return false
    end

    RequestModel(model)
    local timeout = GetGameTimer() + 5000
    while not HasModelLoaded(model) do
        Wait(100)
        if GetGameTimer() > timeout then
            print(("^3[gg_lib]^7 model '%s' would not load in time"):format(tostring(model)))

            return false
        end
    end

    return true
end

--- The model asked for, or the stand-in when it will not load. Nil when even
--- the stand-in fails, which means the game files are wrong rather than the
--- script.
---
--- Use this where a broken model should not stop the job: the player still
--- gets something to interact with, and the console says what was wrong.
gg.util.loadModelOr = function(model, fallback)
    if gg.util.loadModel(model) then return model end

    fallback = fallback or gg.util.FALLBACK_PED

    if model ~= fallback and gg.util.loadModel(fallback) then
        print(("^3[gg_lib]^7 using '%s' in place of '%s'"):format(tostring(fallback), tostring(model)))

        return fallback
    end

    return nil
end

gg.util.loadAnimDict = function(animDict)
    RequestAnimDict(animDict)
    local timeout = GetGameTimer() + 5000
    while not HasAnimDictLoaded(animDict) do
        Wait(100)
        if GetGameTimer() > timeout then
            print("^1[ERROR]^7 Animation dictionary load timed out: " .. tostring(animDict))
            return false
        end
    end

    return true
end

gg.util.round = function(num, numDecimalPlaces)
    local multiplier = 10^(numDecimalPlaces or 0)
    return math.floor(num * multiplier + 0.5) / multiplier
end

gg.util.clamp = function(num, min, max)
    if num < min then return min end
    if num > max then return max end
    return num
end

gg.util.getOrdinal = function(num)
    local suffixes = {"th", "st", "nd", "rd"}
    local last_digit = num % 10
    local last_two_digits = num % 100

    if last_two_digits >= 11 and last_two_digits <= 13 then
        return tostring(num) .. "th"
    end

    if last_digit == 1 then
        return tostring(num) .. suffixes[2]  -- "st"
    elseif last_digit == 2 then
        return tostring(num) .. suffixes[3]  -- "nd"
    elseif last_digit == 3 then
        return tostring(num) .. suffixes[4]  -- "rd"
    else
        return tostring(num) .. suffixes[1]  -- "th"
    end
end

gg.util.getEntityFromNet = function(netid)
    if not netid or not NetworkDoesNetworkIdExist(netid) then return false, nil end

    for i = 1, 25 do
        if NetworkDoesEntityExistWithNetworkId(netid) then
            local entity = NetworkGetEntityFromNetworkId(netid)
            if entity and DoesEntityExist(entity) then return true, entity end
        end
        Wait(0)
    end

    return false, nil
end

gg.util.ensureEntityControl = function(netid)
    if not netid then return false, nil end

    local entity = nil
    local hasControl = false
    for i = 1, 50 do
        if NetworkDoesNetworkIdExist(netid) and NetworkDoesEntityExistWithNetworkId(netid) then
            entity = NetworkGetEntityFromNetworkId(netid)
            if NetworkHasControlOfNetworkId(netid) then
                hasControl = true
                break
            end
            NetworkRequestControlOfNetworkId(netid)
        end
        Wait(0)
    end

    if not hasControl and entity then
        hasControl = NetworkHasControlOfNetworkId(netid)
    end

    return hasControl and entity ~= nil, entity
end
