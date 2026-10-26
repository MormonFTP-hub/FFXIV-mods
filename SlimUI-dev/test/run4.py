# SlimUI 1.1 against the user's real Edit Mode layouts (dps, heals, live 1.0 "SlimUI")
import os
from run import run
REAL = open(os.path.join(os.path.dirname(__file__), "real_layouts.lua"), encoding="utf-8").read() + "\nUSER_LAYOUTS = REAL_LAYOUTS\n"
SCRIPT = r'''
SlimUIDB = { installed = true, pos = {}, macroText = false, fadeMenus = true }
Fire("ADDON_LOADED", "SlimUI"); Fire("PLAYER_LOGIN"); Fire("PLAYER_ENTERING_WORLD")
local names = {} for k, v in pairs(Enum.EditModeSystem) do names[v] = k end
-- unit frames follow the Blizzard frames' Edit Mode spots
for _, key in ipairs({ "player", "target", "focus", "pet", "targettarget", "focustarget" }) do
  local h = SlimUI.holders[key]; local st = h.__state; local p = st.points[#st.points]
  print(string.format("%-12s %dx%d  %s %s %s %s %s", key, st.w, st.h, tostring(p[1]), type(p[2]) == "table" and (p[2].__state.name or "?") or tostring(p[2]), tostring(p[3]), tostring(p[4]), tostring(p[5])))
end
print("player castbar (ours):", tostring(SlimUI.unitFrames.player.Castbar ~= nil))
assert(SlimUI_Install and SlimUI_Install.__state.shown, "update prompt should show")
print("prompt:", SlimUI_Install.body.__state.text:sub(1, 60))
for _, child in ipairs({ SlimUI_Install:GetChildren() }) do
  if child.__state.text == "Apply + reload" then RunScript(child, "OnClick") end
end
assert(SAVED_LAYOUTS and RELOADED, "not applied")
local out = {}
for i, l in ipairs(SAVED_LAYOUTS.layouts) do out[#out+1] = i .. ":" .. l.layoutName end
print("layouts:", table.concat(out, "  "), "| active", SAVED_LAYOUTS.activeLayout, "set", ACTIVE_SET)
local function find(l, name) for _, x in ipairs(SAVED_LAYOUTS.layouts) do if x.layoutName == name then return x end end end
local function same(a, b)
  if (a.isInDefaultPosition and true or false) ~= (b.isInDefaultPosition and true or false) then return false end
  for _, k in ipairs({ "point", "relativeTo", "relativePoint", "offsetX", "offsetY" }) do if a.anchorInfo[k] ~= b.anchorInfo[k] then return false end end
  if #a.settings ~= #b.settings then return false end
  for i, s in ipairs(a.settings) do if b.settings[i].setting ~= s.setting or b.settings[i].value ~= s.value then return false end end
  return true
end
for _, pair in ipairs(PAIRS) do
  local slim, src = find(nil, pair[1]), find(nil, pair[2])
  assert(slim and src, "missing " .. pair[1])
  local diff = {}
  for _, s in ipairs(slim.systems) do
    local o
    for _, t in ipairs(src.systems) do if t.system == s.system and t.systemIndex == s.systemIndex then o = t end end
    if not same(s, o) then diff[#diff+1] = names[s.system] .. (s.systemIndex and ("[" .. s.systemIndex .. "]") or "") end
  end
  print(pair[1] .. " differs from " .. pair[2] .. " only in: " .. table.concat(diff, ", "))
end
for _, s in ipairs(find(nil, PAIRS[1][1]).systems) do
  if s.system == Enum.EditModeSystem.AuraFrame then local a = s.anchorInfo print(string.format("AuraFrame[%d] %s %s %s %.1f %.1f", s.systemIndex, a.point, a.relativeTo, a.relativePoint, a.offsetX, a.offsetY)) end
end
print("db.sourceLayout:", tostring(SlimUIDB.sourceLayout), "layoutVersion:", tostring(SlimUIDB.layoutVersion))
Fire("PLAYER_LOGOUT")
print("snapshot errors:", #SlimUIDB.debug.errors, "frames:", SlimUIDB.debug.frames.SlimUI_player and "yes" or "no")
'''
run("ret spec on 1.0 SlimUI", user_layouts=REAL + 'PAIRS = { { "SlimUI dps", "dps" } }', active=5, script=SCRIPT)
run("holy spec on heals", user_layouts=REAL + 'PAIRS = { { "SlimUI dps", "dps" }, { "SlimUI heals", "heals" } }', active=4, script=SCRIPT)
