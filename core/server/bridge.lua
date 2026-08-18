--------------------------------------------------
-- MARK: Bridge Registry
--------------------------------------------------

local RESOURCE = GetCurrentResourceName()

local function loadTable(path)
    local raw = LoadResourceFile(RESOURCE, path)
    if not raw then return nil end

    local chunk = load(raw, "@" .. path, "t")
    if not chunk then return nil end

    local ok, value = pcall(chunk)

    return ok and value or nil
end

local manifest = loadTable("bridge/manifest.lua")
local utility  = loadTable("utility.lua") or {}

--------------------------------------------------
-- MARK: Own detection
--------------------------------------------------

local function running(name)
    local state = GetResourceState(name)

    return state == "started" or state == "starting"
end

local function detect(category)
    local override = utility[category]

    if override and override ~= "" then
        local up = running(override)

        return {
            category = category,
            resource = override,
            source   = "override",
            state    = up and "started" or "missing",
            loaded   = up,
            stub     = false,
            error    = not up and ("'%s' is not started"):format(override) or nil,
        }
    end

    for _, candidate in ipairs((manifest.categories or {})[category] or {}) do
        if running(candidate) then
            return {
                category = category,
                resource = candidate,
                source   = "detected",
                state    = "started",
                loaded   = true,
                stub     = false,
            }
        end
    end

    return {
        category = category,
        resource = "default",
        source   = "default",
        state    = "started",
        loaded   = true,
        stub     = true,
    }
end

--------------------------------------------------
-- MARK: Dependencies
--------------------------------------------------

local DEPENDENCIES = { "ox_lib", "oxmysql" }

local function dependencyRows()
    local rows = {}

    for _, name in ipairs(DEPENDENCIES) do
        rows[#rows + 1] = {
            resource = name,
            running  = running(name),
        }
    end

    return rows
end

--------------------------------------------------
-- MARK: Interface providers
--------------------------------------------------

local PROVIDERS = {
    {
        id      = "notifications",
        label   = "Notifications",
        key     = "notifications",
        path    = "interface.notifications",
        default = "ox",
        resources = {
            ox = "ox_lib", qb = "qb-core", esx = "es_extended",
            mythic = "mythic_notify", old_mythic = "mythic_notify",
            pNotify = "pNotify", brutal = "brutal_notify", okok = "okokNotify",
            stNotify = "stNotify", sd = "sd-notify", wasabi = "wasabi_notify",
        },
    },
    {
        id      = "progressbar",
        label   = "Progress Bars",
        key     = "ProgressBar",
        path    = "interface.progressbar",
        default = "ox",
        resources = { ox = "ox_lib", qb = "qb-core", esx = "es_extended" },
    },
    {
        id      = "textui",
        label   = "Text UI",
        key     = "textUi",
        path    = "interface.textui",
        default = "ox",
        resources = { ox = "ox_lib", qb = "qb-core", esx = "es_extended" },
    },
}

local CONTEXT_PREFERRED = "lation_ui"

local REQUIRES = {
    qb         = "qb-core",
    esx        = "es_extended",
    mythic     = "mythic_notify",
    old_mythic = "mythic_notify",
    okok       = "okokNotify",
    brutal     = "brutal_notify",
    pNotify    = "pNotify",
    stNotify   = "stNotify",
    sd         = "sd-notify",
    wasabi     = "wasabi_notify",
    ox         = "ox_lib",
}

local function requirementOf(value, resources)
    if value == "custom" then return nil end

    return REQUIRES[value] or resources[value]
end

local function providerRows()
    local rows = {}

    for _, provider in ipairs(PROVIDERS) do
        local stored     = GenericSettings and GenericSettings.get and GenericSettings.get(provider.path)
        local choice     = (type(stored) == "string" and stored ~= "" and stored) or utility[provider.key]
        local configured = choice ~= nil and choice ~= ""
        local value      = configured and choice or provider.default

        local names = {}
        for name in pairs(provider.resources) do names[#names + 1] = name end
        table.sort(names)
        names[#names + 1] = "custom"

        local options = {}

        for _, name in ipairs(names) do
            local needs = requirementOf(name, provider.resources)
            local met   = needs == nil or running(needs)

            options[#options + 1] = {
                value    = name,
                label    = needs and (met and needs or ("%s (not started)"):format(needs)) or name,
                requires = needs,
                available = met,
            }
        end

        local needs = requirementOf(value, provider.resources)
        local known = provider.resources[value] ~= nil or value == "custom"
        local met   = needs == nil or running(needs)

        rows[#rows + 1] = {
            id       = provider.id,
            label    = provider.label,
            path     = provider.path,
            options  = options,
            provider = value,
            resource = provider.resources[value] or (value == "custom" and "custom" or value),
            source   = configured and "configured" or "default",
            running  = known and met,
            requires = needs,
            error    = (known and not met)
                and ("requires '%s', which is not started"):format(needs)
                or (not known)
                and ("'%s' is not a known provider"):format(tostring(value))
                or nil,
        }
    end

    local usingLation = running(CONTEXT_PREFERRED)

    rows[#rows + 1] = {
        id       = "context",
        label    = "Context Menu",
        provider = usingLation and CONTEXT_PREFERRED or "ox",
        resource = usingLation and CONTEXT_PREFERRED or "ox_lib",
        source   = "detected",
        running  = true,
    }

    return rows
end

local own

CreateThread(function()
    Wait(0)

    own = {}

    for _, category in ipairs((manifest and manifest.category_order) or {}) do
        own[#own + 1] = detect(category)
    end
end)

--------------------------------------------------
-- MARK: Fetch
--------------------------------------------------

lib.callback.register("gg_lib:bridge:fetch", function(source)
    if not Admins.canView(source) then return false end

    return true, {
        dependencies = dependencyRows(),
        interface    = providerRows(),
        bridges      = own or {},
    }
end)

--------------------------------------------------
-- MARK: Live change
--------------------------------------------------

local EDITABLE = {
    ["interface.notifications"] = true,
    ["interface.progressbar"]   = true,
    ["interface.textui"]        = true,
}

lib.callback.register("gg_lib:bridge:setProvider", function(source, data)
    if not Admins.canEdit(source) then return false, "not allowed" end

    local path = data and data.path

    if not EDITABLE[path] then return false, "not an interface setting" end

    local ok, errors = GenericSettings.apply({ [path] = data.value }, Admins.actor(source))

    if not ok then
        return false, (type(errors) == "table" and (errors[path] or errors._)) or "rejected"
    end

    return true
end)
