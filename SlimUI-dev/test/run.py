import sys, os
from lupa import lua51
ADDON = r"E:\FFXIV-mods\SlimUI"
BLIZZ = os.path.join(os.path.dirname(__file__), "..", "blizz")
FILES = ["Core.lua", "Units.lua", "ActionBars.lua", "Chat.lua", "Minimap.lua", "Skins.lua", "Layout.lua"]

def run(label, secret=False, cls="PALADIN", user_layouts="", active=1, script=""):
    L = lua51.LuaRuntime(unpack_returned_tuples=True)
    g = L.globals()
    def ex(code, name):
        f = L.eval("function(code, name) local fn, err = loadstring(code, name); if not fn then error(err) end; return fn end")(code, name)
        return f
    g.SECRET_MODE = secret
    g.CLASS = cls
    ex(open(os.path.join(os.path.dirname(__file__), "enums.lua"), encoding="utf-8").read(), "enums")()
    ex(open(os.path.join(os.path.dirname(__file__), "harness.lua"), encoding="utf-8").read(), "harness")()
    for f in ["EditModePresetLayoutConstants.lua", "EditModePresetLayoutSystemUtils.lua", "EditModePresetLayouts.lua", "EditModePresetLayoutsManager.lua"]:
        ex(open(os.path.join(BLIZZ, f), encoding="utf-8").read(), f)()
    if user_layouts:
        ex(user_layouts, "user_layouts")()
    g.ACTIVE_LAYOUT = active
    ns = L.table()
    for f in FILES:
        ex(open(os.path.join(ADDON, f), encoding="utf-8").read(), f)("SlimUI", ns)
    ex(script, "script")()
    errs = list(g.ERRORS.values())
    logs = list(g.LOG.values())
    print("=== %s: %d errors" % (label, len(errs)))
    for e in errs: print("  ERR", e)
    for l in logs: print("  ", l)
    return L

SCRIPT = r'''
Fire("ADDON_LOADED", "SlimUI")
Fire("PLAYER_LOGIN")
Fire("PLAYER_ENTERING_WORLD")
local ns = SlimUI
assert(ns.db and ns.db.pos, "db missing")
local uf = ns.unitFrames
for _, u in ipairs({"player","target","targettarget","pet","focus"}) do assert(uf[u], "no frame " .. u) end
Fire("UNIT_HEALTH", "player"); Fire("UNIT_POWER_FREQUENT", "player"); Fire("UNIT_AURA", "target")
Fire("PLAYER_TARGET_CHANGED"); Fire("UNIT_TARGET", "target"); Fire("PLAYER_FOCUS_CHANGED"); Fire("UNIT_PET", "player")
Fire("RAID_TARGET_UPDATE"); Fire("PLAYER_SPECIALIZATION_CHANGED", "player"); Fire("RUNE_POWER_UPDATE")
assert(not uf.player.Castbar, "Blizzard keeps the player cast bar unless it was locked to the player frame")
Fire("UNIT_SPELLCAST_START", "target", "cast-1", 19750)
Tick(0.1)
local cb = uf.target.Castbar
assert(cb:IsShown(), "target castbar should show")
Fire("UNIT_SPELLCAST_FAILED", "target", "other-cast", 1)
assert(cb:IsShown(), "foreign FAILED must not end the cast")
Fire("UNIT_SPELLCAST_STOP", "target", "cast-1", 19750)
assert(not cb:IsShown(), "STOP should hide")
Fire("UNIT_SPELLCAST_START", "target", "cast-2", 1)
Fire("UNIT_SPELLCAST_NOT_INTERRUPTIBLE", "target"); Fire("UNIT_SPELLCAST_INTERRUPTED", "target", "cast-1", 1)
CASTING = false; CHANNELING = true
Fire("UNIT_SPELLCAST_CHANNEL_START", "focus", nil, 1); Tick(0.1); Fire("UNIT_SPELLCAST_CHANNEL_STOP", "focus", nil, 1)
Fire("UNIT_SPELLCAST_EMPOWER_START", "focus", nil, 1); Tick(0.1); Fire("UNIT_SPELLCAST_EMPOWER_STOP", "focus", nil, 1)
local text = uf.player.HealthText:GetText()
print("player health text:", tostring(issecretvalue(text) and text.v or text))
print("target aura count text:", tostring(uf.target.Auras[1].Count:GetText()))
print("hotkey ActionButton1:", tostring(ActionButton1.HotKey:GetText()))
-- slash
SlashCmdList.SLIMUI("")
SlashCmdList.SLIMUI("move"); SlashCmdList.SLIMUI("move"); SlashCmdList.SLIMUI("reset")
-- tooltip hook
SharedTooltip_SetBackdropStyle(GameTooltip, nil, false)
-- movers drag
for key, h in pairs(ns.holders) do RunScript(h.mover, "OnDragStop") end
assert(ns.db.pos.player, "mover save failed")
-- details
local function inst(id, side) return { baseframe = CreateFrame("Frame"), toolbar_side = side, show_statusbar = false,
  IsEnabled = function() return true end, UngroupInstance = function() end, SaveMainWindowPosition = function() end,
  RestoreMainWindowPosition = function() end, LockInstance = function(self, f) self.locked = f end } end
local wins = { inst(1, 1), inst(2, 1), inst(3, 2), inst(4, 1) }
Details = { GetInstance = function(self, i) return wins[i] end, GetNumInstances = function() return #wins end }
SlashCmdList.SLIMUI("details")
for i = 1, 3 do assert(wins[i].locked == true, "window " .. i .. " not locked") end
assert(wins[4].locked == nil, "4th window should be left alone")
for i = 1, 3 do local st = wins[i].baseframe.__state; print(string.format("details %d -> %.1f x %.1f at (%.1f, %.1f)", i, st.w, st.h, st.points[1][4], st.points[1][5])) end
-- install popup + apply
SlashCmdList.SLIMUI("install")
RunScript(SlimUI_Install, "OnShow")
for _, child in ipairs({ SlimUI_Install:GetChildren() }) do
  if child.__state.text == "Apply + reload" then RunScript(child, "OnClick") end
end
assert(SAVED_LAYOUTS, "layout not saved")
assert(RELOADED, "no reload")
local L = SAVED_LAYOUTS.layouts[SAVED_LAYOUTS.activeLayout]
print("saved layout:", L.layoutName, "type", L.layoutType, "slot", SAVED_LAYOUTS.activeLayout, "of", #SAVED_LAYOUTS.layouts, "active set", ACTIVE_SET)
local moved = 0
local names = {}
for k, v in pairs(Enum.EditModeSystem) do names[v] = k end
for _, s in ipairs(L.systems) do
  if not s.isInDefaultPosition then moved = moved + 1
    local a = s.anchorInfo
    print(string.format("  %s[%s] %s %s %s %d %d", names[s.system] or s.system, tostring(s.systemIndex), a.point, a.relativeTo, a.relativePoint, a.offsetX, a.offsetY))
  end
end
print("systems moved:", moved)
for _, s in ipairs(L.systems) do
  if s.system == Enum.EditModeSystem.ActionBar and s.systemIndex == 1 then
    for _, st in ipairs(s.settings) do io.write(st.setting, "=", st.value, " ") end print("<- main bar settings")
  end
  if s.system == Enum.EditModeSystem.ChatFrame then
    for _, st in ipairs(s.settings) do io.write(st.setting, "=", st.value, " ") end print("<- chat settings")
  end
end
'''
if __name__ == "__main__":
    run("paladin plain", script=SCRIPT)
    run("paladin secret", secret=True, script=SCRIPT)
    run("deathknight secret", secret=True, cls="DEATHKNIGHT", script=SCRIPT)
    run("druid", cls="DRUID", script=SCRIPT)
    run("monk secret", secret=True, cls="MONK", script=SCRIPT)
