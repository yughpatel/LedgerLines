import { useCallback, useEffect, useLayoutEffect, useState } from "react";

const PAGES = ["overview", "transactions"];

// The page lives in the URL hash (#overview, #transactions), so refresh and the
// back button work without a router
export function useHashPage() {
  const read = () => {
    const name = window.location.hash.slice(1);
    return PAGES.includes(name) ? name : "overview";
  };
  const [page, setPage] = useState(read);
  useEffect(() => {
    const onHash = () => setPage(read());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);
  const go = useCallback((next) => {
    if (window.location.hash !== `#${next}`) window.location.hash = next;
    setPage(next);
    window.scrollTo({ top: 0 });
  }, []);
  return [page, go];
}

const lightQuery = () => window.matchMedia("(prefers-color-scheme: light)");

// Dark first: with no saved choice, the page is dark unless the OS asks for light.
// A choice is saved as ll_theme and applied before first paint by index.html
export function useTheme() {
  const effective = () => {
    const chosen = document.documentElement.dataset.theme;
    if (chosen) return chosen;
    return lightQuery().matches ? "light" : "dark";
  };
  const [theme, setTheme] = useState(effective);
  useEffect(() => {
    const query = lightQuery();
    const onChange = () => setTheme(effective());
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);
  const toggle = useCallback(() => {
    const next = effective() === "dark" ? "light" : "dark";
    const apply = () => {
      document.documentElement.dataset.theme = next;
      try { localStorage.setItem("ll_theme", next); } catch { /* storage blocked */ }
      setTheme(next);
    };
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    // A soft cross-fade where the browser supports it
    if (document.startViewTransition && !reduce) document.startViewTransition(apply);
    else apply();
  }, []);
  return [theme, toggle];
}

// Close a popover on Escape or a click outside it
export function useDismiss(ref, open, onDismiss) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === "Escape") onDismiss(); };
    const onDown = (e) => { if (ref.current && !ref.current.contains(e.target)) onDismiss(); };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onDown);
    };
  }, [ref, open, onDismiss]);
}

// Position of the active item inside a container, for a sliding indicator.
// Re-measured on resize, so it follows layout changes
export function useActiveRect(containerRef, activeKey) {
  const [rect, setRect] = useState(null);
  useLayoutEffect(() => {
    const measure = () => {
      const box = containerRef.current;
      const el = box?.querySelector(`[data-key="${activeKey}"]`);
      if (!box || !el) return setRect(null);
      setRect({ left: el.offsetLeft, top: el.offsetTop, width: el.offsetWidth, height: el.offsetHeight });
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [containerRef, activeKey]);
  return rect;
}

export const prefersReducedMotion = () =>
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;
