# Artwork and its provenance

Every picture in `assets/common.r/` is either in the public domain / released
under CC0, or drawn for this repository. Nothing here needs attribution to be
redistributed; the credits below are given because it is the decent thing to do,
and so the next person can check the licence for themselves.

## Block faces

The ten block faces are details of an album of one hundred Peking opera character
portraits, painted in ink and colour on silk in the late Qing dynasty (19th-20th
century), artist unknown. The album is held by the Metropolitan Museum of Art in
New York, which has released its images under **CC0 1.0 (public domain
dedication)** through its Open Access programme. The copies used here were taken
from Wikimedia Commons, which mirrors the museum's files.

- Collection page:
  https://commons.wikimedia.org/wiki/Category:One_hundred_portraits_of_Peking_opera_characters_(MET,_2005.510)
- Museum record: https://www.metmuseum.org/art/collection/search/78499
- Licence: CC0 1.0 - https://creativecommons.org/publicdomain/zero/1.0/

| File            | Source leaf (MET image id) | What it shows                      |
| --------------- | -------------------------- | ---------------------------------- |
| `hero.png`      | DP280158                   | The commander, head and shoulders  |
| `guard.png`     | DP280173                   | A painted-face general, across     |
| `general-1.png` | DP280174                   | Standing general in winged armour  |
| `general-2.png` | DP280085                   | Standing general with a green mask |
| `general-3.png` | DP280164                   | Standing general with a crown      |
| `general-4.png` | DP280170                   | Standing warrior with a spear      |
| `soldier-1.png` | DP280073                   | Foot soldier in a blue cap         |
| `soldier-2.png` | DP280155                   | Foot soldier in a grey cap         |
| `soldier-3.png` | DP280175                   | Foot soldier in a black cap        |
| `soldier-4.png` | DP280185                   | Foot soldier, painted face         |

Each file is a crop of one leaf, resized to exactly the pixel box that kind of
block occupies in the 466px design (see `lib/layout.js`), warmed slightly, and
given rounded corners. On any other round watch the watch scales the picture into
whatever cell that screen ended up with, so one set of files serves them all. The leaves were downloaded from Wikimedia Commons at 900px wide via
`Special:FilePath`. The painted figure was located by looking for saturated or
dark pixels against the bare silk, and the crop taken relative to that figure -
the whole figure for a standing general, head and shoulders for the commander,
the head alone for a soldier - with a hand-measured crop on the three leaves
where that framed the wrong thing (`guard`, `soldier-1`, `soldier-3`). The
`assets` unit test checks every file is present and exactly the size the layout
expects.

## App icon and buttons

`icon.png` is the same commander's portrait (DP280158, CC0) in a round frame.

`undo.png`, `undo-press.png`, `menu.png` and `menu-press.png` were drawn for this
repository as plain SVG shapes on the board's own colours and rasterised to PNG.
They are covered by the repository's MIT licence.
