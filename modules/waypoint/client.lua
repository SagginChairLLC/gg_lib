gg.waypoint = gg.waypoint or {}

--- World waypoints: a distance, a unit and a label on a billboard out in the
--- world, turned to the camera and lifting itself over anything in the way.
---
--- Ids are scoped to the calling script, so "checkpoint" here and "checkpoint"
--- in another script are two different waypoints. Everything this script
--- places is removed for it when the script stops.

--- Place one, or replace the one already under this id.
--- data: id, coords, label, render_distance, visible, meta
function gg.waypoint.create(data)
    return exports.gg_lib:ggWaypointCreate(data) == true
end

--- Change a placed waypoint. Only the keys given are touched.
--- data: coords, label, render_distance, visible, meta
function gg.waypoint.update(id, data)
    return exports.gg_lib:ggWaypointUpdate(id, data) == true
end

function gg.waypoint.remove(id)
    return exports.gg_lib:ggWaypointRemove(id) == true
end

function gg.waypoint.exists(id)
    return exports.gg_lib:ggWaypointExists(id) == true
end

function gg.waypoint.show(id)
    return exports.gg_lib:ggWaypointShow(id) == true
end

function gg.waypoint.hide(id)
    return exports.gg_lib:ggWaypointHide(id) == true
end

--- Removes every waypoint this script has placed.
function gg.waypoint.clear()
    return exports.gg_lib:ggWaypointClear() == true
end

--- A run of waypoints where one is live at a time -- race checkpoints, a
--- delivery round, a tow route. Setting the next point retires the one before
--- it, so a job only ever needs to say where the player is going next.
--- options: label, render_distance, visible, meta, id, keep_previous
function gg.waypoint.setRoutePoint(routeId, index, coords, options)
    return exports.gg_lib:ggWaypointSetRoutePoint(routeId, index, coords, options) == true
end

--- What the route is pointing at now: { id, index, coords, label } or nil.
function gg.waypoint.activeRoutePoint(routeId)
    return exports.gg_lib:ggWaypointActiveRoutePoint(routeId)
end

function gg.waypoint.clearRoute(routeId)
    return exports.gg_lib:ggWaypointClearRoute(routeId) == true
end
