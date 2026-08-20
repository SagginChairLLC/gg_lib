--------------------------------------------------
-- MARK: Popup
--------------------------------------------------

-- The master switch and the default anchor live in Generic Settings. They are
-- read here rather than in each script: one switch, enforced once, or every
-- consumer ends up reinventing it against a setting it does not own.
--
-- gg_lib's own client VM has no module loader, so settings.generic is reached
-- defensively rather than assumed.
local function generic(path)
    if settings and settings.generic and settings.generic.get then
        return settings.generic.get(path)
    end

    return nil
end

local function popupsAllowed()
    return generic("popup.enabled") ~= false
end

local function defaultPosition()
    local stored = generic("popup.position")

    return type(stored) == "string" and stored ~= "" and stored or "bottom-middle"
end

local VARIANTS = { info = true, keybind = true, warn = true }

local state = {
    enabled  = false,
    message  = "",
    position = "bottom-middle",
    variant  = "info",
    keybind  = "",
}

local function update(partial)
    if type(partial) ~= "table" then return end

    -- Turned off server-wide: nothing is shown, and anything already up goes.
    if not popupsAllowed() then
        if not state.enabled then return end

        state.enabled = false
        SendNUIMessage({ action = "popup_update", data = { enabled = false } })

        return
    end

    local out = {}

    -- A caller that names no position gets the server's anchor rather than
    -- whatever the last script happened to leave behind.
    if partial.position == nil and state.position ~= defaultPosition() then
        state.position = defaultPosition()
        out.position = state.position
    end

    if type(partial.position) == "string" and partial.position ~= state.position then
        state.position = partial.position
        out.position = partial.position
    end

    if type(partial.message) == "string" and partial.message ~= state.message then
        state.message = partial.message
        out.message = partial.message
    end

    -- An unknown variant falls back to info rather than reaching the UI and
    -- rendering as nothing at all.
    if type(partial.variant) == "string" then
        local variant = VARIANTS[partial.variant] and partial.variant or "info"

        if variant ~= state.variant then
            state.variant = variant
            out.variant = variant
        end
    end

    if type(partial.keybind) == "string" and partial.keybind ~= state.keybind then
        state.keybind = partial.keybind
        out.keybind = partial.keybind
    end

    local enabled = partial.enabled

    if enabled == nil and type(partial.message) == "string" and partial.message ~= "" and not state.enabled then
        enabled = true
    end

    if type(enabled) == "boolean" and enabled ~= state.enabled then
        state.enabled = enabled
        out.enabled = enabled
    end

    if next(out) == nil then return end

    SendNUIMessage({
        action = "popup_update",
        data   = out,
    })
end

exports("ggPopupUpdate", update)
