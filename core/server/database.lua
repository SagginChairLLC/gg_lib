--------------------------------------------------
-- MARK: Database
--------------------------------------------------
-- Every gg_lib table is created here, once, at boot. gg_lib starts before any
-- consumer, so the tables exist by the time a script's own store loads.
-- Fires `gg_lib:database:ready` when the schema is in place.

Database = {}

local ready = false

local TABLES = {
    -- Setting overrides for every script, plus the studio-wide values under
    -- the pseudo-resource 'gg_studio'. Defaults stay in Lua; only changed
    -- keys get a row.
    [=[
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
    ]=],

    -- Per-resource config revision, bumped on every save so a stale editor
    -- page cannot clobber another admin's write.
    [=[
    CREATE TABLE IF NOT EXISTS `gg_studio_settings_meta` (
        `resource` VARCHAR(64) NOT NULL COLLATE 'utf8mb4_general_ci',
        `revision` BIGINT NOT NULL DEFAULT 0,
        `version` VARCHAR(32) NULL DEFAULT NULL COLLATE 'utf8mb4_general_ci',
        PRIMARY KEY (`resource`) USING BTREE
    )
    COLLATE='utf8mb4_general_ci'
    ENGINE=InnoDB
    ROW_FORMAT=DYNAMIC;
    ]=],

    -- Who changed what, and when. Append only: settings rows are overwritten
    -- in place, so without this there is no way to answer "who turned that
    -- off". Indexed by time because that is the only way it is ever read.
    [=[
    CREATE TABLE IF NOT EXISTS `gg_studio_log` (
        `id` BIGINT NOT NULL AUTO_INCREMENT,
        `resource` VARCHAR(64) NOT NULL COLLATE 'utf8mb4_general_ci',
        `path` VARCHAR(190) NOT NULL COLLATE 'utf8mb4_general_ci',
        `action` VARCHAR(16) NOT NULL DEFAULT 'change' COLLATE 'utf8mb4_general_ci',
        `old_value` TEXT NULL,
        `new_value` TEXT NULL,
        `actor` VARCHAR(100) DEFAULT NULL COLLATE 'utf8mb4_general_ci',
        `changed_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (`id`) USING BTREE,
        INDEX `idx_changed_at` (`changed_at`) USING BTREE,
        INDEX `idx_resource` (`resource`, `changed_at`) USING BTREE
    )
    COLLATE='utf8mb4_general_ci'
    ENGINE=InnoDB
    ROW_FORMAT=DYNAMIC;
    ]=],

    -- Admins granted in game. server_config.lua is the separate bootstrap
    -- list and is never written here.
    [=[
    CREATE TABLE IF NOT EXISTS `gg_studio_admins` (
        `identifier` VARCHAR(96) NOT NULL COLLATE 'utf8mb4_general_ci',
        `name` VARCHAR(100) DEFAULT NULL COLLATE 'utf8mb4_general_ci',
        `granted_by` VARCHAR(100) DEFAULT NULL COLLATE 'utf8mb4_general_ci',
        `granted_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (`identifier`) USING BTREE
    )
    COLLATE='utf8mb4_general_ci'
    ENGINE=InnoDB
    ROW_FORMAT=DYNAMIC;
    ]=],
}

-- MariaDB understands IF NOT EXISTS here; MySQL errors on the syntax and then
-- errors again on the plain form once it has run. Both are harmless.
local function addColumn(table_, column, definition)
    local ok = pcall(MySQL.query.await,
        ("ALTER TABLE `%s` ADD COLUMN IF NOT EXISTS `%s` %s"):format(table_, column, definition))

    if not ok then
        pcall(MySQL.query.await,
            ("ALTER TABLE `%s` ADD COLUMN `%s` %s"):format(table_, column, definition))
    end
end

function Database.isReady()
    return ready
end

CreateThread(function()
    for index = 1, #TABLES do
        MySQL.query.await(TABLES[index])
    end

    -- Installs created before the column existed.
    addColumn("gg_studio_settings_meta", "version", "VARCHAR(32) NULL DEFAULT NULL")

    ready = true
    TriggerEvent("gg_lib:database:ready")
end)
