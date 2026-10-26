local ADDON, ns = ...

local TOOLTIPS = {
	"GameTooltip", "ItemRefTooltip", "ShoppingTooltip1", "ShoppingTooltip2",
	"ItemRefShoppingTooltip1", "ItemRefShoppingTooltip2",
}

local function StyleTooltip(tooltip)
	if not tooltip or not tooltip.NineSlice or tooltip.IsEmbedded then return end
	tooltip.NineSlice:SetCenterColor(0.06, 0.06, 0.06, 0.92)
	tooltip.NineSlice:SetBorderColor(0, 0, 0, 1)
end

local function SkinAura(button)
	-- private aura anchors share the list but their Icon is a frame
	local icon = button.Icon
	if button.isAuraAnchor or not (icon and icon.SetTexCoord) then return end
	icon:SetTexCoord(0.08, 0.92, 0.08, 0.92)
	local px = ns.px
	local border = button:CreateTexture(nil, "BACKGROUND", nil, -8)
	border:SetPoint("TOPLEFT", icon, -px, px)
	border:SetPoint("BOTTOMRIGHT", icon, px, -px)
	border:SetColorTexture(0, 0, 0, 1)
end

ns.Module(function()
	for _, name in ipairs(TOOLTIPS) do
		StyleTooltip(_G[name])
	end
	hooksecurefunc("SharedTooltip_SetBackdropStyle", function(tooltip, _, embedded)
		if not embedded then StyleTooltip(tooltip) end
	end)
	if GameTooltipStatusBar then
		GameTooltipStatusBar:SetStatusBarTexture(ns.WHITE)
	end

	-- buff/debuff buttons are created once up front, so one pass is enough
	for _, container in ipairs({ BuffFrame, DebuffFrame }) do
		if container and container.auraFrames then
			for _, button in ipairs(container.auraFrames) do
				SkinAura(button)
			end
		end
	end
end)
