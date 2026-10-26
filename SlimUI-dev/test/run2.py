from run import run
SCRIPT = r'''
Fire("ADDON_LOADED", "SlimUI"); Fire("PLAYER_LOGIN"); Fire("PLAYER_ENTERING_WORLD")
local ok, err = SlimUI.ApplyLayout()
print("apply:", tostring(ok), tostring(err))
if SAVED_LAYOUTS then
  local names = {}
  for k, v in pairs(Enum.EditModeSystem) do names[v] = k end
  local out = {}
  for i, l in ipairs(SAVED_LAYOUTS.layouts) do out[#out+1] = i .. ":" .. l.layoutName .. "/" .. l.layoutType end
  print("layouts:", table.concat(out, "  "), "active", SAVED_LAYOUTS.activeLayout)
  local L = SAVED_LAYOUTS.layouts[SAVED_LAYOUTS.activeLayout]
  for _, s in ipairs(L.systems) do
    local want = { ActionBar = true, ChatFrame = true, Minimap = true, ObjectiveTracker = true, MicroMenu = true, Bags = true, AuraFrame = true }
    if want[names[s.system]] then
      local t = {}
      for _, st in ipairs(s.settings) do t[#t+1] = st.setting .. "=" .. st.value end
      print(names[s.system] .. "[" .. tostring(s.systemIndex) .. "]", table.concat(t, " "))
    end
  end
end
'''
# user on a custom account layout "Mine" (copy of Modern), plus a character layout
USER = r'''
local modern = EditModePresetLayoutManager:GetCopyOfPresetLayouts()[1]
local mine = CopyTable(modern); mine.layoutName = "Mine"; mine.layoutType = Enum.EditModeLayoutType.Account
local char = CopyTable(modern); char.layoutName = "Alt"; char.layoutType = Enum.EditModeLayoutType.Character
USER_LAYOUTS = { mine, char }
'''
REAPPLY = USER + r'''
local slim = CopyTable(USER_LAYOUTS[1]); slim.layoutName = "SlimUI"
table.insert(USER_LAYOUTS, 2, slim)
'''
FULL = r'''
local modern = EditModePresetLayoutManager:GetCopyOfPresetLayouts()[1]
USER_LAYOUTS = {}
for i = 1, 5 do local l = CopyTable(modern); l.layoutName = "L" .. i; l.layoutType = Enum.EditModeLayoutType.Account; USER_LAYOUTS[i] = l end
'''
run("fresh on Modern", script=SCRIPT)
run("custom account+char, active=Mine", user_layouts=USER, active=3, script=SCRIPT)
run("re-apply existing SlimUI", user_layouts=REAPPLY, active=4, script=SCRIPT)
run("five account layouts", user_layouts=FULL, active=3, script=SCRIPT)
