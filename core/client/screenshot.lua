--------------------------------------------------
-- MARK: Vehicle Screenshots
--------------------------------------------------
-- Spawns a vehicle against a green backdrop, photographs it, and hands the
-- cropped transparent image to the server.
--
-- The whole pipeline lives here rather than in each script. A caller asks for
-- images and gets file names back; it needs no camera code, no canvas code and
-- no NUI of its own.

local RESOURCE = GetCurrentResourceName()

local CHUNK_SIZE = 8192

local busy = false
local vehicle = nil
local backdrop = false

local pending = {}
local nextRequest = 0

--------------------------------------------------
-- MARK: Backdrop
--------------------------------------------------

local FALLBACK_SPOT = vector4(-1324.13, -2257.61, 48.77, 260.0)

-- Asked of the server rather than read locally: gg_lib's own client VM does
-- not load the settings registry, so there is nothing here to read it from.
local function spot()
    local ok, stored = pcall(lib.callback.await, "gg_lib:screenshot:spot", false)

    if ok and type(stored) == "table" and tonumber(stored.x) then
        return vector4(stored.x, stored.y, stored.z, tonumber(stored.heading) or 0.0)
    end

    return FALLBACK_SPOT
end

local function drawBackdrop(at)
    CreateThread(function()
        while backdrop do
            Wait(0)

            DrawMarker(
                28,
                at.x, at.y, at.z - 1.0,
                0.0, 0.0, 0.0,
                0.0, 0.0, 0.0,
                25.0, 25.0, 25.0,
                0, 255, 0, 255,
                false, true, 2, false, nil, nil, false
            )
        end
    end)
end

--------------------------------------------------
-- MARK: Subject
--------------------------------------------------

local function despawn()
    if not vehicle then return end

    if DoesEntityExist(vehicle) then DeleteEntity(vehicle) end
    vehicle = nil
end

local function spawn(model, at)
    local hash = joaat(model)

    if not IsModelValid(hash) then return false end

    RequestModel(hash)

    -- Bounded by frames, not by a clock: a model that refuses to stream cannot
    -- hang the run no matter what the timer does.
    for _ = 1, 500 do
        if HasModelLoaded(hash) then break end
        Wait(10)
    end

    if not HasModelLoaded(hash) then return false end

    despawn()

    vehicle = CreateVehicle(hash, at.x, at.y, at.z, at.w or 0.0, false, false)
    if not vehicle or vehicle == 0 then return false end

    SetEntityAsMissionEntity(vehicle, true, true)
    SetVehicleOnGroundProperly(vehicle)
    FreezeEntityPosition(vehicle, true)
    SetModelAsNoLongerNeeded(hash)

    return true
end

local function frameSubject(cam, at)
    local minimum, maximum = GetModelDimensions(GetEntityModel(vehicle))

    local length = maximum.y - minimum.y
    local width  = maximum.x - minimum.x
    local height = maximum.z - minimum.z

    -- Bigger vehicles need the camera further out, but not linearly -- a bus
    -- pulled back by its own length would be a speck.
    local scale = math.max(0.6, math.sqrt(math.max(length, width) / 5.0))
    local aim   = at.z + height * 0.5

    SetCamCoord(cam, at.x + 7.0 * scale, at.y + 4.0 * scale, aim + 2.0 * scale)
    PointCamAtCoord(cam, at.x, at.y, aim)
    SetCamFov(cam, 40.0)
end

--------------------------------------------------
-- MARK: NUI round trip
--------------------------------------------------

--- Hands one capture to gg_lib's own page and waits for the processed webp.
local function processImage(image, quality)
    nextRequest = nextRequest + 1

    local id = tostring(nextRequest)
    local promise = promise.new()

    pending[id] = promise

    SendNUIMessage({
        action = "gg_screenshot_process",
        data   = { id = id, image = image, quality = quality },
    })

    -- A page that never answers would strand the run, so the wait is bounded
    -- and a timeout is reported like any other failure.
    CreateThread(function()
        Wait(15000)

        if pending[id] then
            pending[id] = nil
            promise:resolve({ ok = false, error = "timed out" })
        end
    end)

    return Citizen.Await(promise)
end

RegisterNUICallback("gg_screenshot_done", function(data, cb)
    cb("ok")

    local id = data and tostring(data.id)
    local promise = id and pending[id]

    if not promise then return end

    pending[id] = nil
    promise:resolve(data)
end)

--------------------------------------------------
-- MARK: Capture
--------------------------------------------------

local function sendToServer(id, webpB64, target, folder)
    local total = math.ceil(#webpB64 / CHUNK_SIZE)

    for index = 1, total do
        local from = (index - 1) * CHUNK_SIZE + 1
        local to   = math.min(index * CHUNK_SIZE, #webpB64)

        TriggerServerEvent("gg_lib:screenshot:chunk", {
            id     = id,
            index  = index,
            total  = total,
            body   = webpB64:sub(from, to),
            target = target,
            folder = folder,
        })

        Wait(10)
    end
end

--- entries: { { id = "adder", vehicle = "adder", mods = {}, color = {} }, ... }
local function capture(entries, options)
    if busy then return false, "a capture is already running" end
    if type(entries) ~= "table" or #entries == 0 then return false, "nothing to capture" end

    if GetResourceState("screenshot-basic") ~= "started" then
        return false, "screenshot-basic is not started"
    end

    options = options or {}

    local target = options.target or RESOURCE
    local folder = options.folder or "vehicle_images"
    local at     = spot()

    busy = true

    local radarWasVisible = not IsRadarHidden()
    if radarWasVisible then DisplayRadar(false) end

    SetFocusPosAndVel(at.x, at.y, at.z, 0.0, 0.0, 0.0)
    RequestCollisionAtCoord(at.x, at.y, at.z)

    local cam = CreateCam("DEFAULT_SCRIPTED_CAMERA", true)
    RenderScriptCams(true, false, 0, true, false)

    backdrop = true
    drawBackdrop(at)

    local done, failed = {}, {}

    -- pcall so a bad model or a NUI error still restores the camera, the radar
    -- and the player's view below.
    local ok, err = pcall(function()
        for index, entry in ipairs(entries) do
            if options.progress then
                options.progress(index, #entries, entry)
            end

            if not spawn(entry.vehicle, at) then
                failed[#failed + 1] = { id = entry.id, error = "model would not load" }
                goto continue
            end

            if entry.mods and lib and lib.setVehicleProperties then
                pcall(lib.setVehicleProperties, vehicle, entry.mods)
            end

            if entry.color and entry.color.primary and entry.color.secondary then
                SetVehicleCustomPrimaryColour(vehicle, entry.color.primary.r, entry.color.primary.g, entry.color.primary.b)
                SetVehicleCustomSecondaryColour(vehicle, entry.color.secondary.r, entry.color.secondary.g, entry.color.secondary.b)
            end

            frameSubject(cam, at)

            -- Long enough for the model, its textures and the backdrop to all
            -- be drawn; a shorter wait photographs an untextured shell.
            Wait(options.settle or 1200)

            local shot = promise.new()

            exports["screenshot-basic"]:requestScreenshot(function(image)
                shot:resolve(image)
            end)

            local image = Citizen.Await(shot)

            if not image then
                failed[#failed + 1] = { id = entry.id, error = "capture returned nothing" }
                goto continue
            end

            local processed = processImage(image, options.quality)

            if not processed or not processed.ok or not processed.webpB64 then
                failed[#failed + 1] = { id = entry.id, error = (processed and processed.error) or "processing failed" }
                goto continue
            end

            sendToServer(tostring(entry.id), processed.webpB64, target, folder)
            done[#done + 1] = entry.id

            ::continue::
        end
    end)

    backdrop = false
    despawn()

    RenderScriptCams(false, false, 0, true, false)
    DestroyCam(cam, false)
    ClearFocus()

    if radarWasVisible then DisplayRadar(true) end

    busy = false

    if not ok then return false, tostring(err) end

    return true, { captured = done, failed = failed }
end

exports("ggCaptureVehicles", function(entries, options)
    return capture(entries, options)
end)

--- Consumers reach this through gg.screenshot.vehicles, which runs in their own
--- VM and forwards here.
RegisterNetEvent("gg_lib:screenshot:run", function(entries, options)
    capture(entries, options)
end)

AddEventHandler("onResourceStop", function(resource)
    if resource ~= RESOURCE then return end

    backdrop = false
    despawn()

    RenderScriptCams(false, false, 0, true, false)
    ClearFocus()
end)
