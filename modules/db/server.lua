gg.db = gg.db or {}

--------------------------------------------------
-- MARK: Migrations
--------------------------------------------------
-- Schema changes that must happen exactly once, not on every boot. A statement
-- like ALTER TABLE ... ADD COLUMN is cheap but not free, and running it every
-- start means every server pays for it forever and the console fills with
-- warnings the owner cannot act on.
--
-- One table serves every GG script rather than each keeping its own ledger:
-- the resource name is part of the key, so scripts never collide.

local READY_TIMEOUT_MS = 15000

local ready = false
local applied = nil  -- key -> true, for this resource only

local function ensureTable()
    MySQL.query.await([=[
    CREATE TABLE IF NOT EXISTS `gg_studio_migrations` (
        `resource` VARCHAR(64) NOT NULL COLLATE 'utf8mb4_general_ci',
        `key` VARCHAR(190) NOT NULL COLLATE 'utf8mb4_general_ci',
        `applied_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (`resource`, `key`) USING BTREE
    )
    COLLATE='utf8mb4_general_ci'
    ENGINE=InnoDB
    ROW_FORMAT=DYNAMIC;
    ]=])
end

local function loadApplied()
    local resource = GetCurrentResourceName()
    local rows = MySQL.query.await("SELECT `key` FROM gg_studio_migrations WHERE resource = ?", { resource })

    applied = {}

    for _, row in ipairs(rows or {}) do
        applied[row.key] = true
    end
end

local function prepare()
    if applied then return true end

    local ok, err = pcall(function()
        ensureTable()
        loadApplied()
    end)

    if not ok then
        gg.print.error(("Migrations unavailable: %s"):format(err))
        return false
    end

    return true
end

CreateThread(function()
    -- oxmysql needs a moment; nothing may migrate before the ledger is read.
    local waited = 0

    while waited < READY_TIMEOUT_MS and GetResourceState("oxmysql") ~= "started" do
        Wait(250)
        waited = waited + 250
    end

    if prepare() then ready = true end
end)

local function waitForReady()
    local waited = 0

    while not ready and waited < READY_TIMEOUT_MS do
        Wait(100)
        waited = waited + 100
    end

    return ready
end

--- Run a schema change once for this resource, ever.
--- @param key string stable name for the change; never reuse one
--- @param statement string|function SQL to run, or a function to call
--- @return boolean applied true when this call performed the change
function gg.db.migrate(key, statement)
    if type(key) ~= "string" or key == "" then return false end
    if not waitForReady() then return false end
    if applied[key] then return false end

    local ok, err = pcall(function()
        if type(statement) == "function" then
            statement()
        else
            MySQL.query.await(statement)
        end
    end)

    if not ok then
        -- Not recorded, so a fixed statement gets another go next start.
        gg.print.error(("Migration '%s' failed: %s"):format(key, err))
        return false
    end

    MySQL.insert.await(
        "INSERT IGNORE INTO gg_studio_migrations (resource, `key`) VALUES (?, ?)",
        { GetCurrentResourceName(), key }
    )

    applied[key] = true

    gg.print.log(("Applied migration '%s'"):format(key))

    return true
end

--- Whether a migration has already run for this resource.
function gg.db.hasMigrated(key)
    if not waitForReady() then return false end

    return applied[key] == true
end
