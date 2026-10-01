---
name: store-submission
description: Prepare everything the Zepp developer console asks for when publishing a version - the icon, the round screenshots, and the text for every field of the App Release form. Use when asked to prepare a store submission, produce store images or screenshots, or write the listing copy.
---

# Preparing a Zepp App Store submission

Zepp has no publish API: a person fills in the console form and uploads the files
by hand. The job here is to leave them a folder they can work from and text they
can paste without editing. Put all of it in `tmp/` (ignored) - store assets are
not repository content.

Suggested shape, one file per concern:

```
tmp/store/ZEPP_FORM.md                     every field, ready to paste
tmp/store/store-icon-240.png               240x240
tmp/store/store-screenshot-1-...-360.png   360x360, one per screen
```

## The images

**Icon.** 240x240 PNG, circular, transparent background, no padding. The app icon
in `assets/common.r/` is already a disc drawn to the edge of its frame, so it only
needs resampling to 240 and re-masking, so the resampled rim stays a clean circle:

```js
const mask = await sharp(
  Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="240" height="240">
     <circle cx="120" cy="120" r="120" fill="#fff"/></svg>`
  )
)
  .png()
  .toBuffer();
await sharp(icon)
  .resize(240, 240)
  .ensureAlpha()
  .composite([{ input: mask, blend: "dest-in" }])
  .png()
  .toFile(out);
```

The mask must be **a white disc on nothing**. A mask with an opaque background
rectangle keeps everything and silently does nothing - check a corner pixel's
alpha afterwards rather than trusting the code.

**Screenshots.** 360x360 PNG, 1 to 10 of them. Capture the real build in the
simulator (see the `zepp-simulator` skill), crop to the face, scale to 360, and
black out the corners with the same disc mask - a round watch has nothing outside
the circle, and the simulator's grey canvas in a corner looks like a bug.

Show screens that sell the app and are honest: the start screen, a board mid-game,
the screen after a win, the records. A screenshot full of zeroes and dashes is
truthful but sells nothing; play a board out first.

## The form

Verify the character limits with a script rather than by eye - the console
silently truncates, and App Details in particular is easy to overrun:

````bash
node -e 'const s=require("fs").readFileSync("tmp/store/ZEPP_FORM.md","utf8");
  for (const [,n,max,body] of s.matchAll(/### (.+?) \(max (\d+)\)\n\n```\n([\s\S]*?)\n```/g))
    console.log([...body].length<=+max?"ok":"OVER", n, [...body].length+"/"+max);'
````

Field by field:

| Field                          | What to put                                                      |
| ------------------------------ | ---------------------------------------------------------------- |
| appId, App Name, Developer     | prefilled by the console; leave them                             |
| App Installation Package       | the `.zab` from the GitHub release                               |
| payment status                 | free                                                             |
| Publish Area                   | Global                                                           |
| Supported Devices, Version No. | filled in from the uploaded package                              |
| Service Category               | dropdown; the sibling apps used `Common`                         |
| App Classification             | dropdown; pick the games / puzzle entry, never a fitness one     |
| App Language                   | English only - see below                                         |
| App Name (per language)        | max 30                                                           |
| App Introduction               | max 40                                                           |
| App Details                    | max 600                                                          |
| App Icon                       | the 240x240 above                                                |
| Privacy Statement              | free text, not a URL                                             |
| Call Permission                | None - the app declares only device info and local storage       |
| Includes SDK                   | No - `package.json` has no runtime dependencies                  |
| Full music playback            | No                                                               |
| Features Descriptions          | one paragraph, factual, for the reviewer rather than the shopper |

**Do not add languages to the form.** Each one opens a block that must be filled
in full, screenshots included, and an empty block risks a rejection - which costs
one of the six weekly review attempts. The app being translated into 11 languages
belongs in the English description as a selling point, not in the language picker.

Keep a Russian version of the texts at the bottom of the file for a later
submission that adds the language deliberately.

## Before submitting

The dropdown options are not visible in a screenshot of the form. If they have not
been named, say which two are unresolved rather than guessing: a wrong
classification is a plausible reason for a reviewer to bounce the submission, and
a resubmission costs one of the weekly attempts.
