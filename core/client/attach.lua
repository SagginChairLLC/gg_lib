--------------------------------------------------
-- MARK: Prop Attach Editor
--------------------------------------------------
-- A dev tool: hang a prop off a bone and nudge it into place, then take the
-- AttachEntityToEntity call away with you.
--
-- Two things make this readable rather than a guessing game.
--
-- The ped is put somewhere empty, facing north, with no rotation of its own, so
-- there is nothing in the scene and nothing in the ped's heading confusing what
-- you are looking at. It goes back where it was on the way out.
--
-- And the numbers on the panel are the numbers the native takes. Attach
-- rotations are measured in the BONE's frame, not the world's -- a hand bone
-- points wherever the hand points -- so a control that promised world axes
-- would be lying. X, Y and Z here turn the prop about the bone's own axes, one
-- at a time, which is the thing you can actually reason about.

local RESOURCE = GetCurrentResourceName()

-- High and empty. Nothing to see behind the prop, and nothing to fall into.
local PARK = vector3(0.0, 0.0, 1000.0)

local LOAD_TIMEOUT_MS = 8000

-- The order AttachEntityToEntity reads the rotation in. 2 is what nearly every
-- script uses, so it is what the copied call says.
local ROT_ORDER = 2

local open = false
local hadFocus = false

local prop = nil
local home = nil   -- where the ped was before it was borrowed

-- A prop hangs off a ped or off a vehicle, and the two name their bones
-- differently: peds by a hashed id, vehicles by a plain string. Everything
-- past boneIndex() is the same either way.
local state = {
    target  = "ped",
    model   = "",
    bone    = 57005,        -- ped bone id
    boneName = "chassis",   -- vehicle bone name
    vehicle = "taxi",
    pos     = { x = 0.0, y = 0.0, z = 0.0 },
    rot     = { x = 0.0, y = 0.0, z = 0.0 },
}

local testCar = nil

local function say(message)
    print(("[gg_lib] %s"):format(message))
end

--------------------------------------------------
-- MARK: Input
--------------------------------------------------

local BLOCKED = {
    24, 25, 257, 263, 264,
    140, 141, 142, 143,
    69, 70, 92, 114, 331,
    37, 245, 199, 200,
    19,
}

local LOOK_KEY = 19            -- left alt

-- Two ways to be in here, and Alt swaps between them.
--
-- Cursor: NUI has the input, so the panel can be clicked and the gizmo
-- dragged, and the ped stands still. Nothing reaches the game at all, which
-- is the point -- keeping input alive is what had the ped walking underneath.
--
-- Free: NUI lets go, so the mouse is the camera and the ped moves normally.
--
-- Each side reads Alt from wherever the input actually is: the page while it
-- has focus, the control while it does not. Neither can get stuck.
local cursor = true

local function setCursor(on)
    cursor = on

    SetNuiFocus(on, on)

    SendNUIMessage({ action = "attach_look", data = { LOOKING = not on } })
end

local function watchCursor()
    CreateThread(function()
        while open do
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

--------------------------------------------------
-- MARK: The bone frame
--------------------------------------------------
-- The gizmo works in world space, because that is the only space a person
-- can point at. AttachEntityToEntity works in the BONE's space. Everything
-- below exists to get from the first to the second.
--
-- The bone's frame is measured rather than calculated: attach the prop with
-- every value at zero and it sits exactly on the bone, wearing the bone's
-- orientation. Asking the game where that prop's own axes point gives the
-- bone's axes back, with no assumption about how the game stores rotations.

--- What the prop is attached to. The vehicle only exists while it is the
--- one being worked on; otherwise it is the player.
local function targetEntity()
    if state.target == "vehicle" and testCar and DoesEntityExist(testCar) then return testCar end

    return PlayerPedId()
end

--- Vehicles answer by name, peds by id. A vehicle without the bone asked
--- for comes back -1, which is worth saying rather than quietly using the
--- chassis instead.
local function boneIndex()
    local entity = targetEntity()

    if state.target == "vehicle" then
        local index = GetEntityBoneIndexByName(entity, state.boneName)

        return index
    end

    -- Bone 0 is the ped itself rather than a bone, and GetPedBoneIndex would
    -- turn that into something else.
    if state.bone == 0 then return 0 end

    return GetPedBoneIndex(entity, state.bone)
end

local frame = nil   -- { origin, right, forward, up }

local function sub(a, b)
    return { x = a.x - b.x, y = a.y - b.y, z = a.z - b.z }
end

local function dot(a, b)
    return (a.x * b.x) + (a.y * b.y) + (a.z * b.z)
end

local function clamp(value, low, high)
    if value < low then return low end
    if value > high then return high end

    return value
end

local function measureFrame()
    if not (prop and DoesEntityExist(prop)) then return end

    AttachEntityToEntity(
        prop, targetEntity(), boneIndex(),
        0.0, 0.0, 0.0, 0.0, 0.0, 0.0,
        true, true, false, true, ROT_ORDER, true
    )

    -- The attach lands next frame, so the reads have to wait for it.
    Wait(0)

    local origin = GetEntityCoords(prop)

    frame = {
        origin  = origin,
        right   = sub(GetOffsetFromEntityInWorldCoords(prop, 1.0, 0.0, 0.0), origin),
        forward = sub(GetOffsetFromEntityInWorldCoords(prop, 0.0, 1.0, 0.0), origin),
        up      = sub(GetOffsetFromEntityInWorldCoords(prop, 0.0, 0.0, 1.0), origin),
    }
end

--- A world transform, as the attach values that would produce it.
---
--- The gizmo sends its object's three axes rather than an angle, so nothing
--- has to guess how the page stores a rotation either. What is left is one
--- conversion at the very end, from the composed matrix to the Euler the
--- native takes, in rotation order 2.
local function toBoneSpace(at, right, forward, up)
    if not frame then return nil, nil end

    local delta = sub(at, frame.origin)

    local pos = {
        x = dot(delta, frame.right),
        y = dot(delta, frame.forward),
        z = dot(delta, frame.up),
    }

    -- Each world axis, written in the bone's axes. These are the columns of
    -- the rotation the native is being asked for.
    local lr = { x = dot(right, frame.right),   y = dot(right, frame.forward),   z = dot(right, frame.up) }
    local lf = { x = dot(forward, frame.right), y = dot(forward, frame.forward), z = dot(forward, frame.up) }
    local lu = { x = dot(up, frame.right),      y = dot(up, frame.forward),      z = dot(up, frame.up) }

    -- Order 2 is Rz * Rx * Ry, so the matrix reads back as below. The yaw
    -- line is the same atan2(-forward.x, forward.y) every heading in this
    -- game is worked out with, which is the check that the rest lines up.
    local rot = {
        x = math.deg(math.asin(clamp(lf.z, -1.0, 1.0))),
        y = math.deg(math.atan(-lr.z, lu.z)),
        z = math.deg(math.atan(-lf.x, lf.y)),
    }

    return pos, rot
end

--------------------------------------------------
-- MARK: The prop
--------------------------------------------------

local function clearProp()
    if prop and DoesEntityExist(prop) then DeleteEntity(prop) end

    prop = nil
end

--- Re-attaches with whatever the state currently says.
local function reattach()
    if not (prop and DoesEntityExist(prop)) then return end

    AttachEntityToEntity(
        prop, targetEntity(), boneIndex(),
        state.pos.x, state.pos.y, state.pos.z,
        state.rot.x, state.rot.y, state.rot.z,
        true, true, false, true, ROT_ORDER, true
    )
end

--- Tells the page where the prop ended up, so the gizmo can sit on it. Sent
--- as axes rather than angles for the same reason they arrive that way.
local function publishProp()
    if not (prop and DoesEntityExist(prop)) then
        SendNUIMessage({ action = "attach_prop", data = { PLACED = false } })
        return
    end

    local origin = GetEntityCoords(prop)

    SendNUIMessage({
        action = "attach_prop",
        data   = {
            PLACED  = true,
            AT      = origin,
            RIGHT   = sub(GetOffsetFromEntityInWorldCoords(prop, 1.0, 0.0, 0.0), origin),
            FORWARD = sub(GetOffsetFromEntityInWorldCoords(prop, 0.0, 1.0, 0.0), origin),
            UP      = sub(GetOffsetFromEntityInWorldCoords(prop, 0.0, 0.0, 1.0), origin),
            POS     = state.pos,
            ROT     = state.rot,
            BONE_OK = boneIndex() ~= -1,
        },
    })
end

--- Measures the bone, re-applies the placement, and tells the page. Anything
--- that changes which bone is in play goes through here.
local function rebuild()
    measureFrame()
    reattach()

    Wait(0)

    publishProp()
end

local function spawn(model)
    clearProp()

    if type(model) ~= "string" or model == "" then return false end

    local hash = joaat(model)

    if not IsModelInCdimage(hash) or not IsModelValid(hash) then
        say(("prop model '%s' is not in the game"):format(model))

        SendNUIMessage({ action = "attach_state", data = { ERROR = model } })

        return false
    end

    RequestModel(hash)

    local deadline = GetGameTimer() + LOAD_TIMEOUT_MS

    while not HasModelLoaded(hash) do
        if GetGameTimer() > deadline then
            say(("prop model '%s' would not load"):format(model))

            SendNUIMessage({ action = "attach_state", data = { ERROR = model } })

            return false
        end

        Wait(0)
    end

    local at = GetEntityCoords(PlayerPedId())

    prop = CreateObject(hash, at.x, at.y, at.z, false, false, false)

    SetModelAsNoLongerNeeded(hash)

    if not (prop and DoesEntityExist(prop)) then
        SendNUIMessage({ action = "attach_state", data = { ERROR = model } })

        return false
    end

    state.model = model

    measureFrame()
    reattach()

    Wait(0)

    publishProp()

    SendNUIMessage({ action = "attach_state", data = { MODEL = model, ERROR = false } })

    return true
end

--------------------------------------------------
-- MARK: The test vehicle
--------------------------------------------------

local function clearCar()
    if testCar and DoesEntityExist(testCar) then DeleteEntity(testCar) end

    testCar = nil
end

--- Puts a car in front of the ped to hang things off. Frozen, because a
--- car rolling away under the prop helps nobody.
local function spawnCar(model)
    clearCar()

    if type(model) ~= "string" or model == "" then return false end

    local hash = joaat(model)

    if not IsModelInCdimage(hash) or not IsModelAVehicle(hash) then
        say(("vehicle model '%s' is not in the game"):format(model))

        SendNUIMessage({ action = "attach_state", data = { ERROR = model } })

        return false
    end

    RequestModel(hash)

    local deadline = GetGameTimer() + LOAD_TIMEOUT_MS

    while not HasModelLoaded(hash) do
        if GetGameTimer() > deadline then
            say(("vehicle model '%s' would not load"):format(model))
            return false
        end

        Wait(0)
    end

    local ped = PlayerPedId()
    local at = GetOffsetFromEntityInWorldCoords(ped, 0.0, 4.5, 0.0)

    testCar = CreateVehicle(hash, at.x, at.y, at.z, 0.0, false, false)

    SetModelAsNoLongerNeeded(hash)

    if not (testCar and DoesEntityExist(testCar)) then return false end

    SetEntityInvincible(testCar, true)
    SetVehicleDoorsLocked(testCar, 2)
    FreezeEntityPosition(testCar, true)

    state.vehicle = model

    return true
end

--------------------------------------------------
-- MARK: The mode
--------------------------------------------------

local function park()
    local ped = PlayerPedId()

    home = GetEntityCoords(ped)

    FreezeEntityPosition(ped, true)
    SetEntityCoords(ped, PARK.x, PARK.y, PARK.z, false, false, false, true)
    SetEntityHeading(ped, 0.0)
    SetEntityRotation(ped, 0.0, 0.0, 0.0, 2, true)
end

local function unpark()
    local ped = PlayerPedId()

    ClearPedTasks(ped)
    FreezeEntityPosition(ped, false)

    if home then
        SetEntityCoords(ped, home.x, home.y, home.z, false, false, false, true)
        home = nil
    end
end

local function enter()
    if open then return end

    open = true
    hadFocus = IsNuiFocused()

    park()

    cursor = true

    SetNuiFocus(true, true)

    watchCursor()

    -- The gizmo draws in a canvas over the game, so it has to be told where
    -- the game camera is looking on every frame or the handles drift.
    CreateThread(function()
        while open do
            SendNUIMessage({
                action = "attach_camera",
                data   = {
                    POSITION = GetFinalRenderedCamCoord(),
                    ROTATION = GetFinalRenderedCamRot(2),
                    FOV      = GetFinalRenderedCamFov(),
                },
            })

            Wait(0)
        end
    end)

    SendNUIMessage({ action = "attach_open", data = { OPEN = true } })
end

local function exit()
    if not open then return end

    open = false
    cursor = true

    clearProp()
    clearCar()
    unpark()

    frame = nil

    SetNuiFocus(hadFocus, hadFocus)

    SendNUIMessage({ action = "attach_open", data = { OPEN = false } })
end

--------------------------------------------------
-- MARK: The panel
--------------------------------------------------

RegisterNUICallback("attach_enter", function(_, cb)
    cb({ ok = true })

    enter()
end)

RegisterNUICallback("attach_look", function(data, cb)
    cb({ ok = true })

    setCursor(not (data and data.free == true))
end)

RegisterNUICallback("attach_exit", function(_, cb)
    cb({ ok = true })

    exit()
end)

RegisterNUICallback("attach_spawn", function(data, cb)
    cb({ ok = true })

    CreateThread(function()
        spawn(data and data.model)
    end)
end)

RegisterNUICallback("attach_clear", function(_, cb)
    cb({ ok = true })

    clearProp()

    state.model = ""
end)

--- Everything the panel can change, in one shape. Sent whole on every edit so
--- there is only one path for the values to travel down.
--- The bone changed. Everything else follows from it, so it is measured
--- again and the placement re-applied on top.
--- Ped or vehicle. Swapping brings the car in or takes it away, and the
--- bone has to be measured again either way.
RegisterNUICallback("attach_target", function(data, cb)
    cb({ ok = true })

    local target = data and data.target

    if target ~= "ped" and target ~= "vehicle" then return end

    state.target = target

    CreateThread(function()
        if target == "vehicle" then
            spawnCar(data.vehicle or state.vehicle)
        else
            clearCar()
        end

        rebuild()

        SendNUIMessage({ action = "attach_target", data = { TARGET = target, VEHICLE = state.vehicle } })
    end)
end)

--- A different car to try the same placement against, which is most of the
--- point: a roof sign that fits a Stanier will not fit a Zentorno.
RegisterNUICallback("attach_vehicle", function(data, cb)
    cb({ ok = true })

    if type(data) ~= "table" or type(data.vehicle) ~= "string" then return end

    CreateThread(function()
        if spawnCar(data.vehicle) then
            rebuild()

            SendNUIMessage({ action = "attach_target", data = { TARGET = state.target, VEHICLE = state.vehicle } })
        end
    end)
end)

RegisterNUICallback("attach_bone", function(data, cb)
    cb({ ok = true })

    if type(data) ~= "table" then return end

    if type(data.boneName) == "string" and data.boneName ~= "" then
        state.boneName = data.boneName
    end

    local bone = tonumber(data.bone)

    if bone then state.bone = math.floor(bone) end

    CreateThread(rebuild)
end)

--- The gizmo moved. It sends where the prop should now be in the world, and
--- the bone frame turns that into the numbers the native wants.
RegisterNUICallback("attach_gizmo", function(data, cb)
    cb({ ok = true })

    if type(data) ~= "table" or not data.at then return end

    local pos, rot = toBoneSpace(data.at, data.right, data.forward, data.up)

    if not pos then return end

    state.pos, state.rot = pos, rot

    reattach()

    SendNUIMessage({ action = "attach_values", data = { POS = pos, ROT = rot } })
end)

--- A finished attachment, dropped in whole: prop, bone, placement and the
--- animation that goes with it. One call rather than four, so nothing is
--- half-applied while the prop is still loading.
RegisterNUICallback("attach_example", function(data, cb)
    cb({ ok = true })

    if type(data) ~= "table" then return end

    local bone = tonumber(data.bone)

    if bone then state.bone = math.floor(bone) end

    if type(data.pos) == "table" then
        state.pos = {
            x = tonumber(data.pos.x) or 0.0,
            y = tonumber(data.pos.y) or 0.0,
            z = tonumber(data.pos.z) or 0.0,
        }
    end

    if type(data.rot) == "table" then
        state.rot = {
            x = tonumber(data.rot.x) or 0.0,
            y = tonumber(data.rot.y) or 0.0,
            z = tonumber(data.rot.z) or 0.0,
        }
    end

    CreateThread(function()
        -- The placement is kept across the spawn, which is the point: the
        -- example arrives already placed rather than sitting on the bone.
        local keepPos, keepRot = state.pos, state.rot

        if type(data.model) == "string" and data.model ~= "" then
            spawn(data.model)
        end

        state.pos, state.rot = keepPos, keepRot

        rebuild()

        SendNUIMessage({ action = "attach_values", data = { POS = state.pos, ROT = state.rot } })
    end)
end)

--- Back to sitting on the bone with nothing applied.
RegisterNUICallback("attach_reset", function(_, cb)
    cb({ ok = true })

    state.pos = { x = 0.0, y = 0.0, z = 0.0 }
    state.rot = { x = 0.0, y = 0.0, z = 0.0 }

    CreateThread(rebuild)

    SendNUIMessage({ action = "attach_values", data = { POS = state.pos, ROT = state.rot } })
end)
--- Puts the ped through an animation, because a prop that sits right on a still
--- ped can still be wrong the moment they move.
RegisterNUICallback("attach_anim", function(data, cb)
    cb({ ok = true })

    local dict = data and data.dict
    local anim = data and data.anim
    local ped  = PlayerPedId()

    if type(dict) ~= "string" or dict == "" or type(anim) ~= "string" or anim == "" then
        ClearPedTasks(ped)
        return
    end

    CreateThread(function()
        RequestAnimDict(dict)

        local deadline = GetGameTimer() + LOAD_TIMEOUT_MS

        while not HasAnimDictLoaded(dict) do
            if GetGameTimer() > deadline then
                say(("animation dictionary '%s' would not load"):format(dict))
                return
            end

            Wait(0)
        end

        TaskPlayAnim(ped, dict, anim, 5.0, 5.0, -1, 15, 0, false, false, false)
        RemoveAnimDict(dict)
    end)
end)

--------------------------------------------------
-- MARK: Cleanup
--------------------------------------------------

AddEventHandler("onClientResourceStop", function(resource)
    if resource ~= RESOURCE then return end

    clearProp()
    clearCar()

    if open then
        unpark()

        SetNuiFocus(false, false)

        open = false
    end
end)

exports("ggAttachEditor", function()
    enter()

    return true
end)
