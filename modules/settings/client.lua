--------------------------------------------------
-- MARK: Settings Client
--------------------------------------------------
-- gg_lib settings module (client): pulls this resource's overrides down on
-- join and keeps them live. The client already has every default compiled into
-- its config files, so the only thing crossing the wire is the diff.
--
-- The editor UI itself lives in gg_lib -- nothing here touches NUI.

local RESOURCE = GetCurrentResourceName()

-- Callback and event names are global across resources, so each script scopes
-- its own sync channel.
local function channel(name)
    return ("gg_settings:%s:%s"):format(RESOURCE, name)
end

local revision = -1

-- Overlay the server's overrides and compile derived data. Until this lands the
-- client runs on defaults, which is correct rather than merely safe: an
-- unmodified server and a client mid-handshake resolve to the same config.
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

    -- Out-of-order or replayed pushes are dropped rather than applied backwards.
    if payload.revision and payload.revision <= revision then return end

    revision = payload.revision or revision
    settings.applyLive(payload.values or {})
end)

CreateThread(function()
    -- The store creates its tables and loads overrides on start, so the first
    -- request from a client that joined during boot can legitimately miss.
    for _ = 1, 20 do
        if pullSnapshot() then return end
        Wait(1000)
    end

    gg.print.warn("Could not pull settings from the server; running on defaults")

    -- Derived data still has to compile, or ids and unlock lists never exist.
    settings.resolve({})
end)

--------------------------------------------------
-- MARK: Generic Settings
--------------------------------------------------
-- Studio-wide values from gg_lib's store. gg_lib broadcasts every generic edit
-- to all clients; each GG script's client VM applies the push to its own
-- cfg.generic. The callback below hydrates joiners; revision guarding in
-- settings.generic.apply makes the overlap between the two harmless.

RegisterNetEvent("gg_lib:generic:sync", function(payload)
    settings.generic.apply(payload)
end)

CreateThread(function()
    for _ = 1, 20 do
        -- pcall: unlike the per-script snapshot above, this callback lives in
        -- another resource -- a gg_lib restart mid-await raises instead of
        -- returning, and that must not kill the retry loop.
        local called, ok, payload = pcall(lib.callback.await, "gg_lib:generic:snapshot", false)

        if called and ok and type(payload) == "table" then
            settings.generic.apply(payload)
            return
        end

        Wait(1000)
    end

    gg.print.warn("Could not pull generic settings from gg_lib; cfg.generic is empty")
end)
