gg.tool = gg.tool or {}

--------------------------------------------------
-- MARK: Tool Mode
--------------------------------------------------
-- A modal state with its own keybinds and an on-screen legend of them. Any
-- flow that takes over the player's input -- placing a ped, aiming a camera,
-- drawing a zone -- describes its keys once and gets the loop, the legend and
-- the cleanup for free.
--
--   local result = gg.tool.run({
--       title = "Place Ped",
--       keys  = {
--           { key = "E",   control = 38,  label = "Place", finish = function(s) return s.coords end },
--           { key = "ESC", control = 200, label = "Cancel", cancel = true },
--       },
--       tick = function(state) ... end,
--   })
--
-- `run` blocks the calling thread until a key finishes or cancels it, then
-- returns that key's value (nil on cancel).
--
-- The legend is drawn by gg_lib's NUI, not by the game's text natives. Feeding
-- a long instructional string to AddTextComponentSubstringPlayerName every
-- frame is a known way to take the game down, and an HTML overlay reads better
-- besides.

-- Controls that would otherwise fire while the player aims the tool around.
-- E (38) and ENTER (191) are in here because a tool binds them: blocking a
-- control does not stop the tool reading it -- every binding is read with
-- IsDisabledControl* -- it stops the rest of the game and other resources
-- reacting to the same press, so tapping E cannot also trigger a nearby
-- interaction prompt.
-- 199/200 are the pause menu. A tool binds ESC to cancel, and without blocking
-- it the game opens the map on the same press -- the tool closes and the player
-- is left staring at the pause screen.
local BLOCKED = { 24, 25, 37, 38, 44, 47, 50, 68, 69, 70, 91, 92, 114, 121, 140, 141, 142, 143, 191, 199, 200, 257, 263, 264, 331 }

local active = false
local current = nil

local last_info = nil

local function showLegend(options)
    local keys = {}

    for index = 1, #options.keys do
        local key = options.keys[index]

        if key.label and key.key then
            keys[#keys + 1] = { key = key.key, label = key.label }
        end
    end

    SendNUIMessage({
        action = "gg_tool",
        data   = { ACTIVE = true, TITLE = options.title or "Tool", MODE = options.mode, KEYS = keys },
    })
end

-- Live readout rows: { { label = "X", value = "120.50" }, ... }. Diffed before
-- sending, because a tool calls this every frame and pushing an identical
-- payload sixty times a second is pure waste.
function gg.tool.setInfo(rows, mode)
    if not active then return end

    local signature = mode or ""

    for index = 1, #rows do
        signature = ("%s|%s=%s"):format(signature, rows[index].label, rows[index].value)
    end

    if signature == last_info then return end

    last_info = signature

    SendNUIMessage({ action = "gg_tool", data = { ACTIVE = true, MODE = mode, INFO = rows } })
end

local function hideLegend()
    SendNUIMessage({ action = "gg_tool", data = { ACTIVE = false } })
end

-- A tool's state table is handed to every callback, so keys and tick share one
-- scratch space without the caller threading it through closures.
function gg.tool.run(options)
    if active then return nil end
    if type(options) ~= "table" or type(options.keys) ~= "table" then return nil end

    active  = true
    current = options

    local state = options.state or {}
    state.tool  = options
    state.done  = false

    local result = nil

    showLegend(options)

    -- Everything past this point runs inside pcall: a tool that throws must
    -- still put the legend away and hand its cleanup a chance to run, or the
    -- player is left with an overlay and no way out.
    -- A backstop, not a feature: no tool should run for five minutes, and a
    -- loop that somehow stops responding to its own keys must still end rather
    -- than leave the player with no cursor and no way out.
    local deadline = GetGameTimer() + 300000

    local ok, err = pcall(function()
        while active and not state.done and GetGameTimer() < deadline do
            for index = 1, #BLOCKED do
                DisableControlAction(0, BLOCKED[index], true)
            end

            -- Disabling the pause controls is not enough on its own: the menu
            -- can still be opened by other means, and once it is up while the
            -- NUI holds focus no input reaches it, so it cannot be closed and
            -- the player is stuck until the resource restarts. Shutting it the
            -- same frame it appears makes that state unreachable.
            if IsPauseMenuActive() then
                SetFrontendActive(false)
            end

            if options.tick then options.tick(state) end

            for index = 1, #options.keys do
                local key = options.keys[index]
                local pressed = key.repeatable and IsDisabledControlPressed(0, key.control)
                    or IsDisabledControlJustPressed(0, key.control)

                if pressed then
                    if key.cancel then
                        state.done = true
                        result = nil
                    elseif key.finish then
                        state.done = true
                        result = key.finish(state)
                    elseif key.action then
                        key.action(state)
                    end

                    break
                end
            end

            Wait(0)
        end
    end)

    active    = false
    current   = nil
    last_info = nil

    hideLegend()

    if options.cleanup then pcall(options.cleanup, state) end

    if not ok then
        gg.print.error(("Tool '%s' failed: %s"):format(options.title or "?", err))
        return nil
    end

    return result
end

function gg.tool.isActive()
    return active
end

-- Swap the running tool's bindings, for a tool with more than one mode. The
-- loop reads options.keys fresh each frame, so replacing it takes effect on the
-- next one; the legend is re-sent so the HUD matches.
function gg.tool.setKeys(keys)
    if not active or not current or type(keys) ~= "table" then return end

    current.keys = keys
    showLegend(current)
end

-- Lets an outside event (a resource stopping, a player dying) drop the tool.
function gg.tool.abort()
    if not active then return end

    active = false
    hideLegend()
end
