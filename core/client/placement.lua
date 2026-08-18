--------------------------------------------------
-- MARK: World Placement
--------------------------------------------------
-- Backs the `coords` setting type. The real ped is spawned, playing the
-- scenario it will play for real, and the admin drags it into place instead of
-- typing numbers at it.
--
-- Two modes. Simple follows the camera: look where it goes, scroll to turn.
-- Advanced parks it and hands it to a three.js gizmo with real drag handles.

-- gg_lib's own client VM never runs init.lua -- that executes inside consumer
-- resources -- so the tool module is pulled in directly here.
gg = gg or {}
gg.print = gg.print or { error = print, warn = print }

-- editor.lua owns this and loads first, but a nil index here would kill the
-- placement callback and strand the player without focus -- the exact failure
-- the guard exists to prevent. Stubs keep that impossible.
GG_PAUSE_GUARD = GG_PAUSE_GUARD or { holders = 0 }
GG_PAUSE_GUARD.acquire = GG_PAUSE_GUARD.acquire or function() end
GG_PAUSE_GUARD.release = GG_PAUSE_GUARD.release or function() end

do
    local source = LoadResourceFile("gg_lib", "modules/tool/client.lua")
    local chunk  = source and load(source, "@@gg_lib/modules/tool/client.lua", "t")

    if chunk then
        local ok, err = pcall(chunk)
        if not ok then
            print(("^1[gg_lib] tool module failed to load: %s^0"):format(err))
        end
    else
        print("^1[gg_lib] could not read modules/tool/client.lua -- restart gg_lib^0")
    end
end

-- Stored positions follow the convention the configs already use: the z a
-- player standing there reports, which sits about a metre above the ground
-- their feet are on, because a ped's entity origin is its middle.
--
-- This is used in exactly ONE place: lifting a raycast ground hit into that
-- convention. It is NOT subtracted again when positioning the preview --
-- SetEntityCoordsNoOffset takes the same origin GetEntityCoords reports, so
-- subtracting there drops the ped to its waist in the ground.
local PED_CENTRE_OFFSET = 1.03

local RAY_DISTANCE  = 60.0
local COARSE_TURN   = 5.0
local FINE_TURN     = 1.0

local preview_ped = nil

-- The running tool's state, so the gizmo's NUI callback can reach it. Cleared
-- when the tool ends, so a late drag from a closed page lands nowhere.
local active_state = nil

--------------------------------------------------
-- MARK: Preview Ped
--------------------------------------------------

local function destroyPreview()
    if preview_ped and DoesEntityExist(preview_ped) then
        DeleteEntity(preview_ped)
    end

    preview_ped = nil
end

-- Nothing reaches a native without passing through here. A NaN or an infinity
-- in a coordinate is one of the few things that will take the game down hard,
-- and camera maths, a malformed stored value or a bad ray result can all
-- produce one.
local function finite(number, fallback)
    number = tonumber(number)

    if not number or number ~= number or number == math.huge or number == -math.huge then
        return fallback
    end

    return number
end

local function safeCoords(coords, fallback)
    if type(coords) ~= "table" and type(coords) ~= "vector3" and type(coords) ~= "vector4" then
        return fallback
    end

    local x = finite(coords.x, nil)
    local y = finite(coords.y, nil)
    local z = finite(coords.z, nil)

    if not x or not y or not z then return fallback end

    -- Well outside the map means something upstream is wrong; placing there
    -- would stream in nothing and is not a position anyone wants.
    if math.abs(x) > 16000 or math.abs(y) > 16000 or math.abs(z) > 2000 then
        return fallback
    end

    return vector3(x, y, z)
end

-- Last resort only: the studio-wide fallback ped is preferred, and this stands
-- in when that is unset or itself invalid.
local LAST_RESORT_PED = "a_m_m_business_01"

-- A list of positions has no model setting to preview from, so it falls back to
-- whatever Generic Settings nominates rather than a hardcoded suit.
local function fallbackPed()
    local configured = settings and settings.generic and settings.generic.get("fallback.ped")

    return type(configured) == "string" and configured ~= "" and configured or LAST_RESORT_PED
end

-- Non-colliding and invincible: the preview is a stand-in, and a solid ped
-- would shove the admin off a roof while they position it.
local function spawnPreview(model, scene, coords, heading)
    if type(model) ~= "string" or model == "" then model = fallbackPed() end

    local hash = joaat(model)

    if not IsModelValid(hash) then
        hash = joaat(fallbackPed())
        if not IsModelValid(hash) then hash = joaat(LAST_RESORT_PED) end
        if not IsModelValid(hash) then return nil end
    end

    RequestModel(hash)

    -- Bounded by a frame count, not a clock: a fixed number of yields cannot
    -- run away no matter what the timer does. If the model refuses to stream
    -- the tool still opens, just without a preview to drag.
    for _ = 1, 100 do
        if HasModelLoaded(hash) then break end
        Wait(10)
    end

    if not HasModelLoaded(hash) then
        SetModelAsNoLongerNeeded(hash)
        return nil
    end

    -- Spawned at the stored position as-is; movePreview owns the position from
    -- the next frame on, so both use one convention and cannot disagree.
    local ped = CreatePed(4, hash, coords.x, coords.y, coords.z, heading, false, false)

    SetModelAsNoLongerNeeded(hash)

    if not ped or ped == 0 or not DoesEntityExist(ped) then return nil end

    -- Deliberately the shortest list that makes a ped stand still and not get
    -- in the way. Alpha and the outline post-process were dropped: they are
    -- decoration, and decoration is not worth a chance of taking the game down.
    SetEntityInvincible(ped, true)
    SetEntityCollision(ped, false, false)
    SetBlockingOfNonTemporaryEvents(ped, true)
    FreezeEntityPosition(ped, true)

    return ped
end

-- The scenario is deliberately NOT started while the ped is being moved. A
-- scenario anchors a ped to a scenario point, and teleporting it out from under
-- that every frame fights the task system; it only starts once the ped has been
-- left alone for a moment, and is cleared again the instant it moves.
local SETTLE_MS = 350

local function movePreview(state)
    if not preview_ped or not DoesEntityExist(preview_ped) then return end

    local target = safeCoords(state.coords, nil)
    if not target then return end

    local heading = finite(state.heading, 0.0) % 360
    local moved = not state.last_applied
        or #(target - state.last_applied) > 0.001
        or math.abs(heading - (state.last_heading or -1)) > 0.01

    if moved then
        SetEntityCoordsNoOffset(preview_ped, target.x, target.y, target.z, false, false, false)
        SetEntityHeading(preview_ped, heading)

        state.last_applied = target
        state.last_heading = heading
        state.settled_at   = GetGameTimer() + SETTLE_MS

        if state.scenario_running then
            ClearPedTasksImmediately(preview_ped)
            state.scenario_running = false
        end

        return
    end

    if state.scene and not state.scenario_running and GetGameTimer() >= (state.settled_at or 0) then
        TaskStartScenarioInPlace(preview_ped, state.scene, 0, true)
        state.scenario_running = true
    end
end

--------------------------------------------------
-- MARK: Drag
--------------------------------------------------

-- Asynchronous on purpose. The synchronous probe blocks the game thread, and
-- firing one every frame in a Wait(0) loop is enough to bring it down; this
-- fires a ray, reads it whenever the engine has it ready, and reuses the last
-- good hit in between.
local pending_ray = nil
local last_ground = nil

local function groundUnderCursor()
    if pending_ray then
        local status, hit, endCoords = GetShapeTestResult(pending_ray)

        -- 1 means still working on it; anything else is a finished result.
        if status ~= 1 then
            pending_ray = nil

            -- The native answers with a boolean in Lua and an int elsewhere.
            if hit == true or hit == 1 then
                last_ground = safeCoords(endCoords, last_ground)
            end
        end
    end

    if not pending_ray then
        local camCoords = safeCoords(GetGameplayCamCoord(), nil)
        local rotation  = GetGameplayCamRot(2)

        -- No usable camera this frame: hold the last position rather than feed
        -- the shape test something it cannot use.
        if not camCoords then return last_ground end

        local pitch = math.rad(finite(rotation.x, 0.0))
        local yaw   = math.rad(finite(rotation.z, 0.0))
        local cos   = math.abs(math.cos(pitch))

        local direction = vector3(-math.sin(yaw) * cos, math.cos(yaw) * cos, math.sin(pitch))
        local target    = safeCoords(camCoords + direction * RAY_DISTANCE, nil)

        if not target then return last_ground end

        pending_ray = StartShapeTestRay(
            camCoords.x, camCoords.y, camCoords.z,
            target.x, target.y, target.z,
            -1, preview_ped or PlayerPedId(), 4
        )

        if not last_ground then
            local found, z = GetGroundZFor_3dCoord(target.x, target.y, target.z, false)
            last_ground = safeCoords(vector3(target.x, target.y, found and z or target.z), camCoords)
        end
    end

    return last_ground
end

--------------------------------------------------
-- MARK: Gizmo
--------------------------------------------------
-- Drawn by three.js in gg_lib's NUI: the game camera is mirrored into a
-- three.js camera every frame and drei's TransformControls draws real drag
-- handles over the entity.
--
-- The handles are in LOCAL space and the mesh carries the entity's heading, so
-- the arrows follow the way the ped faces instead of the world grid. That is
-- what stops a drag going off in a direction that looks wrong.

local gizmo_mode = "translate"

-- The camera and the entity, straight from the engine. Everything else --
-- projection, handle placement, hit testing -- is three.js's job, which is the
-- part worth not reimplementing by hand.
local function pushGizmo(state)
    local camCoords = safeCoords(GetFinalRenderedCamCoord(), nil)
    if not camCoords then return end

    local camRot = GetFinalRenderedCamRot(2)

    SendNUIMessage({
        action = "gg_gizmo",
        data = {
            ACTIVE   = true,
            MODE     = gizmo_mode,
            POSITION = { x = state.coords.x, y = state.coords.y, z = state.coords.z },
            HEADING  = finite(state.heading, 0.0),
            CAMERA   = {
                position = { x = camCoords.x, y = camCoords.y, z = camCoords.z },
                rotation = { x = finite(camRot.x, 0.0), y = finite(camRot.y, 0.0), z = finite(camRot.z, 0.0) },
                fov      = finite(GetFinalRenderedCamFov(), 50.0),
            },
        },
    })
end

-- A drag finished in the NUI. Validated like anything else that crosses in.
local function applyGizmoMove(state, payload)
    if type(payload) ~= "table" then return end

    local moved = safeCoords(payload.position, nil)
    if moved then
        state.coords = moved

        -- Camera-follow would drag the ped straight back off the handle.
        state.drag = false
    end

    local heading = finite(payload.heading, nil)
    if heading then state.heading = heading % 360 end
end

--------------------------------------------------
-- MARK: Placement Tool
--------------------------------------------------

local function pickPosition(initial, preview)
    local ped  = PlayerPedId()
    local here = safeCoords(GetEntityCoords(ped), vector3(0.0, 0.0, 72.0))

    -- A stored value can be anything -- an older schema, a hand-edited row, a
    -- half-filled table -- so it is validated before it reaches a native, and
    -- the player's own position stands in when it will not do.
    local heading = finite(initial and initial.heading, GetEntityHeading(ped)) % 360
    local start   = safeCoords(initial, here)

    -- A stale ray handle from a previous session would be read against this
    -- one's geometry on the first frame.
    pending_ray = nil
    last_ground = nil

    preview_ped = spawnPreview(preview and preview.model, preview and preview.scene, start, heading)

    local state = {
        coords  = start,
        heading = heading,
        drag    = true,
        fine    = false,
        mode    = "simple",
        cursor  = false,
        scene   = type(preview) == "table" and type(preview.scene) == "string" and preview.scene or nil,
    }

    -- The NUI reports drags against the frame published in the last tick, so
    -- the handler needs the same state table the loop is mutating.
    active_state = state

    -- `key` is what the HUD shows; `control` is what the game reads. A binding
    -- with no `key` still works but stays out of the legend, so the four arrow
    -- keys collapse into one "Arrows — Nudge" chip.
    -- ENTER places rather than E, because E switches modes. It pairs with ESC
    -- the way confirm/cancel normally reads.
    local place = { key = "ENTER", control = 191, label = "Place", finish = function(inner)
        return { x = inner.coords.x, y = inner.coords.y, z = inner.coords.z, heading = inner.heading }
    end }

    local cancel = { key = "ESC", control = 200, label = "Cancel", cancel = true }

    local turnUp = { control = 15, action = function(inner)
        inner.heading = (inner.heading + (inner.fine and FINE_TURN or COARSE_TURN)) % 360
    end }

    local turnDown = { key = "Scroll", control = 14, label = "Turn", action = function(inner)
        inner.heading = (inner.heading - (inner.fine and FINE_TURN or COARSE_TURN)) % 360
    end }

    local simple, advanced

    -- The cursor is what makes the gizmo usable, so it is a mode of its own.
    -- SetNuiFocusKeepInput keeps the game reading E/ENTER/ESC while the pointer
    -- belongs to the page, otherwise taking the cursor would take the keybinds
    -- with it and there would be no way back out.
    local function setCursor(inner, on)
        inner.cursor = on

        SetNuiFocus(on, on)
        SetNuiFocusKeepInput(on)

        if not on then
            SendNUIMessage({ action = "gg_gizmo", data = { ACTIVE = false } })
        end
    end

    local toggleCursor = { key = "L-ALT", control = 19, label = "Cursor", action = function(inner)
        setCursor(inner, not inner.cursor)
    end }

    local toAdvanced = { key = "E", control = 38, label = "Advanced", action = function(inner)
        inner.mode = "advanced"

        -- Advanced parks the ped and hands it to the gizmo. Camera-follow would
        -- fight every drag, so it goes off and stays off for the whole mode.
        inner.drag = false

        gg.tool.setKeys(advanced)

        -- Straight into the handles: advanced IS the gizmo, so making an admin
        -- press a second key to see it is a step with no decision in it.
        setCursor(inner, true)
    end }

    local toSimple = { key = "E", control = 38, label = "Simple", action = function(inner)
        inner.mode = "simple"

        -- Coming back to simple resumes camera-follow and drops the cursor;
        -- there is nothing to point at in simple.
        inner.drag = true
        setCursor(inner, false)

        gg.tool.setKeys(simple)
    end }

    -- Simple is the whole job for most placements: look where it goes, spin it,
    -- done. It never stops following the camera, so there is nothing to explain.
    simple = { place, cancel, turnUp, turnDown, toAdvanced }

    -- Advanced is the gizmo and nothing else. Keyboard nudging, height keys and
    -- a camera-drag toggle were all worse ways to do what the handles already
    -- do, and every one of them was another line in the legend to read past.
    advanced = {
        place, cancel,
        -- Move or turn: the same handles, switched between rather than crowded
        -- onto one gizmo.
        { key = "R", control = 45, label = "Move / Turn", action = function(inner)
            gizmo_mode = gizmo_mode == "translate" and "rotate" or "translate"

            if inner.cursor then pushGizmo(inner) end
        end },
        -- The only reason to drop the cursor is to swing the camera round for a
        -- better angle, so it toggles rather than being given up permanently.
        toggleCursor,
        toSimple,
    }

    return gg.tool.run({
        title = "Place Ped",
        state = state,
        keys  = simple,
        tick  = function(inner)
            -- Shift is a fine modifier for the scroll-turn in simple mode.
            inner.fine = IsDisabledControlPressed(0, 21)

            -- Simple always tracks the camera. Advanced can hold still, so a
            -- nudge is not undone by the next mouse movement.
            if inner.drag then
                local ground = groundUnderCursor()

                -- Lift the raycast hit into the stored convention; the preview
                -- takes it straight back off, which lands the ped on the ground
                -- exactly where the spawn will put it later.
                if ground then
                    inner.coords = vector3(ground.x, ground.y, ground.z + PED_CENTRE_OFFSET)
                end
            end

            -- Last gate before anything reaches a native.
            local safe = safeCoords(inner.coords, nil)
            if not safe then
                inner.coords = safeCoords(GetEntityCoords(PlayerPedId()), vector3(0.0, 0.0, 72.0))
                return
            end

            inner.coords = safe

            -- Nothing is drawn on screen: no markers, no text. The ped standing
            -- where it will stand is the preview, and the readout and keybinds
            -- live in the NUI panel. This loop touches the game only to move
            -- one entity.
            movePreview(inner)

            gg.tool.setInfo({
                { label = "X", value = ("%.2f"):format(safe.x) },
                { label = "Y", value = ("%.2f"):format(safe.y) },
                { label = "Z", value = ("%.2f"):format(safe.z) },
                { label = "Heading", value = ("%.1f"):format(finite(inner.heading, 0.0)) },
            }, inner.mode)

            -- The handles only exist while the pointer can reach them.
            if inner.cursor then pushGizmo(inner) end
        end,
        cleanup = function(inner)
            -- Focus has to come back whatever happened, or the player is left
            -- with a cursor over a game they can no longer control.
            SetNuiFocus(false, false)
            SetNuiFocusKeepInput(false)
            SendNUIMessage({ action = "gg_gizmo", data = { ACTIVE = false } })

            destroyPreview()
        end,
    })
end

--------------------------------------------------
-- MARK: Editor Bridge
--------------------------------------------------
-- The editor hands over, the admin places, the editor comes back with the
-- result staged. Focus is dropped for the duration or the raycast would fight
-- the NUI cursor.

RegisterNUICallback("gg_gizmo_move", function(data, cb)
    if active_state then
        pcall(applyGizmoMove, active_state, data)
    end

    cb({})
end)

RegisterNUICallback("settings_pick_coords", function(data, cb)
    -- Without the tool module there is no loop and no legend; answering the
    -- editor is better than erroring inside the callback and hanging it.
    if not gg.tool or not gg.tool.run then
        print("^1[gg_lib] placement unavailable: the tool module did not load^0")
        cb({ ok = false })
        return
    end

    if gg.tool.isActive() then
        cb({ ok = false })
        return
    end

    -- Held across the whole placement AND the handover back to the editor.
    -- The tool's own suppression ends with the tool, which left the cancelling
    -- ESC press free to open the map on the next frame.
    GG_PAUSE_GUARD.acquire()

    SetNuiFocus(false, false)
    SendNUIMessage({ action = "settings_placing", data = { PLACING = true } })

    -- Whatever happens in there, focus comes back and the editor reappears.
    -- Without this an error mid-placement leaves the player with no cursor, no
    -- editor and no way to recover short of a restart.
    local ok, picked = pcall(pickPosition, data and data.current, data and data.preview)

    active_state = nil

    gg.tool.abort()
    destroyPreview()

    SetNuiFocusKeepInput(false)

    SetNuiFocus(true, true)
    SendNUIMessage({ action = "settings_placing", data = { PLACING = false } })

    -- Released only now, a frame after focus is back with the editor. The
    -- editor still holds its own reference, so the guard keeps running.
    GG_PAUSE_GUARD.release()

    if not ok then
        print(("^1[gg_lib] placement failed: %s^0"):format(picked))
        cb({ ok = false })
        return
    end

    cb({ ok = picked ~= nil, COORDS = picked })
end)

-- Go stand where a saved position is, without leaving the editor. The whole
-- point of a coordinate list is judging whether each one is somewhere sensible,
-- and that cannot be done from the numbers.
RegisterNUICallback("settings_teleport", function(data, cb)
    local target = safeCoords(data and data.coords, nil)

    if not target then
        cb({ ok = false })
        return
    end

    local ped     = PlayerPedId()
    local vehicle = GetVehiclePedIsIn(ped, false)

    -- Moving the ped out from under a vehicle leaves the vehicle behind and the
    -- player seated in nothing, so whichever entity is carrying them moves.
    local entity = (vehicle ~= 0 and GetPedInVehicleSeat(vehicle, -1) == ped) and vehicle or ped

    local heading = finite(data.coords.heading, nil) or finite(data.coords.w, nil)

    SetEntityCoords(entity, target.x, target.y, target.z, false, false, false, false)
    if heading then SetEntityHeading(entity, heading % 360) end

    cb({ ok = true })
end)

AddEventHandler("onResourceStop", function(resource)
    if resource ~= "gg_lib" then return end

    gg.tool.abort()
    destroyPreview()
end)
