# Commit Checklist

This file describes the recommended manual commit flow for this repository.

All commands below assume the current working directory is:

```powershell
D:\GoProjects\XAdmin\admin-ui
```

## 1. Inspect local changes

Check what is currently modified before you format or stage anything.

```powershell
git status --short
```

Optionally inspect the diff:

```powershell
git diff
```

## 2. Run targeted autofix commands

Use targeted commands first when you only changed a few files.

Format files:

```powershell
pnpm exec oxfmt <file-or-directory> [more files...]
```

Fix eslint issues that are automatically fixable:

```powershell
pnpm exec eslint <file-or-directory> [more files...] --fix
```

Typical example for generated admin pages:

```powershell
pnpm exec eslint apps/web-antd/src/views/generated/admin apps/web-antd/src/views/system apps/web-antd/src/views/app apps/web-antd/src/views/task --fix
pnpm exec oxfmt apps/web-antd/src/views/generated/admin apps/web-antd/src/views/system apps/web-antd/src/views/app apps/web-antd/src/views/task
```

## 3. Run type checking

For most frontend work in this repository, this is the most useful focused validation:

```powershell
pnpm -F @vben/web-antd run typecheck
```

## 4. Run the same high-level checks as the git hooks

Before a real commit, it is safer to run the same checks that `lefthook` will run:

```powershell
pnpm exec vsh lint
pnpm exec turbo run typecheck
```

Notes:

- `pnpm exec vsh lint` covers formatting and eslint-style checks.
- `pnpm exec turbo run typecheck` runs type checking across the workspace.

## 5. Stage changes

Stage only the files that belong to the current change.

```powershell
git add <file-or-directory> [more files...]
```

Review the staged diff:

```powershell
git diff --cached
```

## 6. Commit

Create the commit only after the checks above are clean.

```powershell
git commit -m "your commit message"
```

## Recommended Short Flow

If you only changed a small set of frontend files, this is the usual minimal flow:

```powershell
git status --short
pnpm exec eslint <changed-files-or-dirs> --fix
pnpm exec oxfmt <changed-files-or-dirs>
pnpm -F @vben/web-antd run typecheck
git add <changed-files-or-dirs>
git commit -m "your commit message"
```

## Recommended Safe Flow

If the change touches generated files, shared components, or multiple page modules:

```powershell
git status --short
pnpm exec eslint <changed-files-or-dirs> --fix
pnpm exec oxfmt <changed-files-or-dirs>
pnpm -F @vben/web-antd run typecheck
pnpm exec vsh lint
pnpm exec turbo run typecheck
git add <changed-files-or-dirs>
git diff --cached
git commit -m "your commit message"
```

## Common Failure Cases

- `oxfmt --check` fails: Run `pnpm exec oxfmt <changed-files-or-dirs>`.

- eslint fails with fixable issues: Run `pnpm exec eslint <changed-files-or-dirs> --fix`.

- `vue-tsc` fails: Run `pnpm -F @vben/web-antd run typecheck` and fix the reported types before committing.

- hook passes locally for one file but commit still fails: Run the full hook-equivalent commands:

```powershell
pnpm exec vsh lint
pnpm exec turbo run typecheck
```

- `git status` shows `MM` after running formatters: The formatter changed files after they were already staged. Run `git add` again before committing.
