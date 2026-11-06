# Trellis web

The Trellis landing page. React 19, Vite, Tailwind v4, Motion, and a small WebGL shader (ogl).
It lives on its own: nothing here imports from `src/` or `contracts/`.

```sh
cd web
npm install
npm run dev        # http://localhost:5173
npm run build      # static site in web/dist, deploy to Vercel, Netlify or Pages
```

- Set the repo link in `src/config.ts` (`REPO_URL`) before judging.
- Sections: hero (`Hero.tsx`), features bento (`Features.tsx`), the interactive demo (`Demo.tsx`),
  keepers vs Trellis (`Compare.tsx`), the rule, FAQ and closing (`Spec.tsx`).
- Numbers in the demo (block heights, 4.2 ETH, timestamps) are illustrative. Swap in real values from the live run.
- Motion: the shader pauses off-screen and in background tabs, caps the pixel ratio at 1.5, and falls back to a CSS
  gradient without WebGL. With reduced motion on, every scene shows its final state.
- The old static page is in `_v1/`.
