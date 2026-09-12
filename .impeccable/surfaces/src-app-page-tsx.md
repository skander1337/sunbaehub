---
version: 1
slug: "src-app-page-tsx"
primary_target: "src/app/page.tsx"
related_targets: ["src/app/(marketing)/page.tsx"]
---

# Surface brief: / (landing, Persuade)

Scope: the marketing landing page at `src/app/page.tsx` (route group `(marketing)`), plus the shared shell it establishes (nav, buttons, panels, type scale) that every app screen inherits. Visitor mode: Persuade. Audience: Korean students and graduates and the specialists who serve them, equally; the demo is a screen recording of normal use. Proof: seeded demo data labeled as demo, no invented claims. Constraints: Korean first with an English toggle, minimal, no playful tone, no SaaS template, reduced motion respected.

## Direction contract

THESIS: One indigo field owns the first viewport and a real product screen rises through its lower edge; the page proves the product by showing it. It refuses the mentor-photo grid, the search-first hero, and the three-feature-card scaffold.

OWN-WORLD: Indigo #2B44A8 is the only committed color: it carries the hero field, primary actions, and active states (hover #1F338A, tint #EEF1FB). Below the field: white #FFFFFF ground, mist #F2F4F6 panels, ink #191F28, secondary #4E5968, muted #8B95A1, hairlines #E5E8EB. Semantic states print as text tags (success #1B8A5A, danger #D6323C, warn #B7791F), never as fills. Pretendard Variable everywhere: 800 display with -0.03em tracking, 700 headings, 400/500 body, tabular numerals for credits. Pill buttons (radius 12px), 16px-radius panels, 1px hairlines, no gradients, no glass; one soft shadow (0 12px 32px rgba(25,31,40,.10)) only under the raised product screen.

STORY: The visitor reads in one line that SunbaeHub books an hour with a verified senior for credits, believes it because the three rules (price follows reviews, 50% refund, fraud flags) are stated plainly and the screen is the real product, then takes one of two equal actions: 선배 찾기 or 선배 되기.

FIRST VIEWPORT: The indigo field covers about 70% of the viewport height with the nav on it in white. Left-aligned within a 1120px container: the two-line headline in white at 56–64px ("취업 고민, 선배에게 1시간."), the English line beneath at 70% white, then a white pill primary "선배 찾기" and an outline-white secondary "선배 되기", then three short rule lines. Centered below, a real white product screen (박서준's booking card: rating, "135 크레딧 · 기본가의 1.35배 · 리뷰 12개 · 평균 88점", the next three open slots) 760px wide, its top third overlapping the field's bottom edge. Signature motion: the field is visible immediately; the two headline lines rise out of a mask 90ms apart, the subline, both buttons, and the three rules follow in sequence (220–640ms); the screen rises 40px through the edge from 260ms over 700ms ease-out while the price counts 100→135 and the review count ticks to 12; reduced motion shows the final frame.

FORM: Indigo Color-Field Hero, chosen by the user from the safer-register lineup in re-roll round 2 (position 3 of 4 in my grounded lineup); standing comparables Toss, 당근, Kakao; seed key 1c59240c.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

## Motion contract, round 2 (2026-09-12): 카드가 쌓인다 · Stacking Cards

Chosen by the user on the decision page from the bolder-register hand (five scroll-driven concepts; ANSWER optionId stacked-sheets, no steer, code-led). Thesis: every section is a card that pins at the top and recedes a step as the next card slides over it, so the page reads as a deck being dealt: hero, how it works, categories + sunbae strip, credits, and the indigo close on top.

Mechanics: five `.deck-card` sections inside `<Deck>` (src/components/landing/Deck.tsx). Cards are `position: sticky; top: 0; min-height: 100lvh`; a card taller than the viewport gets `top: vh − height` so it scrolls through before pinning. The deck sets `--deck-p` on a covered card (0 → 1 as the next card travels up the viewport) and the same number as `--deck-enter` on the entering card. Covered card: `scale(1 − 0.04·p)` from its top edge plus an ink overlay up to 16%; fully covered cards go `visibility: hidden` (out of the tab order). Incoming cards carry a 16px top radius and a 1px hairline; the close card is indigo with the two actions and the footer. In-card reveals (`.reveal`, `.reveal-list > *`) map `--deck-enter` to opacity/translate with a 6% stagger per sibling and finish by entry 0.92, before the card pins; they never use their own view timelines, which would freeze mid-reveal on a pinned card. Reduced motion: cards static in flow, no recede, everything visible. Phones: identical, tall cards bottom-align before pinning.

Kept from the world: indigo only, one shadow (under the product screen), no gradients; the "shadow steps" of the pattern are realised as the dim, not a shadow.

Fill pass (2026-09-12, after "a bit too basic"): the cards carry real product artifacts, not decoration. Hero: a `다음 빈 시간` panel on the field (three other ranked sunbae with their next open time and price, from the same slot rules as checkout; desktop only) and the featured sunbae's best visible review quoted on the product screen with its score. Card 2: one static figure per step (src/components/landing/Figures.tsx): the slot picker with the featured sunbae's real next days and times, the session room with two phrase-map exchanges and their auto-translations, and the review score 92 with the multiplier the pricing rule actually returns. Card 4: a ledger of one session at the featured price, with the real outputs of normalSettlement and refundSplit. Figures are aria-hidden and static; the motion stays the deck's.

## Unresolved

Exact headline copy may be tuned during build; the two actions, the three rules, and the real product screen are fixed.
