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

function gg.popup.hide()
    gg.popup.update({ enabled = false })
end
