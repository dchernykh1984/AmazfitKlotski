# Amazfit Klotski

**Block Escape** - Klotski, the sliding block puzzle also known as Huarong Pass -
as a **Zepp OS mini app** for round Amazfit watches. Ten blocks are packed into a
4x5 tray with
barely any room to move; slide them, without lifting or turning any of them, until
the big 2x2 commander can leave through the gate at the bottom. Everything runs on
the watch: no phone, no network, no account.

- **Board** - the classic 4x5 tray, drawn at a fixed cell size and centred on the
  round screen, with the move counter in the cap above it and the controls in the
  margins beside and below it.
- **Controls** - tap a block to pick it up, then swipe up / down / left / right to
  slide it one cell. The selected block keeps the gold ring, so a run of swipes
  pushes the same block along. Tap it again to let it go. Swipes are swallowed
  while a game is on, so sliding a block to the right cannot back you out of the
  app; from any menu, swipe right to leave.
- **Undo, restart, menu** - undo takes back one move (and the counter with it),
  restart puts the board back as it started, and the menu button pauses over the
  board so the position is still there when you come back.
- **Six boards** - a ladder from a seven-move warm-up to the classic Huarong Pass,
  which cannot be solved in fewer than 116 moves. Each board shows its par next to
  your move count, and keeps its own record in on-watch storage. The board you
  played last is the one that opens next time.
- **Block faces** - every block wears a portrait from a Qing dynasty album of
  Peking opera characters, so the commander, the four generals and the four
  soldiers are all told apart at a glance. The album is CC0 - see
  [docs/ASSETS.md](docs/ASSETS.md).
- **Languages** - the on-watch text is localized into the same 11 languages as the
  sibling [AmazfitSerpent](https://github.com/dchernykh1984/AmazfitSerpent) app:
  English, Russian, German, French, Italian, Spanish, Portuguese, Dutch, Polish,
  Czech and Kazakh. Zepp OS has no device-language code for Kazakh, so that table
  is carried ready but never auto-selected; unknown languages fall back to English.

## Devices

Round watches only, built for both round resolutions: **466** (GTR 4, Active 2
Round, Balance, Cheetah, ...) and **480** (T-Rex 3, Balance 2, ...). The block
faces are real pictures, so the board keeps one fixed cell size on every model and
is centred rather than stretched. Square devices are intentionally out of scope.

## Setup

```bash
git clone https://github.com/dchernykh1984/AmazfitKlotski.git
cd AmazfitKlotski
npm install
```

## Develop

```bash
npm test          # run the unit tests (Vitest)
npm run lint      # ESLint
npm run format    # rewrite files with Prettier
npm run preview   # QR-preview on a device via the Zepp app in Developer Mode
npm run build     # produce the .zab store bundle
```

`preview` and `build` fetch the [Zeus CLI](https://docs.zepp.com/docs/guides/quick-start/)
on demand (`npx`), so it is not tracked as a dependency; the first run downloads it.
The Zeus CLI needs **Node 18 or 20** - on newer Node it fails to resolve its own
modules. The app itself ships **no runtime dependencies**: it uses only the `@zos/*`
modules the watch provides.

### Layout of the code

```
app.json                 manifest (round 466 + 480, one page module)
app.js                   app entry
lib/                     PURE, unit-tested logic (no Zepp OS imports)
  klotski.js             the rule set: blocks, legal slides, undo, solved
  levels.js              the six boards, written as ASCII pictures, plus their par
  layout.js              where the board, counter and buttons sit on the screen
  round-geometry.js      chord maths that keeps text and buttons off the bezel
  pieces.js              which portrait goes on which block
  scores.js              the persisted record, per board
  i18n/                  keys.js (the contract), labels.js (11 tables), index.js
page/index.js            the watch screen: drawing, taps and swipes
page/index.r.layout.js   the layout module Zepp OS requires per page
utils/config/            device.js (screen size), constants.js (colours, type)
assets/common.r/         the block faces, the button icons and the app icon
test/                    Vitest unit tests, including a breadth-first solver
```

The split is deliberate: every rule and every measurement lives in `lib/`, where a
test can reach it without a watch, and `page/index.js` only turns that into widgets
and reacts to taps and swipes. The tests include a breadth-first solver that
re-derives the par of every bundled board, so a mistyped board or a wrong par fails
the build rather than the player.

### In the Zepp store

The app is registered in the [Zepp developer console](https://console.zepp.com/) as
**Block Escape**, app id **1122455**, and `app.json` carries that id. It has to: the
dev preview is cloud-mediated, and an unregistered appId makes the watch install the
app but silently refuse to launch its screen. The repository keeps its own name.

## Pre-commit hooks (contributors)

```bash
uv tool install pre-commit   # or: pipx install pre-commit
pre-commit install
```

After that the hooks run automatically: Prettier and ESLint and a non-ASCII guard on
commit, Conventional Commits validation on the commit message, and the unit tests on
push. The non-ASCII guard skips `lib/i18n/`, which legitimately holds translated
text.

## Continuous integration and releases

Every pull request must pass the required checks: Prettier, ESLint, the unit tests,
`actionlint`, commitizen (Conventional Commits), and an OSV dependency scan.

Releases are automated with `release-please`: it maintains a version-bump PR from the
Conventional Commits and, when merged, tags a GitHub Release. The release build
workflow then produces the `.zab` store bundle and attaches it, deriving the Zepp
`version.name` / `version.code` from `package.json`. Uploading the `.zab` to the Zepp
App Store stays manual, because Zepp has no public publish API.

## License

Released under the [MIT License](LICENSE).
