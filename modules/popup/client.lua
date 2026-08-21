--------------------------------------------------
-- MARK: Popup
--------------------------------------------------

gg.popup = gg.popup or {}

function gg.popup.update(partial)
    exports.gg_lib:ggPopupUpdate(partial)
end

function gg.popup.message(msg)
    gg.popup.update({ message = msg })
end

function gg.popup.toggle(bool)
    gg.popup.update({ enabled = bool == true })
end

function gg.popup.show(msg, position)
    gg.popup.update({ message = msg, position = position, enabled = true })
end

--- Second argument may be a position string, as it always could be, or a table
--- of { position, accent }. accent is the raising script's own colour, so the
--- popup matches the UI it belongs to instead of gg_lib's.
local function options(opts)
    if type(opts) == "table" then return opts end

    return { position = opts }
end

--- Something is true. The default shape, and what every caller got before
--- variants existed.
function gg.popup.info(msg, opts)
    opts = options(opts)

    gg.popup.update({ message = msg, position = opts.position, accent = opts.accent or "", variant = "info", keybind = "", enabled = true })
end

--- Something is available to press. The key is drawn as a cap, so the reader
--- sees an action rather than a sentence about one.
function gg.popup.keybind(key, msg, opts)
    opts = options(opts)

    gg.popup.update({ message = msg, position = opts.position, accent = opts.accent or "", variant = "keybind", keybind = tostring(key or ""), enabled = true })
end

--- Something is about to cost the player. Same frame, urgent colouring, which
--- is deliberately NOT the script's accent -- a warning that matches the rest
--- of the UI stops reading as a warning.
function gg.popup.warn(msg, opts)
    opts = options(opts)

    gg.popup.update({ message = msg, position = opts.position, accent = "", variant = "warn", keybind = "", enabled = true })
end

--- Takes the prompt off screen. Scripts that draw their own HUD call this
--- before showing it, so the two do not stack.
function gg.popup.hide()
    gg.popup.update({ enabled = false })
end
