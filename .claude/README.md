# .claude

Instructions for the coding agents that work on this repository, kept in version
control for the same reason the ESLint config is: they are project conventions,
not one person's setup.

```
settings.json           shared permissions and hooks
settings.local.json     per-machine, NOT committed (absolute paths, one person's approvals)
hooks/check-edit.mjs    holds an edited file to the ASCII and Prettier gates at once
skills/                 the procedures that take more than one step
```

The working agreements themselves - what "done" means, how commits and pull
requests are expected to look, what will bite you - are in `CLAUDE.md` at the root
of the repository, next to `README.md`, which describes the app itself.

Nothing here is secret and nothing here is machine-specific. Keep it that way:
absolute paths, tokens and personal identifiers belong in `settings.local.json`,
which `.gitignore` keeps out.
