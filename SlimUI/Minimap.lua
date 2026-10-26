local ADDON, ns = ...

-- LibDBIcon and friends read this to place their buttons on a square map
function GetMinimapShape()
	return "SQUARE"
end

local function SquareHybrid()
	local hybrid = _G.HybridMinimap
	if hybrid and hybrid.CircleMask and hybrid.MapCanvas then
		hybrid.MapCanvas:SetUseMaskTexture(false)
		hybrid.CircleMask:SetTexture(ns.WHITE)
		hybrid.MapCanvas:SetUseMaskTexture(true)
	end
end

ns.Module(function()
	local map = Minimap
	map:SetMaskTexture(ns.WHITE)
	for _, fn in ipairs({ "SetArchBlobRingScalar", "SetArchBlobRingAlpha", "SetQuestBlobRingScalar",
		"SetQuestBlobRingAlpha", "SetTaskBlobRingScalar", "SetTaskBlobRingAlpha" }) do
		if map[fn] then map[fn](map, 0) end
	end
	ns.Backdrop(map, 1)

	if MinimapCompassTexture then
		MinimapCompassTexture:SetTexture(nil)
		MinimapCompassTexture:SetAlpha(0)
	end
	local cluster = MinimapCluster
	if cluster and cluster.BorderTop then cluster.BorderTop:SetAlpha(0) end
	if MinimapZoneText then MinimapZoneText:SetFont(ns.FONT, 13, "OUTLINE") end

	-- mouse wheel already zooms; the +/- buttons are just clutter
	for _, button in ipairs({ map.ZoomIn, map.ZoomOut }) do
		if button then
			button:SetAlpha(0)
			button:EnableMouse(false)
		end
	end

	SquareHybrid()
	ns.On("ADDON_LOADED", function(_, name)
		if name == "Blizzard_HybridMinimap" then SquareHybrid() end
	end)
end)
