# Authenticator

A Windows app that shows the same 2-step verification codes as Google Authenticator on your phone.

## Start it
Double-click **`Authenticator.exe`**, or search for **Authenticator** in the Start menu. It needs the .NET 10 Desktop Runtime, which this PC already has.

- Click a code to copy it. Or type in the search box and press **Enter** to copy the first match.
- The ring counts down to the next code. The code turns red in its last 5 seconds; right-click › **Copy next code** gets the one after.
- Right-click an account to rename it, move it, delete it, or show its QR code and setup key.
- Starting it again while it's open just brings the window to the front.

## Moving your accounts from the phone
1. In Google Authenticator, open the menu and choose **Transfer accounts › Export accounts**.
2. Get that QR code onto the PC. If your phone allows a screenshot of it, send the screenshot over. Android blocks screenshots on that screen, so take a photo of it with another phone or camera instead.
3. In Authenticator, use **+ › Open QR code image…**, drag the picture onto the window, or copy it and press **Ctrl+V**. If the export is split over several QR codes, add each one. The app tells you which parts are still missing.

Or add accounts one at a time. On a site's 2-step verification page, set up an authenticator app and use **+ › Scan QR code on screen** while its QR code is showing. The app hides itself for a moment and reads every monitor. Scan the same code with your phone too, and both will show the codes. **+ › Enter setup key…** takes a typed key or a pasted `otpauth://` link.

## Where your accounts are kept
- `%APPDATA%\Authenticator\vault.dat`, encrypted with Windows (DPAPI). Only your Windows account on this PC can open it. Every save keeps the previous version as `vault.bak`.
- **⋯ › Back up to a file…** writes a password-protected `.authbackup` file (AES-256-GCM, key from PBKDF2-SHA256). It can be restored on any PC with **⋯ › Restore from a backup…**, or by dropping it on the window. There's no way to recover a forgotten password.
- **⋯ › Export to Google Authenticator…** shows QR codes the phone app can import (**Transfer accounts › Import accounts**). Use it to move accounts back to a phone.
- Codes depend on the PC clock, so it's checked once against an internet time server at start, and any difference is corrected. The status line shows the result.

## What it supports
Time-based (TOTP) and counter-based (HOTP) codes; SHA1, SHA256, SHA512 and MD5; 6 to 8 digits (4 to 10 from links); any code period. Google Authenticator export codes (`otpauth-migration://`) and standard `otpauth://` links. QR codes are read with zxing-cpp, which copes with photos of a screen, rotated codes, and light-on-dark codes.

## Build
Run **`Build exe.cmd`**. It needs the .NET 10 SDK, publishes `Authenticator\Authenticator.csproj` as one file, and copies `Authenticator.exe` here.

`Tests\` has the checks. `dotnet run --project Tests -- test` covers the RFC 4226/6238 code vectors, otpauth and Google export parsing, the vault, backups and QR reading. `dotnet run --project Tests -- flows` drives the main window's import, move and delete off-screen against a temporary folder.

The `AUTHENTICATOR_DATA` environment variable points the app at another data folder, for testing without touching your real accounts. `AUTHENTICATOR_THEME=dark|light` overrides the Windows theme.
