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

  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const cards = Array.from(root.querySelectorAll<HTMLElement>(":scope > .deck-card"));
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    let raf = 0;

    const measure = () => {
      const vh = window.innerHeight;
      for (const card of cards) {
        const h = card.offsetHeight;
        card.style.top = h > vh ? `${vh - h}px` : "0px";
      }
    };

    const update = () => {
      raf = 0;
      if (reduced.matches) return;
      const vh = window.innerHeight;
      for (let i = 0; i < cards.length - 1; i++) {
        const nextTop = cards[i + 1].getBoundingClientRect().top;
        const p = Math.min(1, Math.max(0, 1 - nextTop / vh));
        const v = p.toFixed(3);
        // `--deck-p`: how far the next card has covered this one. `--deck-enter`: the same number seen from the next
        // card, its own entry progress, which drives the reveals inside it so they finish before it pins.
        cards[i].style.setProperty("--deck-p", v);
        cards[i + 1].style.setProperty("--deck-enter", v);
        cards[i].classList.toggle("is-covered", p > 0 && p < 1);
        cards[i].classList.toggle("is-hidden", p >= 1);
      }
    };

    const schedule = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    const onResize = () => {
      measure();
      schedule();
    };

    const ro = new ResizeObserver(onResize);
    for (const card of cards) ro.observe(card);
    measure();
    update();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", onResize);
    reduced.addEventListener("change", schedule);
    return () => {
      ro.disconnect();
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", onResize);
      reduced.removeEventListener("change", schedule);
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div ref={ref} className="deck">
      {children}
    </div>
  );
}
