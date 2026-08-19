gg.target = gg.target or {}

-- sleepless_interact answers the ox_target exports this bridge uses, so it runs
-- that bridge rather than keeping a copy that would drift away from it. It is
-- detected separately because `provides` does not make GetResourceState report
-- ox_target as started, so nothing would match it otherwise.

local PATH = "bridge/target/ox_target/client.lua"

local source = LoadResourceFile("gg_lib", PATH)

if not source or source == "" then
    print("^1[gg_lib] sleepless_interact bridge could not read " .. PATH .. "^0")
    return
end

local chunk, err = load(source, ("@@gg_lib/%s"):format(PATH), "t", _ENV)

if not chunk then
    print("^1[gg_lib] sleepless_interact bridge could not compile " .. PATH .. ": " .. tostring(err) .. "^0")
    return
end

chunk()

-- isActive is the one call it does not provide; the shared file already answers
-- false when an export is missing, so nothing else needs saying here.
