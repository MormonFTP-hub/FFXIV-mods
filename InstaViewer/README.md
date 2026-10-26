# Insta Viewer

A desktop viewer for Instagram links. No Instagram account or sign-in needed.

Run **Insta Viewer.exe**. Paste a link anywhere (Ctrl+V), drop it on the window, or type it in the bar.

| Link | What you get |
| --- | --- |
| Post `instagram.com/p/…` | full-resolution photo, caption, likes, tagged people |
| Reel `instagram.com/reel/…` | video with sound, upgraded to 1080p when ffmpeg is installed |
| Carousel | every slide, with a filmstrip and the arrow keys |
| Profile `instagram.com/name` | bio, follower counts, latest 12 posts |
| Share link `instagram.com/share/…` | followed to the post |

Comments are in the side panel and load as you scroll, the same way Instagram's own signed-out page loads them (top-level comments only, no replies). Stories and more than 12 profile posts need sign-in, so they aren't available.

**Saving:** Ctrl+S saves the current item, Ctrl+Shift+S saves every slide. Files go to `Downloads\Instagram` as `user_code_N.jpg/.mp4`, dated to the post.

**Discord:** the **Discord** button (Ctrl+Shift+D) copies something to paste into a chat. Pick which in Settings (gear, Ctrl+,):
- **Embed link** (default): a link through a "fixer" site, e.g. `fxinstagram.com/reel/…`, which Discord shows as a playable
  video. Discord can't embed instagram.com itself. *Automatic* asks each site the way Discord's bot does and uses the
  first that answers with a video; or pick one, or type another. **Test** checks the choice against the open post.
- **The video file**: the mp4 (1080p if it's under 10 MB) goes on the clipboard like an Explorer copy; Ctrl+V in
  Discord uploads it. Without Nitro, Discord takes files up to 10 MB.

**Keys:** ←/→ slides (or seek in a single video) · Space play/pause · M mute · H HD on/off · F full screen ·
T tagged people · wheel or double-click to zoom a photo, 0 for actual size · Ctrl+L link bar · Ctrl+B history ·
F5 reload from Instagram · Alt+←/→ back/forward · right-click for everything else.

## How it works

`server/ig.py` loads the public post or profile page and reads the data Instagram embeds in it
(`xig_polaris_media`, `xig_user_by_username`). More comments come from the GraphQL query that page uses (`PolarisLoggedOutDesktopWWWPostCommentsPaginationQuery`, doc_id in `ig.COMMENTS_QUERY`), with the page's LSD and CSRF tokens; if Instagram changes the doc_id, capture it again from the signed-out post page. `server/app.py` serves `web/`, keeps the history
(`%LOCALAPPDATA%\InstaViewer`), saves files, and for reels merges the best DASH video and audio tracks with ffmpeg
(stream copy). `server/launcher.py` opens it all in an Edge app window.

- From source: `python -P -E server/app.py` and open http://127.0.0.1:8771/. Data then goes to `work/`, because the
  Microsoft Store Python hides its AppData writes from ffmpeg.
- Rebuild the exe: `python -P -E tools/build_exe.py` (PyInstaller).
- The fetcher sends a plain Chrome user agent. With an `Edg/` token, Instagram caps reels at 720p.
