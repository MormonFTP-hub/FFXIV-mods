local ADDON, ns = ...
_G.SlimUI = ns

ns.WHITE = "Interface\\Buttons\\WHITE8X8"
ns.FONT = "Fonts\\ARIALN.TTF"
ns.px = 1

-- Blizzard frames we replace get parked here so they never draw. It is a
-- UIParent child so they keep their scale (same as oUF's hidden parent).
ns.hidden = CreateFrame("Frame", nil, UIParent)
ns.hidden:SetAllPoints()
ns.hidden:Hide()

local defaults = {
	pos = {},           -- mover positions, keyed by holder name
	installed = false,  -- first-run layout prompt answered
	macroText = false,  -- show macro names on action buttons
	fadeMenus = true,   -- micro menu + bag bar only show on mouseover
}

---------------------------------------------------------------------------
-- Secret values (12.x): combat numbers can be displayed but not compared.
-- Every branch in this addon goes through these so it stays on plain values.
---------------------------------------------------------------------------
local issecretvalue = _G.issecretvalue

function ns.IsSecret(v)
	return issecretvalue ~= nil and issecretvalue(v) or false
end

-- v when it is a plain value, nil when secret
function ns.Plain(v)
	if issecretvalue and issecretvalue(v) then return nil end
	return v
end

-- "is there something here" without touching a secret
function ns.Has(v)
	if issecretvalue and issecretvalue(v) then return true end
	return v ~= nil
end

---------------------------------------------------------------------------
-- Look
---------------------------------------------------------------------------
local function UpdatePixel()
	local _, height = GetPhysicalScreenSize()
	ns.px = 768 / height / UIParent:GetEffectiveScale()
end

-- 1px black border + dark fill behind a frame
function ns.Backdrop(frame, alpha)
	local p = ns.px
	local bd = CreateFrame("Frame", nil, frame, "BackdropTemplate")
	bd:SetPoint("TOPLEFT", -p, p)
	bd:SetPoint("BOTTOMRIGHT", p, -p)
	bd:SetFrameLevel(math.max(0, frame:GetFrameLevel() - 1))
	bd:SetBackdrop({ bgFile = ns.WHITE, edgeFile = ns.WHITE, edgeSize = p })
	bd:SetBackdropColor(0.06, 0.06, 0.06, alpha or 0.85)
	bd:SetBackdropBorderColor(0, 0, 0, 1)
	return bd
end

function ns.Text(parent, size, justify)
	local fs = parent:CreateFontString(nil, "OVERLAY")
	fs:SetFont(ns.FONT, size or 12, "OUTLINE")
	fs:SetJustifyH(justify or "LEFT")
	fs:SetWordWrap(false)
	return fs
end

function ns.Bar(parent)
	local bar = CreateFrame("StatusBar", nil, parent)
	bar:SetStatusBarTexture(ns.WHITE)
	local bg = bar:CreateTexture(nil, "BACKGROUND")
	bg:SetAllPoints()
	bg:SetColorTexture(0.1, 0.1, 0.1, 1)
	bar.bg = bg
	return bar
end

function ns.Print(...)
	print("|cff4fa3ffSlimUI|r:", ...)
end

---------------------------------------------------------------------------
-- Events / modules
---------------------------------------------------------------------------
local events = CreateFrame("Frame")
local handlers = {}

function ns.On(event, fn)
	if not handlers[event] then
		handlers[event] = {}
		events:RegisterEvent(event)
	end
	table.insert(handlers[event], fn)
end

events:SetScript("OnEvent", function(_, event, ...)
	for _, fn in ipairs(handlers[event]) do
		fn(event, ...)
	end
end)

ns.modules = {}
function ns.Module(fn)
	table.insert(ns.modules, fn)
end

-- Lua errors are hidden in-game by default, so SlimUI says them in chat and
-- keeps them for the /reload snapshot
ns.errors = {}
function ns.Report(err)
	err = tostring(err)
	if #ns.errors < 20 then table.insert(ns.errors, err) end
	ns.Print("|cffff5555error:|r " .. err)
end

local function Run(fn)
	local ok, err = pcall(fn)
	if not ok then ns.Report(err) end
end

-- protected work (secure frames, Edit Mode frames) waits for combat to end
local queue = {}
function ns.OutOfCombat(fn)
	if InCombatLockdown() then
		table.insert(queue, fn)
	else
		Run(fn)
	end
end

ns.On("PLAYER_REGEN_ENABLED", function()
	while #queue > 0 do
		Run(table.remove(queue, 1))
	end
end)

local function Blocked(event, addon, func)
	if addon == ADDON then ns.Report(event .. " " .. tostring(func)) end
end
ns.On("ADDON_ACTION_BLOCKED", Blocked)
ns.On("ADDON_ACTION_FORBIDDEN", Blocked)

ns.On("PLAYER_LOGIN", function()
	SlimUIDB = SlimUIDB or {}
	for k, v in pairs(defaults) do
		if SlimUIDB[k] == nil then
			SlimUIDB[k] = type(v) == "table" and CopyTable(v) or v
		end
	end
	ns.db = SlimUIDB
	UpdatePixel()

	for _, init in ipairs(ns.modules) do
		Run(init)
	end
end)

---------------------------------------------------------------------------
-- Edit Mode reads: the active layout as Blizzard indexes it (presets first)
---------------------------------------------------------------------------
function ns.Layouts()
	if not (C_EditMode and C_EditMode.GetLayouts and EditModePresetLayoutManager) then return end
	local info = C_EditMode.GetLayouts()
	if not (info and info.layouts) then return end
	local layouts = EditModePresetLayoutManager:GetCopyOfPresetLayouts()
	tAppendAll(layouts, info.layouts)
	return layouts, info.activeLayout
end

function ns.FindSystem(systems, system, index)
	for _, info in ipairs(systems or {}) do
		if info.system == system and info.systemIndex == index then return info end
	end
end

function ns.ActiveSystem(system, index)
	local layouts, active = ns.Layouts()
	local layout = layouts and layouts[active]
	return layout and ns.FindSystem(layout.systems, system, index)
end

function ns.SettingValue(info, setting)
	for _, s in ipairs(info and info.settings or {}) do
		if s.setting == setting then return s.value end
	end
end

---------------------------------------------------------------------------
-- /reload snapshot so problems can be read from SavedVariables
---------------------------------------------------------------------------
local WATCH = {
	"PlayerCastingBarFrame", "MainActionBar", "BuffFrame", "DebuffFrame", "MicroMenuContainer",
	"SlimUI_player", "SlimUI_target", "SlimUI_focus", "SlimUI_targettarget", "SlimUI_pet", "SlimUI_focustarget",
}

ns.On("PLAYER_LOGOUT", function()
	if not ns.db then return end
	local snap = { errors = ns.errors, frames = {} }
	local layouts, active = ns.Layouts()
	if layouts then
		snap.active = active
		snap.layouts = {}
		for i, l in ipairs(layouts) do snap.layouts[i] = l.layoutName end
	end
	for _, name in ipairs(WATCH) do
		local f = _G[name]
		if f and f.GetPoint then
			local point, rel, relPoint, x, y = f:GetPoint(1)
			local parent = f:GetParent()
			snap.frames[name] = string.format("shown=%s visible=%s alpha=%.2f parent=%s point=%s,%s,%s,%s,%s left=%s top=%s",
				tostring(f:IsShown()), tostring(f:IsVisible()), f:GetAlpha(), tostring(parent and parent:GetName()),
				tostring(point), tostring(rel and rel.GetName and rel:GetName()), tostring(relPoint), tostring(x), tostring(y),
				tostring(f:GetLeft()), tostring(f:GetTop()))
		end
	end
	ns.db.debug = snap
end)

---------------------------------------------------------------------------
-- Movers: every SlimUI frame hangs off a plain holder that /slim move drags
---------------------------------------------------------------------------
ns.holders = {}

-- holder.default is either an anchor list or a function returning one
function ns.PlaceHolder(holder)
	local p = ns.db.pos[holder.key]
	if not p then
		p = holder.default
		if type(p) == "function" then p = p() or holder.fallback end
	end
	holder:ClearAllPoints()
	holder:SetPoint(p[1], _G[p[2]] or UIParent, p[3], p[4], p[5])
end

-- default: anchor list or function returning one; fallback is used when the
-- function has nothing (e.g. Edit Mode data not ready yet)
function ns.Holder(key, width, height, default, fallback)
	local holder = CreateFrame("Frame", "SlimUI_" .. key .. "Holder", UIParent)
	holder:SetSize(width, height)
	holder:SetMovable(true)
	holder:SetClampedToScreen(true)
	holder.key = key
	holder.default = default
	holder.fallback = fallback
	ns.PlaceHolder(holder)
	ns.holders[key] = holder
	return holder
end

local moversShown = false
function ns.ToggleMovers()
	if InCombatLockdown() then
		ns.Print("can't move frames in combat.")
		return
	end
	moversShown = not moversShown
	for key, holder in pairs(ns.holders) do
		if not holder.mover then
			local m = CreateFrame("Frame", nil, holder, "BackdropTemplate")
			m:SetAllPoints()
			m:SetFrameStrata("DIALOG")
			m:SetBackdrop({ bgFile = ns.WHITE, edgeFile = ns.WHITE, edgeSize = ns.px })
			m:SetBackdropColor(0.2, 0.5, 0.9, 0.45)
			m:SetBackdropBorderColor(0.3, 0.6, 1, 1)
			m:EnableMouse(true)
			m:RegisterForDrag("LeftButton")
			local label = ns.Text(m, 11, "CENTER")
			label:SetPoint("CENTER")
			label:SetText(key)
			m:SetScript("OnDragStart", function() holder:StartMoving() end)
			m:SetScript("OnDragStop", function()
				holder:StopMovingOrSizing()
				local point, _, relativePoint, x, y = holder:GetPoint()
				ns.db.pos[key] = { point, "UIParent", relativePoint, x, y }
				if ns.RefreshUnits then ns.RefreshUnits() end
			end)
			-- right-click puts it back
			m:SetScript("OnMouseUp", function(_, button)
				if button == "RightButton" then
					ns.db.pos[key] = nil
					if ns.RefreshUnits then ns.RefreshUnits() else ns.PlaceHolder(holder) end
				end
			end)
			holder.mover = m
		end
		holder.mover:SetShown(moversShown)
	end
	if moversShown then
		ns.Print("drag frames to move them, right-click resets one. |cffffff00/slim move|r again to lock.")
	end
end

ns.On("PLAYER_REGEN_DISABLED", function()
	if moversShown then ns.ToggleMovers() end
end)

---------------------------------------------------------------------------
-- Slash command
---------------------------------------------------------------------------
SLASH_SLIMUI1 = "/slim"
SLASH_SLIMUI2 = "/slimui"
SlashCmdList.SLIMUI = function(msg)
	local cmd = (msg or ""):lower():match("^%s*(%S*)")
	if cmd == "move" or cmd == "unlock" or cmd == "lock" then
		ns.ToggleMovers()
	elseif cmd == "install" or cmd == "layout" then
		ns.ShowInstall()
	elseif cmd == "details" then
		if ns.ArrangeDetails() then ns.Print("Details windows docked in the right panel.") end
	elseif cmd == "reset" then
		if InCombatLockdown() then return ns.Print("not in combat.") end
		wipe(ns.db.pos)
		if ns.RefreshUnits then ns.RefreshUnits() end
		ns.Print("frame positions reset.")
	elseif cmd == "macro" then
		ns.db.macroText = not ns.db.macroText
		ns.Print("macro names " .. (ns.db.macroText and "shown" or "hidden") .. " after /reload.")
	elseif cmd == "fade" then
		ns.db.fadeMenus = not ns.db.fadeMenus
		ns.Print("micro menu/bag fade " .. (ns.db.fadeMenus and "on" or "off") .. " after /reload.")
	else
		ns.Print("commands:")
		print("  /slim move - unlock frames to drag them")
		print("  /slim reset - put frames back to default")
		print("  /slim install - apply the SlimUI Edit Mode layout + dock Details")
		print("  /slim details - dock Details windows in the right panel again")
		print("  /slim macro - toggle macro names on buttons")
		print("  /slim fade - toggle mouseover fade on micro menu/bags")
	end
end
