local ADDON, ns = ...

-- SlimUI's layout lives in Blizzard's own Edit Mode as a copy of your layout
-- ("SlimUI dps" for "dps"): zero runtime cost, nothing tainted, and your own
-- layout stays one dropdown click away. Only the few systems below change;
-- bars, minimap, buffs, unit frame spots and the Cooldown Manager stay yours.
local LAYOUT_NAME = "SlimUI"
local LAYOUT_VERSION = 2
local Find = ns.FindSystem

-- only change settings the layout already carries; Blizzard reconciles the rest
local function Set(info, setting, value)
	if not info or setting == nil or value == nil then return end
	for _, s in ipairs(info.settings) do
		if s.setting == setting then
			s.value = value
			return
		end
	end
end

local function Anchor(info, point, relativeTo, relativePoint, x, y)
	if not info then return end
	info.anchorInfo = { point = point, relativeTo = relativeTo, relativePoint = relativePoint, offsetX = x, offsetY = y }
	info.anchorInfo2 = nil
	info.isInDefaultPosition = false
end

---------------------------------------------------------------------------
-- Things anchored to Blizzard's player/target frames (your buffs and debuffs)
-- get pinned to the same screen spot, since those frames are hidden now.
---------------------------------------------------------------------------
local UNIT_FRAMES = { PlayerFrame = "Player", TargetFrame = "Target" }

-- x/y of a named point on a rect given by left, bottom, width, height
local function PointXY(point, left, bottom, width, height)
	local x = point:find("LEFT") and left or point:find("RIGHT") and left + width or left + width / 2
	local y = point:find("TOP") and bottom + height or point:find("BOTTOM") and bottom or bottom + height / 2
	return x, y
end

-- screen rect of a Blizzard unit frame where Edit Mode puts it, clamped to the screen like the client does
local function UnitFrameRect(systems, frameName, depth)
	local index = Enum.EditModeUnitFrameSystemIndices[UNIT_FRAMES[frameName]]
	local info = Find(systems, Enum.EditModeSystem.UnitFrame, index)
	if not info or depth > 3 then return end
	local scale = 1 + (ns.SettingValue(info, Enum.EditModeUnitFrameSetting.FrameSize) or 0) * 0.05
	local width, height = 232 * scale, 100 * scale
	local a = info.anchorInfo
	local rl, rb, rw, rh
	if a.relativeTo == "UIParent" then
		rl, rb, rw, rh = 0, 0, UIParent:GetWidth(), UIParent:GetHeight()
	elseif UNIT_FRAMES[a.relativeTo] then
		local l, b, r, t = UnitFrameRect(systems, a.relativeTo, depth + 1)
		if not l then return end
		rl, rb, rw, rh = l, b, r - l, t - b
	else
		return
	end
	local x, y = PointXY(a.relativePoint, rl, rb, rw, rh)
	local px, py = PointXY(a.point, 0, 0, width, height)
	local left = math.max(0, math.min(x + a.offsetX - px, UIParent:GetWidth() - width))
	local bottom = math.max(0, math.min(y + a.offsetY - py, UIParent:GetHeight() - height))
	return left, bottom, left + width, bottom + height
end

local function PinToScreen(systems)
	for _, info in ipairs(systems) do
		local a = info.anchorInfo
		if UNIT_FRAMES[a.relativeTo] and info.system ~= Enum.EditModeSystem.UnitFrame then
			local l, b, r, t = UnitFrameRect(systems, a.relativeTo, 0)
			if l then
				local x, y = PointXY(a.relativePoint, l, b, r - l, t - b)
				Anchor(info, a.point, "UIParent", "BOTTOMLEFT", x + a.offsetX, y + a.offsetY)
			end
		end
	end
end

-- slider settings store (value - min) / step
local function Arrange(systems)
	PinToScreen(systems)

	local E = Enum
	local S = E.EditModeSystem

	-- chat fills the left panel
	local CF = E.EditModeChatFrameSetting
	local chat = Find(systems, S.ChatFrame)
	Anchor(chat, "BOTTOMLEFT", "UIParent", "BOTTOMLEFT", 12, 34)
	Set(chat, CF.WidthHundreds, 3) -- 328 wide
	Set(chat, CF.WidthTensAndOnes, 28)
	Set(chat, CF.HeightHundreds, 1) -- 122 tall
	Set(chat, CF.HeightTensAndOnes, 22)

	-- tooltips pop up above the Details corner
	Anchor(Find(systems, S.HudTooltip), "BOTTOMRIGHT", "UIParent", "BOTTOMRIGHT", -6, 188)

	-- micro menu + bags above the chat panel, out of Details' corner; SlimUI fades them in on hover
	local micro = Find(systems, S.MicroMenu)
	Anchor(micro, "BOTTOMLEFT", "UIParent", "BOTTOMLEFT", 6, 188)
	Set(micro, E.EditModeMicroMenuSetting.Size, 0) -- 70%
	local bags = Find(systems, S.Bags)
	Anchor(bags, "BOTTOMLEFT", "UIParent", "BOTTOMLEFT", 6, 222)
	Set(bags, E.EditModeBagsSetting.Size, 0) -- 75%
	if E.BagsDirection then Set(bags, E.EditModeBagsSetting.Direction, E.BagsDirection.Right) end
end

local function IsSlim(layout)
	return layout.layoutType ~= Enum.EditModeLayoutType.Preset
		and (layout.layoutName == LAYOUT_NAME or layout.layoutName:sub(1, #LAYOUT_NAME + 1) == LAYOUT_NAME .. " ")
end

-- Systems SlimUI 1.0 rewrote; everything else in its layout was a straight copy
local function TouchedBy10(info)
	local S, AB, AF = Enum.EditModeSystem, Enum.EditModeActionBarSystemIndices, Enum.EditModeAuraFrameSystemIndices
	if info.system == S.ActionBar then
		local i = info.systemIndex
		return i == AB.MainBar or i == AB.Bar2 or i == AB.Bar3 or i == AB.StanceBar or i == AB.PetActionBar
	elseif info.system == S.AuraFrame then
		return info.systemIndex == AF.BuffFrame or info.systemIndex == AF.DebuffFrame
	end
	for _, s in ipairs({ S.Minimap, S.ObjectiveTracker, S.ChatFrame, S.HudTooltip, S.MicroMenu, S.Bags,
		S.ExtraAbilities, S.VehicleLeaveButton, S.EncounterBar, S.StatusTrackingBar }) do
		if info.system == s then return true end
	end
	return false
end

local function SameSystem(a, b)
	if (a.isInDefaultPosition and true or false) ~= (b.isInDefaultPosition and true or false) then return false end
	local x, y = a.anchorInfo, b.anchorInfo
	if x.point ~= y.point or x.relativeTo ~= y.relativeTo or x.relativePoint ~= y.relativePoint
		or math.abs(x.offsetX - y.offsetX) > 0.5 or math.abs(x.offsetY - y.offsetY) > 0.5 then
		return false
	end
	if #a.settings ~= #b.settings then return false end
	local values = {}
	for _, s in ipairs(a.settings) do values[s.setting] = s.value end
	for _, s in ipairs(b.settings) do
		if values[s.setting] ~= s.value then return false end
	end
	return true
end

-- the layout an existing SlimUI layout was copied from
local function FindSource(layouts, slimIndex)
	local slim = layouts[slimIndex]
	local wanted = slim.layoutName:sub(#LAYOUT_NAME + 2)
	if wanted == "" then wanted = ns.db.sourceLayout end
	if wanted then
		for i, l in ipairs(layouts) do
			if i ~= slimIndex and not IsSlim(l) and l.layoutName == wanted then return l end
		end
	end
	-- SlimUI 1.0 didn't record it: best match on everything 1.0 never changed,
	-- your own layouts ahead of Blizzard's presets
	local best, bestScore
	for _, preset in ipairs({ false, true }) do
		for i, l in ipairs(layouts) do
			if i ~= slimIndex and not IsSlim(l) and (l.layoutType == Enum.EditModeLayoutType.Preset) == preset then
				local score = 0
				for _, sys in ipairs(slim.systems) do
					if not TouchedBy10(sys) then
						local other = Find(l.systems, sys.system, sys.systemIndex)
						if other and SameSystem(sys, other) then score = score + 1 end
					end
				end
				if not bestScore or score > bestScore then best, bestScore = l, score end
			end
		end
		if best then return best end
	end
end

local function NameFor(source)
	if source.layoutType == Enum.EditModeLayoutType.Preset then return LAYOUT_NAME end
	local name = LAYOUT_NAME .. " " .. source.layoutName
	if C_EditMode.IsValidLayoutName and not C_EditMode.IsValidLayoutName(name) then return LAYOUT_NAME end
	return name
end

local function Build(source, layoutType)
	local layout = CopyTable(source)
	layout.layoutName = NameFor(source)
	layout.layoutType = layoutType
	Arrange(layout.systems)
	return layout
end

function ns.ApplyLayout()
	local layouts, active = ns.Layouts()
	if not layouts then return false, "Edit Mode is unavailable" end
	local LT = Enum.EditModeLayoutType
	if not layouts[active] then return false, "no active Edit Mode layout" end

	-- refresh every SlimUI layout from the layout it copies (this also repairs
	-- 1.0 layouts, which carried their own bar/minimap/buff positions)
	local source
	for i, l in ipairs(layouts) do
		if IsSlim(l) then
			local from = FindSource(layouts, i)
			if from then
				layouts[i] = Build(from, l.layoutType)
				if i == active then source = from end
			end
		end
	end

	local slot = IsSlim(layouts[active]) and active or nil
	if not slot then
		-- not on a SlimUI layout: make (or refresh) the one for the active layout
		source = layouts[active]
		local name = NameFor(source)
		local accounts = 0
		for i, l in ipairs(layouts) do
			if l.layoutType == LT.Account then accounts = accounts + 1 end
			if IsSlim(l) and l.layoutName == name then slot = i end
		end
		if slot then
			layouts[slot] = Build(source, layouts[slot].layoutType)
		else
			local limit = Constants.EditModeConsts and Constants.EditModeConsts.EditModeMaxLayoutsPerType or 5
			if accounts >= limit then
				return false, "you already have " .. accounts .. " account layouts; delete one in Edit Mode first"
			end
			-- same order Blizzard keeps: presets, account layouts, character layouts
			slot = 1
			for i, l in ipairs(layouts) do
				if l.layoutType == LT.Preset or l.layoutType == LT.Account then slot = i + 1 end
			end
			table.insert(layouts, slot, Build(source, LT.Account))
		end
	end
	if not source then return false, "couldn't find the layout to build from" end

	C_EditMode.SaveLayouts({ layouts = layouts, activeLayout = slot })
	C_EditMode.SetActiveLayout(slot)
	ns.db.sourceLayout = source.layoutName
	ns.db.layoutVersion = LAYOUT_VERSION
	return true, layouts[slot].layoutName, source.layoutName
end

---------------------------------------------------------------------------
-- Details: dock up to three windows into the right panel. One-shot; Details
-- saves the positions itself, so nothing runs afterwards.
---------------------------------------------------------------------------
local TITLE, STATUS = 20, 14

function ns.ArrangeDetails()
	local D = _G.Details
	local panel = ns.RightPanel
	if not (D and D.GetInstance and D.GetNumInstances and panel) then return false end
	if InCombatLockdown() then return false end

	local windows = {}
	for i = 1, D:GetNumInstances() do
		local inst = D:GetInstance(i)
		if inst and inst.baseframe and inst:IsEnabled() then
			windows[#windows + 1] = inst
			if #windows == 3 then break end
		end
	end
	if #windows == 0 then return false end

	local W, H, pad, gap = panel:GetWidth(), panel:GetHeight(), 3, 3
	local slots
	if #windows == 1 then
		slots = { { pad, pad, W - 2 * pad, H - 2 * pad } }
	elseif #windows == 2 then
		local w = (W - 2 * pad - gap) / 2
		slots = { { pad, pad, w, H - 2 * pad }, { pad + w + gap, pad, w, H - 2 * pad } }
	else
		-- first window across the top, the other two side by side under it
		local w, h = (W - 2 * pad - gap) / 2, (H - 2 * pad - gap) / 2
		slots = {
			{ pad, pad, W - 2 * pad, h },
			{ pad, pad + h + gap, w, h },
			{ pad + w + gap, pad + h + gap, w, h },
		}
	end

	for i, inst in ipairs(windows) do
		local x, y, w, h = unpack(slots[i])
		local top = inst.toolbar_side == 1 and TITLE or 0
		local bottom = (inst.toolbar_side == 2 and TITLE or 0) + (inst.show_statusbar and STATUS or 0)
		pcall(inst.UngroupInstance, inst)
		local frame = inst.baseframe
		local s = frame:GetScale()
		frame:ClearAllPoints()
		frame:SetPoint("TOPLEFT", panel, "TOPLEFT", x / s, -(y + top) / s)
		frame:SetSize(w / s, (h - top - bottom) / s)
		inst:SaveMainWindowPosition()
		inst:RestoreMainWindowPosition()
		inst:LockInstance(true)
	end
	return true
end

---------------------------------------------------------------------------
-- Install prompt
---------------------------------------------------------------------------
function ns.Install()
	if InCombatLockdown() then
		ns.Print("leave combat first.")
		return
	end
	local called, ok, err = pcall(ns.ApplyLayout)
	if not called then ok, err = false, ok end
	if not ok then ns.Print("Edit Mode layout not applied: " .. tostring(err)) end
	-- Details only gets docked on the very first install; after that its spot is yours
	if not ns.db.installed then
		local docked = pcall(ns.ArrangeDetails)
		if not docked then ns.Print("couldn't dock Details; try /slim details after the reload.") end
	end
	ns.db.installed = true
	if ok then ReloadUI() end
end

local INSTALL_TEXT = "Adds an Edit Mode layout copied from your current one (your own layouts are kept), "
	.. "docks Details in the bottom-right corner, then reloads."
local UPDATE_TEXT = "SlimUI 1.1 rebuilds its Edit Mode layout from your own layout: hotbars, minimap, "
	.. "buffs and frame spots go back to where you had them. Then it reloads."

local popup
function ns.ShowInstall(update)
	if not popup then
		popup = CreateFrame("Frame", "SlimUI_Install", UIParent, "BackdropTemplate")
		ns.BuildInstall(popup)
	end
	popup.body:SetText(update and UPDATE_TEXT or INSTALL_TEXT)
	popup:Show()
end

function ns.BuildInstall(popup)
	popup:SetSize(380, 156)
	popup:SetPoint("CENTER", 0, 120)
	popup:SetFrameStrata("DIALOG")
	popup:SetBackdrop({ bgFile = ns.WHITE, edgeFile = ns.WHITE, edgeSize = ns.px })
	popup:SetBackdropColor(0.06, 0.06, 0.06, 0.95)
	popup:SetBackdropBorderColor(0, 0, 0, 1)

	local title = ns.Text(popup, 16, "CENTER")
	title:SetPoint("TOP", 0, -12)
	title:SetText("|cff4fa3ffSlimUI|r setup")

	local body = popup:CreateFontString(nil, "OVERLAY", "GameFontHighlight")
	body:SetPoint("TOPLEFT", 16, -40)
	body:SetPoint("TOPRIGHT", -16, -40)
	body:SetJustifyH("LEFT")
	popup.body = body

	local apply = CreateFrame("Button", nil, popup, "UIPanelButtonTemplate")
	apply:SetSize(160, 24)
	apply:SetPoint("BOTTOMLEFT", 16, 14)
	apply:SetText("Apply + reload")
	apply:SetScript("OnClick", function()
		popup:Hide()
		ns.Install()
	end)

	local skip = CreateFrame("Button", nil, popup, "UIPanelButtonTemplate")
	skip:SetSize(160, 24)
	skip:SetPoint("BOTTOMRIGHT", -16, 14)
	skip:SetText("Not now")
	skip:SetScript("OnClick", function()
		ns.db.installed = true
		ns.db.layoutVersion = LAYOUT_VERSION
		popup:Hide()
		ns.Print("run |cffffff00/slim install|r any time.")
	end)
end

ns.Module(function()
	if not ns.db.installed then
		C_Timer.After(3, function() ns.ShowInstall() end)
	elseif (ns.db.layoutVersion or 1) < LAYOUT_VERSION then
		local layouts = ns.Layouts()
		for _, l in ipairs(layouts or {}) do
			if IsSlim(l) then
				C_Timer.After(3, function() ns.ShowInstall(true) end)
				return
			end
		end
	end
end)
