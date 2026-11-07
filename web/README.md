# Limbo web

Landing page for Limbo. Next.js (App Router) + TypeScript.

```sh
npm install
npm run dev     # http://localhost:3000
npm run build
```

- Live figures use the [`shaders`](https://shaders.com) WebGPU library (`EngravedPlate`, `ContourBand`), with static fallbacks when WebGPU is unavailable.
- The latch simulator (`src/components/LatchSimulator.tsx`) runs entirely in the browser; its hashes, blocks and balances are illustrative.
- Dark theme is the default; the nav toggle switches to light and remembers the choice in `localStorage`.
