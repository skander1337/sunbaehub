import type { ReactNode } from "react";

/**
 * Scroll-driven reveal with no JavaScript: visible by default, animates in as it enters the viewport
 * where `animation-timeline: view()` is supported, and stays static under reduced motion.
 */
export function Reveal({ children, className = "" }: { children: ReactNode; className?: string; delay?: number }) {
  return <div className={`reveal ${className}`}>{children}</div>;
}
