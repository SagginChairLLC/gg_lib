--------------------------------------------------
-- MARK: Settings Editor Client
--------------------------------------------------
-- NUI plumbing for gg_lib's /jobsettings editor. The web app lives in gg_lib's
-- ui_page, so its callbacks register here and route to the gg_lib server host.

local open = false

--------------------------------------------------
-- MARK: Pause Guard
--------------------------------------------------
-- ESC closes the editor, but the game reads the same press as "pause" and opens
-- the map behind it. The editor holds NUI focus, so no input reaches that menu:
-- it cannot be closed and the player is stuck until the resource restarts.
--
-- One guard owns this for the whole session -- editor open, placement, and the
-- handover between them. That matters: the placement tool used to suppress the
-- pause key itself, so cancelling with ESC ended the tool, ended its
-- suppression, and let the very same press through on the following frame,
-- straight into the reopening editor.
--
-- GG_PAUSE_GUARD is global so any other gg_lib flow can hold it too, and it is
-- reference counted so whichever finishes last is the one that releases it.

GG_PAUSE_GUARD = GG_PAUSE_GUARD or { holders = 0 }

function GG_PAUSE_GUARD.acquire()
    GG_PAUSE_GUARD.holders = GG_PAUSE_GUARD.holders + 1

    if GG_PAUSE_GUARD.holders > 1 then return end

    CreateThread(function()
        while GG_PAUSE_GUARD.holders > 0 do
            DisableControlAction(0, 199, true)
            DisableControlAction(0, 200, true)

            -- Belt and braces: blocking the control stops the press, this shuts
            -- the menu if anything else manages to open it.
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
        -- The config revision the editor rendered from -- the host rejects the
        -- save when it no longer matches, instead of overwriting newer edits.
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

-- Re-pull every script's schema without closing the editor, so a change made by
-- another admin shows up in place.
RegisterNUICallback("settings_refresh", function(_, cb)
    local ok, payload = lib.callback.await("gg_lib:settings:fetch", false)

    if not ok or type(payload) ~= "table" then
        cb({ ok = false })
        return
    end

    cb({ ok = true, SCRIPTS = payload.scripts, CAN_EDIT = payload.can_edit == true, UI_THEME = payload.theme, UI_FADE = payload.fade, UI_FADE_TO = payload.fade_to })
end)

-- The editor paints itself in the studio accent, so it has to follow a change
-- to that accent -- including one made by another admin while this page is open.
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
-- The editor's Admins page. Every one of these re-checks permission on the
-- server; a grant or revoke answers with the refreshed lists so the page never
-- has to guess what landed.

RegisterNUICallback("admins_fetch", function(_, cb)
    local ok, payload = lib.callback.await("gg_lib:admins:fetch", false)

    cb({ ok = ok == true, ADMINS = ok and payload.admins or nil, PLAYERS = ok and payload.players or nil })
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
    -- A running tool owns the screen and will hand focus back to the editor
    -- when it finishes. Closing it now would drop the editor mid-placement and
    -- leave that handover pointing at nothing, so the request is refused rather
    -- than honoured -- whatever the page thinks it wants.
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

    -- Whatever was holding it, the guard must not outlive the resource or the
    -- pause menu stays blocked for good.
    GG_PAUSE_GUARD.holders = 0
end)
