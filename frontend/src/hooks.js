import { useEffect, useRef, useState } from "react";

/** "#/results" style routing, no library needed. */
export function useRoute() {
  const read = () => (window.location.hash.startsWith("#/results") ? "results" : "home");
  const [route, setRoute] = useState(read);
  useEffect(() => {
    const on = () => { setRoute(read()); };
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);
  return route;
}

const reduced = () => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/** Animate a number from 0 to `target` once it scrolls into view. */
export function useCountUp(target, ms = 1100) {
  const [value, setValue] = useState(0);
  const ref = useRef(null);
  useEffect(() => {
    if (target == null) return;
    if (reduced()) { setValue(target); return; }
    let raf, started = false;
    const run = () => {
      const t0 = performance.now();
      const step = (now) => {
        const p = Math.min(1, (now - t0) / ms);
        setValue(target * (1 - Math.pow(1 - p, 3)));
        if (p < 1) raf = requestAnimationFrame(step);
      };
      raf = requestAnimationFrame(step);
    };
    const el = ref.current;
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting && !started) { started = true; run(); } }, { threshold: 0.3 });
    if (el) io.observe(el); else run();
    return () => { io.disconnect(); cancelAnimationFrame(raf); };
  }, [target, ms]);
  return [value, ref];
}

/** Adds .in-view when the element scrolls into view (for entrance animations). */
export function useReveal() {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (reduced()) { el.classList.add("in-view"); return; }
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { el.classList.add("in-view"); io.disconnect(); } }, { threshold: 0.15 });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return ref;
}
