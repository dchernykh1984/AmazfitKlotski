---
name: release
description: Cut a release of this Zepp OS app end to end - merge the change, approve and watch the release-please pull request, merge it, and verify the .zab bundle the release build attaches. Use when asked to release, ship, publish a version, drive a release pull request to green, or check what a release actually built.
---

# Cutting a release

Releases are automated with release-please. Nothing here bumps a version by hand:
`package.json` is the version release-please owns, and `app.json` gets its
`version.name` from the release pull request and its `version.code` from
`npm run version:sync` at build time. `README.md` explains why there are two
numbers; do not fight them.

## The flow

1. **Merge the change into `main`.** Only when the person asking has asked for
   that merge.

   ```bash
   gh pr merge <n> --rebase --delete-branch --admin
   ```

   `--admin` is needed because the branch ruleset wants an approval and an account
   cannot approve its own pull request. `gh pr review --approve` on your own pull
   request fails with `Can not approve your own pull request`; do not retry it.

2. **Wait for the release pull request.** Release Please runs on the push to
   `main` and opens or updates one titled
   `chore(main): release <package> <version>`.

   ```bash
   gh pr list --state open
   ```

3. **Approve its workflow runs.** The release pull request comes from a bot
   branch, so its CI and Security runs sit in `action_required` and never start on
   their own. Find them and approve each one:

   ```bash
   gh run list --limit 6                                   # look for action_required
   gh api -X POST repos/<owner>/<repo>/actions/runs/<id>/approve
   ```

   This is the one step a person has to authorise. Do not approve workflows on a
   release nobody asked for.

4. **Watch the checks.**

   ```bash
   gh pr checks <n> --watch --interval 20
   ```

   If they go red, fix the cause on `main` with a normal pull request; the release
   pull request rebases itself onto the fix. Never merge a red release.

5. **Merge the release pull request.** It tags the release and creates the GitHub
   Release; the release build workflow then builds the `.zab` with the Zeus CLI and
   attaches it.

   ```bash
   gh pr merge <n> --rebase --admin
   gh release list --limit 3
   gh release view <tag> --json assets --jq '.assets[] | "\(.name)  \(.size)"'
   ```

## Verifying what was built

A green pipeline says the build ran, not that it built what you think. Check the
bundle itself:

```bash
gh release download <tag> --pattern "*.zab"
cp *.zab bundle.zip && unzip -q bundle.zip -d out
node -e 'const m=require("./out/manifest.json");
  for (const z of m.zpks) console.log(z.version.name, "code "+z.version.code,
    z.platforms.map(p=>p.screenType+" "+p.screenResolution+" "+p.cpuPlatform).join(", "));'
```

Expect one `.zpk` per shipped platform, every one carrying the same version name
and code, and round resolutions only - currently 360, 416, 454, 466 and 480 across
the NXP, APOLLO and ZPS platforms.

To look inside one: a `.zpk` is a zip holding `device.zip`, which holds `app.json`
and `page/index.bin`. **`index.bin` is compiled bytecode, not JavaScript** - a text
search for a string or a number will find nothing. Probe its constant pool
instead, which is how you prove a specific change is in the build:

```bash
node -e 'const fs=require("fs");const bin=fs.readFileSync("page/index.bin");
  const d=v=>{const b=Buffer.alloc(8);b.writeDoubleLE(v);return bin.indexOf(b)>=0};
  const i=v=>{const b=Buffer.alloc(4);b.writeInt32LE(v);return bin.indexOf(b)>=0};
  console.log("0.82 present:", d(0.82), "| colour 0x5a5148 present:", i(0x5a5148));'
```

Pick constants the change introduced: a layout fraction, a new colour. Strings are
worth checking in the whole `.zab` rather than the bytecode, and note that Zeus
stores non-ASCII as UTF-16LE, so decode both byte alignments before concluding a
translation is missing.

## Uploading to the store

The `.zab` is only the artifact. Putting it in the Zepp App Store is manual - Zepp
has no publish API. See the `store-submission` skill.
