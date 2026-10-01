# Working on this repository

`README.md` describes what the app is and how the code is arranged; read it first
and do not repeat it here. This file is the part that is not visible from the
code: how work is expected to be done in this repository.

Longer procedures live in `.agents/skills/`: cutting a release, driving the
simulator, preparing a store submission, running a review cycle.

## Ground rules

- **Read a file before you change it.** The working tree may carry edits that are
  not yours and are not in the history yet.
- **`lib/` stays pure.** No `@zos/*` imports there. Rules, geometry, text and
  scores are plain modules a test can reach without a watch; `page/index.js` only
  turns them into widgets and reacts to taps and swipes.
- **Every measurement belongs in `lib/layout.js`**, expressed as a fraction of the
  screen or of the design, and checked in `test/layout.test.mjs` against all five
  round sizes the bundle ships for. Never hard-code a pixel in `page/index.js`.
  Anything drawn on the bare face has to be cut to the chord at its own height
  (`lib/round-geometry.js`), or it will hang over the bezel on a small screen.
- **Source is ASCII**, except `lib/i18n/`, which is legitimately not. A pre-commit
  hook and a CI check enforce this over `.js`, `.mjs`, `.json`, `.md` and `.yml`.
- **Comments say why, not what.** Match the density and voice of the file you are
  editing.

## What "done" means for a change

A change is finished when all of these are true, and each commit is expected to
stand on its own:

1. The behaviour is covered by tests. A screen change means a `test/page.test.mjs`
   case driving the real page against the stubs; a geometry change means a
   `test/layout.test.mjs` case over every shipped size.
2. Any new on-watch text exists in all 11 tables in `lib/i18n/labels.js`, with the
   key declared in `lib/i18n/keys.js`. Reusing an existing key needs no new text -
   say so rather than leaving it unsaid.
3. `npm test`, `npm run lint` and `npm run format:check` all pass.
4. The commit message is a single-line Conventional Commit, imperative and
   specific about the change rather than the file: `fix: page the boards the way a
finger drags a list, not against it`, not `fix: update index.js`. Commitizen
   validates it locally and in CI. The subject is the whole message: no body, no
   trailers, no `Co-Authored-By`, and no "generated with" footer in the pull
   request description either - strip one if a default adds it.

## Branches and pull requests

- Branch off `main`, named for the change: `fix/records-paging-direction`,
  `feat/level-records`, `chore/commit-agent-context`.
- `main` is protected: rebase merges only, and a pull request cannot be approved by
  the account that opened it. When a merge is authorised, `gh pr merge <n> --rebase
--delete-branch --admin` is the route that works; it is a deliberate bypass, so
  only merge when the person asking has actually asked for that merge.
- The required checks are `pre-commit`, `test`, `actionlint`, `commitizen` and
  `osv-scan`. Watch them with `gh pr checks <n> --watch --interval 20`, but read the
  verdict from the rollup: `gh pr checks` reports a per-check status that lags and can
  still say `pending` long after a job has finished, which reads like a hung check.

  ```bash
  gh pr view <n> --json statusCheckRollup \
    --jq '[.statusCheckRollup[] | {name:(.name//.context), s:(.conclusion//.state)}]'
  ```

- The pull request body is prose, not a checklist: what was wrong, what changed,
  and how it is held in place by tests. Say plainly when there are no new strings
  to translate.

## Things that will bite you

- **`npx zeus dev` rewrites `.gitignore`** with its own template, which ignores
  `package-lock.json` and would break `npm ci` in CI. Run `git checkout --
.gitignore` after any Zeus command and check `git status` before committing.
- **The Zeus CLI needs Node 18 or 20.** On a newer Node it fails to resolve its
  own modules.
- **`tmp/` is ignored** and is the right place for anything a person needs to look
  at but the repository should not carry: store assets, captures, scratch notes.

## Coding-agent context and hooks

`AGENTS.md` is the project entry point for Codex. Project procedures live in
`.agents/skills/`; read the relevant skills before working on their task.
Keep shared guidance consistent with `CLAUDE.md` and `.claude/skills/` when it
changes. The Claude configuration remains available to Claude Code.

Codex hooks live in `.codex/hooks.json`. Trust this checkout and review/allow the
exact hook definitions in `/hooks` before expecting them to run. See
`.codex/README.md` for prerequisites, supported checks and permission limits.
Git hooks are independent: run `pre-commit install` in each clone to enable the
configured commit, commit-message and push checks.
