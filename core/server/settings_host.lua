--------------------------------------------------
-- MARK: Settings Host
--------------------------------------------------
-- gg_lib owns the /ggsettings editor (alias /jobsettings): it aggregates the
-- schema of every started resource carrying the settings module, serves the
-- editor UI, and routes writes back to the owning resource's exports. No
-- election, no per-script hosting -- the old GlobalState claim dance is gone
-- because there is exactly one gg_lib.
--
-- Access is enforced here, per call, never on the client: a caller passes if
-- they are on the admin list or hold the ace, and denials are logged.

local peers = {}   -- cached list of resources carrying the settings module

--------------------------------------------------
-- MARK: Permissions
--------------------------------------------------
-- Admin list first, ace second -- see core/server/admins.lua. The UI hides
-- controls for a viewer, but the save path re-checks regardless.

local function canEdit(source)
    return Admins.canEdit(source)
end

local function canView(source)
    return Admins.canView(source)
end

local function actorFor(source)
    return Admins.actor(source)
end

--------------------------------------------------
-- MARK: Peer Discovery
--------------------------------------------------
-- Scanning every resource is only worth doing when the resource list actually
-- changes, so the result is cached and refreshed on start/stop.

local function scanPeers()
    local found = {}

    for index = 0, GetNumResources() - 1 do
        local resource = GetResourceByFindIndex(index)

        if resource and resource ~= "gg_lib" and GetResourceState(resource) == "started" then
            -- Resources without the module throw on the index; pcall is the
            -- cheapest reliable "does this export exist" test available.
            local ok, alive = pcall(function()
                return exports[resource]:ggSettingsPing()
            end)

            if ok and alive == true then
                found[#found + 1] = resource
            end
        end
    end

    table.sort(found)
    peers = found

    return peers
end

local function describePeers()
    local scripts = {}

    for index = 1, #peers do
        local resource = peers[index]

        local ok, payload = pcall(function()
            return exports[resource]:ggSettingsDescribe()
        end)

        if ok and type(payload) == "table" then
            scripts[#scripts + 1] = payload
        end
    end

    -- The studio-wide pseudo-script rides along with the real ones. pcall
    -- because a fetch during first boot can beat the table creation.
    local ok, generic = pcall(GenericSettings.describe)
    if ok and type(generic) == "table" then
        scripts[#scripts + 1] = generic
    end

    table.sort(scripts, function(left, right)
        local orderLeft  = left.order or 100
        local orderRight = right.order or 100

        if orderLeft ~= orderRight then return orderLeft < orderRight end

        return (left.label or "") < (right.label or "")
    end)

    return scripts
end

--------------------------------------------------
-- MARK: Open
--------------------------------------------------

local function openFor(source, focus)
    if source == 0 then
        print("[gg_lib] /ggsettings has no console UI; run it in game")
        return
    end

    if not canView(source) then
        -- The denial is logged server-side: repeated attempts from the same
        -- player are worth an admin's attention.
        print(("^3[gg_lib] blocked settings open from %s -- not an admin^0"):format(actorFor(source)))
        TriggerClientEvent("gg_lib:settings:denied", source)
        return
    end

    TriggerClientEvent("gg_lib:settings:open", source, {
        focus    = focus,
        can_edit = canEdit(source),
    })
end

-- /ggsettings is the studio command; /jobsettings stays as an alias since the
-- per-script alias commands and older docs point at it.
for _, command in ipairs({ "ggsettings", "jobsettings" }) do
    RegisterCommand(command, function(source, args)
        openFor(source, args and args[1] or nil)
    end, false)
end

-- Per-script alias commands (/taxisettings) land here from the consumer's
-- settings module, deep-linking straight to that script's page.
exports("ggOpenSettings", function(source, focus)
    openFor(source, focus)
end)

--------------------------------------------------
-- MARK: Editor Callbacks
--------------------------------------------------

-- Every callback re-checks ACE on the server per call -- the UI hiding its
-- controls is cosmetic, and a hand-crafted event with a spoofed payload dies
-- here regardless of what the client claims.
lib.callback.register("gg_lib:settings:fetch", function(source)
    if not canView(source) then
        print(("^3[gg_lib] blocked settings fetch from %s -- not an admin^0"):format(actorFor(source)))
        return false
    end

    return true, {
        scripts  = describePeers(),
        can_edit = canEdit(source),
        -- The editor is a GG UI like any other, so it obeys the studio-wide
        -- appearance settings rather than carrying its own look.
        theme    = GenericSettings.get("theme.primary_color"),
        fade     = GenericSettings.get("theme.fade_on_hover_out"),
        fade_to  = GenericSettings.get("theme.fade_opacity"),
    }
end)

-- Writes are routed to the owning resource, which validates against its own
-- schema and persists its own rows. One save carries both the changed values
-- and the reset paths, plus the config revision the editor rendered from --
-- a stale revision means another admin saved meanwhile, and the whole batch
-- is rejected before anything lands.
lib.callback.register("gg_lib:settings:save", function(source, data)
    if not canEdit(source) then
        print(("^1[gg_lib] blocked settings WRITE from %s -- not an admin^0"):format(actorFor(source)))
        return false, { _ = "you do not have permission to change settings" }
    end
    if type(data) ~= "table" or type(data.resource) ~= "string" then
        return false, { _ = "malformed payload" }
    end

    local target  = data.resource
    local changes = type(data.changes) == "table" and data.changes or {}
    local resets  = type(data.resets) == "table" and data.resets or {}
    local actor   = actorFor(source)

    if target == GenericSettings.resource then
        local ok, result = GenericSettings.apply(changes, actor, data.revision)
        if not ok then return false, result end

        local changed = result

        if #resets > 0 then
            local resetOk, resetResult = GenericSettings.reset(resets, actor)
            if not resetOk then return false, resetResult end

            for index = 1, #resetResult do changed[#changed + 1] = resetResult[index] end
        end

        if #changed > 0 then
            print(("[gg_lib] %s changed %d generic setting(s)"):format(actor, #changed))
        end

        return true, changed
    end

    local known = false

    for index = 1, #peers do
        if peers[index] == target then known = true break end
    end

    if not known then return false, { _ = "that script is not accepting settings" } end

    -- Legacy peers (embedded settings module) ignore the third argument and
    -- skip the revision check; module peers enforce it.
    local ok, response = pcall(function()
        return exports[target]:ggSettingsApply(changes, actor, data.revision)
    end)

    if not ok or type(response) ~= "table" then
        print(("^1[gg_lib] settings save to '%s' failed: %s^0"):format(target, response))
        return false, { _ = "the target script rejected the write" }
    end

    if not response.ok then return false, response.result end

    local changed = response.result

    -- The reset half is part of the same authorized batch, so it does not
    -- re-check the revision the apply half just bumped.
    if #resets > 0 then
        local resetOk, resetResponse = pcall(function()
            return exports[target]:ggSettingsReset(resets, actor)
        end)

        if not resetOk or type(resetResponse) ~= "table" then
            return false, { _ = "the target script rejected the reset" }
        end

        if not resetResponse.ok then return false, resetResponse.result end

        for index = 1, #resetResponse.result do changed[#changed + 1] = resetResponse.result[index] end
    end

    if #changed > 0 then
        print(("[gg_lib] %s changed %d setting(s) in %s"):format(actor, #changed, target))
    end

    return true, changed
end)

lib.callback.register("gg_lib:settings:reset", function(source, data)
    if not canEdit(source) then
        print(("^1[gg_lib] blocked settings RESET from %s -- not an admin^0"):format(actorFor(source)))
        return false, { _ = "you do not have permission to change settings" }
    end
    if type(data) ~= "table" or type(data.resource) ~= "string" or type(data.paths) ~= "table" then
        return false, { _ = "malformed payload" }
    end

    if data.resource == GenericSettings.resource then
        return GenericSettings.reset(data.paths, actorFor(source))
    end

    local ok, response = pcall(function()
        return exports[data.resource]:ggSettingsReset(data.paths, actorFor(source), data.revision)
    end)

    if not ok or type(response) ~= "table" then
        return false, { _ = "the target script rejected the reset" }
    end

    return response.ok, response.result
end)

--------------------------------------------------
-- MARK: Maintenance
--------------------------------------------------
-- Stored rows whose setting no longer exists in any schema are kept on boot
-- (a downgrade or a temporarily-removed setting must not cost an admin their
-- override) and cleaned up only through this deliberate console command.

RegisterCommand("gg_settings_prune", function(source, args)
    if source ~= 0 then
        print("[gg_lib] gg_settings_prune is console-only")
        return
    end

    local target = args and args[1]

    local function pruneOne(resource)
        local ok, response = pcall(function()
            return exports[resource]:ggSettingsPrune("console")
        end)

        if not ok or type(response) ~= "table" then
            -- Legacy peers (embedded settings module) predate this export.
            print(("[gg_lib] %s does not support pruning (update its settings module)"):format(resource))
            return
        end

        print(("[gg_lib] %s: pruned %d orphaned override(s)"):format(resource, #(response.result or {})))
    end

    if target and target ~= GenericSettings.resource then
        pruneOne(target)
        return
    end

    if not target then
        for index = 1, #peers do pruneOne(peers[index]) end
    end

    local ok, pruned = GenericSettings.prune("console")
    if ok then
        print(("[gg_lib] %s: pruned %d orphaned override(s)"):format(GenericSettings.resource, #pruned))
    end
end, true)

--------------------------------------------------
-- MARK: Boot
--------------------------------------------------

AddEventHandler("onResourceStart", function(resource)
    -- Let peers finish starting before scanning, otherwise a script that boots
    -- a tick later is missing from the list until something else changes.
    SetTimeout(2000, scanPeers)
end)

AddEventHandler("onResourceStop", function(resource)
    if resource == "gg_lib" then return end

    SetTimeout(100, scanPeers)
end)
