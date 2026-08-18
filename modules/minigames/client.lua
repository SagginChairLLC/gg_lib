gg.minigames = gg.minigames or {}

--- Run a minigame and get pass/fail back. Blocks the calling thread until the
--- player finishes, exactly like a progress bar.
---
--- opts overrides the server's stored defaults for this one run.
function gg.minigames.play(name, opts)
    return exports.gg_lib:ggMinigame(name, opts) == true
end

--- A needle sweeps a ring; hit the key inside the marked arc.
--- opts: rounds, zone (degrees), speed (degrees/s), key or keys
function gg.minigames.skillcheck(opts)
    return gg.minigames.play("skillcheck", opts)
end

--- Mash the key to fill the bar before the clock empties.
--- opts: time (s), decay (%/s), gain (% per press), key
function gg.minigames.keymash(opts)
    return gg.minigames.play("keymash", opts)
end

--- Stop the sweeping marker inside the zone.
--- opts: rounds, zone (track %), speed (sweeps/s), key
function gg.minigames.timing(opts)
    return gg.minigames.play("timing", opts)
end

--- Type the shown keys in order before the timer empties.
--- opts: length, time (s)
function gg.minigames.sequence(opts)
    return gg.minigames.play("sequence", opts)
end

--- Tiles flash; click every one that lit up.
--- opts: size (grid), flashes, time (s)
function gg.minigames.memory(opts)
    return gg.minigames.play("memory", opts)
end

--- Unscramble the word and type it before the timer empties.
--- opts: length, time (s)
function gg.minigames.wordwiz(opts)
    return gg.minigames.play("wordwiz", opts)
end

--- Drag wires between matching dots without crossing them.
--- opts: pairs (3-5), time (s)
function gg.minigames.connect(opts)
    return gg.minigames.play("connect", opts)
end

--- Fails the running game, if any. The play call returns false.
function gg.minigames.cancel()
    return exports.gg_lib:ggMinigameCancel()
end

function gg.minigames.active()
    return exports.gg_lib:ggMinigameActive() == true
end
