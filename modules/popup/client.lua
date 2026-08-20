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

--- Something is true. The default shape, and what every caller got before
--- variants existed.
function gg.popup.info(msg, position)
    gg.popup.update({ message = msg, position = position, variant = "info", keybind = "", enabled = true })
end

--- Something is available to press. The key is drawn as a cap, so the reader
--- sees an action rather than a sentence about one.
function gg.popup.keybind(key, msg, position)
    gg.popup.update({ message = msg, position = position, variant = "keybind", keybind = tostring(key or ""), enabled = true })
end

--- Something is about to cost the player. Same frame, urgent colouring.
function gg.popup.warn(msg, position)
    gg.popup.update({ message = msg, position = position, variant = "warn", keybind = "", enabled = true })
end

function gg.popup.hide()
    gg.popup.update({ enabled = false })
end
