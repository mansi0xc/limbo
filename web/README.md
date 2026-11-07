# Limbo web

Landing page for Limbo. Next.js (App Router) + TypeScript.

```sh
npm install
npm run dev     # http://localhost:3000
npm run build
```

- Live figures use the [`shaders`](https://shaders.com) WebGPU library (`EngravedPlate`, `ContourBand`), with static fallbacks when WebGPU is unavailable.
- The latch simulator (`src/components/LatchSimulator.tsx`) runs entirely in the browser; its hashes, blocks and balances are illustrative.
- The park explorer (`/explorer`, `src/components/ParkExplorer.tsx`) reads two live park nodes' `GET /status` every second: `NEXT_PUBLIC_PARK_A` / `NEXT_PUBLIC_PARK_B`, default `http://127.0.0.1:8787` and `:8788`. It is read-only; the nodes allow cross-origin reads on `/status` and `/health` only.
- Dark theme is the default; the nav toggle switches to light and remembers the choice in `localStorage`.
