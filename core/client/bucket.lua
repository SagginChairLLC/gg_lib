--------------------------------------------------
-- MARK: Editor Bucket (client)
--------------------------------------------------
-- Loaded before the editors that use it (alphabetical glob), and shaped like
-- GG_PAUSE_GUARD so any core/client file can lean on it without a module
-- loader. Entering is best effort: if the server never answers, editing still
-- goes ahead rather than leaving the owner staring at nothing.

GG_EDITOR_BUCKET = GG_EDITOR_BUCKET or { active = false }

function GG_EDITOR_BUCKET.enter()
    if GG_EDITOR_BUCKET.active then return true end

    local ok = pcall(function()
        return lib.callback.await("gg_lib:editor:bucketEnter", false)
    end)

    GG_EDITOR_BUCKET.active = ok == true

    return GG_EDITOR_BUCKET.active
end

function GG_EDITOR_BUCKET.leave()
    if not GG_EDITOR_BUCKET.active then return end

    -- Cleared first: a failed call must not leave the flag set, or a retry
    -- would be skipped and the player would stay stranded.
    GG_EDITOR_BUCKET.active = false

    pcall(function()
        lib.callback.await("gg_lib:editor:bucketLeave", false)
    end)
end

-- The server pulled us back without being asked (sweep, or an admin running
-- gg_unstick). Drop the flag so the next enter is not skipped.
RegisterNetEvent("gg_lib:editor:forceExit", function()
    GG_EDITOR_BUCKET.active = false
end)
