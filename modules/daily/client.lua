gg.daily = gg.daily or {}

--- The countdown to the next daily reset.
---
--- gg_lib publishes when the next one lands and what the server's clock read
--- when it said so. The difference between that and this machine's clock is
--- held onto, so a player whose computer is minutes out still counts down to
--- the same moment as everyone else.

local drift = 0
local nextAt = 0

local function read()
    local published = GlobalState.gg_daily

    if type(published) ~= "table" then return false end

    nextAt = tonumber(published.next) or 0
    drift  = (tonumber(published.at) or os.time()) - os.time()

    return nextAt > 0
end

read()

AddStateBagChangeHandler("gg_daily", "global", function()
    read()
end)

--- Seconds until the next reset. Zero until gg_lib has said when that is.
function gg.daily.secondsUntil()
    if nextAt == 0 and not read() then return 0 end

    return math.max(0, nextAt - (os.time() + drift))
end

--- When the next reset lands, on the server's clock.
function gg.daily.nextAt()
    if nextAt == 0 then read() end

    return nextAt
end

--- The countdown as hours, minutes and seconds, for drawing.
function gg.daily.remaining()
    local left = gg.daily.secondsUntil()

    return math.floor(left / 3600), math.floor(left % 3600 / 60), math.floor(left % 60)
end

--- "05:12:44", which is what most of these end up showing.
function gg.daily.clock()
    return ("%02d:%02d:%02d"):format(gg.daily.remaining())
end
