--------------------------------------------------
-- MARK: Bridge Manifest
--------------------------------------------------

return {
    -- ox and qb candidates sit LAST in every list on purpose: plenty of servers
    -- run them as dependencies of the thing they actually use, so any other
    -- started resource wins auto detection first. qbx_core stays ahead of
    -- qb-core because a qbox server also runs a qb-core shim.
    categories = {
        framework = {
            "es_extended",
            "qbx_core",
            "qb-core",
        },
        inventory = {
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
            "ox_inventory",
            "qb-inventory",
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

    category_order = { "framework", "inventory", "target", "dispatch" },

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
        "minigames",
        "vehicleManager",
    },
}
