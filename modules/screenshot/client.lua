gg.screenshot = gg.screenshot or {}

--- Photograph vehicles against a green backdrop and store the results.
---
--- entries: { { id = "adder", vehicle = "adder", mods = {}, color = {} }, ... }
--- options: target (resource to write into, defaults to this one), folder,
---          quality, settle, progress(index, total, entry)
---
--- Returns ok, results — results being { captured = { id, ... }, failed = { { id, error }, ... } }.
---
--- Everything happens inside gg_lib: the camera, the keying and the upload. A
--- script needs no NUI code of its own for this.
function gg.screenshot.vehicles(entries, options)
    options = options or {}
    options.target = options.target or GetCurrentResourceName()

    return exports.gg_lib:ggCaptureVehicles(entries, options)
end

--- Fired when one image lands, with the path or URL to show it at.
--- handler(name, location)
function gg.screenshot.onStored(handler)
    RegisterNetEvent("gg_lib:screenshot:stored", handler)
end
