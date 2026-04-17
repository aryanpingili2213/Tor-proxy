# MultiProxy Anonymous Router

A web-based dashboard for automatically configuring Tor and Proxychains to route internet traffic through multiple proxies for anonymity.

## Features

- **Dashboard** — Mission control overview: anonymity status, Tor/Proxychains state, current IP, proxy chain summary
- **Install & Setup** — Step-by-step automated installation and configuration of Tor and Proxychains-NG
- **Proxy Manager** — Add, delete, enable/disable, and validate SOCKS5/SOCKS4/HTTP proxies
- **IP Status Checker** — Compare original vs anonymous IP; country, ISP, city, timezone info; DNS leak test
- **Logs** — Filterable, color-coded activity log with clear button

## Stack

- **Frontend**: React + Vite + TypeScript + Tailwind CSS + shadcn/ui
- **Backend**: Node.js + Express + TypeScript
- **Database**: PostgreSQL + Drizzle ORM
- **API**: OpenAPI 3.1 + Orval codegen (React Query hooks)

## Running

```bash
# Install dependencies
pnpm install

# Start dev servers
pnpm --filter @workspace/api-server run dev
pnpm --filter @workspace/multiproxy run dev
```

## Project Structure

```
artifacts/
├── api-server/          # Express API backend
│   └── src/
│       ├── modules/     # system.ts, ip-checker.ts, proxy-validator.ts, logger.ts
│       └── routes/      # system.ts, proxies.ts, ip.ts, logs.ts
└── multiproxy/          # React frontend
    └── src/
        └── pages/       # Dashboard, Setup, Proxies, IPStatus, Logs

lib/
├── api-spec/            # OpenAPI 3.1 spec
├── api-client-react/    # Generated React Query hooks
├── api-zod/             # Generated Zod validation schemas
└── db/                  # Drizzle ORM schema (proxies, logs)
```

## Local System Installation (Linux)

To use Tor and Proxychains on a real Linux system:

```bash
sudo apt-get update
sudo apt-get install -y tor proxychains4
sudo systemctl start tor
sudo systemctl enable tor
```

Then configure `/etc/proxychains4.conf`:

```
dynamic_chain
quiet_mode
proxy_dns

[ProxyList]
socks5 127.0.0.1 9050
```

Run any command through Tor:

```bash
proxychains4 curl https://check.torproject.org/api/ip
```

## Future Improvements

- **GUI desktop version** — Electron or Tauri native app for full system integration
- **Automatic proxy rotation** — Timed or failure-based proxy switching
- **AI-based proxy detection** — ML model to detect and flag honeypot proxies
- **Tor circuit refresh** — Button to request a new Tor identity (new IP)
- **VPN integration** — Layer VPN over Tor for double-hop anonymity
- **Proxy import** — Bulk import from .txt files or proxy list APIs
- **Real-time monitoring** — WebSocket-based live status updates
