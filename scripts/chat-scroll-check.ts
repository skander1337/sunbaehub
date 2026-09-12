import assert from "node:assert/strict";
import { createChatScrollFollower } from "../src/lib/chat-scroll";

// Model browser geometry and intermediate smooth-scroll events without a database.
function viewport() {
  return {
    scrollTop: 0,
    scrollHeight: 2000,
    clientHeight: 400,
    calls: [] as ScrollToOptions[],
    scrollTo(options: ScrollToOptions) {
      this.calls.push(options);
      if (options.behavior === "instant") this.scrollTop = options.top ?? this.scrollTop;
    },
  };
}

const view = viewport();
const follower = createChatScrollFollower();
follower.follow(view, { force: true, instant: true });
assert.deepEqual(view.calls.at(-1), { top: 1600, behavior: "instant" }, "initial history lands immediately");
follower.onScroll(view);

// Someone reading earlier messages must stay there through messages, typing
// appearing/disappearing, and delayed image expansion.
follower.onUserScroll(view);
view.scrollTop = 600;
follower.onScroll(view);
const readingCalls = view.calls.length;
for (const heightChange of [160, 48, -48, 240]) {
  view.scrollHeight += heightChange;
  follower.follow(view);
  assert.equal(view.calls.length, readingCalls);
  assert.equal(view.scrollTop, 600);
}
console.log("PASS: incoming messages, typing, and image growth preserve a reader's history position");

// Sending text or a file explicitly follows, even after its SSE copy was
// deduplicated by the caller. Intermediate smooth events must not unpin it.
follower.follow(view, { force: true });
assert.deepEqual(view.calls.at(-1), { top: 2000, behavior: "smooth" });
view.scrollTop = 900;
follower.onScroll(view);
view.scrollHeight += 200;
follower.follow(view);
assert.deepEqual(view.calls.at(-1), { top: 2200, behavior: "smooth" }, "rapid incoming content extends an ongoing follow");
view.scrollTop = 2200;
follower.onScroll(view);
view.scrollHeight += 100;
follower.follow(view, { instant: true });
assert.deepEqual(view.calls.at(-1), { top: 2300, behavior: "instant" }, "a delayed image stays visible when following");
console.log("PASS: own-send follow and rapid updates remain pinned, including delayed image layout");

// User input interrupts a follow; its next scroll restores ordinary geometry
// tracking instead of being mistaken for another programmatic animation frame.
view.scrollHeight += 200;
follower.follow(view);
view.scrollTop = 2350;
follower.onUserScroll(view);
assert.deepEqual(view.calls.at(-1), { top: 2350, behavior: "instant" });
view.scrollTop = 700;
follower.onScroll(view);
const interruptedCalls = view.calls.length;
follower.follow(view);
assert.equal(view.calls.length, interruptedCalls);

// Rejoining within 64px of the bottom resumes following. Reduced motion is
// checked for each follow so a preference change never requests smooth motion.
view.scrollTop = view.scrollHeight - view.clientHeight - 64;
follower.onScroll(view);
follower.follow(view, { reducedMotion: true });
assert.deepEqual(view.calls.at(-1), { top: 2500, behavior: "instant" });
view.scrollTop = view.scrollHeight - view.clientHeight - 65;
follower.onScroll(view);
const outsideCalls = view.calls.length;
follower.follow(view, { reducedMotion: true });
assert.equal(view.calls.length, outsideCalls, "outside threshold stays in history even with reduced motion");
follower.follow(view, { force: true, reducedMotion: true });
assert.deepEqual(view.calls.at(-1), { top: 2500, behavior: "instant" });

const short = viewport();
short.scrollHeight = 200;
follower.follow(short, { force: true, instant: true });
assert.deepEqual(short.calls.at(-1), { top: 0, behavior: "instant" });
console.log("PASS: reader interruption, near-bottom boundary, reduced motion, and short histories");
