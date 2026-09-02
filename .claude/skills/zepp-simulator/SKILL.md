---
name: zepp-simulator
description: Run this app in the Zepp OS simulator and photograph its screens. Use when asked to launch the app in the emulator, look at a screen on the device, take screenshots of the watch app, or check how a layout change actually renders.
---

# Running and photographing the app in the simulator

The person has to start the Zepp OS simulator themselves (it ships with Zepp OS
Studio); this skill only installs the current code into a simulator that is
already running and gets pictures out of it.

## Installing the current build

```bash
printf '\n' | npx --yes @zeppos/zeus-cli@1.9.2 dev
```

- It **asks which device to preview** and blocks forever waiting for an answer, so
  feed it a newline to take the highlighted default. Run it in the background and
  read its log; it stays alive as a watcher.
- It prints a Chinese "duplicate device" warning several times. Harmless.
- A rebuild after a file change takes about 20-25 seconds and ends with
  `rebuild done` / `refreshing simulator...`. Wait for that line before
  photographing anything.
- **It rewrites `.gitignore`** with its own template. Run `git checkout --
.gitignore` afterwards and check `git status` before committing anything.

## Photographing a screen (Windows)

Two things that do not work, so do not spend time on them:

- **A desktop screen capture returns the wallpaper.** `CopyFromScreen` over the
  simulator's window gives back the desktop behind it.
- **The simulator ignores synthetic input.** Neither `SetCursorPos` plus
  `mouse_event`, nor posted `WM_LBUTTONDOWN` messages, nor relative pointer motion
  reach the guest: qemu holds a pointer grab. There is no way to tap a button for
  it.

What does work is `PrintWindow` with `PW_RENDERFULLCONTENT` (flag `2`), which asks
the window to draw itself into a bitmap:

```powershell
Add-Type -AssemblyName System.Drawing
Add-Type @"
using System; using System.Runtime.InteropServices;
public class P {
  [DllImport("user32.dll")] public static extern bool PrintWindow(IntPtr h, IntPtr hdc, uint f);
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr h, out RECT r);
  [StructLayout(LayoutKind.Sequential)] public struct RECT { public int Left, Top, Right, Bottom; }
}
"@
$p = Get-Process | Where-Object { $_.MainWindowTitle -match 'Zepp OS Simulator' } | Select-Object -First 1
# ... GetWindowRect, new Bitmap, Graphics.GetHdc, PrintWindow($h, $hdc, 2), Save
```

The watch face is a rectangle inside that window, surrounded by the simulator's
grey canvas. **Measure it, do not assume it**: capture once, then find the canvas
edges by scanning for the grey (around RGB 72,76,72) and crop the face out of the
middle. The face is the screen size the device reports, so a 466px watch gives a
roughly 466x466 crop, off by a pixel or two from the simulator's own scaling.

## Photographing a screen you cannot navigate to

Since taps cannot be sent, open the screen from the app itself: add a temporary
method called at the end of `build()` that drives the page through its own public
methods, let the watcher rebuild, capture, then throw the edit away.

```js
// TEMPORARY - screenshots.
shot() {
  this.state.levelId = 1;                 // pin the board; the person may have changed it
  this.startGame();
  this.state.startedAt = now() - 194000;  // a game that took a plausible few minutes
  this.select(blockAt(this.state.game, 0, 2).id);
  this.slide(DOWN);
}
```

Use the page's own `select` / `slide` / `showRecords` rather than poking at state,
so what is photographed is what the real code draws. Seed records with
`writeValue(this.state.storage, bestKey(id), moves)` when a screen would otherwise
be empty. Afterwards:

```bash
git checkout -- page/index.js   # and let the watcher rebuild the real app
```

Say plainly in the write-up that the games behind such shots were played out by
the app rather than by hand.

**Someone may be using the simulator at the same time.** If a capture shows a
screen you did not ask for, that is the likeliest reason - ask before assuming the
app is broken.
