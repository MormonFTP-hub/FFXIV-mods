local ADDON, ns = ...

-- Blizzard's own bars stay in charge (secure, Edit Mode positioned); this
-- only restyles them, so there is no per-frame cost and no action taint.
local BUTTONS = {
	"ActionButton", "MultiBarBottomLeftButton", "MultiBarBottomRightButton", "MultiBarRightButton",
	"MultiBarLeftButton", "MultiBar5Button", "MultiBar6Button", "MultiBar7Button",
	"PetActionButton", "StanceButton",
}

local skinned = {}

local function ShortKey(text)
	text = text:upper()
	text = text:gsub("MOUSE ?BUTTON ?", "M"):gsub("MIDDLE ?MOUSE", "M3")
	text = text:gsub("MOUSE ?WHEEL ?UP", "WU"):gsub("MOUSE ?WHEEL ?DOWN", "WD")
	text = text:gsub("NUM ?PAD ?", "N"):gsub("SPACE ?BAR", "SP"):gsub("CAPS ?LOCK", "CL")
	text = text:gsub("PAGE ?UP", "PU"):gsub("PAGE ?DOWN", "PD"):gsub("BACKSPACE", "BS")
	text = text:gsub("INSERT", "INS"):gsub("DELETE", "DEL"):gsub("HOME", "HM")
	text = text:gsub("([SCA])%-", "%1")
	return text
end

local function UpdateHotkey(button)
	local hotkey = button.HotKey
	local text = hotkey and hotkey:GetText()
	if text and text ~= "" and text ~= RANGE_INDICATOR then
		hotkey:SetText(ShortKey(text))
	end
end

-- Blizzard re-applies its atlases in UpdateButtonArt; flatten them again after
local function FlattenArt(button)
	local normal = button:GetNormalTexture()
	if normal then normal:SetAlpha(0) end
	if button.SlotArt then button.SlotArt:SetAlpha(0) end
	if button.SlotBackground then button.SlotBackground:SetAlpha(0) end
	local pushed = button:GetPushedTexture()
	if pushed then
		pushed:SetColorTexture(1, 1, 1, 0.25)
		pushed:ClearAllPoints()
		pushed:SetAllPoints(button.icon or button.Icon)
	end
end

local function Skin(button)
	if skinned[button] then return end
	local icon = button.icon or button.Icon
	if not icon then return end
	skinned[button] = true
	local px = ns.px

	if button.IconMask then icon:RemoveMaskTexture(button.IconMask) end
	icon:SetTexCoord(0.08, 0.92, 0.08, 0.92)
	icon:ClearAllPoints()
	icon:SetPoint("TOPLEFT", px, -px)
	icon:SetPoint("BOTTOMRIGHT", -px, px)

	local border = button:CreateTexture(nil, "BACKGROUND", nil, -8)
	border:SetAllPoints()
	border:SetColorTexture(0, 0, 0, 1)

	FlattenArt(button)
	if button.UpdateButtonArt then hooksecurefunc(button, "UpdateButtonArt", FlattenArt) end

	local highlight = button:GetHighlightTexture()
	if highlight then
		highlight:SetColorTexture(1, 1, 1, 0.15)
		highlight:SetAllPoints(icon)
	end
	local checked = button.GetCheckedTexture and button:GetCheckedTexture()
	if checked then
		checked:SetColorTexture(1, 0.82, 0, 0.3)
		checked:SetAllPoints(icon)
	end
	if button.Flash then
		button.Flash:SetColorTexture(0.9, 0.1, 0.1, 0.35)
		button.Flash:SetAllPoints(icon)
	end

	if button.HotKey then
		button.HotKey:SetFont(ns.FONT, 12, "OUTLINE")
		UpdateHotkey(button)
		if button.UpdateHotkeys then hooksecurefunc(button, "UpdateHotkeys", UpdateHotkey) end
	end
	if button.Count then button.Count:SetFont(ns.FONT, 13, "OUTLINE") end
	if button.Name then
		button.Name:SetFont(ns.FONT, 10, "OUTLINE")
		if not ns.db.macroText then button.Name:SetAlpha(0) end
	end
end

---------------------------------------------------------------------------
-- Micro menu + bag bar: only visible while the mouse is over them
---------------------------------------------------------------------------
local faders = {}

local function Fader(frame)
	if not frame then return end
	local function show() frame:SetAlpha(1) end
	local function hide()
		if not ns.editMode and not frame:IsMouseOver() then frame:SetAlpha(0) end
	end
	for _, child in ipairs({ frame:GetChildren() }) do
		child:HookScript("OnEnter", show)
		child:HookScript("OnLeave", hide)
	end
	frame:SetAlpha(0)
	table.insert(faders, frame)
end

local function SkinButtons()
	for _, prefix in ipairs(BUTTONS) do
		for i = 1, 12 do
			local button = _G[prefix .. i]
			if button then Skin(button) end
		end
	end
end

ns.Module(function()
	-- the buttons are secure; re-anchoring their icons waits out a mid-combat /reload
	ns.OutOfCombat(SkinButtons)

	local bar = _G.MainActionBar or _G.MainMenuBar
	if bar then
		if bar.BorderArt then bar.BorderArt:SetAlpha(0) end
		if bar.EndCaps then bar.EndCaps:SetAlpha(0) end
	end

	if ns.db.fadeMenus then
		Fader(_G.MicroMenu)
		Fader(_G.BagsBar)
		if EventRegistry then
			EventRegistry:RegisterCallback("EditMode.Enter", function()
				ns.editMode = true
				for _, f in ipairs(faders) do f:SetAlpha(1) end
			end, ns)
			EventRegistry:RegisterCallback("EditMode.Exit", function()
				ns.editMode = false
				for _, f in ipairs(faders) do f:SetAlpha(0) end
			end, ns)
		end
	end
end)
