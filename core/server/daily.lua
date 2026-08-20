--------------------------------------------------
-- MARK: Daily Reset
--------------------------------------------------
-- One clock for every GG script. Whatever resets daily -- progress, streaks,
-- claims, payouts -- rolls over at the same moment, set once on the Generic
-- page rather than in each script's own config.
--
-- This is not a cron. A cron fires at a time, and a server that was switched
-- off at that time simply never gets it. What is stored instead is the last
-- reset boundary a script has dealt with, so the question at boot is not "is it
-- midnight" but "has a midnight passed since this script last looked" -- which
-- answers itself the same way after eight minutes of downtime or eight days.

Daily = {}

local DAY = 86400

-- Poll rather than sleep the whole way to the boundary: the reset time is a
-- setting, and an owner moving it should not have to wait out the old one.
local MAX_SLEEP = 60

-- Printed here rather than through gg.print: this file loads before the one
-- that defines it, and a scheduler that cannot say what it did is worse than
-- one with plain prints.
local function say(message)
    print(("[gg_lib] %s"):format(message))
end

local function warn(message)
    print(("^3[gg_lib] %s^0"):format(message))
end

local tasks   = {}   -- resource -> true
local handled = {}   -- resource -> the last boundary it dealt with
local ready   = false

--------------------------------------------------
-- MARK: The boundary
--------------------------------------------------

local function resetClock()
    local clock = GenericSettings and GenericSettings.get and GenericSettings.get("reset.daily_time") or "00:00"
    local zone  = GenericSettings and GenericSettings.get and GenericSettings.get("reset.timezone")

    local hour, minute = tostring(clock):match("^(%d%d?):(%d%d)$")

    return tonumber(hour) or 0, tonumber(minute) or 0, (settings.timezones or {})[zone] or 0
end

--- The most recent moment the reset was due, at or before `now`.
---
--- Done in plain seconds rather than through os.date and os.time: those read
--- and write the machine's own timezone, and a server in one zone resetting on
--- a clock set in another is exactly what this has to get right.
function Daily.boundaryAt(now)
    local hour, minute, offset = resetClock()

    local zoned  = now + offset
    local intoDay = zoned % DAY
    local target  = (hour * 3600) + (minute * 60)

    local due = zoned - intoDay + target

    -- Before today's reset time means the last one was yesterday's.
    if intoDay < target then due = due - DAY end

    return due - offset
end

function Daily.nextAt(now)
    now = now or os.time()

    return Daily.boundaryAt(now) + DAY
end

function Daily.secondsUntil(now)
    now = now or os.time()

    return math.max(0, Daily.nextAt(now) - now)
end

--------------------------------------------------
-- MARK: Storage
--------------------------------------------------

local function ensureTable()
    MySQL.query.await([=[
    CREATE TABLE IF NOT EXISTS `gg_studio_daily` (
        `resource` VARCHAR(64) NOT NULL COLLATE 'utf8mb4_general_ci',
        `last_run` BIGINT NOT NULL DEFAULT 0,
        `ran_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (`resource`) USING BTREE
    )
    COLLATE='utf8mb4_general_ci'
    ENGINE=InnoDB
    ROW_FORMAT=DYNAMIC;
    ]=])
end

local function loadHandled()
    local rows = MySQL.query.await("SELECT resource, last_run FROM gg_studio_daily")

    for _, row in ipairs(rows or {}) do
        handled[row.resource] = tonumber(row.last_run) or 0
    end
end

local function remember(resource, boundary)
    handled[resource] = boundary

    MySQL.query.await([[
        INSERT INTO gg_studio_daily (resource, last_run) VALUES (?, ?)
        ON DUPLICATE KEY UPDATE last_run = VALUES(last_run)
    ]], { resource, boundary })
end

--------------------------------------------------
-- MARK: Replication
--------------------------------------------------

-- Every script draws a countdown to this. Published rather than fetched so a
-- client works it out for itself, and carries the server's own clock alongside
-- it so a player whose machine is minutes out still counts down correctly.
local function publish()
    local now = os.time()

    GlobalState.gg_daily = {
        next = Daily.nextAt(now),
        at   = now,
    }
end

--------------------------------------------------
-- MARK: Running
--------------------------------------------------

--- Runs one script's reset. The boundary is only written down once the script
--- says it worked, so a reset that failed is tried again rather than skipped.
local function run(resource, boundary)
    if GetResourceState(resource) ~= "started" then return false end

    local ok, accepted = pcall(function()
        return exports[resource]:ggDailyRun(boundary)
    end)

    if not ok then
        warn(("Daily reset for %s failed: %s"):format(resource, accepted))
        return false
    end

    if accepted == false then
        warn(("Daily reset for %s reported a problem; it will be tried again"):format(resource))
        return false
    end

    remember(resource, boundary)

    return true
end

--- Everything behind the given boundary, caught up. The same path serves a
--- boot after downtime and a rollover on a running server, so there is only
--- one behaviour to get right.
local function catchUp(boundary)
    local ran = 0

    for resource in pairs(tasks) do
        local last = handled[resource]

        if last and last < boundary then
            if run(resource, boundary) then ran = ran + 1 end
        end
    end

    if ran > 0 then
        say(("Daily reset ran for %d script(s)"):format(ran))
        TriggerEvent("gg_lib:daily:reset", boundary)
    end

    return ran
end

--------------------------------------------------
-- MARK: Registration
--------------------------------------------------

--- A script saying it has something to reset. Called through the gg.daily
--- module, so the invoking resource is the one that owns the handler.
local function register(resource)
    if not resource or tasks[resource] then return end

    tasks[resource] = true

    if not ready then return end

    local boundary = Daily.boundaryAt(os.time())

    -- A script gg_lib has never seen starts caught up. Firing a reset the
    -- first time a script is installed would wipe whatever it shipped with.
    if handled[resource] == nil then
        remember(resource, boundary)
        return
    end

    if handled[resource] < boundary then run(resource, boundary) end
end

exports("ggDailyRegister", function()
    register(GetInvokingResource())

    return true
end)

exports("ggDailyNext", function()
    return Daily.nextAt()
end)

exports("ggDailySecondsUntil", function()
    return Daily.secondsUntil()
end)

--- Runs the reset now, as though the boundary had just passed. For an owner
--- who wants to roll everything over without waiting for the clock.
function Daily.force()
    local boundary = Daily.boundaryAt(os.time())
    local ran = 0

    for resource in pairs(tasks) do
        if run(resource, boundary) then ran = ran + 1 end
    end

    if ran > 0 then TriggerEvent("gg_lib:daily:reset", boundary) end

    return ran
end

exports("ggDailyForce", function()
    return Daily.force()
end)

--------------------------------------------------
-- MARK: Boot
--------------------------------------------------

AddEventHandler("gg_lib:database:ready", function()
    ensureTable()
    loadHandled()

    ready = true

    -- Anything that registered while the database was still coming up.
    for resource in pairs(tasks) do
        if handled[resource] == nil then
            remember(resource, Daily.boundaryAt(os.time()))
        end
    end

    publish()

    CreateThread(function()
        while true do
            local now      = os.time()
            local boundary = Daily.boundaryAt(now)

            catchUp(boundary)
            publish()

            local remaining = math.max(1, Daily.nextAt(now) - now)

            Wait(math.min(remaining, MAX_SLEEP) * 1000)
        end
    end)
end)

-- Moving the reset time moves the countdown with it.
AddEventHandler("gg_lib:generic:changed", function(changed)
    for _, path in ipairs(changed or {}) do
        if path == "reset.daily_time" or path == "reset.timezone" then
            publish()
            return
        end
    end
end)

RegisterCommand("gg_daily_reset", function(source)
    if source ~= 0 and not Admins.can(source, "manage_admins") then return end

    local ran = Daily.force()

    print(("[gg_lib] daily reset ran for %d script(s)"):format(ran))
end, true)
