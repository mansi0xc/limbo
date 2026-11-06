import { useEffect, useRef, useState } from "react";
import { Renderer, Program, Mesh, Triangle } from "ogl";

// A woven lattice (the trellis) that drifts slowly, with lime pulses travelling
// along the threads like transactions. One fullscreen triangle, one fragment shader.
// Falls back to a CSS gradient when WebGL is missing; renders one still frame
// under reduced motion; pauses off-screen and in background tabs.

const frag = /* glsl */ `
precision highp float;
uniform float uTime;
uniform vec2 uRes;
uniform vec2 uMouse;
uniform float uDensity;
uniform vec2 uFocus;

float hash(float n) { return fract(sin(n) * 43758.5453123); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float n = dot(i, vec2(1.0, 57.0));
  return mix(mix(hash(n), hash(n + 1.0), f.x), mix(hash(n + 57.0), hash(n + 58.0), f.x), f.y);
}
float fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 4; i++) { v += a * noise(p); p *= 2.03; a *= 0.5; }
  return v;
}

void main() {
  vec2 p = (gl_FragCoord.xy - 0.5 * uRes) / uRes.y;
  vec2 m = (uMouse - 0.5 * uRes) / uRes.y;
  float t = uTime;

  // slow organic warp, pulled a little toward the cursor
  vec2 toM = p - m;
  float mInfl = exp(-dot(toM, toM) * 6.0);
  vec2 w = p + 0.16 * vec2(fbm(p * 1.3 + t * 0.03), fbm(p * 1.3 - t * 0.025 + 7.1)) - 0.08;
  w -= toM * mInfl * 0.06;

  // rotate 45 degrees: a diamond trellis
  mat2 R = mat2(0.7071, -0.7071, 0.7071, 0.7071);
  vec2 q = R * w * uDensity;

  vec2 dl = abs(fract(q + 0.5) - 0.5);
  float px = uDensity / uRes.y * 1.25;
  float lu = 1.0 - smoothstep(0.0, px, dl.x);
  float lv = 1.0 - smoothstep(0.0, px, dl.y);
  float halo = exp(-dl.x * 22.0) + exp(-dl.y * 22.0);

  // pulses along some threads (comet: sharp head, long tail)
  float idU = floor(q.x + 0.5), idV = floor(q.y + 0.5);
  float su = step(0.62, hash(idU * 3.17 + 1.0));
  float sv = step(0.66, hash(idV * 5.71 + 2.0));
  float pu = pow(fract(q.y * 0.07 - t * (0.05 + 0.05 * hash(idU)) + hash(idU * 1.7)), 26.0) * su;
  float pv = pow(fract(q.x * 0.07 + t * (0.045 + 0.04 * hash(idV + 9.0)) + hash(idV * 2.3)), 26.0) * sv;
  float pulse = (lu + halo * 0.35) * pu + (lv + halo * 0.35) * pv;

  // knots at the crossings
  float knot = exp(-dot(dl, dl) * 160.0);

  // light falls off away from the focus point, lifts under the cursor
  float focus = smoothstep(1.25, 0.0, length(p - uFocus));
  float lift = 0.55 + 0.9 * mInfl;

  vec3 ink = vec3(0.027, 0.031, 0.039);
  vec3 lilac = vec3(0.65, 0.61, 1.0);
  vec3 lime = vec3(0.77, 0.96, 0.40);

  vec3 col = ink;
  col += lilac * ((lu + lv) * 0.15 + halo * 0.025 + knot * 0.3) * focus * lift;
  col += lime * pulse * 1.5 * focus;
  col += lilac * 0.05 * fbm(p * 1.8 + t * 0.04) * focus;

  // fade into the page at the bottom
  col = mix(ink, col, smoothstep(-0.52, -0.05, p.y));
  gl_FragColor = vec4(col, 1.0);
}
`;

const vert = /* glsl */ `
attribute vec2 position;
void main() { gl_Position = vec4(position, 0.0, 1.0); }
`;

export default function Shader({
  className = "",
  density = 7,
  focus = [0.38, 0.18],
}: { className?: string; density?: number; focus?: [number, number] }) {
  const host = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let renderer: Renderer;
    try {
      renderer = new Renderer({ dpr: Math.min(window.devicePixelRatio, 1.5), alpha: false, antialias: false });
    } catch {
      setFailed(true);
      return;
    }
    const gl = renderer.gl;
    if (!gl) { setFailed(true); return; }
    gl.canvas.style.width = "100%";
    gl.canvas.style.height = "100%";
    gl.canvas.style.display = "block";
    el.appendChild(gl.canvas);

    const program = new Program(gl, {
      vertex: vert,
      fragment: frag,
      uniforms: {
        uTime: { value: 0 },
        uRes: { value: [1, 1] },
        uMouse: { value: [-9999, -9999] },
        uDensity: { value: density },
        uFocus: { value: focus },
      },
    });
    const mesh = new Mesh(gl, { geometry: new Triangle(gl), program });

    const target = { x: -9999, y: -9999 };
    const cur = { x: -9999, y: -9999 };
    const resize = () => {
      const r = el.getBoundingClientRect();
      renderer.setSize(r.width, r.height);
      program.uniforms.uRes.value = [gl.canvas.width, gl.canvas.height];
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(el);

    const onMove = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      const s = gl.canvas.width / r.width;
      target.x = (e.clientX - r.left) * s;
      target.y = (r.height - (e.clientY - r.top)) * s;
      if (cur.x < -999) { cur.x = target.x; cur.y = target.y; }
    };
    window.addEventListener("pointermove", onMove, { passive: true });

    let raf = 0, visible = true, last = performance.now(), time = 12;
    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      time += dt;
      cur.x += (target.x - cur.x) * 0.06;
      cur.y += (target.y - cur.y) * 0.06;
      program.uniforms.uTime.value = time;
      program.uniforms.uMouse.value = [cur.x, cur.y];
      renderer.render({ scene: mesh });
      if (visible && !document.hidden) raf = requestAnimationFrame(frame);
      else raf = 0;
    };
    const start = () => { if (!raf && !reduce) { last = performance.now(); raf = requestAnimationFrame(frame); } };

    if (reduce) renderer.render({ scene: mesh });
    else start();

    const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible) start(); });
    io.observe(el);
    const onVis = () => { if (!document.hidden) start(); };
    document.addEventListener("visibilitychange", onVis);

    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
      ro.disconnect();
      window.removeEventListener("pointermove", onMove);
      document.removeEventListener("visibilitychange", onVis);
      gl.getExtension("WEBGL_lose_context")?.loseContext();
      gl.canvas.remove();
    };
  }, [density, focus[0], focus[1]]);

  return (
    <div
      ref={host}
      aria-hidden
      className={className}
      style={
        failed
          ? { background: "radial-gradient(60% 60% at 70% 25%, rgb(166 156 255 / .18), transparent 70%), radial-gradient(40% 40% at 80% 10%, rgb(197 244 103 / .10), transparent 70%)" }
          : undefined
      }
    />
  );
}
