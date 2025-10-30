System Sync
===========

Two-player card game implemented in TypeScript + React. This README explains how to install and run the project on a different computer (Windows instructions included).

Prerequisites
-------------
- Node.js 18+ (LTS recommended)
- npm (bundled with Node.js)
- Git
- Optional: a code editor such as VS Code

Clone the repository
--------------------
On the target computer, open PowerShell and run:

```powershell
# clone the repository
git clone https://github.com/LauraButterfly/SystemSync.git system-sync
cd system-sync
```

Install dependencies
--------------------
Install root and client dependencies:

```powershell
# from repo root
npm ci

# install client deps
cd client
npm ci
cd ..
```

Running in development (two terminals)
-------------------------------------
Open two PowerShell windows/tabs.

Terminal A — start the server:

```powershell
cd src/server
npm run dev
```

Terminal B — start the client (Vite dev server):

```powershell
cd client
npm run dev
```

Open the browser to the URL printed by the client dev server (commonly `http://localhost:5173`).
