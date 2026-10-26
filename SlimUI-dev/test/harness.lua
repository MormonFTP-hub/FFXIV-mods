-- Minimal WoW API mock for smoke-testing SlimUI in plain Lua 5.1.
-- Our own frames are strict (unknown methods error like the real client);
-- pre-existing Blizzard globals are loose (any field resolves to another loose frame).

ERRORS = {}
LOG = {}
local function log(...) local t = {} for i = 1, select("#", ...) do t[#t+1] = tostring(select(i, ...)) end LOG[#LOG+1] = table.concat(t, " ") end
print = function(...) log("PRINT", ...) end

SECRET_MODE = SECRET_MODE or false

---------------------------------------------------------------------------
-- secret sentinel: errors on arithmetic / comparison / concat like 12.x
---------------------------------------------------------------------------
local secretMT = {}
local function boom(op) return function() error("secret value used in " .. op, 2) end end
secretMT.__add, secretMT.__sub, secretMT.__mul, secretMT.__div = boom("+"), boom("-"), boom("*"), boom("/")
secretMT.__lt, secretMT.__le, secretMT.__concat, secretMT.__len = boom("<"), boom("<="), boom(".."), boom("#")
secretMT.__unm, secretMT.__mod, secretMT.__pow = boom("unm"), boom("%"), boom("^")
secretMT.__index = function(t, k) error("secret value indexed (" .. tostring(k) .. ")", 2) end
secretMT.__tostring = function() return "<secret>" end
function Secret(v) return setmetatable({ v = v }, secretMT) end
function issecretvalue(v) return getmetatable(v) == secretMT end
local function S(v) if SECRET_MODE then return Secret(v) end return v end

local realFormat = string.format
string.format = function(fmt, ...)
	local args = { ... }
	local secret = false
	for i = 1, select("#", ...) do if issecretvalue(args[i]) then secret = true; args[i] = args[i].v end end
	local s = realFormat(fmt, unpack(args, 1, select("#", ...)))
	if secret then return Secret(s) end
	return s
end
format = string.format

---------------------------------------------------------------------------
-- frames
---------------------------------------------------------------------------
ALLFRAMES = {}
local FrameMethods = {}
local strictMT, looseMT = {}, {}

local function newFrame(kind, name, parent, loose)
	local f = setmetatable({}, loose and looseMT or strictMT)
	rawset(f, "__state", { kind = kind, name = name, parent = parent, shown = true, scripts = {}, hooks = {}, events = {}, children = {}, alpha = 1, points = {}, w = 100, h = 20, level = 5, text = "s-1" })
	if parent and type(parent) == "table" and rawget(parent, "__state") then table.insert(parent.__state.children, f) end
	ALLFRAMES[#ALLFRAMES + 1] = f
	return f
end
NewLoose = function(name) return newFrame("Frame", name, nil, true) end

strictMT.__index = function(t, k) return FrameMethods[k] end
looseMT.__index = function(t, k)
	local m = FrameMethods[k]
	if m then return m end
	local child = newFrame("Frame", tostring(k), t, true)
	rawset(t, k, child)
	return child
end
looseMT.__call = function(self, ...) return NewLoose("ret") end

local function runScript(f, name, ...)
	local st = f.__state
	if st.scripts[name] then st.scripts[name](f, ...) end
	for _, h in ipairs(st.hooks[name] or {}) do h(f, ...) end
end
RunScript = runScript

local M = FrameMethods
local function noop() end
for _, n in ipairs({ "SetPoint", "ClearAllPoints", "SetAllPoints", "SetFrameStrata", "SetBackdrop", "SetBackdropColor",
	"SetBackdropBorderColor", "SetFont", "SetJustifyH", "SetJustifyV", "SetWordWrap", "SetTexture", "SetColorTexture", "SetTexCoord",
	"SetVertexColor", "SetStatusBarTexture", "SetStatusBarColor", "SetMinMaxValues", "SetValue", "SetTimerDuration",
	"SetMovable", "SetClampedToScreen", "EnableMouse", "RegisterForDrag", "SetAttribute", "RegisterForClicks",
	"StartMoving", "StopMovingOrSizing", "SetScale", "SetDrawEdge", "SetReverse", "SetCooldown", "SetCooldownFromDurationObject",
	"SetAlphaFromBoolean", "SetShadowOffset", "SetShadowColor", "SetMaskTexture", "RemoveMaskTexture", "SetUnit",
	"SetUseMaskTexture", "SetDontSavePosition", "SetUserPlaced", "SetHideCountdownNumbers", "SetDrawSwipe", "SetEnabled",
	"SetOwner", "SetUnitAuraByAuraInstanceID", "SetCenterColor", "SetBorderColor", "SetNormalFontObject", "SetFrameLevel",
	"SetDrawLayer", "SetBlendMode", "SetAtlas", "SetSize", "SetWidth", "SetHeight", "UnregisterEvent", "SetClampRectInsets" }) do
	M[n] = function(self, ...)
		local st = rawget(self, "__state")
		if not st then error("method " .. n .. " called on non-frame", 2) end
		if n == "SetSize" then st.w, st.h = ... elseif n == "SetWidth" then st.w = ... elseif n == "SetHeight" then st.h = ...
		elseif n == "SetFrameLevel" then st.level = ... elseif n == "SetPoint" then table.insert(st.points, { ... }) end
		if n == "SetValue" or n == "SetMinMaxValues" or n == "SetStatusBarColor" or n == "SetVertexColor" then
			for i = 1, select("#", ...) do
				local v = select(i, ...)
				if not (type(v) == "number" or issecretvalue(v) or v == nil or type(v) == "table") then error(n .. " got " .. type(v), 2) end
			end
		end
	end
end
function M:SetText(t) self.__state.text = t end
function M:SetFormattedText(fmt, ...) self.__state.text = string.format(fmt, ...) end
function M:GetText() return self.__state.text end
function M:GetFont() return "Fonts\\FRIZQT__.TTF", 14, "" end
function M:GetFrameLevel() return self.__state.level end
function M:GetWidth() return self.__state.w end
function M:GetHeight() return self.__state.h end
function M:GetScale() return 1 end
function M:GetEffectiveScale() return 1.15 end
function M:GetName() return self.__state.name end
function M:GetParent() return self.__state.parent end
function M:SetParent(p) self.__state.parent = p end
function M:GetChildren() return unpack(self.__state.children) end
function M:GetPoint() return "CENTER", UIParent, "BOTTOMLEFT", 10, 20 end
function M:IsMouseOver() return false end
function M:GetCenter() local st = self.__state; return st.cx or 300, st.cy or 600 end
function M:GetLeft() return 0 end
function M:GetTop() return 0 end
function M:IsShown() return self.__state.shown end
function M:IsVisible() return self.__state.shown end
function M:Show() if not self.__state.shown then self.__state.shown = true; runScript(self, "OnShow") end end
function M:Hide() if self.__state.shown then self.__state.shown = false; runScript(self, "OnHide") end end
function M:SetShown(s) if s then self:Show() else self:Hide() end end
function M:SetAlpha(a) self.__state.alpha = a end
function M:GetAlpha() return self.__state.alpha end
function M:SetScript(name, fn) self.__state.scripts[name] = fn end
function M:GetScript(name) return self.__state.scripts[name] end
function M:HookScript(name, fn) local h = self.__state.hooks; h[name] = h[name] or {}; table.insert(h[name], fn) end
function M:RegisterEvent(e) self.__state.events[e] = true end
function M:RegisterUnitEvent(e, ...) self.__state.events[e] = { ... } end
function M:UnregisterAllEvents() self.__state.events = {} end
local function makeTex(self) local t = newFrame("Texture", nil, self, false); t.__state.shown = true; return t end
function M:CreateTexture() return makeTex(self) end
function M:CreateFontString() return makeTex(self) end
function M:GetStatusBarTexture() self.__state.sbt = self.__state.sbt or makeTex(self); return self.__state.sbt end
function M:GetNormalTexture() return self.NormalTexture or makeTex(self) end
function M:GetPushedTexture() return self.PushedTexture or makeTex(self) end
function M:GetHighlightTexture() return self.HighlightTexture or makeTex(self) end
function M:GetCheckedTexture() return self.CheckedTexture or makeTex(self) end

function CreateFrame(kind, name, parent, template)
	local f = newFrame(kind, name, parent, false)
	if template and template:find("SecureUnitButtonTemplate") then f.__state.secure = true end
	if name then _G[name] = f end
	return f
end

function Fire(event, ...)
	for _, f in ipairs(ALLFRAMES) do
		local reg = rawget(f, "__state").events[event]
		if reg then
			local unit = ...
			local ok = true
			if type(reg) == "table" and #reg > 0 then
				ok = false
				for _, u in ipairs(reg) do if u == unit then ok = true end end
			end
			if ok then runScript(f, "OnEvent", event, ...) end
		end
	end
end

function Tick(elapsed)
	for _, f in ipairs(ALLFRAMES) do
		local st = rawget(f, "__state")
		if st.shown and st.scripts.OnUpdate then st.scripts.OnUpdate(f, elapsed) end
	end
end

---------------------------------------------------------------------------
-- globals / API
---------------------------------------------------------------------------
NOAUTO = { SlimUIDB = true, ClickCastFrames = true, Details = true, GetMinimapShape = true, SlimUI = true }
setmetatable(_G, { __index = function(t, k)
	if type(k) == "string" and k:match("^[A-Z][a-z]") and not NOAUTO[k] then
		local f = NewLoose(k)
		rawset(t, k, f)
		return f
	end
end })

UIParent = NewLoose("UIParent")
UIParent.__state.w, UIParent.__state.h = 1187, 668
function GetPhysicalScreenSize() return 2560, 1440 end
function InCombatLockdown() return COMBAT or false end
function geterrorhandler() return function(e) ERRORS[#ERRORS + 1] = e end end
function hooksecurefunc(a, b, c)
	local tbl, name, fn = a, b, c
	if type(a) == "string" then tbl, name, fn = _G, a, b end
	local orig = rawget(tbl, name) or tbl[name]
	if orig == nil then error("hooksecurefunc: " .. tostring(name) .. " does not exist", 2) end
	rawset(tbl, name, function(...) local r = { orig(...) }; fn(...); return unpack(r) end)
end
function CopyTable(t) local c = {} for k, v in pairs(t) do c[k] = type(v) == "table" and getmetatable(v) == nil and CopyTable(v) or v end return c end
function tAppendAll(t, s) for _, v in ipairs(s) do t[#t + 1] = v end end
function wipe(t) for k in pairs(t) do t[k] = nil end return t end
table.wipe = wipe
function Mixin(o, ...) for i = 1, select("#", ...) do for k, v in pairs((select(i, ...))) do o[k] = v end end return o end
function CreateFromMixins(...) return Mixin({}, ...) end
function RegisterUnitWatch(f) end
function GameTooltip_SetDefaultAnchor() end
function GameTooltip_Hide() end
function FCF_OpenTemporaryWindow() end
function SharedTooltip_SetBackdropStyle(tt, style, embedded) end
function SetRaidTargetIconTexture() end
function ReloadUI() RELOADED = true end
function GetTime() return 100 end
SlashCmdList = {}
C_Timer = { After = function(t, fn) fn() end, NewTicker = function() return { Cancel = function() end } end }
C_AddOns = { IsAddOnLoaded = function() return true end, EnableAddOn = function() end }
EventRegistry = { RegisterCallback = function() end }
CHAT_FRAMES = { "ChatFrame1", "ChatFrame2" }
CHAT_FRAME_TEXTURES = { "Background", "TopLeftTexture", "ButtonFrameBackground" }
RAID_CLASS_COLORS = setmetatable({}, { __index = function() return { r = 0.96, g = 0.55, b = 0.73 } end })
FACTION_BAR_COLORS = { [1] = { r = 1, g = 0, b = 0 }, [4] = { r = 1, g = 1, b = 0 }, [5] = { r = 0, g = 1, b = 0 } }
PowerBarColor = { MANA = { r = 0, g = 0, b = 1 }, [0] = { r = 0, g = 0, b = 1 } }
DEAD, PLAYER_OFFLINE, INTERRUPTED, FAILED, RANGE_INDICATOR = "Dead", "Offline", "Interrupted", "Failed", "●"
LAYOUT_STYLE_MODERN, LAYOUT_STYLE_CLASSIC = "Modern", "Classic"
CurveConstants = { ScaleTo100 = 1 }
Constants = { EditModeConsts = { EditModeMaxLayoutsPerType = 5 }, EditModeLayoutConsts = {} }

CLASS = CLASS or "PALADIN"
function UnitExists(u) return true end
function UnitHealth(u) return S(800000) end
function UnitHealthMax(u) return S(908000) end
function UnitHealthPercent(u) return S(88.1) end
function UnitPower(u, t) return S(3) end
function UnitPowerMax(u, t) return S(5) end
function UnitPowerType(u) if CLASS == "DRUID" then return S(3), S("ENERGY") end return S(0), S("MANA") end
function UnitName(u) return S("Mormonft"), nil end
function UnitClass(u) return "Paladin", CLASS end
function UnitIsPlayer(u) return S(u == "player" or u == "target") end
function UnitInPartyIsAI() return S(false) end
function UnitIsTapDenied() return S(false) end
function UnitReaction() return S(5) end
function UnitIsConnected() return S(true) end
function UnitIsDeadOrGhost() return S(false) end
function GetRaidTargetIndex() return S(nil) end
function AbbreviateNumbers(v) if issecretvalue(v) then return Secret("800K") end return "800K" end
CASTING = true
local dur = { GetRemainingDuration = function() return S(1.25) end, IsZero = function() return S(false) end }
function UnitCastingInfo(u) if not CASTING then return nil end return S("Flash of Light"), S(""), S(135907), S(1000), S(2500), S(false), "cast-1", S(false), S(19750) end
function UnitChannelInfo(u) if not CHANNELING then return nil end return S("Penance"), S(""), S(1), S(1000), S(3000), S(false), S(false), S(47540), S(false), S(0) end
function UnitCastingDuration() return dur end
function UnitChannelDuration() return dur end
function UnitEmpoweredChannelDuration() return dur end
function GetRuneCooldown(i) if i % 2 == 0 then return S(95), S(10), S(false) end return S(0), S(10), S(true) end
C_UnitAuras = {
	GetUnitAuras = function() return { { icon = S(135907), auraInstanceID = S(11), applications = S(2), duration = S(10), expirationTime = S(105) } } end,
	GetAuraDuration = function() return dur end,
}
C_StringUtil = { TruncateWhenZero = function(v) return v end }
C_CurveUtil = { EvaluateColorValueFromBoolean = function(b, x, y) return S(x) end }
C_SpecializationInfo = { GetSpecialization = function() return 1 end, GetSpecializationInfo = function() return 269 end }

Enum.PowerType = { Mana = 0, Rage = 1, Focus = 2, Energy = 3, ComboPoints = 4, Runes = 5, RunicPower = 6, SoulShards = 7,
	LunarPower = 8, HolyPower = 9, Maelstrom = 11, Chi = 12, Insanity = 13, ArcaneCharges = 16, Fury = 17, Pain = 18, Essence = 19 }
Enum.StatusBarInterpolation = { Immediate = 0, ExponentialEaseOut = 1 }
Enum.StatusBarTimerDirection = { ElapsedTime = 0, RemainingTime = 1 }
-- anything else Blizzard's preset file references gets a unique number
local nextEnum = 1000
setmetatable(Enum, { __index = function(t, k)
	local sub = setmetatable({}, { __index = function(s, kk) nextEnum = nextEnum + 1; rawset(s, kk, nextEnum); return nextEnum end })
	rawset(t, k, sub)
	return sub
end })
for _, sub in pairs(Enum) do
	setmetatable(sub, { __index = function(s, kk) log("MISSING ENUM KEY", kk); nextEnum = nextEnum + 1; rawset(s, kk, nextEnum); return nextEnum end })
end
Constants.EditModeLayoutConsts.EditModeDefaultLayout = Enum.EditModePresetLayouts.Modern

-- Blizzard frames with real-shaped children
GameTooltip = NewLoose("GameTooltip")
function GameTooltip.SetUnitAuraByAuraInstanceID() end
Minimap = NewLoose("Minimap")
BuffFrame = NewLoose("BuffFrame")
BuffFrame.auraFrames = { NewLoose("aura1"), NewLoose("aura2") }
local anchor = NewLoose("privateAnchor"); anchor.isAuraAnchor = true; table.insert(BuffFrame.auraFrames, anchor)
SAVED_LAYOUTS = nil
C_EditMode = {
	GetLayouts = function() return { activeLayout = ACTIVE_LAYOUT or 1, layouts = CopyTable(USER_LAYOUTS or {}) } end,
	SaveLayouts = function(info) SAVED_LAYOUTS = info end,
	SetActiveLayout = function(i) ACTIVE_SET = i end,
	IsValidLayoutName = function(n) return type(n) == "string" and #n > 0 end,
}
