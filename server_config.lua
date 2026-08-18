--------------------------------------------------
-- MARK: gg_lib Server Configuration
--------------------------------------------------
-- Server only. Never sent to a client. Restart gg_lib to apply changes.

return {
    -- The bootstrap admin list: who can open /ggsettings before anyone has
    -- been granted access in the editor. Everyone else is added there.
    -- Prefix other identifier types (steam:, discord:, fivem:, license:).
    admins = {
        "license2:6e713bc45df69b1338e94c292948ef0053ffb638",
    },

    -- Whether ACE grants count too. False = this list is the only way in.
    ace = true,
}
