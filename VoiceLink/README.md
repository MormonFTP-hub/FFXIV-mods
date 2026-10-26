# Voice Link

A Dalamud plugin that turns what you type into speech in a natural-sounding voice (by default **Ava**, one of Microsoft's neural female voices), and gets it to other players three ways:

| Way | Who hears you | What they need |
|---|---|---|
| **Broadcast through mod sync** | Everyone nearby who's synced with you (directly or through a syncshell) | Lightless Sync, which they already have. **Not Voice Link.** |
| **Paired chat reading** | Friends you pair with | Voice Link |
| **Discord** | Everyone in your call | Nothing |

FFXIV's servers only carry text, so no plugin can put audio into the game for other people. Every sound you hear in game is played from files on your own PC. What *can* travel is mod files, through sync plugins like Lightless Sync, and that's what broadcasting uses.

## Broadcasting through Lightless Sync

Type `/vl <message>`. Your character does **/photograph**, and instead of the camera sound, everyone nearby who is synced with you hears your message in Ava's voice. You hear it too.

How it gets there:

1. Voice Link turns the text into speech and builds it into the camera sound file (`sound/vfx/etc/SE_Vfx_Etc_Emote_InstCam.scd`), stretched to the message's length.
2. It saves that file in your Penumbra mod folder (under `Voice Link clips`) and tells Penumbra to use it for your character only, as a temporary mod.
3. Lightless Sync sees the change and uploads the file to everyone synced with you, the same way it shares any sound mod you have on.
4. After a short wait (5 s by default), Voice Link does /photograph for you. About 6 s into the emote, the camera sound plays, on their screens and yours.

**Setup:** `/vl` → **Broadcast** → tick **Send /vl messages through mod sync**. The checks there tell you whether Penumbra, a sync plugin and /photograph are all ready. /photograph has been free for everyone since patch 7.18, but it has to be unlocked.

**Things to know:**

- **The first message after you log in usually isn't heard.** Lightless learns which sounds to share the first time it sees your character play a modded one. Send a short test first.
- **It takes about 10 seconds** from pressing Enter to them hearing it: the sync wait plus the emote's wind-up. This is for announcements and short lines, not conversation. Stand still until it plays, because moving cancels the emote.
- **Your character flickers** on their screens with each message, because the sync redraws you whenever your sound files change.
- They need to be **nearby**, synced with you, and have **sound sync on** for you (it's on by default in Lightless). Their *Player Effects* volume for other players also has to be up.
- If they hear the *previous* message, their sync was slower than the wait. Raise **Wait before the emote**.
- **Snowcloak and other Mare-based sync:** turn on **Redraw me after each clip**, since those only notice changes when you redraw.
- If your character uses Penumbra's shared base collection, other players' /photograph will play your clips *on your screen*. Assigning yourself a collection in Penumbra avoids that.
- Each message is uploaded to your sync service as a small file (about 150 KB for 5 seconds). Voice Link keeps the last five clips locally and deletes older ones.

## Paired chat reading

Friends who also run Voice Link hear your normal chat messages read aloud, and you hear theirs.

1. Send them `VoiceLink\bin\Release\VoiceLink\latest.zip`. They unzip it into a folder they'll keep and install it as a dev plugin (see *Installing* below).
2. They add you on **Paired players**: target you and click **Add my target**, click **Add my party**, or type your name.
3. Talk in party chat (or whichever channels are ticked on the **Chat** tab). Each friend can be given a different voice.

## Using it with Discord

1. Install a virtual audio cable, such as VB-Audio's free *VB-CABLE*.
2. **Voice** tab → **Output** → **CABLE Input**.
3. In Discord's voice settings, set your input device to **CABLE Output**.
4. Turn broadcasting off. Then `/vl hello everyone` is spoken into the call.

## Voices

- **Natural** (default): Microsoft's neural voices (Ava, Emma, Jenny, Aria, Sonia and more), the same ones Edge's *Read aloud* uses. Free, no account needed.
- **Windows**: the voices installed in Windows (Zira). These work offline and fill in automatically if the natural voices can't be reached.

## Commands

| Command | Does |
|---|---|
| `/voicelink` (or `/vl`) | Open settings |
| `/voicelink <text>` | Broadcast it, or with broadcasting off, speak it on your PC only. Never sent to chat. |
| `/voicelink stop` | Stop local speech and clear its queue |
| `/voicelink on` / `off` | Turn reading chat aloud on or off |

## Installing

1. Build it (see *Building* below), or use the files already in `VoiceLink\bin\Debug\`.
2. In game: `/xlsettings` → **Experimental** → under *Dev Plugin Locations* add the full path to `VoiceLink.dll`, click **+**, then **Save and Close**.
3. `/xlplugins` → **Dev Tools** → **Installed Dev Plugins** → enable **Voice Link**.
4. `/vl` → **Voice** tab → type in the test box and press **Speak** to hear it.

## Privacy

- **Natural voices** send the text being read to Microsoft's speech service (`speech.platform.bing.com`). Only text is sent, no account. The **Windows (offline)** engine keeps everything on your PC.
- **Broadcasting** uploads each spoken clip to your sync service, like any other mod file Lightless shares.
- The natural voices use the unofficial service behind Edge's *Read aloud*. If Microsoft changes it, they stop working until the plugin is updated, and the Windows voice fills in. The protocol follows the [edge-tts](https://github.com/rany2/edge-tts) project; when that project updates, the constants in `Speech/EdgeTts.cs` and `Speech/EdgeToken.cs` are the ones to update here.

It's Windows only so far. It hasn't been tried on Linux or Steam Deck, where the MP3 decoder and Windows voice it relies on may be missing.

## Building

You need the .NET 10 SDK, and XIVLauncher with Dalamud installed (the build references Dalamud from `%AppData%\XIVLauncher\addon\Hooks\dev`).

```
dotnet build VoiceLink.slnx -c Debug
```

The output is `VoiceLink\bin\Debug\VoiceLink.dll`. A `-c Release` build also produces `VoiceLink\bin\Release\VoiceLink\latest.zip` for friends.

## How it works

- **Sound file** (`Sync/ScdClip.cs`, `Sync/MsAdpcm.cs`): it starts from the game's own camera-sound file, read through Lumina, and replaces only the audio entry. The speech is resampled to the file's 48 kHz and encoded as MS-ADPCM, the game's sound-effect codec, in the same 70-byte blocks. The sound states its length in two places, the extra description's play time and the track's "wait 5552 ms" before key-off, and both are stretched to the new length. Clips are never shorter than the original. Layout references: VFXEditor's ScdFormat and vgmstream.
- **Penumbra** (`Sync/PenumbraBridge.cs`): `AddTemporaryMod` on your character's own collection. That fires the setting-change event Lightless listens for, and the clip file sits inside the mod folder, which Lightless requires before it will hash and upload a file.
- **Emote** (`Sync/Emotes.cs`): `AgentEmote.ExecuteEmote`, the same call as clicking /photograph in the emote window, used once per message you send.
- **Chat reading** (`ChatListener.cs`): `IChatGui.ChatMessage`, filtered by channel and paired sender (matched by name and home world from the message's player payload). Game icon glyphs are stripped and links are read as "link".
- **Local speech** (`Speech/Speaker.cs`): a two-stage queue that synthesizes the next message while the current one plays. Playback uses NAudio `WaveOutEvent` on the chosen device, with volume applied to the samples so the game's own volume isn't touched.
- **Natural voices** (`Speech/EdgeTts.cs`, `Speech/EdgeToken.cs`): a WebSocket to Edge's read-aloud endpoint that sends SSML and gets back MP3. The `Sec-MS-GEC` token it needs (SHA-256 over a hidden prefix plus a checksum) is ported from edge-tts.
