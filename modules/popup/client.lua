--------------------------------------------------
-- MARK: Popup
--------------------------------------------------
-- The basic string popup, rendered by gg_lib's ui_page (core/client/popup.lua)
-- so this script needs no web app of its own. One popup is shared by every
-- consumer -- the last writer wins.
--
-- Scripts still carrying their embedded copy keep their own global `popup`
-- (declared in their base/ files, loaded after this module) and their own NUI;
-- nothing here collides with that during migration.

gg.popup = gg.popup or {}

-- Partial update: any of { enabled, message, position }.
function gg.popup.update(partial)
    exports.gg_lib:ggPopupUpdate(partial)
end

-- A non-empty message auto-shows the popup; "" leaves it to hide()/toggle().
function gg.popup.message(msg)
    gg.popup.update({ message = msg })
end

function gg.popup.toggle(bool)
    gg.popup.update({ enabled = bool == true })
end

-- One-call show: message plus an optional position (default "bottom-middle").
function gg.popup.show(msg, position)
    gg.popup.update({ message = msg, position = position, enabled = true })
end

function gg.popup.hide()
    gg.popup.update({ enabled = false })
end
