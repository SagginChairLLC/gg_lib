--------------------------------------------------
-- MARK: Settings Host
--------------------------------------------------

local peers = {}   -- cached list of resources carrying the settings module

--------------------------------------------------
-- MARK: Permissions
--------------------------------------------------

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

local function scanPeers()
    local found = {}

    for index = 0, GetNumResources() - 1 do
        local resource = GetResourceByFindIndex(index)

        if resource and resource ~= "gg_lib" and GetResourceState(resource) == "started" then
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
        print(("^3[gg_lib] blocked settings open from %s -- not an admin^0"):format(actorFor(source)))
        TriggerClientEvent("gg_lib:settings:denied", source)
        return
    end

    TriggerClientEvent("gg_lib:settings:open", source, {
        focus    = focus,
        can_edit = canEdit(source),
    })
end

for _, command in ipairs({ "ggsettings", "jobsettings" }) do
    RegisterCommand(command, function(source, args)
        openFor(source, args and args[1] or nil)
    end, false)
end

exports("ggOpenSettings", function(source, focus)
    openFor(source, focus)
end)

--------------------------------------------------
-- MARK: Editor Callbacks
--------------------------------------------------

lib.callback.register("gg_lib:settings:fetch", function(source)
    if not canView(source) then
        print(("^3[gg_lib] blocked settings fetch from %s -- not an admin^0"):format(actorFor(source)))
        return false
    end

    return true, {
        scripts  = describePeers(),
        can_edit = canEdit(source),
        theme    = GenericSettings.get("theme.primary_color"),
        fade     = GenericSettings.get("theme.fade_on_hover_out"),
        fade_to  = GenericSettings.get("theme.fade_opacity"),
    }
end)

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

    local ok, response = pcall(function()
        return exports[target]:ggSettingsApply(changes, actor, data.revision)
    end)

    if not ok or type(response) ~= "table" then
        print(("^1[gg_lib] settings save to '%s' failed: %s^0"):format(target, response))
        return false, { _ = "the target script rejected the write" }
    end

    if not response.ok then return false, response.result end

    local changed = response.result

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
    SetTimeout(2000, scanPeers)
end)

AddEventHandler("onResourceStop", function(resource)
    if resource == "gg_lib" then return end

    SetTimeout(100, scanPeers)
end)
