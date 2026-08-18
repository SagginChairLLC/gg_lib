--------------------------------------------------
-- MARK: Settings Store
--------------------------------------------------
-- gg_lib settings module (server): persistence plus the export surface the
-- gg_lib host aggregates. Only overrides are stored: a row exists for a path
-- exactly when an admin has changed it away from the Lua default. That keeps
-- the database small, makes "reset to default" a DELETE, and means a script
-- update ships new defaults without the database fighting it.
--
-- Requires @oxmysql/lib/MySQL.lua in the consumer's server_scripts.

settings = settings or {}
settings.store = settings.store or {}

local RESOURCE = GetCurrentResourceName()

local overrides = {}   -- path -> stored value
local orphaned  = {}   -- path -> stored value for paths no longer in the schema
local revision  = 0
local ready     = false

--------------------------------------------------
-- MARK: Schema
--------------------------------------------------

local function ensureTables()
    MySQL.query.await([=[
    CREATE TABLE IF NOT EXISTS `gg_studio_settings` (
        `resource` VARCHAR(64) NOT NULL COLLATE 'utf8mb4_general_ci',
        `path` VARCHAR(190) NOT NULL COLLATE 'utf8mb4_general_ci',
        `value` TEXT NOT NULL,
        `updated_by` VARCHAR(100) DEFAULT NULL COLLATE 'utf8mb4_general_ci',
        `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (`resource`, `path`) USING BTREE
    )
    COLLATE='utf8mb4_general_ci'
    ENGINE=InnoDB
    ROW_FORMAT=DYNAMIC;
    ]=])

    MySQL.query.await([=[
    CREATE TABLE IF NOT EXISTS `gg_studio_settings_meta` (
        `resource` VARCHAR(64) NOT NULL COLLATE 'utf8mb4_general_ci',
        `revision` BIGINT NOT NULL DEFAULT 0,
        `version` VARCHAR(32) NULL DEFAULT NULL COLLATE 'utf8mb4_general_ci',
        PRIMARY KEY (`resource`) USING BTREE
    )
    COLLATE='utf8mb4_general_ci'
    ENGINE=InnoDB
    ROW_FORMAT=DYNAMIC;
    ]=])

    -- Installs that created the meta table before the version column existed.
    -- MariaDB understands IF NOT EXISTS; stock MySQL errors on the syntax and
    -- errors again (duplicate column) once the plain form has run. All harmless.
    local altered = pcall(MySQL.query.await, "ALTER TABLE `gg_studio_settings_meta` ADD COLUMN IF NOT EXISTS `version` VARCHAR(32) NULL DEFAULT NULL")
    if not altered then
        pcall(MySQL.query.await, "ALTER TABLE `gg_studio_settings_meta` ADD COLUMN `version` VARCHAR(32) NULL DEFAULT NULL")
    end
end

--------------------------------------------------
-- MARK: Encoding
--------------------------------------------------
-- Values are wrapped before encoding so a bare scalar round-trips as reliably as
-- a table -- json.encode(false) and json.encode("x") are not consistently
-- decodable on their own across runtimes.

local function encode(value)
    return json.encode({ v = value })
end

local function decode(raw)
    local ok, wrapper = pcall(json.decode, raw)
    if not ok or type(wrapper) ~= "table" then return nil end

    return wrapper.v
end

--------------------------------------------------
-- MARK: Load
--------------------------------------------------

local function loadOverrides()
    local rows = MySQL.query.await(
        "SELECT path, value FROM gg_studio_settings WHERE resource = ?",
        { RESOURCE }
    )

    local loaded = {}
    local undecodable = 0

    for _, row in ipairs(rows or {}) do
        local value = decode(row.value)

        if value ~= nil then
            loaded[row.path] = value
        else
            -- A row that will not decode is invisible everywhere else: it is
            -- not an override and not an orphan, so the setting just quietly
            -- runs on its default.
            undecodable = undecodable + 1
            gg.print.error(("Settings: row '%s' could not be decoded, using the default. Raw value: %s"):format(row.path, tostring(row.value)))
        end
    end

    gg.print.log(("Settings: read %d row(s) from the database for %s"):format(#(rows or {}), RESOURCE))

    return loaded, undecodable
end

--------------------------------------------------
-- MARK: Schema Drift
--------------------------------------------------
-- A script update can add, remove or rename settings, and the stored rows must
-- follow without ever costing an admin an override:
--   * added    -> nothing to do; overrides-only storage means no row = default.
--   * renamed  -> settings.define(path, { renamed_from = "old.path" }) migrates
--                 the stored row to the new path on boot.
--   * removed  -> the row is kept in the database (a downgrade or a temporarily
--                 removed setting must be able to find it again) but excluded
--                 from the running config and logged. settings.store.prune()
--                 deletes them, deliberately, via gg_lib's console command.

local function applyRenames(loaded)
    for path, def in pairs(settings.schema) do
        local sources = type(def.renamed_from) == "string" and { def.renamed_from } or def.renamed_from

        if type(sources) == "table" and loaded[path] == nil then
            for _, old in ipairs(sources) do
                if loaded[old] ~= nil then
                    local ok = pcall(MySQL.query.await,
                        "UPDATE gg_studio_settings SET path = ? WHERE resource = ? AND path = ?",
                        { path, RESOURCE, old })

                    if ok then
                        loaded[path] = loaded[old]
                        loaded[old] = nil
                        gg.print.log(("Settings: migrated stored override '%s' -> '%s'"):format(old, path))
                    end

                    break
                end
            end
        end
    end
end

-- Split the loaded rows into schema-backed overrides and orphans, so orphans
-- never reach cfg, snapshots or saves -- they only wait for prune or a schema
-- that declares them again.
local function partitionOrphans(loaded)
    local active = {}
    local names = {}

    for path, value in pairs(loaded) do
        if settings.schema[path] then
            active[path] = value
        else
            orphaned[path] = value
            names[#names + 1] = path
        end
    end

    if #names > 0 then
        table.sort(names)
        gg.print.warn(("Settings: %d stored override(s) no longer match a declared setting (kept; prune via gg_settings_prune): %s")
            :format(#names, table.concat(names, ", ")))
    end

    return active
end

-- Record which script build last ran against these rows, so upgrades and
-- downgrades are visible in the console instead of silent.
local function syncStoredVersion()
    local current = GetResourceMetadata(RESOURCE, "version", 0) or "0.0.0"

    local rows = MySQL.query.await(
        "SELECT version FROM gg_studio_settings_meta WHERE resource = ?",
        { RESOURCE }
    )

    local stored = rows and rows[1] and rows[1].version or nil

    if stored ~= current then
        if stored then
            gg.print.log(("Settings: stored config last written by v%s, now running v%s"):format(stored, current))
        end

        MySQL.query.await(
            "UPDATE gg_studio_settings_meta SET version = ? WHERE resource = ?",
            { current, RESOURCE }
        )
    end
end

local function loadRevision()
    local rows = MySQL.query.await(
        "SELECT revision FROM gg_studio_settings_meta WHERE resource = ?",
        { RESOURCE }
    )

    if rows and rows[1] then
        return tonumber(rows[1].revision) or 0
    end

    MySQL.insert.await(
        "INSERT INTO gg_studio_settings_meta (resource, revision) VALUES (?, 0)",
        { RESOURCE }
    )

    return 0
end

local function bumpRevision()
    revision = revision + 1

    MySQL.query.await(
        "UPDATE gg_studio_settings_meta SET revision = ? WHERE resource = ?",
        { revision, RESOURCE }
    )

    return revision
end

--------------------------------------------------
-- MARK: Replication
--------------------------------------------------
-- Only the changed paths go over the wire, not the whole config. Clients deep-set
-- them and rerun their derives, so a live edit costs a few hundred bytes.

-- Event names are global across resources, so every one of these is namespaced
-- by the owning resource. Without that, a second GG script carrying this module
-- would receive this script's sync and try to apply it against its own schema.
local function broadcast(changed)
    local payload = {}

    for index = 1, #changed do
        local path = changed[index]
        payload[path] = settings.read(path)
    end

    TriggerClientEvent(("gg_settings:%s:sync"):format(RESOURCE), -1, {
        resource = RESOURCE,
        revision = revision,
        values   = payload,
    })
end

-- Everything a joining client needs: the current revision and every override on
-- top of the defaults it already has compiled in.
function settings.store.snapshot()
    local values = {}

    for path in pairs(overrides) do
        if settings.schema[path] then
            values[path] = settings.read(path)
        end
    end

    return {
        resource = RESOURCE,
        revision = revision,
        values   = values,
    }
end

function settings.store.revision()
    return revision
end

function settings.store.isReady()
    return ready
end

--------------------------------------------------
-- MARK: Writes
--------------------------------------------------

-- Persist a batch of { [path] = value }. Validation runs before anything touches
-- the database, so a payload with one bad key writes nothing at all rather than
-- landing half-applied. `expectedRevision` (when given) must match the current
-- revision -- a mismatch means someone else saved since this batch was staged,
-- and the whole batch is rejected instead of overwriting their edits.
--
-- Returns (ok, changed_paths | error_map).
function settings.store.save(changes, actor, expectedRevision)
    if type(changes) ~= "table" then return false, { _ = "malformed payload" } end
    if not ready then return false, { _ = "settings are still loading" } end

    if expectedRevision ~= nil and tonumber(expectedRevision) ~= revision then
        return false, { _ = "settings changed since this page was opened -- refresh and try again" }
    end

    local accepted = {}
    local errors   = {}
    local count    = 0

    for path, value in pairs(changes) do
        local def = settings.schema[path]

        if not def then
            errors[path] = "is not a known setting"
        else
            local ok, result = settings.validate(def, value)

            if ok then
                accepted[path] = result
                count = count + 1
            else
                errors[path] = result
            end
        end
    end

    if next(errors) then return false, errors end
    if count == 0 then return true, {} end

    local queries = {}

    for path, value in pairs(accepted) do
        queries[#queries + 1] = {
            query = [[
                INSERT INTO gg_studio_settings (resource, path, value, updated_by)
                VALUES (?, ?, ?, ?)
                ON DUPLICATE KEY UPDATE value = VALUES(value), updated_by = VALUES(updated_by)
            ]],
            values = { RESOURCE, path, encode(value), actor },
        }
    end

    local ok, result = pcall(function()
        return MySQL.transaction.await(queries)
    end)

    if not ok then
        gg.print.error(("Failed to persist settings: %s"):format(result))
        return false, { _ = "database write failed" }
    end

    -- oxmysql answers a transaction with false when it rolled back, which is
    -- not an error and therefore does not reach the pcall above. Without this
    -- check a rolled-back write looks identical to a successful one: the live
    -- push still fires, the editor still says saved, and the value is simply
    -- gone at the next restart.
    if result == false then
        gg.print.error("Settings: the database rolled the write back; nothing was saved")
        return false, { _ = "database write failed" }
    end

    -- Read the rows straight back. A transaction that reports success but
    -- leaves nothing behind is the one failure mode that looks exactly like a
    -- setting that never saved, and one extra query on a human-paced action is
    -- cheap insurance against chasing it in the dark.
    local written = {}
    for path in pairs(accepted) do written[#written + 1] = path end

    local placeholders = string.rep("?", #written, ",")
    local check = { RESOURCE }
    for index = 1, #written do check[#check + 1] = written[index] end

    local verifyOk, rows = pcall(MySQL.query.await,
        ("SELECT path FROM gg_studio_settings WHERE resource = ? AND path IN (%s)"):format(placeholders),
        check)

    if verifyOk then
        local found = {}
        for _, row in ipairs(rows or {}) do found[row.path] = true end

        local missing = {}
        for index = 1, #written do
            if not found[written[index]] then missing[#missing + 1] = written[index] end
        end

        if #missing > 0 then
            gg.print.error(("Settings: the database accepted the write but %d row(s) are not there: %s")
                :format(#missing, table.concat(missing, ", ")))
        else
            gg.print.log(("Settings: %s stored %d override(s)"):format(actor or "someone", #written))
        end
    end

    -- History before the in-memory values move, so the "old" column is the
    -- value that was actually replaced.
    local history = {}
    for path, value in pairs(accepted) do
        history[#history + 1] = { path = path, action = "change", old = overrides[path], new = value }
    end

    pcall(function()
        exports.gg_lib:ggLogChange(history, actor)
    end)

    for path, value in pairs(accepted) do
        overrides[path] = value
    end

    local changed = settings.applyLive(accepted)
    bumpRevision()
    broadcast(changed)

    return true, changed
end

-- Drop the stored overrides for these paths and fall back to the Lua defaults.
function settings.store.reset(paths, actor, expectedRevision)
    if type(paths) ~= "table" then return false, { _ = "malformed payload" } end
    if not ready then return false, { _ = "settings are still loading" } end

    if expectedRevision ~= nil and tonumber(expectedRevision) ~= revision then
        return false, { _ = "settings changed since this page was opened -- refresh and try again" }
    end

    local targets = {}
    local restore = {}

    for _, path in ipairs(paths) do
        local def = settings.schema[path]

        if def then
            targets[#targets + 1] = path
            restore[path] = settings.deepCopy(def.default)
        end
    end

    if #targets == 0 then return true, {} end

    local placeholders = string.rep("?", #targets, ",")
    local values = { RESOURCE }

    for index = 1, #targets do
        values[#values + 1] = targets[index]
    end

    local ok, err = pcall(function()
        MySQL.query.await(
            ("DELETE FROM gg_studio_settings WHERE resource = ? AND path IN (%s)"):format(placeholders),
            values
        )
    end)

    if not ok then
        gg.print.error(("Failed to reset settings: %s"):format(err))
        return false, { _ = "database write failed" }
    end

    local history = {}
    for index = 1, #targets do
        local path = targets[index]
        history[#history + 1] = { path = path, action = "reset", old = overrides[path], new = restore[path] }
    end

    pcall(function()
        exports.gg_lib:ggLogChange(history, actor)
    end)

    for index = 1, #targets do
        overrides[targets[index]] = nil
    end

    local changed = settings.applyLive(restore)
    bumpRevision()
    broadcast(changed)

    if actor then
        gg.print.log(("%s reset %d setting(s)"):format(actor, #targets))
    end

    return true, changed
end

-- Sorted list of stored override paths no setting declares any more.
function settings.store.orphans()
    local names = {}
    for path in pairs(orphaned) do names[#names + 1] = path end
    table.sort(names)

    return names
end

-- Delete the orphaned rows. Never runs on its own -- only through gg_lib's
-- console command (or an explicit call), so nothing is lost to an accident.
function settings.store.prune(actor)
    local targets = settings.store.orphans()
    if #targets == 0 then return true, {} end

    local placeholders = string.rep("?", #targets, ",")
    local values = { RESOURCE }

    for index = 1, #targets do
        values[#values + 1] = targets[index]
    end

    local ok, err = pcall(function()
        MySQL.query.await(
            ("DELETE FROM gg_studio_settings WHERE resource = ? AND path IN (%s)"):format(placeholders),
            values
        )
    end)

    if not ok then
        gg.print.error(("Failed to prune settings: %s"):format(err))
        return false, { _ = "database write failed" }
    end

    orphaned = {}
    gg.print.log(("%s pruned %d orphaned setting override(s)"):format(actor or "console", #targets))

    return true, targets
end

--------------------------------------------------
-- MARK: Boot
--------------------------------------------------

CreateThread(function()
    ensureTables()

    revision = loadRevision()
    syncStoredVersion()

    -- Reconcile the stored rows against the schema this build declares before
    -- anything reads them: migrate renames, quarantine orphans.
    local loaded = loadOverrides()
    applyRenames(loaded)
    overrides = partitionOrphans(loaded)

    -- The schema has to exist before the rows are matched against it. If the
    -- config files have not declared anything yet, every stored row looks like
    -- an orphan and every setting silently runs on its default.
    local declared = 0
    for _ in pairs(settings.schema) do declared = declared + 1 end

    if declared == 0 then
        gg.print.error("Settings: no settings were declared before the store loaded -- every stored value will be ignored")
    end

    -- Overlay stored overrides, then let every registered derive compile against
    -- the final values. Nothing downstream should read cfg before this lands.
    settings.resolve(overrides)

    ready = true

    TriggerEvent("gg_settings:ready")
end)

--------------------------------------------------
-- MARK: Host Surface
--------------------------------------------------
-- The exports gg_lib's /jobsettings host discovers this resource by. Writes
-- come back through here so every resource validates and persists its own
-- settings against its own schema; the host never touches these tables.

exports("ggSettingsPing", function()
    return true
end)

exports("ggSettingsDescribe", function()
    if not settings.store.isReady() then return nil end

    local payload = settings.describe()
    payload.revision = settings.store.revision()

    return payload
end)

-- `actor` is passed through for the audit column. gg_lib has already checked
-- the caller's ACE permission; these are resource-to-resource exports and not
-- reachable from a client.
exports("ggSettingsApply", function(changes, actor, expectedRevision)
    local ok, result = settings.store.save(changes, actor, expectedRevision)

    return { ok = ok, result = result, revision = settings.store.revision() }
end)

exports("ggSettingsReset", function(paths, actor, expectedRevision)
    local ok, result = settings.store.reset(paths, actor, expectedRevision)

    return { ok = ok, result = result, revision = settings.store.revision() }
end)

exports("ggSettingsPrune", function(actor)
    local ok, result = settings.store.prune(actor)

    return { ok = ok, result = result }
end)

-- A joining client gets this resource's overrides on top of the defaults it
-- already has compiled in. Scoped by resource name because callback names are
-- global and every consumer registers one of these.
lib.callback.register(("gg_settings:%s:snapshot"):format(RESOURCE), function()
    if not settings.store.isReady() then return false end

    return true, settings.store.snapshot()
end)

--------------------------------------------------
-- MARK: Generic Settings
--------------------------------------------------
-- Studio-wide values live in gg_lib's store, not this resource's. Fetching them
-- also registers this resource as a subscriber in gg_lib: every generic edit
-- made in /jobsettings comes back through the ggGenericSync export below for as
-- long as both resources run. gg_lib's subscriber cache is memory-only, so the
-- onResourceStart re-fetch is what re-subscribes us after a gg_lib restart.

exports("ggGenericSync", function(payload)
    settings.generic.apply(payload)
end)

local function fetchGeneric()
    local ok, payload = pcall(function()
        return exports.gg_lib:ggGenericFetch()
    end)

    if not ok or type(payload) ~= "table" then return false end

    settings.generic.apply(payload)

    return true
end

CreateThread(function()
    for _ = 1, 50 do
        if GetResourceState("gg_lib") == "started" and fetchGeneric() then return end
        Wait(1000)
    end

    gg.print.warn("Could not fetch generic settings from gg_lib; cfg.generic is empty")
end)

AddEventHandler("onResourceStart", function(resource)
    if resource ~= "gg_lib" then return end

    -- A moment for gg_lib's server scripts to register the export again.
    SetTimeout(1000, fetchGeneric)
end)

--------------------------------------------------
-- MARK: Alias Command
--------------------------------------------------
-- settings.script({ command = "taxisettings" }) registers a per-script alias
-- that deep-links into this resource's page of the shared editor. Deferred a
-- tick so the config files (which declare the command name) have loaded.

CreateThread(function()
    Wait(0)

    local alias = settings.info.command
    if not alias then return end

    RegisterCommand(alias, function(source)
        exports.gg_lib:ggOpenSettings(source, RESOURCE)
    end, false)
end)
