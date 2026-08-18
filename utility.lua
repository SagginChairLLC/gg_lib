--------------------------------------------------
-- MARK: gg_lib Configuration
--------------------------------------------------
-- One file for the whole server. Every GG script that imports gg_lib reads its
-- bridge overrides and lib preferences from here -- there is no per-script
-- utility.lua to keep in sync any more.

return {
    debugMode = false,      -- Print bridge detection results per resource
    notifications = "ox",   -- [ox, qb, esx] [defaults ox]
    ProgressBar = "ox",     -- [ox, qb, esx] [defaults ox]

    -- OVERRIDES (Skips auto detection. Leave blank to auto detect; a named
    -- resource that is not started will be warned about at boot.)
    framework = "", -- e.g. "qb-core", "qbx_core", "es_extended"
    inventory = "", -- e.g. "ox_inventory", "qb-inventory"
    target    = "", -- e.g. "ox_target", "qb-target"
    dispatch  = "", -- e.g. "cd_dispatch", "ps-dispatch"
}
