--------------------------------------------------
-- MARK: gg_lib Configuration
--------------------------------------------------

return {
    debugMode = false,      -- Print bridge detection results per resource
    notifications = "ox",   -- [ox, qb, esx] [defaults ox]
    ProgressBar = "ox",     -- [ox, qb, esx] [defaults ox]
    textUi = "ox",          -- [ox, qb, esx] [defaults ox]

    framework = "", -- e.g. "qb-core", "qbx_core", "es_extended"
    inventory = "", -- e.g. "ox_inventory", "qb-inventory"
    target    = "", -- e.g. "ox_target", "qb-target"
    dispatch  = "", -- e.g. "cd_dispatch", "ps-dispatch"
}
