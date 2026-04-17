# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## Application: MultiProxy Anonymous Router

A web dashboard for routing internet traffic through Tor and multiple proxies for anonymity.

### Features
- Dashboard — anonymity status, Tor/Proxychains state, current IP
- Install & Setup — automated Tor and Proxychains installation/configuration
- Proxy Manager — add, delete, validate SOCKS5/SOCKS4/HTTP proxies
- IP Status Checker — original vs anonymous IP comparison, DNS leak test
- Logs — filterable activity log

## Structure

```text
artifacts-monorepo/
├── artifacts/
│   ├── api-server/         # Express API server
│   │   └── src/
│   │       ├── modules/    # system.ts, ip-checker.ts, proxy-validator.ts, logger.ts
│   │       └── routes/     # system.ts, proxies.ts, ip.ts, logs.ts, health.ts
│   └── multiproxy/         # React + Vite frontend (previewPath: /)
│       └── src/pages/      # Dashboard, Setup, Proxies, IPStatus, Logs
├── lib/
│   ├── api-spec/           # OpenAPI spec + Orval codegen config
│   ├── api-client-react/   # Generated React Query hooks
│   ├── api-zod/            # Generated Zod schemas from OpenAPI
│   └── db/                 # Drizzle ORM schema + DB connection
│       └── src/schema/     # proxies.ts, logs.ts
├── scripts/                # Utility scripts
├── pnpm-workspace.yaml
├── tsconfig.base.json
├── tsconfig.json
└── package.json
```

## Database Schema

- `proxies` — id, type, host, port, username, password, enabled, status, latency_ms, last_checked, created_at
- `logs` — id, level, message, source, metadata, timestamp

## API Routes

- `GET /api/system/status` — system overview
- `POST /api/system/tor/install` — install Tor
- `POST /api/system/tor/start` — start Tor
- `POST /api/system/tor/stop` — stop Tor
- `POST /api/system/proxychains/install` — install Proxychains
- `POST /api/system/proxychains/configure` — write proxychains.conf
- `GET/POST /api/proxies` — list/add proxies
- `DELETE /api/proxies/:id` — delete proxy
- `POST /api/proxies/:id/validate` — validate single proxy
- `POST /api/proxies/validate-all` — validate all proxies
- `GET /api/ip/original` — original IP info
- `GET /api/ip/anonymous` — current (Tor) IP info
- `GET /api/ip/leak-test` — DNS leak test
- `GET /api/logs` — activity logs
- `POST /api/logs/clear` — clear logs

## TypeScript & Composite Projects

Every package extends `tsconfig.base.json` which sets `composite: true`. The root `tsconfig.json` lists all packages as project references.

## Root Scripts

- `pnpm run build` — runs `typecheck` first, then recursively runs `build` in all packages that define it
- `pnpm run typecheck` — runs `tsc --build --emitDeclarationOnly` using project references
