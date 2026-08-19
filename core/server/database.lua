--------------------------------------------------
-- MARK: Database
--------------------------------------------------

Database = {}

local ready = false

local TABLES = {
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

    [=[
    CREATE TABLE IF NOT EXISTS `gg_studio_roles` (
        `id` VARCHAR(48) NOT NULL COLLATE 'utf8mb4_general_ci',
        `label` VARCHAR(64) NOT NULL COLLATE 'utf8mb4_general_ci',
        `icon` VARCHAR(48) DEFAULT NULL COLLATE 'utf8mb4_general_ci',
        `permissions` TEXT NOT NULL,
        `created_by` VARCHAR(100) DEFAULT NULL COLLATE 'utf8mb4_general_ci',
        `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (`id`) USING BTREE
    )
    COLLATE='utf8mb4_general_ci'
    ENGINE=InnoDB
    ROW_FORMAT=DYNAMIC;
    ]=],

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

    addColumn("gg_studio_settings_meta", "version", "VARCHAR(32) NULL DEFAULT NULL")

    -- Admins predate roles, so anyone already granted keeps full access.
    addColumn("gg_studio_admins", "role", "VARCHAR(48) NOT NULL DEFAULT 'admin'")

    ready = true
    TriggerEvent("gg_lib:database:ready")
end)
