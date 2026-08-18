--------------------------------------------------
-- MARK: Popup
--------------------------------------------------

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
