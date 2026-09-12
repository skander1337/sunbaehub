type ScrollViewport = {
  scrollTop: number;
  scrollHeight: number;
  clientHeight: number;
  scrollTo: (options: ScrollToOptions) => void;
};

const FOLLOW_DISTANCE = 64;
const nearBottom = (view: ScrollViewport) => view.scrollHeight - view.clientHeight - view.scrollTop <= FOLLOW_DISTANCE;

/** Preserve reading position while allowing an explicitly followed conversation to grow. */
export function createChatScrollFollower() {
  let pinned = true;
  let smoothTarget: number | null = null;

  return {
    onScroll(view: ScrollViewport) {
      // Intermediate events from our own smooth scroll aren't a decision to
      // read history. User wheel/touch/keyboard input cancels this target first.
      if (smoothTarget !== null) {
        if (Math.abs(view.scrollTop - smoothTarget) > 1 && view.scrollTop < view.scrollHeight - view.clientHeight - 1) return;
        smoothTarget = null;
      }
      pinned = nearBottom(view);
    },
    onUserScroll(view: ScrollViewport) {
      if (smoothTarget !== null) view.scrollTo({ top: view.scrollTop, behavior: "instant" });
      smoothTarget = null;
      pinned = nearBottom(view);
    },
    follow(view: ScrollViewport, { force = false, instant = false, reducedMotion = false } = {}) {
      if (!force && !pinned) return;
      pinned = true;
      const top = Math.max(0, view.scrollHeight - view.clientHeight);
      const behavior = instant || reducedMotion ? "instant" : "smooth";
      if (behavior === "smooth" && Math.abs(view.scrollTop - top) <= 1) {
        smoothTarget = null;
        return;
      }
      smoothTarget = behavior === "smooth" ? top : null;
      view.scrollTo({ top, behavior });
    },
  };
}
