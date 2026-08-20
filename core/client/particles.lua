--------------------------------------------------
-- MARK: Particle Viewer
--------------------------------------------------
-- A dev tool: pick a ptfx out of the panel and it plays in front of you, with
-- the scale, colour and alpha live so an effect can be dialled in without a
-- restart between every try.
--
-- One effect at a time. Swapping stops the one before it, and everything is
-- torn down on the way out -- a looped ptfx nobody removed stays in the world
-- until the client restarts.

local RESOURCE = GetCurrentResourceName()

-- Far enough to see the whole effect, close enough to read it.
local AHEAD = 3.0

-- A dictionary that will not load is a wrong name, not a slow disk.
local LOAD_TIMEOUT_MS = 5000

local open = false

-- The editor is what opens this, and it should be there again on the way out.
local hadFocus = false

local current = {
    handle = nil,
    dict   = nil,
    effect = nil,
    scale  = 1.0,
    colour = { r = 255, g = 255, b = 255 },
    alpha  = 1.0,
}

local loaded = {}   -- dict -> true, so a dictionary is requested once

local function say(message)
    print(("[gg_lib] %s"):format(message))
end

--------------------------------------------------
-- MARK: Assets
--------------------------------------------------

local function loadAsset(dict)
    if loaded[dict] then return true end
    if type(dict) ~= "string" or dict == "" then return false end

    RequestNamedPtfxAsset(dict)

    local deadline = GetGameTimer() + LOAD_TIMEOUT_MS

    while not HasNamedPtfxAssetLoaded(dict) do
        if GetGameTimer() > deadline then return false end

        Wait(0)
    end

    loaded[dict] = true

    return true
end

local function releaseAssets()
    for dict in pairs(loaded) do
        RemoveNamedPtfxAsset(dict)
    end

    loaded = {}
end

--------------------------------------------------
-- MARK: The effect
--------------------------------------------------

local function stop()
    if current.handle and DoesParticleFxLoopedExist(current.handle) then
        RemoveParticleFx(current.handle, false)
    end

    current.handle = nil
end

--- Where the effect plays: a little in front of the player, at their feet.
local function spot()
    local ped = PlayerPedId()

    return GetOffsetFromEntityInWorldCoords(ped, 0.0, AHEAD, 0.0)
end

local function play(dict, effect)
    stop()

    if not loadAsset(dict) then
        say(("particle dictionary '%s' would not load -- check the name"):format(tostring(dict)))

        SendNUIMessage({ action = "particle_state", data = { PLAYING = false, ERROR = tostring(dict) } })

        return false
    end

    local at = spot()

    UseParticleFxAssetNextCall(dict)

    current.handle = StartParticleFxLoopedAtCoord(
        effect,
        at.x, at.y, at.z,
        0.0, 0.0, 0.0,
        current.scale,
        false, false, false, false
    )

    if not current.handle or current.handle == 0 then
        say(("particle '%s' in '%s' did not start -- check the effect name"):format(tostring(effect), tostring(dict)))

        SendNUIMessage({ action = "particle_state", data = { PLAYING = false, ERROR = tostring(effect) } })

        return false
    end

    current.dict, current.effect = dict, effect

    SetParticleFxLoopedColour(current.handle, current.colour.r / 255, current.colour.g / 255, current.colour.b / 255, false)
    SetParticleFxLoopedAlpha(current.handle, current.alpha)

    SendNUIMessage({ action = "particle_state", data = { PLAYING = true, DICT = dict, EFFECT = effect } })

    return true
end

--- Re-applies whatever the panel is showing to the effect that is running.
local function restyle()
    if not (current.handle and DoesParticleFxLoopedExist(current.handle)) then return end

    SetParticleFxLoopedScale(current.handle, current.scale)
    SetParticleFxLoopedColour(current.handle, current.colour.r / 255, current.colour.g / 255, current.colour.b / 255, false)
    SetParticleFxLoopedAlpha(current.handle, current.alpha)
end

--------------------------------------------------
-- MARK: The mode
--------------------------------------------------

-- Keeping input means the game still hears everything, including the click
-- that picked an effect out of the panel. These are the ones that would fire
-- a weapon, throw a punch or open something over the top of the viewer;
-- movement and the camera are deliberately left alone.
local BLOCKED = {
    24, 25, 257, 263, 264,          -- attack, aim, melee
    140, 141, 142, 143,             -- melee light, heavy, alternate, block
    69, 70, 92, 114, 331,           -- attacking from a vehicle
    37,                             -- weapon wheel
    245,                            -- chat, so typing in the panel stays there
    199, 200,                       -- pause, so escape closes the viewer
    19,                             -- the look key itself, read below rather than acted on
}

local LOOK_KEY = 19            -- left alt

-- Two ways to be in here, and Alt swaps between them.
--
-- Cursor: NUI has the input, so the panel can be clicked and dragged and the
-- ped stands still. Nothing reaches the game at all, which is the point --
-- keeping input alive is what had the ped walking under the panel.
--
-- Free: NUI lets go, so the mouse is the camera and the ped moves normally.
--
-- Each side reads Alt from wherever the input actually is: the page while it
-- has focus, the control while it does not. Neither can get stuck.
local cursor = true

local function setCursor(on)
    cursor = on

    SetNuiFocus(on, on)

    SendNUIMessage({ action = "particle_look", data = { LOOKING = not on } })
end

local function watchCursor()
    CreateThread(function()
        while open do
            -- Only while the game can hear it; the page sends the other way.
            if not cursor and IsDisabledControlJustPressed(0, LOOK_KEY) then
                setCursor(true)
            end

            if not cursor then
                for index = 1, #BLOCKED do
                    DisableControlAction(0, BLOCKED[index], true)
                end
            end

            Wait(0)
        end

        cursor = true
    end)
end

local function enter()
    if open then return end

    open = true
    hadFocus = IsNuiFocused()

    cursor = true

    SetNuiFocus(true, true)

    watchCursor()

    SendNUIMessage({ action = "particle_open", data = { OPEN = true } })
end

local function exit()
    if not open then return end

    open = false

    stop()
    releaseAssets()

    cursor = true

    SetNuiFocus(hadFocus, hadFocus)

    SendNUIMessage({ action = "particle_open", data = { OPEN = false } })
end

--------------------------------------------------
-- MARK: The panel
--------------------------------------------------

RegisterNUICallback("particle_enter", function(_, cb)
    cb({ ok = true })

    enter()
end)

RegisterNUICallback("particle_look", function(data, cb)
    cb({ ok = true })

    setCursor(not (data and data.free == true))
end)

RegisterNUICallback("particle_exit", function(_, cb)
    cb({ ok = true })

    exit()
end)

RegisterNUICallback("particle_play", function(data, cb)
    local dict   = data and data.dict
    local effect = data and data.effect

    if type(dict) ~= "string" or type(effect) ~= "string" then
        cb({ ok = false })
        return
    end

    cb({ ok = true })

    CreateThread(function()
        play(dict, effect)
    end)
end)

RegisterNUICallback("particle_stop", function(_, cb)
    cb({ ok = true })

    stop()

    SendNUIMessage({ action = "particle_state", data = { PLAYING = false } })
end)

RegisterNUICallback("particle_style", function(data, cb)
    cb({ ok = true })

    if type(data) ~= "table" then return end

    current.scale = tonumber(data.scale) or current.scale
    current.alpha = tonumber(data.alpha) or current.alpha

    if type(data.colour) == "table" then
        current.colour = {
            r = tonumber(data.colour.r) or current.colour.r,
            g = tonumber(data.colour.g) or current.colour.g,
            b = tonumber(data.colour.b) or current.colour.b,
        }
    end

    restyle()
end)

--- Moves the running effect to where the player is standing now, so an effect
--- can be walked around and then put back in front.
RegisterNUICallback("particle_recentre", function(_, cb)
    cb({ ok = true })

    if not (current.dict and current.effect) then return end

    CreateThread(function()
        play(current.dict, current.effect)
    end)
end)

--------------------------------------------------
-- MARK: Cleanup
--------------------------------------------------

AddEventHandler("onClientResourceStop", function(resource)
    if resource ~= RESOURCE then return end

    stop()
    releaseAssets()

    if open then
        SetNuiFocus(false, false)
        open = false
    end
end)

exports("ggParticleViewer", function()
    enter()

    return true
end)
