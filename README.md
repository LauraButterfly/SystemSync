git branch
git checkout main
git branch -D ui/assistant-changes
git add -A
git commit -m "backup before accepting assistant changes"
System Sync
===========

Lightweight two-player card game (client + server) implemented in TypeScript + React. This README explains how to install and run the project on a different computer (Windows instructions included). It covers cloning the repo, installing dependencies, running in development, creating a production build, and basic networking so other machines can connect.

Prerequisites
-------------
- Node.js 18+ (LTS recommended)
- npm (bundled with Node.js)
- Git
- Optional: a code editor such as VS Code

Quick overview of the repo
--------------------------
- `client/` — React client (Vite). Run via `npm run dev` inside `client`.
- `src/server` — Node/Express + socket.io server.
- `src/shared` — shared TypeScript game logic used by tests and server.
- `tests/` — Jest tests for shared logic.

Clone the repository
--------------------
On the target computer, open PowerShell and run:

```powershell
# clone the repository (replace the URL with your repo URL if different)
git clone https://github.com/your-username/your-repo.git system-sync
cd system-sync
```

Install dependencies
--------------------
Install root and client dependencies (some projects keep a separate `package.json` in `client`):

```powershell
# from repo root
npm ci

# install client deps if client has its own package.json
cd client
npm ci
cd ..
```

Set environment (optional)
--------------------------
- The client looks for `VITE_SERVER_URL` during development/build to know where the server is. By default the client connects to `http://localhost:3000`.
- If you run the server on another machine or want other computers to connect, set the variable when starting the client, for example:

```powershell
# on the client machine (PowerShell)
$env:VITE_SERVER_URL = 'http://192.168.1.42:3000'  # replace with your server's LAN IP
npm run dev
```

Running in development (two terminals)
-------------------------------------
Open two PowerShell windows/tabs.

Terminal A — start the server:

```powershell
cd src/server
npm run dev   # or `npm start` / run via ts-node-dev depending on scripts
```

Terminal B — start the client (Vite dev server):

```powershell
cd client
# optionally set VITE_SERVER_URL before launching
$env:VITE_SERVER_URL = 'http://<server-ip-or-localhost>:3000'
npm run dev
```

Open the browser to the URL printed by the client dev server (commonly `http://localhost:5173`). If accessing from another computer, use the client machine's IP and port printed by Vite (e.g., `http://192.168.1.123:5173`).

Allow firewall access (Windows)
------------------------------
If the other machine cannot reach the server or client dev server, you may need to add a firewall rule on the host machine to allow the port (3000 for server, 5173 for Vite by default):

```powershell
# as Administrator (example for server port 3000)
New-NetFirewallRule -DisplayName "SystemSync Server" -Direction Inbound -LocalPort 3000 -Protocol TCP -Action Allow
```

Production build and serving
----------------------------
To build the client for production and serve it with the Node server (or a static host):

1. Build the client:

```powershell
cd client
npm run build
```

2a. Serve the built files with a static server (simple):

```powershell
# from client/dist
npx serve dist -p 5173
```

2b. Or configure your Node server to serve the `client/dist` directory (common approach).

Running on another computer (LAN or over internet)
-------------------------------------------------
- To let other computers on the same LAN play, run the server on a machine with a LAN IP (e.g., `192.168.1.42`) and ensure firewall rules allow incoming connections to the server port. Point the client's `VITE_SERVER_URL` to that LAN IP.
- To make the server reachable over the internet, set up port forwarding on your router and use your public IP (or a reverse proxy / cloud VM). Note: exposing game servers publicly has security considerations.

Testing
-------
Run the unit tests (shared logic):

```powershell
npm test
```

This repository contains `tests/game.core.test.ts` which verifies core game rules.

Undo / revert changes
---------------------
If you applied patches or experiment changes and want to revert, use Git:

```powershell
# discard unstaged changes
git restore .

# reset to last commit (dangerous: discards local commits)
git reset --hard HEAD
```

Tips & troubleshooting
----------------------
- If the client can’t reach the server, check `VITE_SERVER_URL` and firewall/port forwarding.
- If typescript build errors appear on the server, run the server with `ts-node-dev` (dev) or compile with `tsc` to see full errors.
- Use `npm run dev` scripts shown in `package.json` — if scripts differ, check that file for exact commands.

Changes made by assistant
-------------------------
The assistant updated a few convenience UI features and server behaviors while helping with the project. Notable items:

- Matrix rain background component: `client/src/components/MatrixRain.tsx` (opt-in during lobby view).
- Custom Mode select component: `client/src/components/ModeSelect.tsx`.
- Server-side behavior: sudden-death mode now starts with fewer cards (server decides starting hand size) and win threshold is configurable.

If you'd like these notes removed or shortened, tell me and I'll adjust the README.

Contact
-------
If you want me to produce a single git patch containing the assistant's recent edits, or to set up a distribution package for another computer, say "Create patch" or "Build release" and I'll prepare it.


