--------------------------------------------------
-- MARK: Minigames
--------------------------------------------------
-- Runs the minigame set in gg_lib's own page. A caller asks for a game and
-- gets a pass/fail back; the drawing, input and theming all live here.
--
-- Config resolution, weakest first: the built-in defaults, then the server
-- owner's stored defaults, then whatever the calling script passes.

local RESOURCE = GetCurrentResourceName()

-- `cursor` frees the mouse for the games played by clicking rather than typing.
local GAMES = {
    skillcheck = { cursor = false, defaults = { rounds = 3, zone = 40, speed = 220, key = "" } },
    keymash    = { cursor = false, defaults = { time = 6, decay = 16, gain = 6, key = "" } },
    timing     = { cursor = false, defaults = { rounds = 3, zone = 16, speed = 0.7, key = "" } },
    sequence   = { cursor = false, defaults = { length = 6, time = 5 } },
    memory     = { cursor = true,  defaults = { size = 4, flashes = 5, time = 8 } },
    wordwiz    = { cursor = false, defaults = { length = 6, time = 10 } },
    connect    = { cursor = true,  defaults = { pairs = 4, time = 45 } },
    hold       = { cursor = false, defaults = { rounds = 3, zone = 18, speed = 55, time = 8, key = "" } },
    reflex     = { cursor = false, defaults = { rounds = 4, window = 1.3, key = "" } },
    breach     = { cursor = true,  defaults = { size = 5, length = 4, time = 30 } },
    lockpick   = { cursor = false, defaults = { rounds = 3, zone = 34, speed = 150, time = 25, key = "" } },
    codecrack  = { cursor = false, defaults = { length = 4, rounds = 5, time = 45 } },
}

-- A game that never answers -- a dead page, a broken build -- must not strand
-- the calling script forever.
local WATCHDOG_MS = 120000

local active = nil

--------------------------------------------------
-- MARK: Config
--------------------------------------------------

local function storedDefaults(name)
    local ok, stored = pcall(lib.callback.await, "gg_lib:minigames:defaults", false, name)

    return ok and type(stored) == "table" and stored or nil
end

local function resolveConfig(name, opts)
    local merged = {}

    for key, value in pairs(GAMES[name].defaults) do merged[key] = value end

    local stored = storedDefaults(name)
    if stored then
        for key, value in pairs(stored) do merged[key] = value end
    end

    if type(opts) == "table" then
        for key, value in pairs(opts) do merged[key] = value end
    end

    -- The page takes a key list; the config keeps a string because that is what
    -- an owner actually types. "E" is one key, "EFG" is a pool of three to draw
    -- from, and empty leaves the page its own. A caller passing `keys` outranks
    -- both. Either way the page draws once, and that key stands for the game.
    if merged.keys == nil and type(merged.key) == "string" then
        local pool = {}

        for character in merged.key:upper():gmatch("[A-Z0-9]") do
            pool[#pool + 1] = character
        end

        if #pool > 0 then merged.keys = pool end
    end

    merged.key = nil

    return merged
end

--------------------------------------------------
-- MARK: Play
--------------------------------------------------

local function play(name, opts)
    local game = GAMES[name]

    if not game then return false, ("'%s' is not a minigame"):format(tostring(name)) end
    if active then return false, "a minigame is already running" end

    active = promise.new()

    -- The editor keeps its focus when a game is tried from inside it; a game
    -- started from gameplay grabs and then fully releases it.
    local hadFocus = IsNuiFocused()

    GG_PAUSE_GUARD.acquire()
    SetNuiFocus(true, game.cursor)

    SendNUIMessage({
        action = "minigame_start",
        data   = { NAME = name, CONFIG = resolveConfig(name, opts) },
    })

    local watchdog = active

    SetTimeout(WATCHDOG_MS, function()
        if active ~= watchdog then return end

        -- Resolved here rather than asking the page to answer: a page that has
        -- stopped responding is exactly the case this exists for. The hide is
        -- best effort; the caller getting its answer is not.
        SendNUIMessage({ action = "minigame_cancel", data = {} })
        watchdog:resolve(false)
    end)

    local success = Citizen.Await(active)

    active = nil

    SetNuiFocus(hadFocus, hadFocus)
    GG_PAUSE_GUARD.release()

    return success == true
end

RegisterNUICallback("minigame_finish", function(data, cb)
    cb("ok")

    if not active then return end

    active:resolve(data and data.success == true)
end)

-- The studio's Try button. Answered before the game starts, or the page would
-- sit frozen behind the game waiting on this callback.
RegisterNUICallback("minigame_try", function(data, cb)
    cb({ ok = true })

    local name = data and data.name

    if type(name) ~= "string" or not GAMES[name] then return end

    CreateThread(function()
        play(name, {})
    end)
end)

--------------------------------------------------
-- MARK: Exports
--------------------------------------------------

exports("ggMinigame", function(name, opts)
    return play(name, opts)
end)

exports("ggMinigameCancel", function()
    if not active then return false end

    SendNUIMessage({ action = "minigame_cancel", data = {} })

    return true
end)

exports("ggMinigameActive", function()
    return active ~= nil
end)

-- Every game as its own export too, so a script outside the GG set calls one
-- directly: exports.gg_lib:ggSkillcheck({ rounds = 3 }).
for name in pairs(GAMES) do
    exports(("gg%s%s"):format(name:sub(1, 1):upper(), name:sub(2)), function(opts)
        return play(name, opts)
    end)
end

AddEventHandler("onResourceStop", function(resource)
    if resource ~= RESOURCE then return end

    if active then active:resolve(false) end
end)
