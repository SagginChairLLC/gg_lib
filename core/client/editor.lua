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

RegisterNetEvent("gg_lib:settings:access", function(data)
    open = true
    SetNuiFocus(true, true)
    GG_PAUSE_GUARD.acquire()

    SendNUIMessage({
        action = "settings_access",
        data = {
            IDENTIFIER = data and data.identifier or "",
            FILE       = data and data.file or "",
        },
    })
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
            CAN_MANAGE = payload.can_manage == true,
            ROLE     = payload.role,
            ROLE_LABEL = payload.role_label,
            TOOLS    = payload.tools,
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

    cb({
        ok = true,
        SCRIPTS = payload.scripts,
        CAN_EDIT = payload.can_edit == true,
        CAN_MANAGE = payload.can_manage == true,
        ROLE = payload.role,
        ROLE_LABEL = payload.role_label,
        TOOLS = payload.tools,
        UI_THEME = payload.theme,
        UI_FADE = payload.fade,
        UI_FADE_TO = payload.fade_to,
    })
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

    cb({ ok = ok == true, ADMINS = ok and payload.admins or nil, PLAYERS = ok and payload.players or nil, ROLES = ok and payload.roles or nil })
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

--------------------------------------------------
-- MARK: Interface test
--------------------------------------------------
-- The Test buttons run the real display and menu modules rather than a copy of
-- their dispatch, so what plays here is exactly what a script would get. The
-- modules read their provider from settings; this VM has none, so a shim feeds
-- them the choice the page is showing.

local testChoice = {}
local testReady = false

local function ensureInterface()
    if testReady then return true end

    settings = settings or {}
    settings.generic = settings.generic or {}
    settings.generic.get = function(path) return testChoice[path] end

    gg = gg or {}

    for _, path in ipairs({ "modules/display/client.lua", "modules/menu/client.lua" }) do
        local source = LoadResourceFile(GetCurrentResourceName(), path)
        if not source then return false end

        local chunk = load(source, ("@@gg_lib/%s"):format(path), "t")
        if not chunk then return false end

        if not pcall(chunk) then return false end
    end

    testReady = true

    return true
end

local MENU_WAIT_MS = 30000

local function runTest(id)
    if id == "notifications" then
        gg.display.notify({
            title   = "gg_lib",
            msg     = "Notifications are wired up.",
            status  = "success",
            timeout = 4000,
            icon    = "plug",
        })

        Wait(2600)
    elseif id == "progressbar" then
        gg.display.ProgressBar({ label = "Testing progress bars", duration = 3000 })
    elseif id == "textui" then
        gg.display.DoTextui({ msg = "gg_lib text UI test", position = "left" })
        Wait(3000)
        gg.display.RemoveTextui()
    elseif id == "context" then
        gg.menu.open({
            id    = "gg_lib_bridge_test",
            title = "gg_lib",
        }, {
            { title = "Context menus are wired up", description = "Close this to return to the editor", icon = "plug" },
        })

        Wait(400)

        local deadline = GetGameTimer() + MENU_WAIT_MS

        while GetGameTimer() < deadline do
            if not gg.menu.getOpenContextMenu() then break end

            Wait(200)
        end
    end
end

RegisterNUICallback("bridge_test", function(data, cb)
    local id = data and data.id

    if not ensureInterface() then
        cb({ ok = false })
        return
    end

    if data and data.path then testChoice[data.path] = data.value end

    -- Some providers carry extra settings of their own. Without these the
    -- stub above answers nil for them and the test falls back to a default,
    -- so it draws something the server would not.
    for _, extra in ipairs((data and data.tuning) or {}) do
        if extra.path then testChoice[extra.path] = extra.value end
    end

    SetNuiFocus(false, false)

    CreateThread(function()
        local ok = pcall(runTest, id)

        -- Focus goes back only if the editor is still meant to be up; closing
        -- it mid-test must not hand focus back to a hidden page.
        if open then SetNuiFocus(true, true) end

        cb({ ok = ok })
    end)
end)

for _, entry in ipairs({
    { nui = "admins_set_role",    channel = "gg_lib:admins:setRole" },
    { nui = "admins_save_role",   channel = "gg_lib:admins:saveRole" },
    { nui = "admins_delete_role", channel = "gg_lib:admins:deleteRole" },
}) do
    RegisterNUICallback(entry.nui, function(data, cb)
        local ok, result = lib.callback.await(entry.channel, false, data)

        cb({
            ok      = ok == true,
            error   = not ok and result or nil,
            ADMINS  = ok and result.admins or nil,
            PLAYERS = ok and result.players or nil,
            ROLES   = ok and result.roles or nil,
        })
    end)
end

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
        ROLES   = ok and result.roles or nil,
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
        ROLES   = ok and result.roles or nil,
    })
end)

RegisterNUICallback("logs_fetch", function(data, cb)
    local ok, payload = lib.callback.await("gg_lib:logs:fetch", false, {
        page   = data and data.page,
        size   = data and data.size,
        search = data and data.search,
        actor  = data and data.actor,
    })

    cb({
        ok        = ok == true,
        ROWS      = ok and payload.rows or nil,
        TOTAL     = ok and payload.total or 0,
        ACTORS    = ok and payload.actors or nil,
        RETENTION = ok and payload.retention or nil,
    })
end)

RegisterNUICallback("logs_retention", function(data, cb)
    local ok = lib.callback.await("gg_lib:logs:setRetention", false, data and data.days)

    cb({ ok = ok == true })
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
