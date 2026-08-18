gg.util = gg.util or {}

--------------------------------------------------
-- MARK: Number Formatting
--------------------------------------------------

local SEPARATORS = {
    ["1,234.56"] = { group = ",", decimal = "." },
    ["1.234,56"] = { group = ".", decimal = "," },
    ["1 234,56"] = { group = " ", decimal = "," },
    ["1234.56"]  = { group = "",  decimal = "." },
}

local SYMBOLS = {
    USD = "$", CAD = "CA$", AUD = "A$", NZD = "NZ$", SGD = "S$", HKD = "HK$",
    TWD = "NT$", BRL = "R$", MXN = "MX$", ARS = "AR$", CLP = "CLP$", COP = "COL$",
    UYU = "$U", BSD = "$", BBD = "$", BMD = "$", BZD = "$", BND = "$", FJD = "$",
    GYD = "$", JMD = "$", KYD = "$", LRD = "$", NAD = "$", SBD = "$", SRD = "$",
    TTD = "$", XCD = "$", ZWL = "$",

    EUR = "€", GBP = "£", JPY = "¥", CNY = "¥", INR = "₹", KRW = "₩",
    KPW = "₩", RUB = "₽", UAH = "₴", TRY = "₺", ILS = "₪", VND = "₫",
    THB = "฿", PHP = "₱", NGN = "₦", GHS = "₵", CRC = "₡", PYG = "₲",
    LAK = "₭", MNT = "₮", KZT = "₸", AZN = "₼", GEL = "₾", BDT = "৳",
    KHR = "៛", PLN = "zł", CZK = "Kč", HUF = "Ft", ISK = "kr", NOK = "kr",
    SEK = "kr", DKK = "kr", CHF = "CHF", ZAR = "R", EGP = "E£", LBP = "L£",
    SYP = "S£", SDG = "SDG", SHP = "£", FKP = "£", GIP = "£", JEP = "£",

    PKR = "₨", LKR = "₨", NPR = "₨", MUR = "₨", SCR = "₨", IDR = "Rp",
    MYR = "RM", VES = "Bs.", BOB = "Bs.", PEN = "S/", GTQ = "Q", HNL = "L",
    NIO = "C$", DOP = "RD$", CUP = "₱", SVC = "₡", PAB = "B/.",
}

local SUFFIXED = { PLN = true, CZK = true, HUF = true, SEK = true, NOK = true, DKK = true, ISK = true }

local DEFAULT_SEPARATORS = SEPARATORS["1,234.56"]

local function genericGeneral()
    return cfg and cfg.generic and cfg.generic.general or nil
end

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

    if not digits then return text end

    local formatted = groupDigits(digits, separators.group)

    if fraction ~= "" then
        formatted = formatted .. separators.decimal .. fraction
    end

    return (number < 0 and "-" or "") .. formatted
end

function gg.util.formatMoney(amount, decimals)
    local general  = genericGeneral()
    local currency = general and general.currency_type or "USD"
    local formatted = gg.util.formatNumber(amount, decimals)

    local symbol = SYMBOLS[currency]

    if not symbol then
        return ("%s %s"):format(currency, formatted)
    end

    if SUFFIXED[currency] then
        return ("%s %s"):format(formatted, symbol)
    end

    return symbol .. formatted
end
