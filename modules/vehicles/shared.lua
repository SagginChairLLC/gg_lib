--------------------------------------------------
-- MARK: Vehicle Catalogue
--------------------------------------------------
-- Every framework keeps its vehicles somewhere different: qb and qbx in a
-- shared Lua table, ESX in a database table, and a dealership resource in its
-- own. This reads whichever is there and hands out one record shape.

gg.vehicles = gg.vehicles or {}

local RESOURCE = GetCurrentResourceName()
local CHANNEL  = ("%s:vehicles:catalogue"):format(RESOURCE)

local catalogue = nil
local byHash    = nil
local resolved  = false

--------------------------------------------------
-- MARK: Normalize
--------------------------------------------------

--- Turn one raw vehicle row into the shape every script can rely on.
--- Returns nil for anything without a usable spawn name.
function gg.vehicles.normalize(row)
    if type(row) ~= "table" then return nil end

    -- Sources disagree on what the spawn name is called.
    local model = row.model or row.spawn_code or row.spawncode or row.vehicle

    if type(model) ~= "string" or model == "" then return nil end

    model = model:lower()

    local price = tonumber(row.price)

    return {
        model    = model,
        label    = row.label or row.name or model,
        brand    = row.brand,
        price    = price and price >= 0 and price or nil,
        category = row.category,
    }
end

--------------------------------------------------
-- MARK: Dealership source
--------------------------------------------------

local DEALERSHIP = "jg-dealerships"

local SPAWN_COLUMNS = { "spawn_code", "model", "vehicle", "spawncode" }
local LABEL_COLUMNS = { "name", "label", "model_name" }

local function firstPresent(columns, candidates)
    for _, candidate in ipairs(candidates) do
        if columns[candidate] then return candidate end
    end

    return nil
end

--- The dealership keeps its vehicles in its own table, whose name and columns
--- are not published anywhere. Rather than guess, find the table that actually
--- holds spawn names and read the columns it turns out to have.
local function dealershipRows()
    local listed, tables = pcall(MySQL.query.await, "SHOW TABLES LIKE 'dealership%'")

    if not listed or type(tables) ~= "table" then return nil end

    for _, entry in ipairs(tables) do
        local name

        for _, value in pairs(entry) do
            if type(value) == "string" then name = value end
        end

        if name then
            local described, columns = pcall(MySQL.query.await, ("SHOW COLUMNS FROM `%s`"):format(name))

            if described and type(columns) == "table" then
                local present = {}

                for _, column in ipairs(columns) do
                    if type(column.Field) == "string" then present[column.Field] = true end
                end

                local spawn = firstPresent(present, SPAWN_COLUMNS)

                -- A price alongside a spawn name is what separates the vehicle
                -- catalogue from the dealership's other tables.
                if spawn and present.price then
                    local label  = firstPresent(present, LABEL_COLUMNS)
                    local fields = { ("`%s` AS model"):format(spawn), "`price`" }

                    if label then fields[#fields + 1] = ("`%s` AS name"):format(label) end
                    if present.brand then fields[#fields + 1] = "`brand`" end
                    if present.category then fields[#fields + 1] = "`category`" end

                    local read, rows = pcall(MySQL.query.await,
                        ("SELECT %s FROM `%s`"):format(table.concat(fields, ", "), name))

                    if read and type(rows) == "table" and rows[1] then return rows end
                end
            end
        end
    end

    return nil
end

--------------------------------------------------
-- MARK: Build
--------------------------------------------------

local function rawRows()
    if gg.context == "server" and GetResourceState(DEALERSHIP) == "started" then
        local rows = dealershipRows()

        if rows then return rows end
    end

    if not (gg.framework and gg.framework.GetVehicleTable) then return nil end

    local ok, rows = pcall(gg.framework.GetVehicleTable)

    return ok and type(rows) == "table" and rows or nil
end

local function absorb(rows)
    if type(rows) ~= "table" then return false end

    local out, hashes, total = {}, {}, 0

    for _, row in ipairs(rows) do
        local vehicle = gg.vehicles.normalize(row)

        if vehicle and not out[vehicle.model] then
            out[vehicle.model] = vehicle
            hashes[joaat(vehicle.model)] = vehicle
            total = total + 1
        end
    end

    if total == 0 then return false end

    catalogue, byHash = out, hashes
    resolved = true

    return true
end

local function build()
    return absorb(rawRows())
end

--------------------------------------------------
-- MARK: Reads
--------------------------------------------------

--- Every catalogued vehicle, keyed by spawn name.
function gg.vehicles.all()
    -- Clients are handed the catalogue by the server, so a read before it
    -- arrives answers empty rather than building one it cannot build.
    if not resolved and gg.context == "server" then build() end

    return catalogue or {}
end

--- One vehicle, or nil when nothing by that spawn name is catalogued.
function gg.vehicles.get(model)
    if type(model) ~= "string" then return nil end

    return gg.vehicles.all()[model:lower()]
end

--- The spawn name behind a model hash, replacing a scan of the whole list.
function gg.vehicles.fromHash(hash)
    if not resolved and gg.context == "server" then build() end

    local vehicle = byHash and byHash[hash]

    return vehicle and vehicle.model or nil
end

--- The label to show a player. Falls back to the spawn name so an unlisted
--- vehicle still reads as something.
function gg.vehicles.label(model)
    local vehicle = gg.vehicles.get(model)

    return vehicle and vehicle.label or model
end

function gg.vehicles.price(model)
    local vehicle = gg.vehicles.get(model)

    return vehicle and vehicle.price or nil
end

function gg.vehicles.exists(model)
    return gg.vehicles.get(model) ~= nil
end

--- The catalogue as a sorted array, for pickers and menus.
function gg.vehicles.list()
    local out = {}

    for _, vehicle in pairs(gg.vehicles.all()) do out[#out + 1] = vehicle end

    table.sort(out, function(a, b) return a.label:lower() < b.label:lower() end)

    return out
end

--- Every category the catalogue carries, sorted. Empty when the source has no
--- category of its own.
function gg.vehicles.categories()
    local seen, out = {}, {}

    for _, vehicle in pairs(gg.vehicles.all()) do
        if vehicle.category and not seen[vehicle.category] then
            seen[vehicle.category] = true
            out[#out + 1] = vehicle.category
        end
    end

    table.sort(out)

    return out
end

function gg.vehicles.ready()
    return resolved
end

--- Blocks until the catalogue is warm. False when it never arrives.
function gg.vehicles.await(timeout)
    local deadline = GetGameTimer() + (tonumber(timeout) or 30000)

    while not resolved do
        if GetGameTimer() > deadline then return false end

        Wait(100)
    end

    return true
end

--------------------------------------------------
-- MARK: Warm up
--------------------------------------------------

local WARM_TRIES = 60

if gg.context == "server" then
    --- Rebuilds from the framework as it stands now.
    function gg.vehicles.refresh()
        local previous, wasResolved, previousHashes = catalogue, resolved, byHash

        resolved, catalogue, byHash = false, nil, nil

        if build() then return true end

        -- A failed rebuild keeps what was already there rather than blanking
        -- every label over one hiccup.
        catalogue, resolved, byHash = previous, wasResolved, previousHashes

        return false
    end

    lib.callback.register(CHANNEL, function()
        return gg.vehicles.all()
    end)

    CreateThread(function()
        local wired = gg.bridge and gg.bridge.framework

        -- No framework means no vehicle list to read.
        if not wired or wired == "default" then return end

        for _ = 1, WARM_TRIES do
            if GetResourceState(wired) == "started" and build() then return end

            Wait(1000)
        end

        if gg.print and gg.print.warn then
            gg.print.warn(("could not read the vehicle list from %s"):format(wired))
        end
    end)
else
    -- Clients cannot read any of the sources themselves, so the catalogue is
    -- fetched once. Reads before it lands answer empty; await() covers code
    -- that cannot tolerate that.
    function gg.vehicles.refresh()
        local ok, rows = pcall(lib.callback.await, CHANNEL, false)

        if not ok or type(rows) ~= "table" then return false end

        local list = {}

        for _, vehicle in pairs(rows) do list[#list + 1] = vehicle end

        return absorb(list)
    end

    CreateThread(function()
        for _ = 1, WARM_TRIES do
            if gg.vehicles.refresh() then return end

            Wait(1000)
        end
    end)
end
