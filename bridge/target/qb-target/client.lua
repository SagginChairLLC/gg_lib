gg.target = gg.target or {}

local utility = require("utility")

--------------------------------------------------
-- MARK: Options
--------------------------------------------------

--- Callers pass either an array of options or { options = {...}, distance = n }.
local function unpackOptions(parameters)
    if type(parameters) ~= "table" then return {}, nil end

    if parameters.options then return parameters.options, parameters.distance end

    return parameters, parameters.distance
end

--- This provider keys its options by label, so that is what identifies one.
--- A new table every time: the caller's is often a config it reuses.
local function toProvider(parameters)
    local options, distance = unpackOptions(parameters)
    local out = { options = {}, distance = distance }

    for index = 1, #options do
        local option = options[index]

        out.options[index] = {
            label       = option.label or option.name,
            icon        = option.icon,
            item        = option.item or option.items,
            job         = option.job or option.groups,
            gang        = option.gang,
            distance    = option.distance,
            canInteract = option.canInteract,
            action      = option.action or option.onSelect,
            event       = option.event,
            serverEvent = option.serverEvent,
            command     = option.command,
            type        = option.type,
        }
    end

    return out
end

local function labelsOf(parameters)
    local options = unpackOptions(parameters)
    local labels = {}

    for index = 1, #options do
        labels[index] = options[index].label or options[index].name
    end

    return labels
end

--- Removal takes labels, but callers may hand over the options themselves.
local function asLabels(value)
    if type(value) == "table" and (value.options or (value[1] and type(value[1]) == "table")) then
        return labelsOf(value)
    end

    return value
end

--------------------------------------------------
-- MARK: Cleanup
--------------------------------------------------
-- ox_target drops a resource's targets when it stops; this one does not, so
-- anything registered through here is remembered and taken back by hand.

local owned = {}

local function remember(kind, key, extra)
    local resource = GetInvokingResource() or GetCurrentResourceName()

    owned[#owned + 1] = { kind = kind, key = key, extra = extra, resource = resource }
end

local function forget(kind, key)
    for index = #owned, 1, -1 do
        local entry = owned[index]

        if entry.kind == kind and entry.key == key then table.remove(owned, index) end
    end
end

AddEventHandler("onClientResourceStop", function(resource)
    for index = #owned, 1, -1 do
        local entry = owned[index]

        if entry.resource == resource then
            if entry.kind == "zone" then
                exports["qb-target"]:RemoveZone(entry.key)
            elseif entry.kind == "entity" then
                if DoesEntityExist(entry.key) then
                    exports["qb-target"]:RemoveTargetEntity(entry.key, entry.extra)
                end
            elseif entry.kind == "model" then
                exports["qb-target"]:RemoveTargetModel(entry.key, entry.extra)
            elseif entry.kind == "global" then
                exports["qb-target"]:RemoveGlobalType(entry.key, entry.extra)
            end

            table.remove(owned, index)
        end
    end
end)

--------------------------------------------------
-- MARK: Entities
--------------------------------------------------
-- This provider turns a networked entity into its network id itself, so the
-- raw handle is what goes in either way.

gg.target.addEntity = function(entity, parameters)
    if not entity or not DoesEntityExist(entity) then return false end

    exports["qb-target"]:AddTargetEntity(entity, toProvider(parameters))
    remember("entity", entity, labelsOf(parameters))

    return true
end

gg.target.removeEntity = function(entity, names)
    if not entity then return false end

    exports["qb-target"]:RemoveTargetEntity(entity, asLabels(names))
    forget("entity", entity)

    return true
end

--------------------------------------------------
-- MARK: Models
--------------------------------------------------

gg.target.addModel = function(models, parameters)
    exports["qb-target"]:AddTargetModel(models, toProvider(parameters))
    remember("model", models, labelsOf(parameters))

    return true
end

gg.target.removeModel = function(models, names)
    exports["qb-target"]:RemoveTargetModel(models, asLabels(names))
    forget("model", models)

    return true
end

--------------------------------------------------
-- MARK: Zones
--------------------------------------------------
-- Zones are named here rather than numbered, so the name is the handle and it
-- comes back from every add for removeZone to take again.

local nextZone = 0

local function zoneName(data)
    if type(data.name) == "string" and data.name ~= "" then return data.name end

    nextZone = nextZone + 1

    return ("gg_zone_%s_%d"):format(GetInvokingResource() or GetCurrentResourceName(), nextZone)
end

gg.target.addBoxZone = function(data)
    local name   = zoneName(data)
    local coords = data.coords
    local size   = data.size or vec3(1.0, 1.0, 1.0)

    exports["qb-target"]:AddBoxZone(name, vec3(coords.x, coords.y, coords.z), size.x, size.y, {
        name      = name,
        heading   = data.rotation or coords.w or 0.0,
        debugPoly = data.debug or utility.debugMode,
        minZ      = coords.z - ((size.z or 2.0) / 2),
        maxZ      = coords.z + ((size.z or 2.0) / 2),
    }, toProvider(data))

    remember("zone", name)

    return name
end

gg.target.addSphereZone = function(data)
    local name   = zoneName(data)
    local coords = data.coords

    exports["qb-target"]:AddCircleZone(name, vec3(coords.x, coords.y, coords.z), data.radius or 1.0, {
        name      = name,
        debugPoly = data.debug or utility.debugMode,
        useZ      = true,
    }, toProvider(data))

    remember("zone", name)

    return name
end

gg.target.addPolyZone = function(data)
    local name = zoneName(data)

    exports["qb-target"]:AddPolyZone(name, data.points, {
        name      = name,
        debugPoly = data.debug or utility.debugMode,
        minZ      = data.minZ,
        maxZ      = data.maxZ,
    }, toProvider(data))

    remember("zone", name)

    return name
end

gg.target.removeZone = function(id)
    if id == nil then return false end

    exports["qb-target"]:RemoveZone(id)
    forget("zone", id)

    return true
end

--------------------------------------------------
-- MARK: Globals
--------------------------------------------------
-- Global types are numbered here: 1 peds, 2 vehicles, 3 objects, 4 players.

local function globalArgs(first, second)
    if type(first) == "string" then return second end

    return first
end

local function addGlobal(kind, parameters)
    exports["qb-target"]:AddGlobalType(kind, toProvider(parameters))
    remember("global", kind, labelsOf(parameters))
end

gg.target.addGlobalPed = function(first, second)
    addGlobal(1, globalArgs(first, second))

    return true
end

gg.target.removeGlobalPed = function(names)
    exports["qb-target"]:RemoveGlobalType(1, asLabels(names))

    return true
end

gg.target.addGlobalVehicle = function(first, second)
    addGlobal(2, globalArgs(first, second))

    return true
end

gg.target.removeGlobalVehicle = function(names)
    exports["qb-target"]:RemoveGlobalType(2, asLabels(names))

    return true
end

gg.target.addGlobalObject = function(first, second)
    addGlobal(3, globalArgs(first, second))

    return true
end

gg.target.removeGlobalObject = function(names)
    exports["qb-target"]:RemoveGlobalType(3, asLabels(names))

    return true
end

gg.target.addGlobalPlayer = function(first, second)
    addGlobal(4, globalArgs(first, second))

    return true
end

gg.target.removeGlobalPlayer = function(names)
    exports["qb-target"]:RemoveGlobalType(4, asLabels(names))

    return true
end

--------------------------------------------------
-- MARK: State
--------------------------------------------------

gg.target.disable = function(state)
    -- Named the other way round here: this one is told whether targeting is on.
    exports["qb-target"]:AllowTargeting(state ~= true)
end

gg.target.isActive = function()
    local ok, active = pcall(function() return exports["qb-target"]:IsTargetActive() end)

    return ok and active == true
end

--------------------------------------------------
-- MARK: Legacy names
--------------------------------------------------
-- What scripts written against the older bridge call, so they keep working
-- while they are moved across.

gg.target.AddTargetEntity    = gg.target.addEntity
gg.target.removeTargetEntity = gg.target.removeEntity
gg.target.RemoveZone         = gg.target.removeZone

gg.target.AddBoxZone = function(name, coords, size, parameters)
    local options, distance = unpackOptions(parameters)

    return gg.target.addBoxZone({
        name     = name,
        coords   = coords,
        size     = size,
        options  = options,
        distance = distance,
    })
end
