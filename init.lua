--------------------------------------------------
-- MARK: gg_lib Import
--------------------------------------------------
-- A consumer adds '@gg_lib/init.lua' to its shared_scripts and this file runs
-- inside that resource's Lua VM: module and bridge sources are pulled over
-- with LoadResourceFile and executed here, so every gg.* function registers
-- its events, NUI callbacks and exports against the consumer.
--
-- Extra modules opt in per resource via manifest metadata: gg_lib 'settings'.

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

-- gg_lib's own utility.lua -- bridge overrides and lib preferences, configured
-- once server-wide instead of per script.
local utility do
    local chunk = loadChunk("utility.lua")
    utility = chunk and chunk() or {}
end

-- The module sources were written when they lived inside each script and did
-- require("utility") for that script's copy. Route that one require to gg_lib's
-- shared config; everything else behaves exactly as the consumer's own require.
local hostRequire = require

local function moduleRequire(name)
    if name == "utility" then return utility end

    return hostRequire(name)
end

-- Chunks run against the consumer's environment, with only `require` swapped.
-- Reads fall through to consumer globals; writes land in consumer globals; the
-- global `gg` the chunks mutate is the one defined below.
local moduleEnv = setmetatable({ require = moduleRequire }, {
    __index = _ENV,
    __newindex = function(_, key, value)
        _ENV[key] = value
    end,
})

-- Runs modules/<name>/shared.lua (if present) then the context file. Missing
-- files are fine -- plenty of modules are client- or server-only.
--
-- The state table is a re-entrancy guard, and it is load-bearing: nearly every
-- module opens with `gg.util = gg.util or {}`, and that READ of gg.util fires
-- gg's lazy __index for the very module that is mid-load. Without the guard
-- that recurses until the C stack dies ("C stack overflow" from load()).
-- 'loading' makes the self-read resolve to whatever the module has rawset so
-- far (usually nil, so `or {}` does its job); 'loaded'/'missing' make repeat
-- lookups free instead of re-executing files or re-hitting the disk.
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
        -- Leave no stale 'loading' marker behind; a retry should be possible.
        moduleState[name] = nil
        error(err, 0)
    end

    moduleState[name] = ran and "loaded" or "missing"

    return ran
end

--------------------------------------------------
-- MARK: The gg Table
--------------------------------------------------
-- Predefined keys plus a lazy fallback: indexing an unknown key attempts to
-- load modules/<key>/ on the fly, so future additions to gg_lib are available
-- without touching this file. The core set still loads eagerly below, because
-- some module folders populate differently-named keys.

gg = setmetatable({
    __lib   = GG_LIB,
    context = context,
    utility = utility,
}, {
    __index = function(self, name)
        if type(name) ~= "string" then return nil end

        runModule(name)

        -- rawget regardless of whether anything ran: a re-entrant read during
        -- a module's own load must see its partially-built table (or nil), and
        -- a folder whose key differs (miniBridge -> gg.fuel) sets keys that a
        -- later lookup finds here without another load.
        return rawget(self, name)
    end,
})

--------------------------------------------------
-- MARK: Bridge
--------------------------------------------------
-- Detection runs locally on both sides with the same rules, so there is no
-- server->client handshake: an override in gg_lib/utility.lua wins, otherwise
-- the first candidate in the manifest whose resource is started, otherwise the
-- category's default stub.

local manifest do
    local chunk = loadChunk("bridge/manifest.lua")
    manifest = chunk()
end

local function detectBridge(category)
    local override = utility[category]

    if override and override ~= "" then
        local overrideState = GetResourceState(override)
        if overrideState ~= "started" and overrideState ~= "starting" then
            print(("^3[gg_lib] utility.lua forces %s = '%s' but that resource is not started^0"):format(category, override))
        end

        return override
    end

    for _, candidate in ipairs(manifest.categories[category]) do
        local candidateState = GetResourceState(candidate)

        if candidateState == "started" or candidateState == "starting" then
            return candidate
        end
    end

    return "default"
end

-- Which resource each category resolved to, e.g. gg.bridge.framework = "qb-core".
gg.bridge = {}

for _, category in ipairs(manifest.category_order) do
    local resolved = detectBridge(category)
    gg.bridge[category] = resolved

    local chunk = loadChunk(("bridge/%s/%s/%s.lua"):format(category, resolved, context), moduleEnv)

    if chunk then
        local ok, err = pcall(chunk)
        if not ok then
            print(("^1[gg_lib] bridge %s/%s failed to load in %s: %s^0"):format(category, resolved, RESOURCE, err))
        end
    end

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
-- Read from the consumer's fxmanifest:  gg_lib 'settings'

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
-- The embedded core fired these once its async bridge handshake finished, and
-- script code listens for them (build/client/init.lua, daily_reset). Loading is
-- synchronous now, but the contract stays: fire on the next tick so every file
-- in the resource has finished its file-scope code first.

CreateThread(function()
    Wait(0)
    TriggerEvent(("%s:%s:onResourceStart"):format(RESOURCE, context))
end)
