--------------------------------------------------
-- MARK: Settings Editor Client
--------------------------------------------------

local open = false

--------------------------------------------------
-- MARK: Pause Guard
--------------------------------------------------

GG_PAUSE_GUARD = GG_PAUSE_GUARD or { holders = 0 }

function GG_PAUSE_GUARD.acquire()
    GG_PAUSE_GUARD.holders = GG_PAUSE_GUARD.holders + 1

    if GG_PAUSE_GUARD.holders > 1 then return end

    CreateThread(function()
        while GG_PAUSE_GUARD.holders > 0 do
            DisableControlAction(0, 199, true)
            DisableControlAction(0, 200, true)

            if IsPauseMenuActive() then
                SetFrontendActive(false)
            end

            Wait(0)
        end
    end)
end

function GG_PAUSE_GUARD.release()
    GG_PAUSE_GUARD.holders = math.max(0, GG_PAUSE_GUARD.holders - 1)
end

RegisterNetEvent("gg_lib:settings:denied", function()
    lib.notify({ description = "You do not have permission to open settings.", type = "error" })
end)

RegisterNetEvent("gg_lib:settings:open", function(data)
    local ok, payload = lib.callback.await("gg_lib:settings:fetch", false)

    if not ok or type(payload) ~= "table" then
        lib.notify({ description = "Settings are not available right now.", type = "error" })
        return
    end

    open = true
    SetNuiFocus(true, true)
    GG_PAUSE_GUARD.acquire()

    SendNUIMessage({
        action = "settings_open",
        data = {
            SCRIPTS  = payload.scripts,
            CAN_EDIT = payload.can_edit == true,
            FOCUS    = data and data.focus or nil,
            UI_THEME = payload.theme,
            UI_FADE  = payload.fade,
            UI_FADE_TO = payload.fade_to,
        },
    })
end)

RegisterNUICallback("settings_save", function(data, cb)
    local ok, result = lib.callback.await("gg_lib:settings:save", false, {
        resource = data and data.resource,
        changes  = data and data.changes,
        resets   = data and data.resets,
        revision = data and data.revision,
    })

    cb({ ok = ok == true, errors = ok and nil or result, changed = ok and result or nil })
end)

RegisterNUICallback("settings_reset", function(data, cb)
    local ok, result = lib.callback.await("gg_lib:settings:reset", false, {
        resource = data and data.resource,
        paths    = data and data.paths,
    })

    cb({ ok = ok == true, errors = ok and nil or result, changed = ok and result or nil })
end)

RegisterNUICallback("settings_refresh", function(_, cb)
    local ok, payload = lib.callback.await("gg_lib:settings:fetch", false)

    if not ok or type(payload) ~= "table" then
        cb({ ok = false })
        return
    end

    cb({ ok = true, SCRIPTS = payload.scripts, CAN_EDIT = payload.can_edit == true, UI_THEME = payload.theme, UI_FADE = payload.fade, UI_FADE_TO = payload.fade_to })
end)

RegisterNetEvent("gg_lib:generic:sync", function(payload)
    local values = payload and payload.values
    if not values then return end

    if values["theme.primary_color"] == nil and values["theme.fade_on_hover_out"] == nil and values["theme.fade_opacity"] == nil then
        return
    end

    SendNUIMessage({
        action = "settings_theme",
        data   = {
            UI_THEME   = values["theme.primary_color"],
            UI_FADE    = values["theme.fade_on_hover_out"],
            UI_FADE_TO = values["theme.fade_opacity"],
        },
    })
end)

--------------------------------------------------
-- MARK: Admins
--------------------------------------------------

RegisterNUICallback("admins_fetch", function(_, cb)
    local ok, payload = lib.callback.await("gg_lib:admins:fetch", false)

    cb({ ok = ok == true, ADMINS = ok and payload.admins or nil, PLAYERS = ok and payload.players or nil })
end)

RegisterNUICallback("bridge_fetch", function(_, cb)
    local ok, payload = lib.callback.await("gg_lib:bridge:fetch", false)

    cb({ ok = ok == true, DATA = ok and payload or nil })
end)

RegisterNUICallback("bridge_set_provider", function(data, cb)
    local ok, err = lib.callback.await("gg_lib:bridge:setProvider", false, {
        path  = data and data.path,
        value = data and data.value,
    })

    cb({ ok = ok == true, error = not ok and err or nil })
end)

RegisterNUICallback("admins_grant", function(data, cb)
    local ok, result = lib.callback.await("gg_lib:admins:grant", false, {
        player     = data and data.player,
        identifier = data and data.identifier,
    })

    cb({
        ok      = ok == true,
        error   = not ok and result or nil,
        ADMINS  = ok and result.admins or nil,
        PLAYERS = ok and result.players or nil,
    })
end)

RegisterNUICallback("admins_revoke", function(data, cb)
    local ok, result = lib.callback.await("gg_lib:admins:revoke", false, {
        identifier = data and data.identifier,
    })

    cb({
        ok      = ok == true,
        error   = not ok and result or nil,
        ADMINS  = ok and result.admins or nil,
        PLAYERS = ok and result.players or nil,
    })
end)

RegisterNUICallback("logs_fetch", function(data, cb)
    local ok, rows = lib.callback.await("gg_lib:logs:fetch", false, { limit = data and data.limit })

    cb({ ok = ok == true, ROWS = ok and rows or nil })
end)

RegisterNUICallback("settings_close", function(_, cb)
    if gg and gg.tool and gg.tool.isActive() then
        cb({})
        return
    end

    if open then GG_PAUSE_GUARD.release() end

    open = false
    SetNuiFocus(false, false)
    cb({})
end)

AddEventHandler("onResourceStop", function(resource)
    if resource ~= "gg_lib" then return end
    if open then SetNuiFocus(false, false) end

    GG_PAUSE_GUARD.holders = 0
end)
