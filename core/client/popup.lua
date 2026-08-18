--------------------------------------------------
-- MARK: Popup
--------------------------------------------------
-- The basic string popup every GG script shows ("Drive to the pickup", "Press
-- E to talk"). It renders through gg_lib's own ui_page, so a consumer needs no
-- web app of its own -- scripts call gg.popup (modules/popup/client.lua), which
-- lands here through the export below.
--
-- State lives in this VM because every consumer shares one popup: the last
-- writer wins, and duplicate values are dropped before they reach the NUI.

local state = {
    enabled  = false,
    message  = "",
    position = "bottom-middle",
}

local function update(partial)
    if type(partial) ~= "table" then return end

    local out = {}

    if type(partial.position) == "string" and partial.position ~= state.position then
        state.position = partial.position
        out.position = partial.position
    end

    if type(partial.message) == "string" and partial.message ~= state.message then
        state.message = partial.message
        out.message = partial.message
    end

    local enabled = partial.enabled

    -- Same convenience the embedded copies had: a non-empty message shows the
    -- popup without an explicit toggle(true).
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
