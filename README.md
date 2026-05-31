# XAdmin Admin UI

`admin-ui` is the frontend workspace for XAdmin. It is based on the VBen 5 monorepo structure, but the current branch is focused on integrating the XAdmin backend, tenant/platform permission model, dictionary management, internal messages, and file management.

This repository is not a generic upstream VBen distribution README. It documents the actual usage of the current XAdmin branch.

## Scope

- Main app: `apps/web-antd`
- Branch in active use: `xadmin-api-integration`
- Backend target: XAdmin `admin`
- UI stack: Vue 3 + Vite + TypeScript + Ant Design Vue
- Workspace mode: `pnpm` + `turbo` monorepo

## Current Status

The current branch has already been adapted for XAdmin-specific backend behavior, including:

- login and token refresh against XAdmin backend APIs
- dynamic menu loading and permission filtering
- platform/tenant-aware dictionary management
- internal message inbox integration
- file management with upload, preview, download, and delete

## Requirements

- Node.js `^22.18.0 || ^24.0.0`
- `pnpm >= 11`

## Install

```bash
pnpm install
```

## Run

Run the main XAdmin frontend:

```bash
pnpm dev:antd
```

Or directly:

```bash
pnpm -F @vben/web-antd run dev
```

## Build

```bash
pnpm build:antd
```

## Checks

Type check:

```bash
pnpm -F @vben/web-antd run typecheck
```

Workspace type check:

```bash
pnpm exec turbo run typecheck
```

Lint and format:

```bash
pnpm lint
pnpm format
```

Encoding check:

```bash
pnpm check:encoding
```

## Key Paths

- Main app: `apps/web-antd`
- Generated admin API client entry: `apps/web-antd/src/api/admin`
- XAdmin layout integration: `apps/web-antd/src/layouts`
- System pages: `apps/web-antd/src/views/system`
- Permission pages: `apps/web-antd/src/views/app/permission`
- Profile pages: `apps/web-antd/src/views/_core/profile`

## Backend Coordination

This frontend is designed to work with the XAdmin backend repository under the sibling workspace:

- backend repo: `../admin`

Typical local pairing:

- frontend: `http://localhost:5666` or the current Vite port
- backend REST: `http://localhost:7788`

Adjust actual ports according to local Vite and backend configuration.

## Notes For This Branch

- Some upstream VBen demo content has been removed or replaced.
- Menus, permissions, and page behavior are driven by XAdmin backend resources instead of static demo assumptions.
- Do not treat this branch as an untouched upstream VBen template.

## Related Repositories

- XAdmin backend: `../admin`
- XAdmin generator/tooling: `../xkit`
- XAdmin template repo: `../xkit-template`

## License

This repository keeps the original upstream license base unless your project policy states otherwise. See [LICENSE](./LICENSE).
