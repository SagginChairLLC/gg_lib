
local shared = require("init.shared")
local script_ready = false
if not gg then gg = {} end
local cachedActiveResources = shared.checkResources(false)

local function checkVersion()
    local resource = "gg_lib"
    local current = GetResourceMetadata(resource, "version", 0)
    print(json.encode(current))
    if current then current = current:match("%d+%.%d+%.%d+") end
    if not current then
        return print(("^1Unable to read version for '%s'^0"):format(resource))
    end

    SetTimeout(1000, function()
        PerformHttpRequest("https://api.github.com/repos/SagginChairLLC/gg_lib/releases/latest", function(status, body)
            if status ~= 200 then return end

            local data = json.decode(body)
            if data.prerelease then return end

            local latest = data.tag_name:match("%d+%.%d+%.%d+")
            if not latest or latest == current then return end

            local cv = { string.strsplit(".", current) }
            local lv = { string.strsplit(".", latest) }

            for i = 1, #cv do
                local c, l = tonumber(cv[i]), tonumber(lv[i])
                if c ~= l then
                    if c < l then
                        return print(("^3Update available for %s (current: %s)\n%s^0"):format(resource, current, data.html_url))
                    else
                        break
                    end
                end
            end
        end, "GET")
    end)
end

CreateThread(function()
    shared.loadResourceScripts()
    checkVersion()
    script_ready = true
end)

RegisterNetEvent(GetCurrentResourceName()..":server:requestActiveResources", function()
    local src = source
    TriggerClientEvent(GetCurrentResourceName()..":client:receiveActiveResources", src, cachedActiveResources)
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
