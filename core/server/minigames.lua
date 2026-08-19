--------------------------------------------------
-- MARK: Minigame Defaults
--------------------------------------------------
-- Hands a client the server owner's stored defaults for one game. Defaults are
-- tuning, not secrets, so there is no gate -- any player about to play a game
-- needs them.

local KNOWN = {
    skillcheck = true, keymash = true, timing = true,
    sequence = true, memory = true, wordwiz = true, connect = true,
    hold = true, reflex = true, breach = true, lockpick = true, codecrack = true,
}

lib.callback.register("gg_lib:minigames:defaults", function(_, name)
    if type(name) ~= "string" or not KNOWN[name] then return nil end

    return GenericSettings.get(("minigames.%s"):format(name))
end)
