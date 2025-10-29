if not gg then gg = {} end

local request_recieved = false
local script_ready = false
local resources = {}
RegisterNetEvent(GetCurrentResourceName()..":client:receiveActiveResources", function(cachedActiveResources, cachedModules)
    if not cachedActiveResources or request_recieved then
        return
    end

    resources = cachedActiveResources
    request_recieved = true
end)


CreateThread(function()
    while not request_recieved do
        TriggerServerEvent(GetCurrentResourceName()..":server:requestActiveResources")
        Wait(1000)
    end

    if resources then
        for category, resourceList in pairs(resources) do
            for _, resourceName in ipairs(resourceList) do
                if resourceName then
                    local baseDir = "bridge/" .. category .. "/" .. resourceName .. "/"
                    local clientScript = baseDir .. "client.lua"
                    local resourceFile = LoadResourceFile(GetCurrentResourceName(), clientScript)

                    if not resourceFile then
                        return error(("Unable to find file at path '%s'"):format(clientScript))
                    end

                    local ld, err = load(resourceFile, ('@@%s/%s'):format(GetCurrentResourceName(), clientScript))

                    if not ld or err then
                        return error(err)
                    end

                    ld()
                end
            end
        end
    end
    
    script_ready = true
end)


local function deepCopy(orig, copies)
    copies = copies or {}
    if type(orig) ~= 'table' then
        return orig
    elseif copies[orig] then
        return copies[orig]
    end

    local copy = {}
    copies[orig] = copy

    for k, v in next, orig, nil do
        copy[deepCopy(k, copies)] = deepCopy(v, copies)
    end

    local mt = getmetatable(orig)
    if mt then
        setmetatable(copy, deepCopy(mt, copies))
    end

    return copy
end

exports('requestBridge', function()
    while not script_ready do Wait(0) end
    local clone = deepCopy(gg)
    return clone
end)
