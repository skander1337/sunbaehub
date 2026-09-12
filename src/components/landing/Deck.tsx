"use client";

import { useEffect, useRef, type ReactNode } from "react";

/**
 * Stacking cards: each direct `.deck-card` child pins at the top of the viewport and the next one slides over it.
 * This component only measures: cards taller than the viewport get a negative `top` so they scroll through before
 * pinning, and each covered card receives `--deck-p` (0 → 1 as the next card travels up the viewport) which the
 * stylesheet turns into the recede transform and the dim. Under reduced motion the cards are static and untouched.
 */
export function Deck({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const cards = Array.from(root.querySelectorAll<HTMLElement>(":scope > .deck-card"));
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    const revealProgress = new Map<HTMLElement, number>();
    let viewportHeight = window.innerHeight;
    let raf = 0;

    const clearMotion = () => {
      for (const card of cards) {
        card.classList.remove("is-covered", "is-hidden");
        card.style.removeProperty("--deck-p");
        card.style.removeProperty("--deck-enter");
        card.style.removeProperty("top");
      }
    };

    const measure = () => {
      if (reduced.matches) return;
      // The CSS probe uses the small viewport, which stays steady as mobile browser
      // toolbars expand or collapse, but still responds to rotation and real resizing.
      viewportHeight = Math.max(1, viewportRef.current?.getBoundingClientRect().height || window.innerHeight);
      const heights = cards.map((card) => card.offsetHeight);
      cards.forEach((card, i) => {
        card.style.top = heights[i] > viewportHeight ? `${viewportHeight - heights[i]}px` : "0px";
      });
    };

    const update = () => {
      raf = 0;
      if (reduced.matches) return;
      // Read all geometry before changing styles so scrolling does not alternate
      // layout reads and writes for every section.
      const nextTops = cards.slice(1).map((card) => card.getBoundingClientRect().top);
      for (let i = 0; i < cards.length - 1; i++) {
        const nextCard = cards[i + 1];
        const p = Math.min(1, Math.max(0, 1 - nextTops[i] / viewportHeight));
        const v = p.toFixed(3);
        // Cover motion reverses with scrolling; revealed content stays readable when
        // the visitor scrolls back through a section they have already seen.
        const entered = Math.max(revealProgress.get(nextCard) ?? 0, p);
        revealProgress.set(nextCard, entered);
        cards[i].style.setProperty("--deck-p", v);
        nextCard.style.setProperty("--deck-enter", entered.toFixed(3));
        cards[i].classList.toggle("is-covered", p > 0 && p < 1);
        cards[i].classList.toggle("is-hidden", p >= 1);
      }
    };

    const schedule = () => {
      if (reduced.matches) return;
      if (!raf) raf = requestAnimationFrame(update);
    };
    const onResize = () => {
      measure();
      schedule();
    };

    const onMotionChange = () => {
      cancelAnimationFrame(raf);
      raf = 0;
      // A preference change can happen mid-scroll: remove both covered-card state and
      // entry progress, so previously hidden and not-yet-revealed content returns at once.
      if (reduced.matches) {
        clearMotion();
        // Reduced motion reveals all content. Enabling motion again must not hide it.
        for (const card of cards) revealProgress.set(card, 1);
      } else {
        measure();
        update();
      }
    };

    const ro = new ResizeObserver(onResize);
    for (const card of cards) ro.observe(card);
    if (viewportRef.current) ro.observe(viewportRef.current);
    onMotionChange();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", onResize);
    reduced.addEventListener("change", onMotionChange);
    return () => {
      ro.disconnect();
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", onResize);
      reduced.removeEventListener("change", onMotionChange);
      cancelAnimationFrame(raf);
      clearMotion();
      revealProgress.clear();
    };
  }, []);

  return (
    <div ref={ref} className="deck">
      <div ref={viewportRef} className="deck-viewport" aria-hidden="true" />
      {children}
    </div>
  );
}
