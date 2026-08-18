--------------------------------------------------
-- MARK: gg_lib Import
--------------------------------------------------

if not _VERSION:find("5.4") then
    error("gg_lib requires Lua 5.4. Add `lua54 'yes'` to your fxmanifest.lua")
end

local GG_LIB   = "gg_lib"
local RESOURCE = GetCurrentResourceName()

if gg and gg.__lib == GG_LIB then
    error(("gg_lib loaded twice. Remove the duplicate '@gg_lib/init.lua' from %s/fxmanifest.lua"):format(RESOURCE))
end

local state = GetResourceState(GG_LIB)
if state ~= "started" and state ~= "starting" then
    error(("gg_lib is not started. Ensure it starts before %s in your server.cfg"):format(RESOURCE))
end

local context = IsDuplicityVersion() and "server" or "client"

--------------------------------------------------
-- MARK: Chunk Loading
--------------------------------------------------

local function readFile(path)
    return LoadResourceFile(GG_LIB, path)
end

local function loadChunk(path, env)
    local source = readFile(path)
    if not source or source == "" then return nil end

    local chunk, err = load(source, ("@@%s/%s"):format(GG_LIB, path), "t", env)
    if not chunk then
        error(("gg_lib failed to compile %s: %s"):format(path, err))
    end

    return chunk
end

local utility do
    local chunk = loadChunk("utility.lua")
    utility = chunk and chunk() or {}
end

local hostRequire = require

local function moduleRequire(name)
    if name == "utility" then return utility end

    return hostRequire(name)
end

local moduleEnv = setmetatable({ require = moduleRequire }, {
    __index = _ENV,
    __newindex = function(_, key, value)
        _ENV[key] = value
    end,
})

local moduleState = {}

local function runModule(name)
    local current = moduleState[name]
    if current then return current == "loaded" end

    moduleState[name] = "loading"

    local ran = false
    local ok, err = pcall(function()
        for _, file in ipairs({ "shared", context }) do
            local chunk = loadChunk(("modules/%s/%s.lua"):format(name, file), moduleEnv)

            if chunk then
                chunk()
                ran = true
            end
        end
    end)

    if not ok then
        moduleState[name] = nil
        error(err, 0)
    end

    moduleState[name] = ran and "loaded" or "missing"

    return ran
end

--------------------------------------------------
-- MARK: The gg Table
--------------------------------------------------

gg = setmetatable({
    __lib   = GG_LIB,
    context = context,
    utility = utility,
}, {
    __index = function(self, name)
        if type(name) ~= "string" then return nil end

        runModule(name)

        return rawget(self, name)
    end,
})

--------------------------------------------------
-- MARK: Bridge
--------------------------------------------------

local manifest do
    local chunk = loadChunk("bridge/manifest.lua")
    manifest = chunk()
end

-- The Bridges page stores its selections in the database; gg_lib publishes
-- them to a statebag and this reads it back. The read MUST be synchronous:
-- this runs at file scope, and a yield here suspends this file while the
-- scripts after it keep loading -- they would find no gg and no settings and
-- die one by one. Server exports run on the caller's coroutine and the store
-- awaits the database, so neither side may call into gg_lib for these.
local storedOverrides = {}

do
    local ok, stored = pcall(function() return GlobalState.gg_bridge_overrides end)

    if ok and type(stored) == "table" then storedOverrides = stored end
end

local function detectBridge(category)
    local fromStore = storedOverrides[category] ~= nil
    local override = storedOverrides[category] or utility[category]

    if override and override ~= "" then
        local overrideState = GetResourceState(override)
        local running = overrideState == "started" or overrideState == "starting"

        if not running then
            print(("^3[gg_lib] utility.lua forces %s = '%s' but that resource is not started^0"):format(category, override))
        end

        return override, {
            source  = fromStore and "stored" or "override",
            state   = overrideState,
            running = running,
        }
    end

    for _, candidate in ipairs(manifest.categories[category]) do
        local candidateState = GetResourceState(candidate)

        if candidateState == "started" or candidateState == "starting" then
            return candidate, { source = "detected", state = candidateState, running = true }
        end
    end

    return "default", { source = "default", state = "started", running = true }
end

gg.bridge = {}

gg.bridge_status = {}

for _, category in ipairs(manifest.category_order) do
    local resolved, detail = detectBridge(category)
    gg.bridge[category] = resolved

    local path   = ("bridge/%s/%s/%s.lua"):format(category, resolved, context)
    local chunk  = loadChunk(path, moduleEnv)
    local loaded = false
    local failure

    if not detail.running then
        failure = ("'%s' is not started"):format(resolved)
    end

    if chunk then
        local ok, err = pcall(chunk)

        if ok then
            loaded = true
        else
            failure = tostring(err)
            print(("^1[gg_lib] bridge %s/%s failed to load in %s: %s^0"):format(category, resolved, RESOURCE, err))
        end
    else
        loaded = true
    end

    gg.bridge_status[category] = {
        category = category,
        resource = resolved,
        source   = detail.source,
        state    = detail.state,
        loaded   = loaded and detail.running,
        error    = failure,
        stub     = resolved == "default",
    }

    if utility.debugMode then
        print(("[gg_lib] %s: %s -> %s"):format(RESOURCE, category, resolved))
    end
end

--------------------------------------------------
-- MARK: Core Modules
--------------------------------------------------

for _, name in ipairs(manifest.modules) do
    local ok, err = pcall(runModule, name)
    if not ok then
        print(("^1[gg_lib] module %s failed to load in %s: %s^0"):format(name, RESOURCE, err))
    end
end

--------------------------------------------------
-- MARK: Opt-in Modules
--------------------------------------------------

for index = 1, GetNumResourceMetadata(RESOURCE, "gg_lib") do
    local name = GetResourceMetadata(RESOURCE, "gg_lib", index - 1)

    if name and name ~= "" then
        local ok, err = pcall(runModule, name)
        if not ok then
            print(("^1[gg_lib] module %s failed to load in %s: %s^0"):format(name, RESOURCE, err))
        end
    end
end

--------------------------------------------------
-- MARK: Ready Signal
--------------------------------------------------

CreateThread(function()
    Wait(0)
    TriggerEvent(("%s:%s:onResourceStart"):format(RESOURCE, context))
end)
