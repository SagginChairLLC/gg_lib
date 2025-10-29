gg.util = gg.util or {}

gg.util.formatNumber = function(number)
    local formatted = tostring(math.floor(number)):reverse():gsub("(%d%d%d)", "%1,"):reverse()
    if formatted:sub(1, 1) == "," then
        formatted = formatted:sub(2)
    end
    return formatted
end

-- Only used in boosting to move images from imageprocessor to boosting.
gg.util.addFile = function(srcResource, srcDir, fileName, destResource, destDir)
    local src = GetResourcePath(srcResource) .. "/" .. srcDir .. "/" .. fileName
    local dest = GetResourcePath(destResource) .. "/" .. destDir .. "/" .. fileName

    local srcFile = io.open(src, "rb")
    if not srcFile then
        print("^1[ERROR]^7 Could not open source file: " .. src)
        return false
    end

    local data = srcFile:read("*all")
    srcFile:close()

    os.execute("mkdir \"" .. dest:match("(.*/)") .. "\"")

    local destFile = io.open(dest, "wb")
    if not destFile then
        print("^1[ERROR]^7 Could not open destination file: " .. dest)
        return false
    end

    destFile:write(data)
    destFile:close()
    return true
end

-- Only used in boosting to remove unused vehicle images
gg.util.removeFile = function(resource, dir, fileName)
    local path = GetResourcePath(resource) .. "/" .. dir .. "/" .. fileName

    local file = io.open(path, "r")
    if not file then
        print("^1[ERROR]^7 File does not exist: " .. path)
        return false
    end
    file:close()

    local success, reason = os.remove(path)
    if not success then
        print("^1[ERROR]^7 Could not remove file: " .. path .. " (" .. tostring(reason) .. ")")
        return false
    end

    return true
end


gg.util.copyTable = function(orig)
    local function deepCopy(tbl)
        local copy = {}
        for k, v in pairs(tbl) do
            if type(v) == "table" then
                copy[k] = deepCopy(v)
            else
                copy[k] = v
            end
        end
        return copy
    end
    return deepCopy(orig)
end

