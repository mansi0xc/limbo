import { useEffect } from "react";
import Lenis from "lenis";
import { MotionConfig } from "motion/react";
import Hero, { Nav } from "./components/Hero";
import Features from "./components/Features";
import Demo from "./components/Demo";
import Compare from "./components/Compare";
import { Spec, Questions, Closing } from "./components/Spec";

export default function App() {
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const lenis = new Lenis({ duration: 1.1, anchors: { offset: -80 } });
    let id = 0;
    const raf = (t: number) => { lenis.raf(t); id = requestAnimationFrame(raf); };
    id = requestAnimationFrame(raf);
    return () => { cancelAnimationFrame(id); lenis.destroy(); };
  }, []);

  return (
    <MotionConfig reducedMotion="user">
      <div className="grain">
        <Nav />
        <main>
          <Hero />
          <Features />
          <Demo />
          <Compare />
          <Spec />
          <Questions />
        </main>
        <Closing />
      </div>
    </MotionConfig>
  );
}
