--------------------------------------------------
-- MARK: Outfit Preview
--------------------------------------------------
-- Numbers in a settings page do not tell anyone what an outfit looks like, so
-- this is a small clothing editor: a copy of the player on a camera, turned
-- by dragging, with a short menu beside it.
--
-- The ped is a plain freemode body, not a copy of the player. An outfit is a
-- fixed set of clothes handed to everyone who takes the job, so a neutral
-- body says more about it than one particular character does -- and nothing
-- here can go wrong with somebody's real appearance. The player is only
-- hidden, and only for themselves.

gg = gg or {}

local RESOURCE = GetCurrentResourceName()

local MODELS = {
    male   = "mp_m_freemode_01",
    female = "mp_f_freemode_01",
}

-- Slot name to the component id the natives take. The names are the studio's;
-- the numbers are the game's.
local COMPONENTS = {
    face = 0, mask = 1, hair = 2, arms = 3, pants = 4, bag = 5,
    shoes = 6, accessory = 7, undershirt = 8, kevlar = 9, badge = 10, jacket = 11,
}

local PROPS = {
    hat = 0, glasses = 1, ear = 2, watch = 6, bracelet = 7,
}

local LOAD_TIMEOUT_MS = 8000

local DISTANCE = { min = 1.0, max = 5.0 }
local HEIGHT   = { min = 0.1, max = 2.2 }

local preview = nil
local camera  = nil
local heading = 0.0

-- Where the camera sits relative to the ped: the direction it was first placed
-- along, plus how far out and how high. Kept apart from the ped's own facing,
-- so turning the ped never drags the shot around with it.
-- Height is measured from the ped's feet, because that is where a ped's
-- coordinates are. Chest high is roughly a metre up; anything less frames
-- the shot on somebody's knees.
local view = { dir = nil, at = nil, distance = 3.1, height = 0.8 }

-- How far to push the subject off centre, in metres across the frame. The
-- menu covers the right of the screen, so a ped centred on the camera is
-- not centred on the part of the screen anyone can see.
local SHIFT = 0.55

-- Asked for, as opposed to arrived at. The camera walks towards these
-- rather than snapping, which is the difference between adjusting a shot
-- and being teleported around one.
local target = { distance = 3.1, height = 0.8 }

local function clamp(value, low, high)
    if value < low then return low end
    if value > high then return high end

    return value
end

--------------------------------------------------
-- MARK: The player
--------------------------------------------------

local hidden = false

--- Out of the way, and only for this player. A body standing between the
--- camera and the ped is the likeliest thing to ruin the shot, and it is the
--- one thing guaranteed to be right there.
local function hidePlayer(on)
    if on == hidden then return end

    hidden = on

    local ped = PlayerPedId()

    SetEntityVisible(ped, not on, false)
    SetLocalPlayerVisibleLocally(not on)
    FreezeEntityPosition(ped, on)
    SetEntityInvincible(ped, on)
end

--------------------------------------------------
-- MARK: Input
--------------------------------------------------

-- NUI focus takes the pointer for the page but leaves the game listening
-- underneath, so dragging to turn the ped also throws punches. These are
-- held off for as long as the editor is up.
local BLOCKED = {
    24,  -- attack
    25,  -- aim
    140, -- melee light
    141, -- melee heavy
    142, -- melee alternate
    257, -- attack 2
    263, -- melee attack 1
    264, -- melee attack 2
    45,  -- reload
    22,  -- jump
    23,  -- enter vehicle
    75,  -- exit vehicle
    199, -- pause
    200, -- pause, alternate
}

local blocking = false

local function blockInput(on)
    if on == blocking then return end

    blocking = on

    if not on then return end

    CreateThread(function()
        while blocking do
            for index = 1, #BLOCKED do
                DisableControlAction(0, BLOCKED[index], true)
            end

            -- Disabling the control is not always enough to stop escape
            -- reaching the pause menu, and a pause menu opening behind a
            -- focused NUI page leaves the pointer stranded between the two.
            -- Shutting it the frame it appears is the reliable half.
            if IsPauseMenuActive() then SetPauseMenuActive(false) end

            Wait(0)
        end
    end)
end

--------------------------------------------------
-- MARK: The camera
--------------------------------------------------

local function applyCamera()
    if not (camera and view.at and view.dir) then return end

    SetCamCoord(
        camera,
        view.at.x + (view.dir.x * view.distance),
        view.at.y + (view.dir.y * view.distance),
        view.at.z + view.height
    )

    -- Screen right, for a camera looking back down its own placement line.
    -- Aiming to the right of the ped is what moves the ped to the left of
    -- the frame; moving the camera itself would just follow it round.
    local rx, ry = -view.dir.y, view.dir.x

    -- Aimed a little below its own height, so the ped keeps filling the frame
    -- rather than sliding out of the bottom of it as the camera rises.
    PointCamAtCoord(
        camera,
        view.at.x + (rx * SHIFT),
        view.at.y + (ry * SHIFT),
        view.at.z + (view.height * 0.85) + 0.15
    )
end

local easing = false

--- Walks the camera to wherever it was last asked to go.
---
--- One thread, started on demand and left to finish, so holding a key does
--- not stack a mover per keypress.
local function ease()
    if easing then return end

    easing = true

    CreateThread(function()
        while camera do
            local dd = target.distance - view.distance
            local dh = target.height - view.height

            if math.abs(dd) < 0.002 and math.abs(dh) < 0.002 then
                view.distance, view.height = target.distance, target.height

                applyCamera()

                break
            end

            view.distance = view.distance + (dd * 0.16)
            view.height   = view.height + (dh * 0.16)

            applyCamera()

            Wait(0)
        end

        easing = false
    end)
end

--- Points the shot at the ped, and only builds a camera if there is not one
--- already.
---
--- Swapping bodies deletes and respawns the ped, and tearing the camera down
--- with it started a blend back to gameplay that raced the blend into the new
--- camera. Gameplay won, and the shot was simply gone. The camera now outlives
--- every ped it looks at.
local function frame(ped)
    view.at = GetEntityCoords(ped)

    -- Taken once and then left alone.
    --
    -- Deriving it from the ped every time reads its *current* facing, so any
    -- change of clothes after turning the ped would recompute "in front" and
    -- swing the shot back round to the face. The direction belongs to the
    -- session, not to whichever way the ped happens to be pointing.
    if not view.dir then
        local front = GetOffsetFromEntityInWorldCoords(ped, 0.0, 1.0, 0.0)

        local dx, dy = front.x - view.at.x, front.y - view.at.y
        local length = math.sqrt((dx * dx) + (dy * dy))

        if length < 0.001 then length = 1.0 end

        view.dir = { x = dx / length, y = dy / length }
    end

    if camera then
        applyCamera()

        return
    end

    camera = CreateCamWithParams("DEFAULT_SCRIPTED_CAMERA", view.at.x, view.at.y, view.at.z + 1.0, 0.0, 0.0, 0.0, 40.0, false, 0)

    applyCamera()

    SetCamActive(camera, true)
    RenderScriptCams(true, true, 400, true, true)
end

-- What the ped looks like with nothing applied. Captured once, when the body
-- is built, so a slot that gets switched off has somewhere to go back to.
local base = nil

--- Just the body. The camera, the hidden player and the held controls all
--- stay, because a change of body is not the end of the session.
local function clearPed()
    if preview and DoesEntityExist(preview) then DeleteEntity(preview) end

    preview = nil
    base    = nil
end

local function clear()
    if camera then
        RenderScriptCams(false, true, 400, true, true)
        DestroyCam(camera, false)

        camera = nil
    end

    clearPed()

    view.dir = nil
    view.at  = nil

    view.distance, target.distance = 3.1, 3.1
    view.height, target.height     = 0.8, 0.8

    hidePlayer(false)
    blockInput(false)
end

--------------------------------------------------
-- MARK: The ped
--------------------------------------------------

--- A plain freemode body. Deliberately not the player: an outfit is a fixed
--- set of clothes handed to everyone who takes the job, and previewing it on
--- one particular character says less about it than a neutral body does.
local function makeBase(ped, gender)
    SetPedDefaultComponentVariation(ped)

    -- Without a head blend a freemode ped renders as the untextured default,
    -- which makes every outfit look broken regardless of what it is.
    local shape = gender == "female" and 21 or 4

    SetPedHeadBlendData(ped, shape, shape, 0, 0, 0, 0, 0.5, 0.5, 0.0, false)

    -- The model default is a green nobody wants to look at.
    SetPedHairColor(ped, 1, 1)

    local components, props = {}, {}

    for name, id in pairs(COMPONENTS) do
        components[name] = { drawable = GetPedDrawableVariation(ped, id), texture = GetPedTextureVariation(ped, id) }
    end

    for name, id in pairs(PROPS) do
        props[name] = { drawable = GetPedPropIndex(ped, id), texture = GetPedPropTextureIndex(ped, id) }
    end

    base = { components = components, props = props }
end

--- How far each slot can actually go on this body.
---
--- The game knows exactly how many drawables a component has and how many
--- textures that drawable has, and it is per model -- a hat with four
--- colours on the male body may have two on the female. Without asking, the
--- editor is a pair of unbounded number boxes and most of the numbers in
--- them are invisible clothing.
---
--- Counts are turned into highest-valid-index here, because that is what a
--- person typing into the box is choosing.
local function limitsOf(ped)
    local components, props = {}, {}

    for name, id in pairs(COMPONENTS) do
        local drawables = GetNumberOfPedDrawableVariations(ped, id)
        local current   = GetPedDrawableVariation(ped, id)

        components[name] = {
            drawable = math.max(0, drawables - 1),
            texture  = math.max(0, GetNumberOfPedTextureVariations(ped, id, current) - 1),
        }
    end

    for name, id in pairs(PROPS) do
        local drawables = GetNumberOfPedPropDrawableVariations(ped, id)
        local current   = GetPedPropIndex(ped, id)

        -- A prop can always be cleared, so -1 is a real choice and the count
        -- of textures is only meaningful once something is on.
        props[name] = {
            drawable = math.max(-1, drawables - 1),
            texture  = current >= 0 and math.max(0, GetNumberOfPedPropTextureVariations(ped, id, current) - 1) or 0,
        }
    end

    return { components = components, props = props }
end

--- Applies one kind of slot across the whole body.
---
--- Every slot is written every time, not just the ones the outfit mentions.
--- A slot that is switched off is put back to the base, which is what makes
--- turning one off show its effect immediately instead of leaving the last
--- thing that was applied sitting there.
local function apply(ped, slots, ids, isProp, fallback)
    for name, id in pairs(ids) do
        local slot     = type(slots) == "table" and slots[name] or nil
        local drawable = slot and tonumber(slot.drawable)
        local texture  = slot and tonumber(slot.texture) or 0

        if drawable == nil then
            local was = (fallback or {})[name] or {}

            drawable = was.drawable or (isProp and -1 or 0)
            texture  = was.texture or 0
        end

        if isProp then
            if drawable < 0 then
                ClearPedProp(ped, id)
            else
                SetPedPropIndex(ped, id, drawable, texture, true)
            end
        else
            SetPedComponentVariation(ped, id, drawable, texture, 0)
        end
    end
end

local function spawn(gender)
    local hash = joaat(MODELS[gender] or MODELS.male)

    if not IsModelInCdimage(hash) then return nil end

    RequestModel(hash)

    local deadline = GetGameTimer() + LOAD_TIMEOUT_MS

    while not HasModelLoaded(hash) do
        if GetGameTimer() > deadline then return nil end

        Wait(0)
    end

    local player = PlayerPedId()
    local at     = GetOffsetFromEntityInWorldCoords(player, 0.0, 2.2, 0.0)

    -- Dropped onto whatever is actually underfoot. Reusing the player's own
    -- height sinks the ped into a kerb or floats it over a step.
    local found, groundZ = GetGroundZFor_3dCoord(at.x, at.y, at.z + 1.0, false)

    local ped = CreatePed(4, hash, at.x, at.y, (found and groundZ or at.z) + 0.02, 0.0, false, false)

    SetModelAsNoLongerNeeded(hash)

    if not DoesEntityExist(ped) then return nil end

    SetEntityInvincible(ped, true)
    SetBlockingOfNonTemporaryEvents(ped, true)
    FreezeEntityPosition(ped, true)
    SetEntityAsMissionEntity(ped, true, true)

    -- Facing the player, so the outfit is seen from the front.
    heading = (GetEntityHeading(player) + 180.0) % 360.0

    SetEntityHeading(ped, heading)

    return ped
end

--------------------------------------------------
-- MARK: Callbacks
--------------------------------------------------

--- Show an outfit. Called again with different clothes while it is already up
--- redresses the same ped rather than churning through models, unless the
--- gender changed and the body has to change with it.
RegisterNUICallback("outfit_preview", function(data, cb)
    cb({ ok = true })

    if type(data) ~= "table" then return end

    local gender = data.gender == "female" and "female" or "male"

    CreateThread(function()
        local model = joaat(MODELS[gender])

        if preview and DoesEntityExist(preview) and GetEntityModel(preview) ~= model then clearPed() end

        if not (preview and DoesEntityExist(preview)) then
            preview = spawn(gender)

            if not preview then return end

            makeBase(preview, gender)

            hidePlayer(true)
            blockInput(true)
        end

        apply(preview, data.components, COMPONENTS, false, (base or {}).components)
        apply(preview, data.props, PROPS, true, (base or {}).props)

        -- After the clothes: setting a hair component resets the tint.
        SetPedHairColor(preview, 1, 1)

        frame(preview)

        -- Sent every time, not once: how many textures a slot has depends on
        -- which drawable is currently on it.
        SendNUIMessage({ action = "outfit_limits", data = limitsOf(preview) })
    end)
end)

RegisterNUICallback("outfit_close", function(_, cb)
    cb({ ok = true })

    clear()
end)

--- Turned by however far the pointer was dragged. The ped turns, not the
--- camera, so a jacket can be read from the back without the whole scene
--- swinging round.
RegisterNUICallback("outfit_turn", function(data, cb)
    cb({ ok = true })

    if not (preview and DoesEntityExist(preview)) then return end

    heading = (heading + (tonumber(data and data.by) or 0.0)) % 360.0

    SetEntityHeading(preview, heading)
end)

--- Up, down, in and out. Everything else about the shot stays put.
RegisterNUICallback("outfit_camera", function(data, cb)
    cb({ ok = true })

    if type(data) ~= "table" then return end

    target.distance = clamp(target.distance + (tonumber(data.dolly) or 0.0), DISTANCE.min, DISTANCE.max)
    target.height   = clamp(target.height + (tonumber(data.rise) or 0.0), HEIGHT.min, HEIGHT.max)

    ease()
end)

AddEventHandler("onResourceStop", function(name)
    if name == RESOURCE then clear() end
end)
