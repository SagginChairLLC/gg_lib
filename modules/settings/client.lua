--------------------------------------------------
-- MARK: Settings Client
--------------------------------------------------

local RESOURCE = GetCurrentResourceName()

local function channel(name)
    return ("gg_settings:%s:%s"):format(RESOURCE, name)
end

local revision = -1

local function pullSnapshot()
    local ok, payload = lib.callback.await(channel("snapshot"), false)

    if not ok or type(payload) ~= "table" then return false end

    revision = payload.revision or 0
    settings.resolve(payload.values or {})

    return true
end

RegisterNetEvent(channel("sync"), function(payload)
    if type(payload) ~= "table" then return end
    if payload.resource ~= RESOURCE then return end

    if payload.revision and payload.revision <= revision then return end

    revision = payload.revision or revision
    settings.applyLive(payload.values or {})
end)

CreateThread(function()
    for _ = 1, 20 do
        if pullSnapshot() then return end
        Wait(1000)
    end

    gg.print.warn("Could not pull settings from the server; running on defaults")

    settings.resolve({})
end)

--------------------------------------------------
-- MARK: Generic Settings
--------------------------------------------------

RegisterNetEvent("gg_lib:generic:sync", function(payload)
    settings.generic.apply(payload)
end)

CreateThread(function()
    for _ = 1, 20 do
        local called, ok, payload = pcall(lib.callback.await, "gg_lib:generic:snapshot", false)

        if called and ok and type(payload) == "table" then
            settings.generic.apply(payload)
            return
        end

        Wait(1000)
    end

    gg.print.warn("Could not pull generic settings from gg_lib; cfg.generic is empty")
end)
