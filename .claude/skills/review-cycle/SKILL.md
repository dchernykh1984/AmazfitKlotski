---
name: review-cycle
description: Run the review cycles this repository expects over a branch - re-read the whole diff, fix what is found as its own commit, and know when to stop. Use when asked for N review cycles, a review pass with fixes, or to review a branch before opening a pull request.
---

# Review cycles

A review cycle here means: read the whole diff of the branch again with fresh
eyes, find real problems, and **commit the fixes as their own commit** rather than
folding them into the change under review. The history should show what was found
and when.

## What a cycle is

1. `git diff main...HEAD` over the source, then over the tests. Read the whole
   diff, not the parts you remember writing.
2. Judge each finding: would this actually produce a wrong result, a crash, an
   unreadable screen or a silent gap in the tests? A rename you would have made
   differently is not a finding.
3. Fix what survives. One commit per cycle is normal, with a message naming what
   was found: `test(records): pin the page to the number of record lines the
layout counts`.
4. `npm test`, `npm run lint`, `npm run format:check` before the commit.

**Stop early when a cycle stops finding anything serious.** Five requested cycles
that turn up nothing after the second are two cycles; say so rather than inventing
findings to fill the count.

## What is worth looking for here

- **Geometry that only holds at 466.** Anything positioned in `page/index.js` with
  a number in it, or a box in `lib/layout.js` with no test over `SHIPPED_SIZES`.
  Ask what happens at 360.
- **Text that can outgrow its box.** Zepp text widgets clip rather than wrap.
  Compare the room a line has against the longest form of that line across all 11
  language tables, not against English.
- **Widget bookkeeping.** Every widget created has to be deleted exactly once by
  the screen that owns it. The UI stub throws on a double delete and keeps dead
  widgets visible, so a leak or a double free shows up as a failing test - if
  there is a test.
- **State that survives a screen change.** A screen that nulls `state.game` can
  quietly discard a game in progress; check which screens can reach it.
- **Storage.** Reads must survive a watch with no storage, a failing storage and a
  storage holding nonsense from an older version. The session copy is authoritative
  over what is on the disk.
- **Two sources of truth.** A count in the page and the same count in the layout, a
  key in `keys.js` and its use in a table - if they can disagree, either join them
  or add the test that fails when they do.
- **Tests that pass for the wrong reason.** Locating a widget by creation order
  breaks the moment it is redrawn; find it by where it sits or what colour it is.

## What a finding is not

Do not report style preferences, do not re-litigate a decision the person already
made, and do not raise a defensive check for a case the data model makes
impossible. If a cycle found nothing, the honest report is that it found nothing.
