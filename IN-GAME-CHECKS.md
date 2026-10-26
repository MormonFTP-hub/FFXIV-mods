# In-game checks

What an offline scan of every `*/out/*.pmp` found on 2026-10-23, so you know what to look at when you check each mod in game. Fill in the **Result** lines as you go; later sessions read this file.

The scan read every model, material and texture in each pack. It did not run the game, so a flag means "look here", not "this is broken". Hero Chaos Chao (confirmed perfect in game) passes every check.

## What each problem looks like

| Problem | In game | Cause | Fix |
|---|---|---|---|
| **Metal** | The piece looks dark grey to near-black outdoors and shiny, and loses its colours. Gekko showed this. | The `_id` texture picks the colour table's metal row for most of the material. | Swap rows 0 and 1 in the mod's `tools/materials.py` (metal row second), or write `_id` G = 255 − metal. |
| **Mirrored** | Colours land on the wrong parts, or a pattern is flipped or repeated. Black Cat's white suit came out pink and black. | UVs outside 0..1 with samplers set to mirror (the `e0800` gear template does that). | Clear the low 4 bits of the sampler flags (wrap), or move the UVs into 0..1. |
| **Over 4 materials** | Part of the model is missing, or it doesn't load. | Penumbra's limit is 4 materials per model. | Atlas textures so fewer materials are needed. |
| **Black vertex colours** | The whole piece is pitch black, even in sunlight (Mantis 1.0.0). | Vertex colour set 0 is black. | None found in any pack now. |

Rule these out before blaming a mod:
- **Shade and night light.** Jotaro looked dark because he stood in shade. Peni looked duller than in the viewer because of the night lighting.
- **Another enabled mod with higher priority on the same files.** See [Conflicts](#conflicts).
- **Race.** Glamourer designs can switch your race through the clan.

`PmpViewer\PMP Viewer.exe` flags the metal and mirror problems per material when you open a `.pmp`.

## Colour lift, every mod (Oct 25)

The user, on Neon 1.2.0: "YES EVERY MOD SHOULD BE THIS KIIND OF SHADING. this like color intensity is what im looking for" / "i want you to go through every mod you've made and make this saturation change".

What changed:
- Every pack's colour maps got Neon's lift: luminance gamma 1.4 (dark and mid tones lifted most, hue kept), then saturation ×1.2.
- Not lifted: skin on `skin.shpk` (your skin colour tints it), hair coloured by customisation, normal/mask/`_id`/glow maps, lash and line-art cards.
- Each mod's texture step now applies it, so rebuilds keep it. The pre-lift pack is in `<Mod>/work/lift/before*.pmp`, with a GS before/after in `cmp_lift.png`.

New versions:

| Mod | Version | Notes |
|---|---|---|
| Neon | 1.2.0 | The reference |
| Nurse-Pool | 1.2.0 | |
| Peni Parker | 1.0.3 | |
| Invisible Woman | 1.2.0 | Lashes not lifted |
| Jubilee | 1.1.0 | Pinks reach full red in sun |
| Mantis | 1.2.0 | Line art not lifted |
| Luna Snow | 1.1.0 | |
| Black Cat | 1.1.0 | Hot pink in sun |
| Lady Loki, older (`LadyLoki/out`, `out_midlander`) | 1.1.1 | Also fixed: every colour-table row was 0.8 metal. Emerald, gold and teal now show |
| Viper | 1.1.1 | Also fixed: inverted metal `_id`, decal key. She was near-black; now mint, indigo and acid green |
| Mina | 1.2.0 | |
| Gregor | 1.1.1 | Also fixed: inverted metal `_id`. The coat was near-black; now blue, with a white shirt and red tie |
| Jak | 1.1.0 | |
| Griffith | 1.1.0 | Steel stays steel |
| Lich King | 1.1.0 | Eye mist not lifted |
| Sonic | 1.1.1 | Also fixed: inverted metal `_id`. He was near-black; now bright blue with red shoes. Super Sonic goes from brown to gold |
| Asuka (Langley, Plugsuit) | 1.2.0 / 1.2.0 | Suit at gamma 1.2 / sat 1.1 (full strength flattened the red). Also carries an unpacked face-colour change from an earlier Asuka session. Plugsuit 1.2.0 (Oct 25) re-shapes the collar onto your own neck (see the Asuka row below) |
| Sailor Moon | 1.2.0 | Hair 1.2/1.1 and body 1.15/1.1 (full strength went neon) |
| Aerith | 1.8.0 | Hair 1.2/1.2 (1.4 turned it tan-blonde); face skin unchanged |
| Cloud | 1.1.0 | |
| Jotaro | 1.2.0 | |
| Sora | 1.3.0, 2.0.0 | Hair 1.2/1.0 (1.4 went ginger). 2.0.0: clothes saturation 1.35 ("sat clothes a little more") |
| Don Quixote (full body, Viera outfit) | 1.2.0 / 1.1.0 (kept in 1.3.0 / 1.2.0) | Hair 1.4/1.0 (more saturation went lemon) |
| Hero Chaos Chao | 1.1.0 | Gentle: mostly white |
| Swift Spectral Tiger | 1.1.0 | Glow unchanged |
| Voidwing Dragonhawk | 1.3.0 | Glow rows unchanged |
| White Fox | 1.2.0 | Its own session |
| Lady Loki (`Loki/out`) | 1.4.0 | Its own session |
| Gekko | 1.2.0 | Main atlas and tattoo set (all character.shpk); also the nape fix. `Gekko/out/compare_colour_lift.png` |

Scratch-folder ports (each pack's original is in its `lift_before\` folder):
- OSRS Characters 1.2.0, ZOE2 Frames 1.4.0, Blitzcrank 1.1.0, Frank West 1.1.0, Olimar 1.1.0, Polygon Cloud 1.1.0, Solid Snake 1.1.0, Grace Ashcroft 1.1.0, Xal'atath 1.1.0.
- Jinx Cloud Tattoos 1.1.0: only the ink is lifted, your Bibo+ skin is unchanged.
- LCB Sinners 1.1.0: colour-table colours lifted, and the coats now read charcoal.
- The old scratch Lady Loki 1.1.0 still doesn't draw in game (broken material names; that was already so).

**Look at:** are the colours as bright as you want across mods, and is any of them too much (neon reds and pinks in full sun)? Any one mod can be toned down on its own.

**Result:**

## Flagged: check these

### Black Cat — Pink Purr (Marvel Rivals)
- **Equip:** Street set (`e6135`): Street Cap / Street Top / Street Handwear / Street Cargo Trousers / Street High-top Shoes. Works on every race.
- **Mirrored: seen in game on 1.0.1, fixed in 1.0.2** (built Oct 24). 1.0.1's materials sampled UV tiles u 1–4, v −1–0 with mirror samplers. 1.0.2 moves every triangle into 0..1, and also drops the rip's occlusion, which had darkened her face. In the PMP Viewer's game shaders, 1.0.2 now matches the source render: pink gloves, white chest, white boots, checks in place, cheek mark on her right cheek (`BlackCat/work/gs/cmp_new.png`). The viewer lists no problems.
- **Look at (1.0.2):** suit colours as in the source: silver-white top with pink panels, pink gloves, pink trousers with white checks, white boots. Is the face a light tan, with the dark mark on her right cheek?
- **Result:**

### Gekko (Valorant)
- **Equip:** Alternative set (`e6229`): Alternative Cap / Alternative Shirt / Alternative Leather Bracelets / Alternative Trousers / Alternative Spiked Shoes.
- **Metal, already seen in game** (near-black outdoors): Shirt material b 100%, Cap material a 96%. With the full-body ports, the head slot carries the character's head and hair.
- **Result (1.0.x):** near-black outdoors (the user's report, Oct 23).
- **1.1.0 (Oct 25), from comparing the source with GS** (`Gekko/out/compare_source_vs_gs.png`):
  - `_id` green is now 255 − metal (no material picks the metal row). The real metal (buckles, clips) uses a glossy non-metal row; a metal row rendered them near-black in GS.
  - Fingers are rooted on the FFXIV knuckles. At the game's idle they had crumpled into a lump.
  - The neck and the back of his head are pushed out until they cover the wearer's own neck and skull. In GS the wearer's skin showed behind his ear, down the middle of the nape, and through his hair for Midlander, Highlander and Roegadyn women. Hrothgar are left out: a band at the nape still shows on them.
  - His head casts no shadow: its hair shadowed itself in thin lines.
  - The decal key is off on every material.
  - The viewer reports no problems on any race.
- **Look at (1.1.0):**
  - Outdoors in sun and shade: green vest, purple trim, brown plaid, warm brown skin (not dark)
  - Buckles and clips silver
  - Do the fingers curl naturally at idle?
  - Behind his ears and at the nape: any of your own (lighter) skin? Your Midlander face mod's demon ears will poke out behind his ears; the face-hider option covers them.
- **Result 1.1.0 (Oct 25):** colours fixed (no longer dark), but a dark crease ran along the underside of his jaw, with the neck wider than the jaw (the user's screenshot, Mister Wonderful design: Midlander woman, face 5). GS reproduced it.
- **Cause:** the neck cover pushed the side of the neck out up to 3 cm for every woman, because the Miqo'te and Au Ra faces' cheeks, jaws and irises came out at the sides of the neck in its measurements: the face's own expression bones (j_f_*) weren't carried through the racial deformer. The push also reached the underside of his jaw, which then stepped out.
- **1.1.1:** expression bones follow the head in the measurement (women's side push 30 mm to about 1 mm), the push fades out on his jaw and skull (by his own head weight), and Hrothgar are left out of the neck cover too.
- **Look at (1.1.1):** a clean jaw line from the front and the sides, no crease under the chin.
- **Result 1.1.1 (Oct 25):** jaw fine; the back of the neck flared out (the user's side-view screenshot).
- **Cause:** the neck cover pushed the nape out to the thickest race on the fit (Roegadyn and Au Ra women), plus a smoothing bug that dragged the skull-base need down the whole nape: 10-20 mm past a Midlander woman's own neck.
- **1.2.0:**
  - The neck-cover need spreads only round the neck. Roegadyn women, Au Ra women and Highlander men are left out of the neck cover (a strip at the nape; the face hider covers it). The nape is now 4-5 mm outside the Midlander woman's own neck.
  - Neck skin is skinned like vanilla necks (Elezen women's nape show-through 2,669 px to 64).
  - Highlander men have their own fit (EQDP own): left out of the shared neck cover, their whole nape showed (9,461 px in GS), and including them flared every man's nape.
  - The colours get Neon's lift (requested for every mod).
- **Look at (1.2.0):**
  - Side view: does the back of his neck still look flared?
  - Brighter, more saturated colours, as on Neon 1.2.0
- **Result 1.2.0 (Oct 25):** the user said "thats good" (not stated whether checked in game).

### Neon (Valorant)
- **Equip:** Critical Hit B Tour set (`e6222`): Critical Hit B-1 Tour Headset / Top / Halfgloves / Breeches / Longboots. The B-2 Tour set changes too.
- **Metal: found on 1.0.1, fixed in 1.1.0** (built Oct 25). 1.0.1 had 86–100% of every material on the metal row (`_id` green inverted), and GS drew her near-black. 1.1.0 fixes the `_id`, makes the second row a glossy non-metal, turns the decal key off, roots her fingers on the FFXIV knuckles (the idle curl had folded them into her palm), and pushes the back of her head out over the wearer's skull, which showed between her buns from behind. In GS, 1.1.0 matches the source render from the front, back, side and three-quarter (`Neon/work/gs/cmp_*.png`).
- **Look at (1.1.0):** tan skin, blue hair with yellow underlayers, navy suit, matte pale-gold plates. Do the fingers hang relaxed at idle? From behind, is there any skin between the buns?
- **Your Abigail face:** its Elf Ears (`atrx_ears`) stick out of her hair, and the headset can't hide them. Set Abigail's "Ears/Horns – Options" to None while wearing Neon, or turn on Neon's "Hide your own face" with Neon above Abigail in priority.
- **Result:** 1.1.0, Oct 25, at night in a Halloween-decorated housing ward: "really good, i want brighter colors though". No ears, no skin showing between the buns, and the hands looked fine in the screenshot. The suit and hair read dark at night, so 1.2.0 lifts the colour textures: gamma 1.4 on luminance plus 20% saturation, body and hair only. In GS's dim light, the figure is about 40% brighter.
- **Look at (1.2.0):** same spot at night. Is the suit navy rather than near-black, and the hair a clear blue? Does the skin still look natural?

### Viper (Valorant)
- **Equip:** Scientist's set (`e9233`): Scientist's Monocle / Coat / Gloves / Breeches / Boots.
- **Metal:** Monocle materials a 64%, b 100%, c 100%. That's her head and hair.
- **Fixed in 1.1.1 (Oct 25):** `_id` green inverted as in Neon 1.1.0, glossy non-metal second row, decal key off, plus the colour lift. The viewer reports 0 problems. In GS she went from near-black to mint, indigo and acid green (`Viper/work/lift/cmp_lift.png`).
- **Look at (1.1.1):** suit colours outdoors, not dark.
- **Result 1.1.1 (Oct 25):** the user said "looks really good".
- **Still open (seen in GS on 1.0.1, not fixed in 1.1.1):** the wearer's own neck showing as a skin-coloured patch at her nape and behind the jaw when posed. Look at the back of her neck turning the camera round her.

### Nurse-Pool (Marvel Rivals)
- **Equip:** Housemaid's set (`e6016`): Housemaid's Brim / Apron Dress / Wristdresses / Bloomers / Pumps. The Loyal Housemaid's set changes too.
- **Metal, 100% each in 1.0.x: fixed in 1.1.0** (built Oct 25). Every colour-table row is plain now, so nothing can pick metal. 1.1.0 also switches the samplers to wrap (the gear atlas runs past u = 1, so mirror would have flipped parts of it), drops the rip's baked occlusion, brightens the bare skin 1.5×, re-bakes the wig, roots the fingers on the FFXIV knuckles and covers the neck. In the PMP Viewer's game shaders, 1.1.0 now matches the source render (`NursePool/work/gs/cmp_after_full.png`; 1.0.1 was near-black).
- **Look at (1.1.0):** white dress, red mask with a white lens on his right eye, golden-blonde wig, pink scarred skin, teal gloves, dark fishnets, red heels. Fists close normally in idle (no claws).
- **1.3.0** (Oct 25, you asked for brighter colours): stronger colour lift on the outfit and wig (gamma 1.6, saturation 1.3), and the bare skin moved to the game's skin shader with his own colour, so it shouldn't go grey in shade. In GS it's 10% brighter than 1.2.0 in sun and 12% in shade (`NursePool/out/brightness_1.3.0.png`). **Look at:** does the skin stay warm pink out of the sun? Is the outfit bright enough now, or too washed out?
- **Result:**

### Sonic the Hedgehog (Sonic Forces)
- **Equip:** Werewolf set (`e6047`): Werewolf Head / Body / Arms / Bottoms / Feet.
- **Metal:** Head material a 98%.
- **Mirrored:** Head material b, 12 meshes (all races), UVs u −0.3–1.3, v −1.16–−0.26.
- **Look at:** his head (dark, and something flipped on part b).
- **Metal fixed in 1.1.1 (Oct 25):** `_id` green inverted. Only the gold shoe buckles stay metal. In GS he went from near-black to bright blue, with a tan muzzle, white gloves and red shoes, about 3.4× brighter (`SonicForces/work/lift/cmp_lift.png`). The eye's mirrored UVs are left as they are: in GS the irises draw in place.
- **Look at (1.1.1):** bright blue, not dark; Super Sonic gold; the irises sit in the right place.
- **Result:**

### Gregor AEDD (Limbus Company)
- **Equip:** Wake Doctor's set (`e6148`): Mask / White Coat / Rubber Gloves / Bottoms / Shoes. Outfit only: you keep your own head. Built for male races except Lalafell.
- **Metal:** White Coat materials a 99%, b 98%. Expect a dark coat.
- **Fixed in 1.1.1 (Oct 25):** `_id` green inverted (real metal stays metal: glasses frame, buckles, bolts), plus the colour lift. The centipede's vein row is now only on the veins. In GS the coat went from near-black to blue, with a white shirt, red tie and grey trousers (`Gregor/work/lift/cmp_lift.png`).
- **Look at (1.1.1):** a blue coat, not dark. With "Glowing eyes and veins" on, only the veins glow.
- **Result:**

### Lady Loki — Seaside Siren, older outfit pack (`LadyLoki/out`)
- **Equip:** Summer Sunset set (`e6137`): Bandana / Beach Cover-up / Wrist Torques / Bottoms / Sandals, plus the **Omega Rod**. Needs Bibo+; women of c0201-based races only.
- **Metal, 100% each:** Cover-up materials a and b, Bandana a, Bottoms a, and the staff.
- **Mirrored:** the wrist torques model uses the cover-up's two materials with UVs below 0 (v −0.99–0).
- **Metal fixed in 1.1.1 (Oct 25), both packs:** the template's row 0 (0.8 metal) had been copied into all 32 colour-table rows. Metalness is now 0, plus the colour lift. In GS the emerald swimsuit and skirt, gold tiara and peacock earrings read now (`LadyLoki/work/lift/cmp_lift.png`). The mirrored torques are unchanged.
- **Result:**

### The Lich King (WoW)
- **Equip:** Archfiend set (`e0757`): Helm / Armor / Gauntlets / Breeches / Sabatons, plus **Deathbringer** on Dark Knight for Frostmourne.
- **Metal:** every piece 63–67%, Frostmourne 100%. Much of this may be real armour metal: check the cloth, fur and skulls aren't dark too.
- **Mirrored, barely:** Helm material c, UVs −0.03–1.07, so at most thin seams at texture edges.
- **Result:**

### Griffith (Reborn)
- **Equip:** Hellhound set (`e0110`), any of Hellhound / Grey Hound / Shadowhound: Helm / Armor / Gauntlets / Cuisses / Sabatons. Hyur Midlander male, face 1, hairstyle 1.
- **Metal:** all five pieces, material a, 81%. May be intended armour metal: check the cape and cloth parts aren't dark.
- **Result:**

### Sora (KH3)
- **Equip (2.0.0):** Air Cell set (`e0907`): Hood / Jacket / Armlets / Halfslops / Shoes, hood shown, any race (the Glamourer design in `SoraKH3/out` puts it on). Until 1.3.0: Hyuran set (`e0084`) on a Hyur Midlander man with face 1 and hairstyle 1.
- **1.1.0 (Oct 24), from comparing the source render with GS.** All three earlier flags are fixed:
  - 1.0.0 shipped vanilla placeholder models that needed six manual glTF imports. 1.1.0 ships the real models.
  - The breeches' metal row is now a glossy non-metal row; in GS full metal turned the buttons, zipper, chain and crown near-black.
  - The face has 2 materials, down from 5.

  Also fixed in GS:
  - the fringe's sun-shadow stripes over his eyes (the hair casts no shadow now)
  - at idle, the jacket lining poking through the lapels and the belt strap sliding over the jacket hem
  - fingers rooted on FFXIV's knuckles

  In GS the pack matches the source render (`SoraKH3/out/compare_source_vs_gs.png`), and the viewer reports no problems on any race.
- **Look at (1.1.0):**
  - Buttons pale gold, chain and crown bright silver (not dark)
  - No stripy shadows on his face
  - Standing idle and in `/cpose`: is the jacket front clean at the lapels and the belt?
  - Do the fingers curl naturally?
  - Hair a medium chestnut brown
- **Result 1.1.0 (Oct 24):** the face, eyes and hair were dark grey-brown (face about RGB 40/34/30).
- **Cause, reproduced in GS:**
  - Your "Mister Wonderful" design keeps face paint 3 in black at 93%, and the game binds it as the face model's decal.
  - Sora's materials had `character.shpk`'s decal (crest) key on, copied from a body template.
  - Face paints are BC4 masks (alpha 1), so the paint colour covered the whole face and eyes.
- **1.1.1** turns the decal key off on every material (`0x4242B842`, as vanilla hands/legs/feet).
- **Same problem, fixed (Oct 24):** Griffith 1.0.2, Jak 1.0.2 and Jotaro 1.0.1 turn the key off on every material. With face paint 3 in black, GS turned the old builds' faces black: Jak's face and ears, Jotaro's face and cap (part of his face model), Griffith's face inside the helmet. The new builds render normally. That's probably Jotaro's "dark face" too.
- **Look at (Griffith 1.0.2, Jak 1.0.2, Jotaro 1.0.1):** with your character's face paint on, is the face skin-coloured and is Jotaro's cap white?
- **Result:**
- **Look at (1.1.1):** with your design's face paint still on, is Sora's face peach and are his eyes blue?
- **Result 1.1.1 (Oct 24):** the user said "that worked": the face is no longer dark in game.
- **1.2.0 (Oct 25), after "Sora kinda looks funky" next to Aerith.** Cause, found in GS: Aerith's face is on the game's skin shader (`skin.shpk`) and her hair on `characterlegacy.shpk`; Sora's skin and hair were on the gear shader (`character.shpk`). Lit from behind, his skin went grey-tan and dim, while vanilla skin stays warm. His hair read as matte clay with white streaks. 1.2.0 puts his face, neck, arms and legs on `skin.shpk` (your skin colour tints it; the design sets a light peach and no face paint) and his hair on `characterlegacy.shpk` (Aerith's recipe).
- **Look at (1.2.0):** in shade and indoors, does his face stay warm skin-coloured rather than grey? Do his face, neck, arms and legs match? Is the hair warm chestnut without white streaks? Re-apply the Glamourer design (it now sets skin colour and clears face paint).
- **Result 1.3.0 (Oct 25, in-game screenshot):** "face and skin good hair too"; asked for slightly more saturated clothes, a slightly smaller head, and Sora on every race, not only Midlander men.
- **2.0.0 (Oct 25):**
  - It's a full-body costume on the **Air Cell set** (`e0907`): Hood / Jacket / Armlets / Halfslops / Shoes, hood shown. His head is the hood model, so it works on every race, face and hairstyle.
  - Fitted to the Midlander man, Midlander woman, Roegadyn man and Lalafell; the other races are reshaped by the racial deformer.
  - Head 10% smaller (as small as your own face allows), clothes saturation 1.35, and his skin keeps its own colour on every race.
  - Delete the 1.x mod first (it replaced the Hyuran set and Midlander male face 1 / hairstyle 1). Re-apply the new Glamourer design.
- **Look at (2.0.0):**
  - On your usual character and at least one other race: does any of your own face, ear, horn or hair poke out of his head, from the front, side and behind? (Turn on **Hide your own face** if it does.)
  - Is the head size right now?
  - Are the clothes colours where you want them?
  - Do the face and skin still look like 1.3.0?
- **Result:**

### Don Quixote (Limbus Company) — full body + Viera male outfit (`DonQuixote/`)
- **Equip (full body, `DonQuixote.pmp`):** Taoist's set (`e0359`): Cap / Shirt / Gloves / Slops / Shoes, on a Midlander woman. Your "Mister Wonderful" design works (automation applies it to Mormonftp Aihara).
- **Equip (outfit, `DonQuixote_Outfit_VieraMale.pmp`):** Taoist's Shirt / Slops / Shoes on a **Viera man** only. Other races keep the vanilla Taoist's look.
- **Result 1.0.0 (Oct 24):** her face, neck and hands came out grey-white, with a brown-grey band down the neck, and the hands looked weird. The outfit mod "didn't change anything".
- **Cause, reproduced in GS:**
  - **Skin:** her anime texture is lit by the gear shader. Its very pale skin reads flat grey, and the neck is painted in a dark shadow tone.
  - **Hands:** her fingers were stretched and re-weighted rather than rooted on the game's knuckles, so they crumpled in idle (the Mantis/Asuka finger lesson). The thumb was off by 20 mm.
  - **Outfit:** your screenshot was the Midlander woman, because Glamourer automation applies "Mister Wonderful" to Mormonftp Aihara. The outfit only changes Viera men, as designed.
- **1.1.0 (full body)** puts her face, neck and hand skin on `skin.shpk` (your skin colour) with the neck lifted to her face's tone. It also roots fingers and the thumb on the knuckles and adds arm twist helpers. The outfit pack got the same arm weights (1.0.1).
- **Checked in GS** (Mister Wonderful design, idle, Day):
  - Her cheeks are RGB 174/121/99 against your own face's 176/126/105.
  - Neck and face are one tone, with no band and no seam line down the neck's centre.
  - The hands curl naturally, with no blotches.
  - `check_pmp.py` reports 0 errors on all races.
  - The outfit renders on the "Mormonftp Aihara" Viera design: Penumbra loads all 3 EQDP entries; c1701 top/dwn/sho come from the mod and every other race from the game.
- **GS caveat:** GS draws your own face through hers. The game hides it (your 1.0.0 screenshot shows only her face), so leave "Hide your own face" off unless it shows in game.
- **Look at (1.1.0):**
  - Is her neck the same tone as her face, with no band?
  - Do her face and hands look like skin (your tone, a little lighter) rather than grey?
  - Standing idle: do the fingers curl naturally, with no crumpled knuckles or twisted thumb?
  - Outfit: switch to the Viera man (turn off the automation, or apply the "Mormonftp Aihara" design) and wear the Taoist's Shirt, Slops and Shoes.
- **Result 1.2.0 (Oct 25):** "why i run the butt clips through" (screenshot from behind, running: a dark patch across the back of the coat).
- **Cause, reproduced in GS** with the game's run animation:
  - Her trousers' butt was 84% on the thighs (vanilla legs: `j_kosi` above the hip joint), so it swung back through the coat.
  - The coat chains bent 5-11 cm away from the game's skirt joints, and the shell and red lining split their weight between panels differently, so the front flaps folded into the legs and the lining showed through.
  - The two-sided clothes material drew the shell's inside through gaps in the lining when the tails flipped.
- **1.3.0 (full body) / 1.2.0 (outfit):**
  - butt weighted like vanilla legs
  - coat weighted by position on the game's own skirt chains, like the vanilla Taoist's robe
  - lining rides the shell
  - clothes one-sided

  In GS (`DonQuixote/work/compare_run_1.2.0_vs_1.3.0.png`) running from behind, the side and rear three-quarter, walking and idle are clean, and so is the Viera outfit running. `check_pmp.py` reports 0 errors.
- **Look at (1.3.0 / 1.2.0):**
  - Run, sprint and stop: no dark patches through the back or front of the coat.
  - Do the coat tails swing naturally?
  - Does anything look missing when you look inside the open coat? (The clothes are one-sided now.)
- **Result:**

### Voidwing Dragonhawk (Company Chocobo)
- **Summon:** the Company Chocobo (or the Legacy / Black / Draught chocobos, or the chocobo companion).
- **Metal:** chocobo legs-slot material b (`mt_d0001e0001_dwn_b`) 74%. Fixed in 1.2.0 (Oct 24): gold 0.6 and steel 0.45 metalness, and the viewer flags nothing.
- **Also:** 1.0.0 was invisible when ridden; 1.1.0 should fix that but isn't confirmed.
- **1.2.0 (Oct 24), matched to the WoW source in GS:**
  - single-sided like WoW: the backs of the tail and wing feather cards had rendered black;
  - `_id` G inverted to the game's meaning: before, the feathers took the glowing row everywhere;
  - steel plates darkened to WoW's slate;
  - no black fringes at distance.
  - **Look for:** blue glow only on the feather edges, eye and gems (GS can't show colour-table glow); feather edges at a distance.
- **Result:**

## Clean on these checks

No metal rows, at most 4 materials, no mirrored UVs, no black vertex colours. What's left is each README's own list of limits.

| Mod | Equip | Notes |
|---|---|---|
| **Hero Chaos Chao** | Summon Mammet #001 | Confirmed perfect in game (1.0.1). |
| **Mantis — Dreamy Dew** | The Warden's set (`e6211`) | 1.0.1 confirmed rendering correctly in game, after 1.0.0 was pitch black.<br>1.0.3 (Oct 24, from comparing source vs GS) fixes two things:<br>• the camisole was grey with dark streaks; it had the robe's ORM map<br>• fingers stuck out as dark claws whenever the game bent them; they now bend at FFXIV's finger joints<br>In game, check:<br>• the camisole is white and clean<br>• the fingers look normal at idle, in emotes and when holding a weapon<br>**Result:** |
| Aerith | Spring Dress set (`e0141`), Bibo+, women | Legacy shader, like the Chao. 1.1.0 (Oct 23), tuned in the PMP Viewer: chestnut hair, a painted scalp under the strands, an A-line skirt drape and real gloss. 1.2.0 (Oct 23) fixes the gap between the sleeves and the bracelets, and the knee gap under the skirt (the gloves and boots no longer hide body skin). It also adds the Face option: her face replaces every Midlander woman's face 1-5.<br>**Result 1.2.0 (Oct 23):** the user said it "looks really good". The Face option showed on their Midlander woman, but the face was flat, grey and hazy, and the hair olive-green and streaky ("fix the lighting and hair").<br>1.3.0 fixes:<br>• legacy `_s` is a specular colour, and G = gloss had made the highlights green<br>• the face skin's vertex colour red is now 0, as on vanilla faces; red = 1 is body-style shading<br>**Result 1.3.0 (Oct 23):** "really close". The hair was brown and neutral (fixed). The face was "doing weird lighting things": bright patches on the forehead, nose and under the eyes, a blotchy band under the jaw, and slightly dark overall. The tattoos are the user's own mod.<br>1.4.0 fixes:<br>• face specular and roughness set near vanilla (0.62 / 0.46) with a quarter of FF7R's variation<br>• neck and unused texels get flat normals and the body's skin base<br>• hair 12% and face 6% lighter<br>**Result 1.4.0 (Oct 23, daylight):** "even worse... looks like she has shit on her face". The face was grey-green with brown smudges on the cheeks and around the eyes.<br>Cause:<br>• FF7R's albedo has painted shading and blush (wide eyeshadow, blotchy cheeks and jaw), which the game multiplies by the skin colour<br>• its normal map has 2.6x vanilla's fine bumpiness<br>1.5.0 keeps 35% of the broad skin variation (lips and brows kept in full) and 35% of the fine normal detail, which lands on vanilla's numbers.<br>**Result 1.5.0 (Oct 23):** a grey face with salmon-pink patches on the forehead, under the eyes, beside the nose and specks on the cheeks ("do you see the shading differences").<br>Root cause, present since 1.2.0: skin.shpk `_mask` red picks the skin material in steps of 17. Vanilla faces and Bibo+ use exactly 165 (-> 10); her skin sat at 148-158 (-> 9, grey), and only the glossy T-zone reached 165.<br>1.6.0 sets mask R = 165 and B = 156 (vanilla's constants); only G carries roughness.<br>**Result 1.6.0 (Oct 24):** the face was still grey at full-body distance with salmon patches. The user compared GS against the game: "doing hella good".<br>Real causes, found in GS: (1) every mip of the face `_norm` from 512 px down was zero (texconv weighted colour by alpha = 0), so there was no skin tint at distance; (2) scalp-cap patches over the brows, eyes, nose and lips z-fought the face; (3) the fringe cast shadows. The mask R theory was wrong: R is specular.<br>1.7.0 fixes all three and restores FF7R's skin detail.<br>**Result 1.7.0 (Oct 24):** "looks really good when it's working", but sometimes the face was invisible until the user swapped faces. Dalamud log: Penumbra "Failed to asynchronously load resource" for `face/f0002|f0005/material/mt_c0201f000N_aerith_*.mtrl`. The game substitutes the character's face id into the material path; only f0001's copies shipped. 1.7.1 ships all four materials for faces 1-5.<br>In game, check:<br>• the face shows on every face 1-5 without swapping<br>• the whole face is skin-coloured at every camera distance, with no grey areas or patches<br>• no hair shadow on the face<br>• no smudges in daylight<br>• the face is evenly lit, with no shiny T-zone<br>• no seam or blotches under the jaw<br>• the face matches the neck<br>• no skin shows at the parting<br>• the back of the skirt falls straight when walking<br>• the forearms are whole<br>• she blinks and talks |
| Asuka | Magitek set (`e6164`) | 1.1.0 (Oct 24, from comparing source vs GS) fixes four things:<br>• your own neck showed through as a pale patch behind her jaw, under the ear (her anime neck is slimmer than FFXIV's); her neck and collar now cover it<br>• her fringe threw a hard shadow band across her eyes; the head casts no sun shadow now<br>• the suit, hair and face were far more matte than the glossy source<br>• the thumb crumpled in the idle pose; fingers and thumb now bend at FFXIV's finger joints<br>In game, check:<br>• no skin-coloured patch behind her jaw or under the ears, standing and turning the camera, and on an Elezen or Roegadyn (long necks)<br>• no dark band or bangs shadow across her eyes in sunlight<br>• the suit has sharp latex highlights and the hair a sheen<br>• the fingers and thumb look natural at idle, in emotes and holding a weapon<br>• whether the thicker neck under her chin reads as natural skin or as a dark band<br>**Result 1.1.0 (Oct 24):** her face came out ugly: pale grey-white, like porcelain. Her AI skin texture was paler and greyer than FFXIV skin, and the game greyed it further, with a gloss sheen on top. 1.2.0 tones her skin to a vanilla face's colour in the same light and makes the face matte again. The user also asked for the suit alone with their own head: **Asuka Plugsuit (Evangelion)**.<br>**Result Plugsuit 1.1.0 (Oct 25):** "fix the neck. other than that its alright". A black band showed between their chin and the collar's navy rim: the collar was an open tube 2-5 cm in front of the throat, built round Asuka's neck. Plugsuit 1.2.0 shrink-wraps the collar onto the wearer's own neck, up to just under the jaw. Miqo'te women, Au Ra women and Highlander men get their own models because their necks are thicker.<br>In game (Plugsuit 1.2.0), check:<br>• the collar hugs your neck like a turtleneck, with no black band or gap under the chin, from the front and from above<br>• none of your neck skin pokes through the red collar when you turn your head or emote<br>**Result:** |
| Cloud Strife | Strife set (`e0263`), Midlander male | Legacy shader. Replaces every Midlander male face and hairstyle by default. |
| Invisible Woman | Valentione Rose Ribboned set (`e6098`) | 1.1.0 (Oct 24), matched to the psylocke.gg original in the PMP Viewer's game shaders: the `_id` glow was inverted (would have glowed everywhere but the roses), the gold was dull, the hair lavender-grey. The glow can't be seen in GS (it draws no `character.shpk` colour-table glow, even on vanilla e0847), so check it here.<br>In game, check:<br>• the rose petals, the thorn veins and the collar gem glow soft cyan, and nothing else glows (no cyan or purple wash over the hat, boots or capelet)<br>• the gold (hat emblem, collar, belt, boot caps) reads bright gold, not black<br>• the hair is indigo-violet, not grey<br>**Result:** |
| Jak | Scion Rogue's set (`e6027`), Midlander male, face 1 / hairstyle 1 | |
| Jotaro | The Emperor's New set (`e0279`), Midlander male, face 1 | Looked dark in game. That was put down to shade, but 1.0.0's face materials also took the character's face paint colour (fixed in 1.0.1, see the face paint section).<br>1.1.0 (Oct 25): his face, ears, neck and hands are on the game's skin shader (`skin.shpk`), as Aerith's face is. On the gear shader his skin went dull and dark out of the sun (GS, backlit). Your skin colour now tints his skin; a light or tan Midlander swatch suits him.<br>In game, check: in shade and indoors, is his face warm rather than dark? Do the face and hands match? Is the cap still white?<br>**Result:** |
| Jubilee | Pajama set (`e6169`) | |
| Lady Loki, full body (`Loki/out`) | Summer's Flame set (`e0666`) | 1.1.0 (Oct 24, from comparing source vs GS):<br>• new **Headpiece** and **Jewellery** options, as in the game's Customize menu. 1.0.0 stacked all three headpieces and all three jewellery sets; the default is now the horned crown and the gold set<br>• fingers bend at the FFXIV knuckles (they kinked mid-finger in idle)<br>• eyes half-lidded under a baked eyelid shadow, as in the original<br>• her neck covers your own neck (a sliver showed under the ear)<br>• no occlusion on the body (about 10% brighter); decal key off on every material (the Sora face-paint fix)<br>In game, check:<br>• each Headpiece option shows only that piece, and None shows just her hair<br>• each Jewellery option swaps earrings, bracelets and anklets together<br>• no skin-coloured sliver at the side of her neck, turning the camera round her<br>• fingers curl naturally at idle (fingertips may dip into the skirt hem)<br>**Result 1.1.0 (Oct 24):** the user's screenshot: face ugly (dark rings round the eyes, glowing cyan irises, gaunt), skin too dark overall. Reproduced in GS daylight.<br>1.2.0 (Oct 24): no baked occlusion (it doubled the game's own round the eyes), matte eyes with the iris at its texture colour, the face's grey-teal paint strokes blended into the skin, skin textures 1.4× brighter.<br>In game, check: no dark rings, eyes green rather than glowing, skin brighter than 1.1.0 and the face as bright as the body.<br>**Result 1.2.0 (Oct 25):** the user's shot in dim light: "why's she still look ugly. also the head i big". Her skin read grey and flat out of the sun.<br>1.3.0 (Oct 25): face and body skin on `skin.shpk` (vanilla skin shader, her own tan kept, 1.15× brighter), head about 9% smaller with the back of her head and hair pushed out to keep covering your own head, and brighter, more saturated hair and outfit (Neon's colour lift).<br>In game, check: her skin stays warm in shade and at night, the head looks in proportion, and nothing of your own head shows from behind or the side.<br>**Result 1.3.0 (Oct 25):** the user: "doesnt the head still kinda look weird to you?" In GS: her eyelids sat half shut (the source face rig's bind pose has them closed) and the colour lift had turned her black hair grey-teal.<br>1.4.0 (Oct 25): face posed from her lobby idle (`tools/expression.py`): open eyes, half her smirk; hair black again (saturation boost only).<br>In game, check: eyes open with no gap or seam round the lids, the smirk with no pale smudges by the mouth, hair near-black.<br>**Result 1.4.0 (Oct 25):** the user: "body is good face is whatever but good enough". Accepted; no open issues. |
| Luna Snow | Cosmic Explorer's set (`e6252`) | |
| Mina | Alternative set (`e6264`, the dress one) | 1.1.0 (Oct 24), compared in GS with Valve's in-game model on the Deadlock wiki. Changes: the eyes no longer glow (1.0.x lit the whole eyeball red), the head casts no sun shadow (the fringe striped her eyes), the materials are more matte, and there's a new **Overskirt** option. The default, "Hangs clear of the hands", keeps your hands visible in idle; "Flared, as in Deadlock" hides them. The user asked for a smaller, cuter head. That's the new **Head size** option. "Deadlock size" (the default, at the user's choice) has her Deadlock proportions and a slimmer bob, but blanks every player face in the collection, even without the set on. "FFXIV size" stays big because it must cover your face; at 1.00, the Abigail - Demon face's elf ears and jaw poked through in GS.<br>In game, check:<br>• dark-red irises, white sclera, no glow<br>• no hair shadow on her face<br>• FFXIV size: your face, Abigail's ears included, stays inside her head (Au Ra horns and jaw scales show, 3-7%)<br>• Deadlock size: no face shows, and her ears stay under the bob<br>• both Overskirt options, standing and running<br>**Result:** |
| Peni Parker | Night of Devilry set (`e6191`) | Duller than in the viewer, which was the night lighting.<br>1.0.2 (Oct 24, from comparing source vs GS) fixes three things:<br>• your own neck showed through her choker as pale bands at the nape, under the ear and at the throat (the game face model carries the neck)<br>• fingers stayed straight and stuck out when the game curled them (her knuckles sat 3 cm off FFXIV's; same fix as Mantis)<br>• Roegadyn men now have their own fit, and Hrothgar men wear it. Before, the deformer misplaced her head and 42% of the wearer's face showed.<br>In game, check:<br>• the back and sides of her neck are solid black choker, with no skin-coloured band, standing and turning the camera<br>• the fingers curl naturally at idle, in emotes and when holding a weapon<br>• on a Roegadyn or Hrothgar man, the whole outfit and the thicker choker<br>**Result:** |
| Sailor Moon | Neo Queen's Tiara + Educand's Sailor Top, Skirt and Loafers (`e6257` + `e6162`) | Made from an unpainted 3D-print STL: the colours, eyes and rig are all the port's own.<br>1.1.0 (Oct 25, from comparing source vs GS) fixes:<br>• your own neck showed through at the nape and under the ears; her neck and choker now cover it<br>• paint leaks: collar blue over both puff sleeves and the chest side, skirt blue down the back of the left thigh, boot red up the right calf, the bow's red on the pleats, a jagged red fringe at the nape<br>• her bangs threw a hard shadow over her face; the head casts no sun shadow now<br>• hair crevices were too dark (half-strength baked occlusion)<br>• crest decal key off on every material (the Sora face-paint fix)<br>In game, check:<br>• no skin-coloured patch at the nape or under the ears, turning the camera round her, also on an Elezen or Roegadyn woman (long necks)<br>• white puff sleeves, blue sailor collar, red choker with a straight top edge<br>• no shadow stripe across her eyes in sunlight<br>• the inside of her left forearm (a seam where the print fused it to the skirt)<br>• the pigtails at idle and when running<br>**Result:** |
| Swift Spectral Tiger | Any chocobo mount | Replaces the skeleton and animations, so watch how it moves. |
| White Fox — Pink Paws | Island Resort set (`e6173`) | 1.0.1 made vertex colours white (1.0.0 would have been pitch black).<br>1.1.0 (Oct 25, from comparing source vs GS) fixes:<br>• face and skin too dark, irises glowing amber: no baked occlusion, matte eyes, iris at its texture colour, skin 1.4× brighter (the Lady Loki 1.2.0 fixes)<br>• eyes wide open: the original's eyelid shadow is baked in, so she looks half-lidded<br>• fingers bend at FFXIV's knuckles; on Roegadyn men the thumb no longer stretches into a web towards the wrist<br>• her neck covers your own neck<br>• crest decal key off on every material<br>In game, check:<br>• her face in daylight is warm and as bright as her body, no dark rings, eyes not glowing (the hat brim's shadow over her eyes is normal)<br>• no skin-coloured sliver at the side or back of her neck, turning the camera round her<br>• fingers and thumb look natural at idle, in emotes and holding a weapon, also on a Roegadyn or Hrothgar man<br>• the three tails stay behind her and don't cut through the legs when running<br>**Result 1.1.0 (Oct 25):** the user's screenshot, out of the sun: it renders correctly, but "why head big also colors should be brighter".<br>1.2.0 (Oct 25) fixes:<br>• head (and hat) at her own size on the women's fit, 1.0× instead of 1.08×, with the eyes placed so your face stays covered<br>• face and body skin on the game's skin shader (`skin.shpk`), so it no longer goes grey out of the sun; it takes your character's skin colour<br>• Neon 1.2.0's colour lift on the swimsuit, jacket, hair, tails, hat, flowers and jewellery<br>In game, check:<br>• the head and hat look in proportion to her body<br>• her skin is warm in shade and indoors, and matches your character's skin colour<br>• the colours are as bright as you want<br>• from behind and above: on an Au Ra or Roegadyn woman a sliver of your own head may show under the hat brim (use Hide your own face)<br>**Result 1.2.0 (Oct 25, night):** colours fine; "something is off feel like the head is huge". Measured: the FFXIV body is 0.92× her height and 0.88× her shoulders, so head and hat were ~10–14% too big for it.<br>1.2.1: head 0.95× as wide (height and depth must stay, or your own skull pokes through the crown and the back of her hair), hat brim pulled in to 0.8×.<br>In game, check: does the head and hat now look in proportion? No patch of your own skin at her temples or the back of her head.<br>**Result 1.2.1 (Oct 25):** "it's alright not perfect but good enough". Accepted as is. A properly small head would need the face hider on a collection of the user's own (their one collection is also Default). |

## Conflicts

Enable only one mod from each group in a collection, or Penumbra's priority decides which one you see:
- **Hyur Midlander male face 1 / hairstyle 1:** Griffith, Jak, Jotaro, Cloud (Cloud replaces every face and hairstyle). Sora left this group in 2.0.0 (his head is now the Air Cell Hood).
- **Chocobo model:** Voidwing Dragonhawk, Swift Spectral Tiger.
