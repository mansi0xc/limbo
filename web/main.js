// Trellis landing page. Plain JS, no dependencies.
// Everything here is an enhancement: without it the page shows every scene in its final state.

// Set this when the public repo exists, and every GitHub link on the page picks it up.
const REPO_URL = "";

(() => {
  const root = document.documentElement;
  root.classList.add("ready");
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];

  if (REPO_URL) $$("[data-repo]").forEach((a) => (a.href = REPO_URL));

  // ---------- nav border on scroll ----------
  const nav = $("#nav");
  const onScroll = () => nav.classList.toggle("scrolled", window.scrollY > 8);
  onScroll();
  window.addEventListener("scroll", onScroll, { passive: true });

  // ---------- theme ----------
  try {
    const saved = localStorage.getItem("trellis-theme");
    if (saved) root.dataset.theme = saved;
  } catch (_) {}
  $("#theme")?.addEventListener("click", () => {
    const dark = root.dataset.theme
      ? root.dataset.theme === "dark"
      : window.matchMedia("(prefers-color-scheme: dark)").matches;
    root.dataset.theme = dark ? "light" : "dark";
    try { localStorage.setItem("trellis-theme", root.dataset.theme); } catch (_) {}
  });

  // ---------- visibility helper ----------
  const watch = (el, onIn, onOut, threshold = 0.25) => {
    if (!("IntersectionObserver" in window)) { onIn(); return; }
    new IntersectionObserver(
      (entries) => entries.forEach((e) => (e.isIntersecting ? onIn() : onOut && onOut())),
      { threshold }
    ).observe(el);
  };

  // ---------- reveal on scroll ----------
  $$(".reveal").forEach((el) => {
    if (reduce || !("IntersectionObserver" in window)) { el.classList.add("seen"); return; }
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => { if (e.isIntersecting) { el.classList.add("seen"); io.disconnect(); } });
    }, { threshold: 0.12, rootMargin: "0px 0px -6% 0px" });
    io.observe(el);
  });

  // ---------- a pausable step loop ----------
  // Runs steps on a timer while its element is on screen and the tab is visible.
  const loop = (el, steps) => {
    let i = 0, timer = null, onScreen = false, running = false;
    const next = () => {
      timer = null;
      if (!running) return;
      const s = steps[i];
      s.run();
      i = (i + 1) % steps.length;
      timer = setTimeout(next, s.ms);
    };
    const sync = () => {
      const should = onScreen && !document.hidden;
      if (should && !running) { running = true; next(); }
      if (!should && running) { running = false; clearTimeout(timer); timer = null; }
    };
    watch(el, () => { onScreen = true; sync(); }, () => { onScreen = false; sync(); }, 0.2);
    document.addEventListener("visibilitychange", sync);
    return { reset(to = 0) { i = to; if (running) { clearTimeout(timer); next(); } } };
  };

  // ---------- hero stage ----------
  const stage = $("#stage");
  if (stage && !reduce) {
    const chain = $("#chain");
    const slotNum = $("#slot-num");
    let height = 1206;
    const capPark = $("#cap-park"), capPred = $("#cap-pred");
    const caption = (el, text) => {
      if (el.textContent === text) return;
      el.classList.add("swap");
      setTimeout(() => { el.textContent = text; el.classList.remove("swap"); }, 260);
    };
    const filler = () => {
      const d = document.createElement("div");
      d.className = "tx";
      d.style.width = 48 + Math.round(Math.random() * 42) + "%";
      return d;
    };
    const tx = (cls, label) => {
      const d = document.createElement("div");
      d.className = "tx " + cls;
      d.textContent = label;
      return d;
    };
    const tick = (special = []) => {
      height += 1;
      slotNum.textContent = height;
      const b = document.createElement("div");
      b.className = "block in";
      b.innerHTML = `<div class="block-n"><span>#${height}</span></div>`;
      special.forEach((s) => b.appendChild(s));
      const n = special.length ? 1 : 2 + Math.round(Math.random());
      for (let k = 0; k < n; k++) b.appendChild(filler());
      chain.appendChild(b);
      const first = chain.firstElementChild;
      first.classList.add("out");
      setTimeout(() => first.remove(), 750);
    };
    const set = (...cls) => {
      ["s1", "s2", "s3", "s4", "s5", "s6"].forEach((c) => stage.classList.toggle(c, cls.includes(c)));
    };

    // Start from a clean, empty state.
    set();
    capPark.textContent = "Three sibling cheques parked. Waiting on the latch.";
    capPred.textContent = "Waiting for a maker’s quote.";

    loop(stage, [
      { ms: 1900, run: () => { set(); caption(capPark, "Three sibling cheques parked. Waiting on the latch."); caption(capPred, "Waiting for a maker’s quote."); tick(); } },
      { ms: 1500, run: () => { set("s1"); tick(); } },
      { ms: 1600, run: () => { set("s1", "s2"); caption(capPark, "The oracle attested. The latch flips once, for good."); } },
      { ms: 1900, run: () => { set("s1", "s2", "s3"); caption(capPark, "Winner promoted with its signed bytes unchanged. Siblings evicted, nothing simulated."); tick([tx("park", "CET_YES")]); } },
      { ms: 1800, run: () => { set("s1", "s2", "s3", "s4"); caption(capPred, "Quote #42 arrives. One trade binds to it, another to #41."); } },
      { ms: 1600, run: () => { set("s1", "s2", "s3", "s4", "s5"); caption(capPred, "#41 is stale, so it’s turned away at admission."); } },
      { ms: 2800, run: () => { set("s1", "s2", "s3", "s4", "s5", "s6"); caption(capPred, "Quote at index 0, trade at index 1, in the same block."); tick([tx("pred", "0 · quote #42"), tx("pred t", "1 · trade → #42")]); } },
    ]);
  }

  // ---------- step-through explainers ----------
  $$("[data-explainer]").forEach((box) => {
    const scene = $(".scene", box);
    const buttons = $$(".steps button[data-step]", box);
    const bar = $(".progress i", box);
    const total = buttons.length;
    const DUR = 3400;
    let step = 1, timer = null, onScreen = false, idleUntil = 0;

    const render = (n) => {
      step = n;
      buttons.forEach((b) => b.classList.toggle("active", +b.dataset.step === n));
      const at = (attr, cls) => $$(`[${attr}]`, scene).forEach((el) => el.classList.toggle(cls, n >= +el.getAttribute(attr)));
      at("data-from", "on");
      at("data-mark", "marked");
      at("data-sent", "sent");
      at("data-flip", "flipped");
      at("data-land", "on-land");
    };
    const runBar = (ms) => {
      if (!bar) return;
      bar.classList.remove("run");
      void bar.offsetWidth;
      bar.style.setProperty("--dur", ms + "ms");
      bar.classList.add("run");
    };
    const schedule = () => {
      clearTimeout(timer);
      if (reduce || !onScreen || document.hidden) { bar?.classList.remove("run"); return; }
      const wait = Math.max(0, idleUntil - Date.now());
      const ms = (step === total ? DUR + 1400 : DUR) + wait;
      if (!wait) runBar(ms);
      timer = setTimeout(() => { render(step === total ? 1 : step + 1); schedule(); }, ms);
    };

    buttons.forEach((b) => b.addEventListener("click", () => {
      render(+b.dataset.step);
      idleUntil = Date.now() + 9000; // let people read before autoplay resumes
      bar?.classList.remove("run");
      schedule();
    }));

    // DLC / deadman tabs
    const tabs = $$(".tabs [data-mode]", box);
    tabs.forEach((t) => t.addEventListener("click", () => {
      const mode = t.dataset.mode;
      tabs.forEach((x) => x.setAttribute("aria-selected", String(x === t)));
      scene.classList.toggle("mode-dlc", mode === "dlc");
      scene.classList.toggle("mode-dead", mode === "dead");
      $$("[data-dlc]", box).forEach((el) => (el.textContent = el.dataset[mode]));
      render(1);
      idleUntil = 0;
      schedule();
    }));

    render(reduce ? total : 1);
    watch(box, () => { onScreen = true; schedule(); }, () => { onScreen = false; schedule(); }, 0.3);
    document.addEventListener("visibilitychange", schedule);
  });

  // ---------- frame tabs ----------
  const ftabs = $$("[data-frames]");
  ftabs.forEach((t) => t.addEventListener("click", () => {
    ftabs.forEach((x) => x.setAttribute("aria-selected", String(x === t)));
    $$(".frame-set").forEach((s) => {
      const show = s.dataset.set === t.dataset.frames;
      s.hidden = !show;
      if (show) s.classList.add("seen");
    });
  }));
})();
