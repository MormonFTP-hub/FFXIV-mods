# SlimUI

A lightweight ElvUI-style UI for World of Warcraft (Interface 12.x). It adds unit frames, an action bar skin, chat, minimap and tooltip cleanup, and a matching Edit Mode layout. It never touches nameplates, so Plater and similar addons keep working.

## Install
Copy this `SlimUI` folder into `World of Warcraft\_retail_\Interface\AddOns\` and enable it on the character select screen. [Details](https://www.curseforge.com/wow/addons/details) is supported but optional.

## Commands
| Command | Does |
|---|---|
| `/slim install` | Applies the **SlimUI** Edit Mode layout and docks Details |
| `/slim move` | Unlocks the frames so you can drag them (again to lock) |
| `/slim reset` | Puts the frames back where they started |
| `/slim details` | Docks the Details windows in the right panel again |
| `/slim macro`, `/slim fade` | Toggle macro names on buttons and the micro menu/bag fade |

## Files
| File | Does |
|---|---|
| `Core.lua` | Settings (`SlimUIDB`), frame movers, slash commands |
| `Units.lua` | Player, target, target-of-target, focus and pet frames |
| `ActionBars.lua` | Skins the Blizzard action bars |
| `Chat.lua` | Chat frame cleanup |
| `Minimap.lua` | Square minimap |
| `Skins.lua` | Tooltip and aura skins |
| `Layout.lua` | Creates and applies the **SlimUI** Edit Mode layout |

The `SlimUI-dev` folder next door holds the offline test harness used while building it: copies of Blizzard's Edit Mode preset files and a small Lua harness that runs the layout code outside the game.
