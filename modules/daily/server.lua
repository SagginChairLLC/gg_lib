gg.daily = gg.daily or {}

--- Whatever this script resets every day.
---
--- gg_lib keeps one clock for every GG script, set on the Generic page, so a
--- server running six of them rolls all six over at the same moment.
---
--- It is not a cron. gg_lib remembers the last reset this script dealt with,
--- so a server that was switched off across the reset time runs it on the way
--- back up rather than skipping the day.

local handlers = {}

--- Runs when the day rolls over, and on boot if one rolled over while the
--- server was down. Register as many as the script needs.
---
--- The handler is given the boundary it is resetting for, as a unix timestamp.
--- Returning false says it did not work, and gg_lib will try again rather than
--- writing the day off.
function gg.daily.onReset(handler)
    if type(handler) ~= "function" then return false end

    handlers[#handlers + 1] = handler

    -- Told once, on the first handler: gg_lib only needs to know this script
    -- has something to reset.
    if #handlers == 1 then
        exports.gg_lib:ggDailyRegister()
    end

    return true
end

--- Seconds until the next reset, for a countdown.
function gg.daily.secondsUntil()
    return exports.gg_lib:ggDailySecondsUntil() or 0
end

--- When the next reset lands, as a unix timestamp.
function gg.daily.nextAt()
    return exports.gg_lib:ggDailyNext() or 0
end

--- Rolls every registered script over now, without waiting for the clock.
function gg.daily.force()
    return exports.gg_lib:ggDailyForce() or 0
end

--- gg_lib calling in. Every handler runs; if any of them fails the whole thing
--- is reported as failed, so nothing is marked done that did not finish.
exports("ggDailyRun", function(boundary)
    local failed = false

    for _, handler in ipairs(handlers) do
        local ok, result = pcall(handler, boundary)

        if not ok then
            failed = true
            gg.print.error(("A daily reset handler failed: %s"):format(result))
        elseif result == false then
            failed = true
        end
    end

    return not failed
end)
