--------------------------------------------------
-- MARK: Bridge Manifest
--------------------------------------------------
-- Every bridge gg_lib ships, in detection priority order. Each name is both the
-- folder under bridge/<category>/ and the resource it detects, so adding a new
-- bridge is: create the folder, add the name here.
--
-- This replaces the old io.popen directory scan -- a static list means client
-- and server can run identical detection with no filesystem access and no
-- server->client sync round-trip.
--
-- Order matters: the first candidate whose resource is started wins. qbx_core
-- sits before qb-core because a qbox server also runs a qb-core shim.

return {
    categories = {
        framework = {
            "qbx_core",
            "qb-core",
            "es_extended",
        },
        inventory = {
            "ox_inventory",
            "qb-inventory",
            "qs-inventory",
            "ps-inventory",
            "origen_inventory",
            "codem-inventory",
            "core_inventory",
            "lj-inventory",
            "jpr-inventory",
            "tgiann-inventory",
            "ak47_inventory",
            "one_inventory",
        },
        target = {
            "ox_target",
            "qb-target",
        },
        dispatch = {
            "cd_dispatch",
            "ps-dispatch",
            "qs-dispatch",
            "rcore_dispatch",
            "l2s-dispatch",
            "lb-tablet",
            "origen_police",
            "redutzu-mdt",
            "kartik-mdt",
            "tk_dispatch",
            "dusa_dispatch",
            "piotreq_gpt",
        },
    },

    -- Categories load in this order: framework first, since other bridges and
    -- lib modules may lean on it.
    category_order = { "framework", "inventory", "target", "dispatch" },

    -- Core gg.* modules, loaded eagerly into every consumer in this order.
    -- Eager (not lazy) on purpose: folder names do not always match the gg key
    -- they populate (scriptcache -> gg.cache, miniBridge -> gg.fuel/gg.keys),
    -- and consumers were written against an always-there gg. print loads first
    -- so everything after it can log.
    modules = {
        "print",
        "scriptcache",
        "util",
        "blip",
        "camera",
        "display",
        "menu",
        "miniBridge",
        "nui",
        "pedManager",
        "player",
        "popup",
        "vehicleManager",
    },
}
