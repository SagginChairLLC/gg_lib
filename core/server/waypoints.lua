--------------------------------------------------
-- MARK: Waypoint Defaults
--------------------------------------------------
-- Hands a client the owner's stored defaults for every waypoint style. Like
-- the minigame defaults these are tuning rather than secrets, so there is no
-- gate: any player about to see a waypoint needs them.

local KNOWN = { race = true, taxi = true }

lib.callback.register("gg_lib:waypoints:defaults", function()
    local out = {}

    for style in pairs(KNOWN) do
        out[style] = GenericSettings.get(("waypoints.%s"):format(style))
    end

    return out
end)
