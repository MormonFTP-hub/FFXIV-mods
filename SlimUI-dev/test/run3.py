from run import run, SCRIPT
COMBAT = r'''
COMBAT = true
Fire("ADDON_LOADED", "SlimUI"); Fire("PLAYER_LOGIN")
assert(not SlimUI.unitFrames.player, "frames must wait for combat to end")
SlashCmdList.SLIMUI("move")
SlimUI.Install()
assert(not SAVED_LAYOUTS, "layout must not apply in combat")
COMBAT = false
Fire("PLAYER_REGEN_ENABLED")
assert(SlimUI.unitFrames.player, "frames built after combat")
print("skinned hotkey after combat:", tostring(ActionButton1.HotKey:GetText()))
'''
run("combat reload", secret=True, script=COMBAT)
run("paladin secret (regression)", secret=True, script=SCRIPT)
