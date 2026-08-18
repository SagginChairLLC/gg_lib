gg.util = gg.util or {}

--------------------------------------------------
-- MARK: Number Formatting
--------------------------------------------------
-- Reads the studio-wide number format and currency out of cfg.generic, so a
-- script never carries its own copy. cfg.generic only exists in resources
-- carrying the settings module, and it is empty until gg_lib's first payload
-- lands, so both fall back to the US default rather than erroring.

local SEPARATORS = {
    ["1,234.56"] = { group = ",", decimal = "." },
    ["1.234,56"] = { group = ".", decimal = "," },
    ["1 234,56"] = { group = " ", decimal = "," },
    ["1234.56"]  = { group = "",  decimal = "." },
}

-- Symbols for the currencies that have one people recognise on sight. Every
-- other ISO code falls back to the code itself with a space ("PLN 1,234"),
-- which is how those currencies are normally written anyway -- and means the
-- full ISO list works without inventing a glyph for each one.
local SYMBOLS = {
    -- Dollar family
    USD = "$", CAD = "CA$", AUD = "A$", NZD = "NZ$", SGD = "S$", HKD = "HK$",
    TWD = "NT$", BRL = "R$", MXN = "MX$", ARS = "AR$", CLP = "CLP$", COP = "COL$",
    UYU = "$U", BSD = "$", BBD = "$", BMD = "$", BZD = "$", BND = "$", FJD = "$",
    GYD = "$", JMD = "$", KYD = "$", LRD = "$", NAD = "$", SBD = "$", SRD = "$",
    TTD = "$", XCD = "$", ZWL = "$",

    -- Widely recognised glyphs
    EUR = "€", GBP = "£", JPY = "¥", CNY = "¥", INR = "₹", KRW = "₩",
    KPW = "₩", RUB = "₽", UAH = "₴", TRY = "₺", ILS = "₪", VND = "₫",
    THB = "฿", PHP = "₱", NGN = "₦", GHS = "₵", CRC = "₡", PYG = "₲",
    LAK = "₭", MNT = "₮", KZT = "₸", AZN = "₼", GEL = "₾", BDT = "৳",
    KHR = "៛", PLN = "zł", CZK = "Kč", HUF = "Ft", ISK = "kr", NOK = "kr",
    SEK = "kr", DKK = "kr", CHF = "CHF", ZAR = "R", EGP = "E£", LBP = "L£",
    SYP = "S£", SDG = "SDG", SHP = "£", FKP = "£", GIP = "£", JEP = "£",

    -- Pound and rupee variants that read oddly as bare codes
    PKR = "₨", LKR = "₨", NPR = "₨", MUR = "₨", SCR = "₨", IDR = "Rp",
    MYR = "RM", VES = "Bs.", BOB = "Bs.", PEN = "S/", GTQ = "Q", HNL = "L",
    NIO = "C$", DOP = "RD$", CUP = "₱", SVC = "₡", PAB = "B/.",
}

-- Currencies whose symbol conventionally follows the amount.
local SUFFIXED = { PLN = true, CZK = true, HUF = true, SEK = true, NOK = true, DKK = true, ISK = true }

local DEFAULT_SEPARATORS = SEPARATORS["1,234.56"]

local function genericGeneral()
    return cfg and cfg.generic and cfg.generic.general or nil
end

-- Group in threes using a placeholder first: the separator can be "." or " ",
-- either of which would be read as a pattern if inserted directly.
local function groupDigits(digits, separator)
    if separator == "" then return digits end

    local marked = digits:reverse():gsub("(%d%d%d)", "%1\1"):reverse()

    if marked:sub(1, 1) == "\1" then marked = marked:sub(2) end

    return (marked:gsub("\1", separator))
end

function gg.util.formatNumber(number, decimals)
    local general    = genericGeneral()
    local separators = SEPARATORS[general and general.number_format] or DEFAULT_SEPARATORS

    number   = tonumber(number) or 0
    decimals = tonumber(decimals) or 0

    local text = ("%%.%df"):format(decimals):format(math.abs(number))
    local digits, fraction = text:match("^(%d+)%.?(%d*)$")

    -- inf/nan have no digits to group; hand back whatever %f produced.
    if not digits then return text end

    local formatted = groupDigits(digits, separators.group)

    if fraction ~= "" then
        formatted = formatted .. separators.decimal .. fraction
    end

    return (number < 0 and "-" or "") .. formatted
end

-- Same formatting, wearing the studio currency's symbol.
function gg.util.formatMoney(amount, decimals)
    local general  = genericGeneral()
    local currency = general and general.currency_type or "USD"
    local formatted = gg.util.formatNumber(amount, decimals)

    local symbol = SYMBOLS[currency]

    -- No glyph worth showing: the code reads better than a guess. This is the
    -- normal case for most of ISO 4217, not a failure.
    if not symbol then
        return ("%s %s"):format(currency, formatted)
    end

    if SUFFIXED[currency] then
        return ("%s %s"):format(formatted, symbol)
    end

    return symbol .. formatted
end
