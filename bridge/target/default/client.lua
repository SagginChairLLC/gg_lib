gg = gg or {}
gg.target = gg.target or {}

local activeTargets = {}

-- internal helper
local function showInteraction(options)
    if #options == 1 then
        local opt = options[1]
        lib.showTextUI(("[E] %s"):format(opt.label or "Interact"), {
            position = "right-center",
            icon = opt.icon or "fa-solid fa-hand-pointer",
            iconColor = opt.iconColor or "white",
            iconAnimation = opt.iconAnimation or "bounce",
        })
    else
        lib.showTextUI("[E] Open Menu", {
            position = "right-center",
            icon = "fa-solid fa-list",
            iconColor = "white",
        })
    end
end

local function hideInteraction()
    lib.hideTextUI()
end

local function openContext(id, options)
    local context = {
        id = id,
        title = "Interaction Menu",
        options = {},
    }

    for _, opt in ipairs(options) do
        context.options[#context.options+1] = {
            title = opt.label or "Option",
            icon = opt.icon or "fa-solid fa-circle",
            iconColor = opt.iconColor or "white",
            iconAnimation = opt.iconAnimation,
            description = opt.description,
            onSelect = opt.action,
        }
    end

    lib.registerContext(context)
    lib.showContext(id)
end

-- Entity target
gg.target.AddTargetEntity = function(entity, parameters)
    if not DoesEntityExist(entity) then return end
    local opts = parameters.options or {}
    local dist = parameters.distance or 2.0

    activeTargets[entity] = {
        type = "entity",
        entity = entity,
        distance = dist,
        options = opts,
    }

    CreateThread(function()
        while activeTargets[entity] do
            local ped = PlayerPedId()
            local coords = GetEntityCoords(ped)
            local entCoords = GetEntityCoords(entity)
            local distCheck = #(coords - entCoords)

            if distCheck <= dist then
                showInteraction(opts)
                if IsControlJustReleased(0, 38) then
                    if #opts == 1 then
                        local act = opts[1].action
                        if act then act() end
                    else
                        openContext("entity_"..entity, opts)
                    end
                end
                Wait(0)
            else
                hideInteraction()
                Wait(500)
            end
        end
        hideInteraction()
    end)
end

gg.target.removeTargetEntity = function(entity)
    activeTargets[entity] = nil
    lib.hideTextUI()
end

-- BoxZone target
gg.target.AddBoxZone = function(name, coords, size, parameters)
    local opts = parameters.options or {}
    local dist = parameters.distance or 2.0

    activeTargets[name] = {
        type = "zone",
        coords = coords,
        size = size,
        distance = dist,
        options = opts,
    }

    CreateThread(function()
        while activeTargets[name] do
            local ped = PlayerPedId()
            local pos = GetEntityCoords(ped)
            local zone = activeTargets[name]
            local inZone = (
                math.abs(pos.x - zone.coords.x) <= zone.size.x / 2 and
                math.abs(pos.y - zone.coords.y) <= zone.size.y / 2 and
                math.abs(pos.z - zone.coords.z) <= zone.size.z / 2
            )

            if inZone then
                showInteraction(opts)
                if IsControlJustReleased(0, 38) then
                    if #opts == 1 then
                        local act = opts[1].action
                        if act then act() end
                    else
                        openContext("zone_"..name, opts)
                    end
                end
                Wait(0)
            else
                hideInteraction()
                Wait(500)
            end
        end
        hideInteraction()
    end)
end

gg.target.RemoveZone = function(name)
    activeTargets[name] = nil
    lib.hideTextUI()
end
