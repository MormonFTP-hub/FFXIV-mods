local ADDON, ns = ...

local TAB_TEXTURES = {
	"Left", "Middle", "Right", "ActiveLeft", "ActiveMiddle", "ActiveRight",
	"HighlightLeft", "HighlightMiddle", "HighlightRight",
}
local EDIT_TEXTURES = { "Left", "Right", "Mid", "FocusLeft", "FocusRight", "FocusMid" }
local CLUTTER = {
	"QuickJoinToastButton", "ChatFrameChannelButton", "ChatFrameMenuButton", "TextToSpeechButtonFrame",
	"ChatFrameToggleVoiceDeafenButton", "ChatFrameToggleVoiceMuteButton",
}

local skinned = {}

local function SkinChatFrame(cf)
	if not cf or skinned[cf] then return end
	skinned[cf] = true
	local name = cf:GetName()

	-- clearing the texture (not alpha) survives Blizzard's chat fade in/out
	for _, key in ipairs(CHAT_FRAME_TEXTURES) do
		local tex = _G[name .. key]
		if tex and tex.SetTexture then tex:SetTexture(nil) end
	end
	local buttonFrame = _G[name .. "ButtonFrame"]
	if buttonFrame then buttonFrame:SetParent(ns.hidden) end

	cf:SetShadowOffset(1, -1)
	cf:SetShadowColor(0, 0, 0, 1)

	local tab = _G[name .. "Tab"]
	if tab then
		for _, key in ipairs(TAB_TEXTURES) do
			if tab[key] then tab[key]:SetTexture(nil) end
		end
	end

	local edit = _G[name .. "EditBox"]
	if edit then
		for _, key in ipairs(EDIT_TEXTURES) do
			local tex = _G[name .. "EditBox" .. key]
			if tex then tex:SetTexture(nil) end
		end
		ns.Backdrop(edit, 0.9)
		edit:ClearAllPoints()
		edit:SetPoint("TOPLEFT", cf, "BOTTOMLEFT", -2, -6)
		edit:SetPoint("TOPRIGHT", cf, "BOTTOMRIGHT", 2, -6)
		edit:SetHeight(20)
	end
end

local function SkinAll()
	for _, name in ipairs(CHAT_FRAMES) do
		SkinChatFrame(_G[name])
	end
end

local function Panel(name)
	local p = CreateFrame("Frame", name, UIParent, "BackdropTemplate")
	p:SetFrameStrata("BACKGROUND")
	p:SetBackdrop({ bgFile = ns.WHITE, edgeFile = ns.WHITE, edgeSize = ns.px })
	p:SetBackdropColor(0.06, 0.06, 0.06, 0.75)
	p:SetBackdropBorderColor(0, 0, 0, 1)
	return p
end

ns.Module(function()
	SkinAll()
	hooksecurefunc("FCF_OpenTemporaryWindow", SkinAll)
	for _, name in ipairs(CLUTTER) do
		local f = _G[name]
		if f then f:SetParent(ns.hidden) end
	end

	-- left panel follows the chat frame wherever Edit Mode puts it
	local left = Panel("SlimUI_LeftPanel")
	left:SetPoint("TOPLEFT", ChatFrame1, "TOPLEFT", -6, 26)
	left:SetPoint("BOTTOMRIGHT", ChatFrame1, "BOTTOMRIGHT", 6, -28)

	-- invisible area Details gets docked into (/slim details); Details draws its own backgrounds
	local right = CreateFrame("Frame", "SlimUI_RightPanel", UIParent)
	right:SetSize(340, 176)
	right:SetPoint("BOTTOMRIGHT", UIParent, "BOTTOMRIGHT", -6, 6)
	ns.RightPanel = right
end)
