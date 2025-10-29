gg.player = gg.player or {}

-- @param coord | vector4 coordinate
gg.player.teleport = function(coord)
    local ped = PlayerPedId()
    DoScreenFadeOut(500)
    while not IsScreenFadedOut() do
        Wait(0)
    end
    RequestCollisionAtCoord(coord.x, coord.y, coord.z)
    SetEntityCoords(ped, coord.x, coord.y, coord.z, false, false, false, true)
    SetEntityHeading(ped, coord.w)
    while not HasCollisionLoadedAroundEntity(ped) do
        Wait(0)
    end
    DoScreenFadeIn(500)
end


local TabletProp
gg.player.ToggleTablet = function(toggle)
    if toggle then
        if not DoesEntityExist(TabletProp) then
            local PlayerPed =  PlayerPedId()
            local PlayerCoords = GetEntityCoords(PlayerPed)
            gg.util.loadAnimDict("amb@code_human_in_bus_passenger_idles@female@tablet@idle_a")
            TaskPlayAnim(PlayerPed, 'amb@code_human_in_bus_passenger_idles@female@tablet@idle_a', 'idle_a', 2.0, 2.0, -1, 51, 0, false, false, false)
            TabletProp = CreateObject(GetHashKey("prop_cs_tablet"), PlayerCoords.x, PlayerCoords.y, PlayerCoords.z,  true,  true, true)
            AttachEntityToEntity(TabletProp, PlayerPed, GetPedBoneIndex(PlayerPed, 28422), -0.05, 0.0, 0.0, 0.0, 0.0, 0.0, true, true, false, true, 1, true)
        end
    else
        ClearPedTasks(PlayerPedId())
        if DoesEntityExist(TabletProp) then
            DeleteEntity(TabletProp)
        end
    end

    return true
end