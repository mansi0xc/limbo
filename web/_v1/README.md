# Trellis web

The landing page for Trellis. Plain HTML, CSS and JS: no build step and no dependencies.

```sh
# from the repo root
npx serve web          # or: python3 -m http.server -d web 5173
```

Or just open `web/index.html` in a browser.

- `index.html`: the page. Every scene's final state is in the markup, so it reads fine without JS.
- `styles.css`: design tokens at the top (colours, fonts), light and dark.
- `main.js`: reveals, the hero loop and the step-through scenes. Set `REPO_URL` at the top.
- `PLAN.md`: the overall frontend plan (landing, live console, inspector).

Fonts (Instrument Serif, Geist, Geist Mono) load from Google Fonts, with system fallbacks if they don't.
To deploy, drop the folder on any static host (Vercel, Netlify, GitHub Pages) with `web/` as the root.
