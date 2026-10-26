local ADDON, ns = ...
local Plain, Has, IsSecret = ns.Plain, ns.Has, ns.IsSecret

local format, min = string.format, math.min
local UnitHealth, UnitHealthMax, UnitPower, UnitPowerMax = UnitHealth, UnitHealthMax, UnitPower, UnitPowerMax
local UnitHealthPercent = UnitHealthPercent
local Abbrev = AbbreviateNumbers or AbbreviateLargeNumbers
local EvalBool = C_CurveUtil and C_CurveUtil.EvaluateColorValueFromBoolean
local GetUnitAuras = C_UnitAuras and C_UnitAuras.GetUnitAuras
local GetAuraDuration = C_UnitAuras and C_UnitAuras.GetAuraDuration
local TruncateWhenZero = C_StringUtil and C_StringUtil.TruncateWhenZero

local frames = {}
ns.unitFrames = frames

---------------------------------------------------------------------------
-- Health / power / name
---------------------------------------------------------------------------
local function HealthText(unit, percentOnly)
	if Plain(UnitIsDeadOrGhost(unit)) then return DEAD end
	if Plain(UnitIsConnected(unit)) == false then return PLAYER_OFFLINE end
	local pct = UnitHealthPercent and UnitHealthPercent(unit, true, CurveConstants and CurveConstants.ScaleTo100)
	if percentOnly then
		if Has(pct) then return format("%d%%", pct) end
		return ""
	end
	local cur = Abbrev(UnitHealth(unit))
	if Has(pct) then return format("%s | %d%%", cur, pct) end
	return cur
end

local function UpdateHealth(f)
	local u = f.unit
	f.Health:SetMinMaxValues(0, UnitHealthMax(u))
	f.Health:SetValue(UnitHealth(u))
	if f.HealthText then f.HealthText:SetText(HealthText(u, f.percentOnly)) end
end

local function UpdateColor(f)
	local u = f.unit
	local r, g, b = 0.2, 0.75, 0.3
	if Plain(UnitIsPlayer(u)) or Plain(UnitInPartyIsAI and UnitInPartyIsAI(u)) then
		local _, class = UnitClass(u)
		local c = Plain(class) and RAID_CLASS_COLORS[class]
		if c then r, g, b = c.r, c.g, c.b end
	elseif Plain(UnitIsTapDenied(u)) then
		r, g, b = 0.55, 0.55, 0.55
	else
		local reaction = Plain(UnitReaction(u, "player"))
		local c = reaction and FACTION_BAR_COLORS[reaction]
		if c then r, g, b = c.r, c.g, c.b end
	end
	if Plain(UnitIsConnected(u)) == false then r, g, b = 0.5, 0.5, 0.5 end
	f.Health:SetStatusBarColor(r, g, b)
end

local function UpdatePower(f)
	local pw = f.Power
	if not pw then return end
	local u = f.unit
	local pType, pToken = UnitPowerType(u)
	pw:SetMinMaxValues(0, UnitPowerMax(u))
	pw:SetValue(UnitPower(u))
	local c = PowerBarColor[Plain(pToken)] or PowerBarColor[Plain(pType)] or PowerBarColor.MANA
	pw:SetStatusBarColor(c.r, c.g, c.b)
	if f.PowerText then f.PowerText:SetText(Abbrev(UnitPower(u))) end
end

local function UpdateName(f)
	if not f.Name then return end
	local name = UnitName(f.unit)
	f.Name:SetText(name)
end

local function UpdateRaidIcon(f)
	if not f.RaidIcon then return end
	local index = Plain(GetRaidTargetIndex(f.unit))
	if index then
		SetRaidTargetIconTexture(f.RaidIcon, index)
		f.RaidIcon:Show()
	else
		f.RaidIcon:Hide()
	end
end

---------------------------------------------------------------------------
-- Auras (target: debuffs you applied)
---------------------------------------------------------------------------
local MAX_AURAS = 8

local function Aura_OnEnter(self)
	if InCombatLockdown() or IsSecret(self.auraID) or not self.auraID then return end
	GameTooltip:SetOwner(self, "ANCHOR_BOTTOMRIGHT")
	pcall(GameTooltip.SetUnitAuraByAuraInstanceID, GameTooltip, self.owner.unit, self.auraID)
	GameTooltip:Show()
end

local function SetAura(f, n, aura)
	local b = f.Auras[n]
	b.Icon:SetTexture(aura.icon)
	b.auraID = aura.auraInstanceID

	local duration = GetAuraDuration and GetAuraDuration(f.unit, aura.auraInstanceID)
	if duration and b.CD.SetCooldownFromDurationObject then
		b.CD:SetCooldownFromDurationObject(duration)
		if b.CD.SetAlphaFromBoolean and duration.IsZero then
			b.CD:SetAlphaFromBoolean(duration:IsZero(), 0, 1)
		end
	else
		local length, expires = Plain(aura.duration), Plain(aura.expirationTime)
		if length and expires and length > 0 then
			b.CD:SetCooldown(expires - length, length)
			b.CD:SetAlpha(1)
		else
			b.CD:SetAlpha(0)
		end
	end

	if TruncateWhenZero then
		b.Count:SetText(TruncateWhenZero(aura.applications))
	else
		local count = Plain(aura.applications)
		b.Count:SetText((count and count > 1) and count or "")
	end
	b:Show()
end

local function UpdateAuras(f)
	local n = 0
	if GetUnitAuras then
		local list = GetUnitAuras(f.unit, f.auraFilter, MAX_AURAS)
		if list then
			for i = 1, min(#list, MAX_AURAS) do
				n = n + 1
				SetAura(f, n, list[i])
			end
		end
	elseif AuraUtil and AuraUtil.ForEachAura then
		AuraUtil.ForEachAura(f.unit, f.auraFilter, MAX_AURAS, function(aura)
			n = n + 1
			SetAura(f, n, aura)
			return n >= MAX_AURAS
		end, true)
	end
	for i = n + 1, MAX_AURAS do
		f.Auras[i]:Hide()
	end
end

local function CreateAuras(f, size, filter)
	f.Auras = {}
	f.auraFilter = filter
	for i = 1, MAX_AURAS do
		local b = CreateFrame("Frame", nil, f)
		b:SetSize(size, size)
		-- the first icon is placed by Orient(), the rest follow it
		if i > 1 then b:SetPoint("LEFT", f.Auras[i - 1], "RIGHT", 3, 0) end
		ns.Backdrop(b, 1)
		b.Icon = b:CreateTexture(nil, "ARTWORK")
		b.Icon:SetAllPoints()
		b.Icon:SetTexCoord(0.08, 0.92, 0.08, 0.92)
		b.CD = CreateFrame("Cooldown", nil, b, "CooldownFrameTemplate")
		b.CD:SetAllPoints()
		b.CD:SetDrawEdge(false)
		b.CD:SetReverse(true)
		local over = CreateFrame("Frame", nil, b)
		over:SetAllPoints()
		over:SetFrameLevel(b.CD:GetFrameLevel() + 1)
		b.Count = ns.Text(over, 11, "RIGHT")
		b.Count:SetPoint("BOTTOMRIGHT", 1, 0)
		b.owner = f
		b:SetScript("OnEnter", Aura_OnEnter)
		b:SetScript("OnLeave", GameTooltip_Hide)
		b:Hide()
		f.Auras[i] = b
	end
end

---------------------------------------------------------------------------
-- Cast bars. 12.x hands out duration objects; the StatusBar animates
-- itself from them, so the only per-frame work is the timer text.
---------------------------------------------------------------------------
local CAST_COLOR = { 0.3, 0.55, 0.9 }
local LOCKED_COLOR = { 0.55, 0.55, 0.55 }
local FAIL_COLOR = { 0.85, 0.2, 0.2 }

local CAST_EVENTS = {
	"UNIT_SPELLCAST_START", "UNIT_SPELLCAST_STOP", "UNIT_SPELLCAST_FAILED", "UNIT_SPELLCAST_INTERRUPTED",
	"UNIT_SPELLCAST_DELAYED", "UNIT_SPELLCAST_CHANNEL_START", "UNIT_SPELLCAST_CHANNEL_UPDATE",
	"UNIT_SPELLCAST_CHANNEL_STOP", "UNIT_SPELLCAST_EMPOWER_START", "UNIT_SPELLCAST_EMPOWER_UPDATE",
	"UNIT_SPELLCAST_EMPOWER_STOP", "UNIT_SPELLCAST_INTERRUPTIBLE", "UNIT_SPELLCAST_NOT_INTERRUPTIBLE",
}

local function CastColor(cb, locked)
	local tex = cb:GetStatusBarTexture()
	if cb.color then
		tex:SetVertexColor(cb.color[1], cb.color[2], cb.color[3])
	elseif IsSecret(locked) then
		if EvalBool then
			tex:SetVertexColor(EvalBool(locked, LOCKED_COLOR[1], CAST_COLOR[1]),
				EvalBool(locked, LOCKED_COLOR[2], CAST_COLOR[2]),
				EvalBool(locked, LOCKED_COLOR[3], CAST_COLOR[3]))
		else
			tex:SetVertexColor(CAST_COLOR[1], CAST_COLOR[2], CAST_COLOR[3])
		end
	elseif locked then
		tex:SetVertexColor(LOCKED_COLOR[1], LOCKED_COLOR[2], LOCKED_COLOR[3])
	else
		tex:SetVertexColor(CAST_COLOR[1], CAST_COLOR[2], CAST_COLOR[3])
	end
end

local function CastStart(cb, channel)
	local u = cb.unit
	local name, texture, startMS, endMS, castID, locked, empowered, _
	if channel then
		name, _, texture, startMS, endMS, _, locked, _, empowered = UnitChannelInfo(u)
	else
		name, _, texture, startMS, endMS, _, castID, locked = UnitCastingInfo(u)
	end
	if not Has(name) then
		cb:Hide()
		return
	end
	empowered = Plain(empowered)

	cb.failed = nil
	cb.channel = channel
	cb.castID = castID
	cb.token = (cb.token or 0) + 1

	local duration
	if channel then
		if empowered and UnitEmpoweredChannelDuration then duration = UnitEmpoweredChannelDuration(u, true) end
		if not duration and UnitChannelDuration then duration = UnitChannelDuration(u) end
	elseif UnitCastingDuration then
		duration = UnitCastingDuration(u)
	end

	if duration and cb.SetTimerDuration then
		cb.duration, cb.startT, cb.endT = duration, nil, nil
		local drain = channel and not empowered
		cb:SetTimerDuration(duration, Enum.StatusBarInterpolation.Immediate,
			drain and Enum.StatusBarTimerDirection.RemainingTime or Enum.StatusBarTimerDirection.ElapsedTime)
	else
		startMS, endMS = Plain(startMS), Plain(endMS)
		if not (startMS and endMS) then
			cb:Hide()
			return
		end
		cb.duration, cb.startT, cb.endT = nil, startMS / 1000, endMS / 1000
		cb:SetMinMaxValues(0, cb.endT - cb.startT)
	end

	cb.Icon:SetTexture(texture)
	cb.Text:SetText(name)
	CastColor(cb, locked)
	cb:Show()
end

local function CastRefresh(cb)
	cb.failed = nil
	if Has(UnitChannelInfo(cb.unit)) then
		CastStart(cb, true)
	elseif Has(UnitCastingInfo(cb.unit)) then
		CastStart(cb, false)
	else
		cb:Hide()
	end
end

local function CastFail(cb, label)
	if cb.failed or not cb:IsShown() then return end
	cb.failed = true
	cb:SetMinMaxValues(0, 1)
	cb:SetValue(1)
	cb:GetStatusBarTexture():SetVertexColor(FAIL_COLOR[1], FAIL_COLOR[2], FAIL_COLOR[3])
	cb.Text:SetText(label)
	cb.Time:SetText("")
	local token = cb.token
	C_Timer.After(0.6, function()
		if cb.failed and cb.token == token then cb:Hide() end
	end)
end

-- a cast id we can compare and that belongs to some other cast
local function OtherCast(cb, castGUID)
	return Has(cb.castID) and not IsSecret(cb.castID) and not IsSecret(castGUID) and castGUID ~= cb.castID
end

local function Cast_OnEvent(cb, event, _, castGUID)
	if event == "UNIT_SPELLCAST_START" or event == "UNIT_SPELLCAST_DELAYED" then
		CastStart(cb, false)
	elseif event == "UNIT_SPELLCAST_CHANNEL_START" or event == "UNIT_SPELLCAST_CHANNEL_UPDATE"
		or event == "UNIT_SPELLCAST_EMPOWER_START" or event == "UNIT_SPELLCAST_EMPOWER_UPDATE" then
		CastStart(cb, true)
	elseif event == "UNIT_SPELLCAST_STOP" then
		if cb.failed or cb.channel or OtherCast(cb, castGUID) then return end
		cb:Hide()
	elseif event == "UNIT_SPELLCAST_CHANNEL_STOP" or event == "UNIT_SPELLCAST_EMPOWER_STOP" then
		if cb.channel then cb:Hide() end
	elseif event == "UNIT_SPELLCAST_FAILED" or event == "UNIT_SPELLCAST_INTERRUPTED" then
		if cb.channel or OtherCast(cb, castGUID) then return end
		CastFail(cb, event == "UNIT_SPELLCAST_INTERRUPTED" and INTERRUPTED or FAILED)
	elseif event == "UNIT_SPELLCAST_INTERRUPTIBLE" then
		CastColor(cb, false)
	elseif event == "UNIT_SPELLCAST_NOT_INTERRUPTIBLE" then
		CastColor(cb, true)
	end
end

local function Cast_OnUpdate(cb, elapsed)
	if cb.failed then return end
	if cb.duration then
		cb.tick = (cb.tick or 0) + elapsed
		if cb.tick < 0.05 then return end
		cb.tick = 0
		cb.Time:SetFormattedText("%.1f", cb.duration:GetRemainingDuration())
	elseif cb.endT then
		local now = GetTime()
		if now >= cb.endT then
			cb:Hide()
			return
		end
		cb:SetValue(cb.channel and (cb.endT - now) or (now - cb.startT))
		cb.Time:SetFormattedText("%.1f", cb.endT - now)
	end
end

local function Cast_OnHide(cb)
	cb.failed, cb.duration, cb.endT = nil, nil, nil
end

local function CreateCastbar(f, height, classColor)
	local px = ns.px
	local cb = CreateFrame("StatusBar", nil, f)
	cb:SetStatusBarTexture(ns.WHITE)
	cb:SetStatusBarColor(1, 1, 1)
	cb:SetSize(f.width - height - px * 3, height)
	ns.Backdrop(cb, 0.9)
	local bg = cb:CreateTexture(nil, "BACKGROUND")
	bg:SetAllPoints()
	bg:SetColorTexture(0.1, 0.1, 0.1, 1)

	cb.Icon = cb:CreateTexture(nil, "ARTWORK")
	cb.Icon:SetSize(height, height)
	cb.Icon:SetPoint("TOPRIGHT", cb, "TOPLEFT", -px * 3, 0)
	cb.Icon:SetTexCoord(0.08, 0.92, 0.08, 0.92)
	local iconBorder = cb:CreateTexture(nil, "BACKGROUND", nil, -7)
	iconBorder:SetPoint("TOPLEFT", cb.Icon, -px, px)
	iconBorder:SetPoint("BOTTOMRIGHT", cb.Icon, px, -px)
	iconBorder:SetColorTexture(0, 0, 0, 1)

	cb.Text = ns.Text(cb, 11, "LEFT")
	cb.Text:SetPoint("LEFT", 4, 0)
	cb.Text:SetPoint("RIGHT", -34, 0)
	cb.Time = ns.Text(cb, 11, "RIGHT")
	cb.Time:SetPoint("RIGHT", -4, 0)

	cb.unit = f.unit
	if classColor then
		local _, class = UnitClass("player")
		local c = RAID_CLASS_COLORS[class]
		cb.color = { c.r, c.g, c.b }
	end
	for _, event in ipairs(CAST_EVENTS) do
		cb:RegisterUnitEvent(event, f.unit)
	end
	cb:SetScript("OnEvent", Cast_OnEvent)
	cb:SetScript("OnUpdate", Cast_OnUpdate)
	cb:SetScript("OnHide", Cast_OnHide)
	cb:Hide()
	f.Castbar = cb
end

---------------------------------------------------------------------------
-- Class power pips (holy power, combo points, chi, shards, charges,
-- essence, runes). Each pip is a StatusBar spanning [i-1, i] so feeding
-- every pip the raw count fills the right ones even if the count is secret.
---------------------------------------------------------------------------
local PT = Enum.PowerType

local function SpecID()
	local getSpec = C_SpecializationInfo and C_SpecializationInfo.GetSpecialization or GetSpecialization
	local getInfo = C_SpecializationInfo and C_SpecializationInfo.GetSpecializationInfo or GetSpecializationInfo
	local index = getSpec and getSpec()
	if index and getInfo then return (getInfo(index)) end
end

local CLASS_POWER = {
	PALADIN = function() return PT.HolyPower end,
	ROGUE = function() return PT.ComboPoints end,
	DRUID = function() if Plain(UnitPowerType("player")) == PT.Energy then return PT.ComboPoints end end,
	MONK = function() if SpecID() == 269 then return PT.Chi end end,
	WARLOCK = function() return PT.SoulShards end,
	MAGE = function() if SpecID() == 62 then return PT.ArcaneCharges end end,
	EVOKER = function() return PT.Essence end,
	DEATHKNIGHT = function() return PT.Runes end,
}

local PIP_COLOR = {
	[PT.HolyPower] = { 0.95, 0.85, 0.35 },
	[PT.ComboPoints] = { 1, 0.85, 0.2 },
	[PT.Chi] = { 0.45, 0.95, 0.75 },
	[PT.SoulShards] = { 0.6, 0.35, 0.85 },
	[PT.ArcaneCharges] = { 0.35, 0.6, 1 },
	[PT.Essence] = { 0.3, 0.8, 0.85 },
}

local function LayoutPips(cp, count)
	local gap = 3
	local width = (cp:GetWidth() - gap * (count - 1)) / count
	for i, pip in ipairs(cp.pips) do
		if i <= count then
			pip:ClearAllPoints()
			pip:SetPoint("TOPLEFT", cp, "TOPLEFT", (i - 1) * (width + gap), 0)
			pip:SetSize(width, cp:GetHeight())
			pip:SetMinMaxValues(i - 1, i)
			pip:Show()
		else
			pip:Hide()
		end
	end
	cp.count = count
end

local runeValues = {}
local function RuneTick(cp)
	local now, busy = GetTime(), false
	for i = 1, 6 do
		local start, duration, ready = GetRuneCooldown(i)
		start, duration, ready = Plain(start), Plain(duration), Plain(ready)
		local v = 1
		if not ready then
			if start and duration and duration > 0 then
				v = min(1, (now - start) / duration)
				busy = true
			else
				v = 0
			end
		end
		runeValues[i] = v
	end
	table.sort(runeValues, function(a, b) return a > b end)
	for i = 1, 6 do
		local v = runeValues[i]
		cp.pips[i]:SetValue(v)
		cp.pips[i]:SetAlpha(v >= 1 and 1 or 0.45)
	end
	return busy
end

local function Rune_OnUpdate(cp, elapsed)
	cp.tick = (cp.tick or 0) + elapsed
	if cp.tick < 0.05 then return end
	cp.tick = 0
	if not RuneTick(cp) then cp:SetScript("OnUpdate", nil) end
end

local function UpdateClassPower(f)
	local cp = f.ClassPower
	local ptype = cp.getType and cp.getType()
	if not ptype then
		cp:Hide()
		return
	end
	cp:Show()

	if ptype == PT.Runes then
		if cp.ptype ~= ptype then
			cp.ptype = ptype
			LayoutPips(cp, 6)
			local c = RAID_CLASS_COLORS.DEATHKNIGHT
			for i = 1, 6 do
				cp.pips[i]:SetMinMaxValues(0, 1)
				cp.pips[i]:SetStatusBarColor(c.r, c.g, c.b)
			end
		end
		if RuneTick(cp) then cp:SetScript("OnUpdate", Rune_OnUpdate) end
		return
	end

	local maxPower = Plain(UnitPowerMax("player", ptype)) or 5
	if maxPower < 1 then
		cp:Hide()
		return
	end
	if cp.count ~= maxPower or cp.ptype ~= ptype then
		cp.ptype = ptype
		cp:SetScript("OnUpdate", nil)
		LayoutPips(cp, min(maxPower, #cp.pips))
		local c = PIP_COLOR[ptype] or { 1, 1, 1 }
		for _, pip in ipairs(cp.pips) do
			pip:SetStatusBarColor(c[1], c[2], c[3])
			pip:SetAlpha(1)
		end
	end
	local cur = UnitPower("player", ptype)
	for i = 1, cp.count do
		cp.pips[i]:SetValue(cur)
	end
end

local function CreateClassPower(f)
	local cp = CreateFrame("Frame", nil, f)
	cp:SetSize(f.width, 7)
	cp.pips = {}
	for i = 1, 10 do
		local pip = ns.Bar(cp)
		ns.Backdrop(pip, 1)
		pip:Hide()
		cp.pips[i] = pip
	end
	local _, class = UnitClass("player")
	cp.getType = CLASS_POWER[class]
	cp:Hide()
	f.ClassPower = cp
end

---------------------------------------------------------------------------
-- Frames
---------------------------------------------------------------------------
local function UpdateAll(f)
	if not Plain(UnitExists(f.unit)) then return end
	UpdateColor(f)
	UpdateHealth(f)
	UpdatePower(f)
	UpdateName(f)
	UpdateRaidIcon(f)
	if f.Auras then UpdateAuras(f) end
	if f.Castbar then CastRefresh(f.Castbar) end
	if f.ClassPower then UpdateClassPower(f) end
end

local function PlayerPower(f)
	UpdatePower(f)
	if f.ClassPower then UpdateClassPower(f) end
end

local UNIT_EVENTS = {
	UNIT_HEALTH = UpdateHealth,
	UNIT_MAXHEALTH = UpdateHealth,
	UNIT_POWER_UPDATE = UpdatePower,
	UNIT_MAXPOWER = UpdatePower,
	UNIT_DISPLAYPOWER = UpdatePower,
	UNIT_NAME_UPDATE = UpdateName,
	UNIT_FACTION = UpdateColor,
	UNIT_FLAGS = UpdateColor,
	UNIT_CONNECTION = UpdateAll,
}

local function Unit_OnEvent(f, event)
	local fn = f.handlers[event]
	if fn then fn(f) end
end

-- unit tooltips only out of combat: cheaper, and keeps tainted code away
-- from secret tooltip data mid-fight
local function Unit_OnEnter(self)
	if InCombatLockdown() then return end
	GameTooltip_SetDefaultAnchor(GameTooltip, self)
	GameTooltip:SetUnit(self.unit)
	GameTooltip:Show()
end

local function Unit_OnLeave()
	GameTooltip:Hide()
end

local COMPOUND = { targettarget = true, focustarget = true }

local function Spawn(unit, key, width, height, powerHeight, default, fallback, opts)
	opts = opts or {}
	local holder = ns.Holder(key, width, height, default, fallback)

	local f = CreateFrame("Button", "SlimUI_" .. key, UIParent, "SecureUnitButtonTemplate")
	f:SetAllPoints(holder)
	f:SetFrameStrata("LOW")
	f:SetAttribute("unit", unit)
	f:SetAttribute("*type1", "target")
	f:SetAttribute("*type2", "togglemenu")
	f:RegisterForClicks("AnyUp")
	f:SetScript("OnEnter", Unit_OnEnter)
	f:SetScript("OnLeave", Unit_OnLeave)
	f.unit = unit
	f.width = width
	f.holder = holder
	ns.Backdrop(f, 0.9)

	local hp = ns.Bar(f)
	hp:SetPoint("TOPLEFT")
	hp:SetPoint("TOPRIGHT")
	hp:SetPoint("BOTTOM", 0, powerHeight > 0 and (powerHeight + ns.px) or 0)
	f.Health = hp

	if powerHeight > 0 then
		local pw = ns.Bar(f)
		pw:SetPoint("BOTTOMLEFT")
		pw:SetPoint("BOTTOMRIGHT")
		pw:SetHeight(powerHeight)
		f.Power = pw
	end

	local size = opts.fontSize or 12
	if opts.name then
		f.Name = ns.Text(hp, size, opts.name)
		if opts.name == "CENTER" then
			f.Name:SetPoint("LEFT", 3, 0)
			f.Name:SetPoint("RIGHT", -3, 0)
		else
			f.Name:SetPoint("LEFT", 4, 0)
			f.Name:SetWidth(width * 0.55)
		end
	end
	if opts.health then
		f.HealthText = ns.Text(hp, size, "RIGHT")
		f.HealthText:SetPoint("RIGHT", -4, 0)
		f.percentOnly = opts.percentOnly
	end
	if opts.powerText then
		f.PowerText = ns.Text(hp, size - 1, "LEFT")
		f.PowerText:SetPoint("LEFT", 4, 0)
	end
	if opts.raidIcon then
		f.RaidIcon = hp:CreateTexture(nil, "OVERLAY")
		f.RaidIcon:SetSize(18, 18)
		f.RaidIcon:SetPoint("CENTER", f, "TOP", 0, 2)
		f.RaidIcon:SetTexture("Interface\\TargetingFrame\\UI-RaidTargetingIcons")
		f.RaidIcon:Hide()
	end

	f.handlers = {}
	for event, fn in pairs(UNIT_EVENTS) do
		f.handlers[event] = fn
	end
	if unit == "player" then
		f.handlers.UNIT_POWER_UPDATE = nil
		f.handlers.UNIT_POWER_FREQUENT = PlayerPower
		f.handlers.UNIT_MAXPOWER = PlayerPower
		f.handlers.UNIT_DISPLAYPOWER = PlayerPower
	end
	if opts.auras then
		CreateAuras(f, 22, opts.auras)
		f.handlers.UNIT_AURA = UpdateAuras
	end
	-- compound units get no unit events; poll them only while they are visible
	if COMPOUND[unit] then
		f:HookScript("OnShow", function(self)
			if not self.ticker then
				self.ticker = C_Timer.NewTicker(0.25, function() UpdateAll(self) end)
			end
		end)
		f:HookScript("OnHide", function(self)
			if self.ticker then
				self.ticker:Cancel()
				self.ticker = nil
			end
		end)
	else
		for event in pairs(f.handlers) do
			f:RegisterUnitEvent(event, unit)
		end
	end
	f:SetScript("OnEvent", Unit_OnEvent)
	f:HookScript("OnShow", UpdateAll)

	if unit ~= "player" then RegisterUnitWatch(f) end
	ClickCastFrames = ClickCastFrames or {}
	ClickCastFrames[f] = true

	frames[unit] = f
	return f
end

---------------------------------------------------------------------------
-- Placement: each SlimUI frame sits where Edit Mode puts the Blizzard frame
-- it replaces, so the layout (and spec layouts) still drive positions.
---------------------------------------------------------------------------
local UNIT_SYSTEM = { player = "Player", target = "Target", focus = "Focus", pet = "Pet" }
local REPLACED = {
	PlayerFrame = "SlimUI_playerHolder", TargetFrame = "SlimUI_targetHolder",
	FocusFrame = "SlimUI_focusHolder", PetFrame = "SlimUI_petHolder",
}

local function BlizzardInfo(unit)
	local name = UNIT_SYSTEM[unit]
	local index = name and Enum.EditModeUnitFrameSystemIndices and Enum.EditModeUnitFrameSystemIndices[name]
	return index and ns.ActiveSystem(Enum.EditModeSystem.UnitFrame, index)
end

local function BlizzardSpot(unit)
	local info = BlizzardInfo(unit)
	-- the default pet frame hangs off the player frame instead of having a spot
	if not info or (unit == "pet" and info.isInDefaultPosition) then return end
	local a = info.anchorInfo
	return { a.point, REPLACED[a.relativeTo] or a.relativeTo, a.relativePoint, a.offsetX, a.offsetY }
end

-- Blizzard's Frame Size slider: 100-200% in 5% steps
local function SizeFor(unit, width, height)
	local steps = ns.SettingValue(BlizzardInfo(unit), Enum.EditModeUnitFrameSetting.FrameSize) or 0
	local scale = 1 + steps * 0.05
	return math.floor(width * scale + 0.5), math.floor(height * min(scale, 1.25) + 0.5)
end

local function IsTop(region)
	local _, y = region:GetCenter()
	return y ~= nil and y > UIParent:GetHeight() / 2
end

local function IsRight(region)
	local x = region:GetCenter()
	return x ~= nil and x > UIParent:GetWidth() / 2
end

-- small frames sit beside their owner, on the side facing the screen centre
local function Beside(ownerKey)
	return function()
		local owner = ns.holders[ownerKey]
		if not owner then return end
		local edge = IsTop(owner) and "TOP" or "BOTTOM"
		if IsRight(owner) then
			return { edge .. "RIGHT", owner:GetName(), edge .. "LEFT", -8, 0 }
		end
		return { edge .. "LEFT", owner:GetName(), edge .. "RIGHT", 8, 0 }
	end
end

local function PetSpot()
	local spot = BlizzardSpot("pet")
	if spot then return spot end
	local player = frames.player
	if player and IsTop(player.holder) then
		-- under the class power row (and the cast bar, when SlimUI draws it)
		local drop = 4 + 7 + 8 + (player.Castbar and (player.Castbar:GetHeight() + 4) or 0)
		return { "TOPLEFT", "SlimUI_playerHolder", "BOTTOMLEFT", 0, -drop }
	end
	return { "BOTTOMRIGHT", "SlimUI_playerHolder", "BOTTOMLEFT", -8, 0 }
end

-- extras stack away from the screen edge the frame is on
local function Orient(f)
	local gap = 4 + ns.px
	local top = IsTop(f.holder)
	local under = f
	if f.ClassPower then
		f.ClassPower:ClearAllPoints()
		if top then
			f.ClassPower:SetPoint("TOPLEFT", f, "BOTTOMLEFT", 0, -gap)
			under = f.ClassPower
		else
			f.ClassPower:SetPoint("BOTTOMLEFT", f, "TOPLEFT", 0, gap)
		end
	end
	if f.Castbar then
		f.Castbar:ClearAllPoints()
		f.Castbar:SetPoint("TOPRIGHT", under, "BOTTOMRIGHT", 0, -gap)
	end
	if f.Auras then
		local first = f.Auras[1]
		first:ClearAllPoints()
		if top then
			local drop = gap + (f.Castbar and (f.Castbar:GetHeight() + gap) or 0)
			first:SetPoint("TOPLEFT", f, "BOTTOMLEFT", 0, -drop)
		else
			first:SetPoint("BOTTOMLEFT", f, "TOPLEFT", 0, gap)
		end
	end
end

local ORDER = { "player", "target", "focus", "pet", "targettarget", "focustarget" }

function ns.RefreshUnits()
	if InCombatLockdown() or not frames.player then return end
	-- twice, so frames anchored to each other settle whatever the order
	for _ = 1, 2 do
		for _, key in ipairs(ORDER) do
			local holder = ns.holders[key]
			if holder then ns.PlaceHolder(holder) end
		end
	end
	for _, f in pairs(frames) do
		Orient(f)
	end
end

---------------------------------------------------------------------------
-- Blizzard frames we replace: silence every event so they cost nothing
---------------------------------------------------------------------------
local function Silence(frame)
	frame:UnregisterAllEvents()
	for _, child in ipairs({ frame:GetChildren() }) do
		Silence(child)
	end
end

local function Kill(frame)
	if not frame then return end
	Silence(frame)
	frame:Hide()
	frame:SetParent(ns.hidden)
end

local function HideBlizzard(ownCastbar)
	Kill(PlayerFrame)
	-- same as oUF: keep vehicle events so Blizzard's vehicle handling still resolves
	for _, event in ipairs({ "PLAYER_ENTERING_WORLD", "UNIT_ENTERING_VEHICLE", "UNIT_ENTERED_VEHICLE",
		"UNIT_EXITING_VEHICLE", "UNIT_EXITED_VEHICLE" }) do
		pcall(PlayerFrame.RegisterEvent, PlayerFrame, event)
	end
	Kill(TargetFrame)
	Kill(FocusFrame)
	Kill(PetFrame)
	-- Blizzard's own player cast bar stays unless it was locked inside the player frame
	if ownCastbar and PlayerCastingBarFrame then PlayerCastingBarFrame:SetUnit(nil) end
	if PetCastingBarFrame then PetCastingBarFrame:SetUnit(nil) end
end

---------------------------------------------------------------------------
-- Build
---------------------------------------------------------------------------
local function Build()
	local castInfo = ns.ActiveSystem(Enum.EditModeSystem.CastBar)
	local ownCastbar = ns.SettingValue(castInfo, Enum.EditModeCastBarSetting.LockToPlayerFrame) == 1
	HideBlizzard(ownCastbar)

	local w, h = SizeFor("player", 210, 40)
	local player = Spawn("player", "player", w, h, 8,
		function() return BlizzardSpot("player") end,
		{ "BOTTOMRIGHT", "UIParent", "BOTTOM", -30, 186 },
		{ health = true, powerText = true })
	if ownCastbar then CreateCastbar(player, 18, true) end
	CreateClassPower(player)

	w, h = SizeFor("target", 210, 40)
	local target = Spawn("target", "target", w, h, 8,
		function() return BlizzardSpot("target") end,
		{ "BOTTOMLEFT", "UIParent", "BOTTOM", 30, 186 },
		{ name = "LEFT", health = true, raidIcon = true, auras = "HARMFUL|PLAYER" })
	CreateCastbar(target, 18)

	w, h = SizeFor("focus", 180, 30)
	local focus = Spawn("focus", "focus", w, h, 5,
		function() return BlizzardSpot("focus") end,
		{ "BOTTOMRIGHT", "UIParent", "BOTTOM", -260, 290 },
		{ name = "LEFT", health = true, percentOnly = true, raidIcon = true, fontSize = 11 })
	CreateCastbar(focus, 14)

	Spawn("pet", "pet", 120, 26, 4, PetSpot,
		{ "BOTTOMRIGHT", "SlimUI_playerHolder", "BOTTOMLEFT", -8, 0 },
		{ name = "CENTER", fontSize = 11 })

	Spawn("targettarget", "targettarget", 120, 26, 0, Beside("target"),
		{ "BOTTOMLEFT", "SlimUI_targetHolder", "BOTTOMRIGHT", 8, 0 },
		{ name = "CENTER", fontSize = 11 })

	Spawn("focustarget", "focustarget", 110, 22, 0, Beside("focus"),
		{ "BOTTOMLEFT", "SlimUI_focusHolder", "BOTTOMRIGHT", 8, 0 },
		{ name = "CENTER", fontSize = 10 })

	ns.RefreshUnits()

	local function refresh(unit)
		local f = frames[unit]
		if f then UpdateAll(f) end
	end

	ns.On("PLAYER_ENTERING_WORLD", function()
		ns.OutOfCombat(ns.RefreshUnits)
		for _, f in pairs(frames) do UpdateAll(f) end
	end)
	-- spec swaps and Edit Mode saves can move the Blizzard frames we follow
	ns.On("EDIT_MODE_LAYOUTS_UPDATED", function()
		ns.OutOfCombat(ns.RefreshUnits)
	end)
	ns.On("PLAYER_TARGET_CHANGED", function()
		refresh("target")
		refresh("targettarget")
	end)
	ns.On("PLAYER_FOCUS_CHANGED", function()
		refresh("focus")
		refresh("focustarget")
	end)
	ns.On("UNIT_TARGET", function(_, unit)
		if unit == "target" then refresh("targettarget") end
		if unit == "focus" then refresh("focustarget") end
	end)
	ns.On("UNIT_PET", function(_, unit)
		if unit == "player" then refresh("pet") end
	end)
	ns.On("RAID_TARGET_UPDATE", function()
		for _, f in pairs(frames) do
			if f.RaidIcon and f:IsShown() then UpdateRaidIcon(f) end
		end
	end)
	local function classPower() UpdateClassPower(player) end
	ns.On("PLAYER_SPECIALIZATION_CHANGED", classPower)
	ns.On("UPDATE_SHAPESHIFT_FORM", classPower)
	ns.On("RUNE_POWER_UPDATE", classPower)

	for _, f in pairs(frames) do
		UpdateAll(f)
	end
end

ns.Module(function()
	ns.OutOfCombat(Build)
end)
