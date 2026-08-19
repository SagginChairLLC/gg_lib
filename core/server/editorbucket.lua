--------------------------------------------------
-- MARK: Editor Routing Bucket
--------------------------------------------------
-- World editing drops the player into a bucket of their own so the ghost
-- vehicles, the hidden body and the free camera are invisible to everyone
-- else, and so live traffic cannot drive through a depot being laid out.
--
-- Every path back out is covered, because being stuck in an empty world is a
-- far worse failure than a stale ghost: the client asks to leave when it is
-- done, the drop handler clears the record, a sweep pulls back anyone who has
-- been in there implausibly long, and stopping the resource empties it.

-- No init.lua in gg_lib's own server VM either, so nothing here may assume a
-- populated gg table.
gg = gg or {}
gg.print = gg.print or { error = print, warn = print, log = print }

local EDITOR_BUCKET = 21847

local MAX_SESSION_MS = 20 * 60 * 1000
local SWEEP_MS = 60000

local occupants = {}  -- src -> { bucket = previous, since = ms }

local function restore(src)
    local record = occupants[src]
    if not record then return false end

    occupants[src] = nil

    if GetPlayerName(src) then
        SetPlayerRoutingBucket(src, record.bucket or 0)
    end

    return true
end

local function enter(src)
    if occupants[src] then return true end

    local previous = GetPlayerRoutingBucket(src) or 0

    -- Already in the editor bucket somehow: send them home rather than
    -- recording it as the place to come back to.
    if previous == EDITOR_BUCKET then previous = 0 end

    occupants[src] = { bucket = previous, since = GetGameTimer() }

    SetPlayerRoutingBucket(src, EDITOR_BUCKET)

    return true
end

lib.callback.register("gg_lib:editor:bucketEnter", function(source)
    return enter(source)
end)

lib.callback.register("gg_lib:editor:bucketLeave", function(source)
    restore(source)

    return true
end)

AddEventHandler("playerDropped", function()
    occupants[source] = nil
end)

-- A client that crashed mid-edit never sends the leave, and a reconnect keeps
-- the same source only sometimes. This is the net under that.
CreateThread(function()
    while true do
        Wait(SWEEP_MS)

        local now = GetGameTimer()

        for src, record in pairs(occupants) do
            if not GetPlayerName(src) then
                occupants[src] = nil
            elseif (now - record.since) > MAX_SESSION_MS then
                gg.print.warn(("Editor bucket: pulling %s back after %d minutes"):format(src, MAX_SESSION_MS // 60000))
                restore(src)
            end
        end
    end
end)

AddEventHandler("onResourceStop", function(resource)
    if resource ~= GetCurrentResourceName() then return end

    for src in pairs(occupants) do
        restore(src)
    end
end)

--- Manual escape hatch for an admin whose client died in a way the sweep has
--- not caught up with yet.
RegisterCommand("gg_unstick", function(source)
    if source == 0 then
        for src in pairs(occupants) do restore(src) end
        print("Pulled every editor occupant back to their world")
        return
    end

    if restore(source) then
        TriggerClientEvent("gg_lib:editor:forceExit", source)
    end
end, true)
