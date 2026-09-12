# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Next.js (App Router) + TypeScript + Tailwind v4 + Drizzle ORM on SQLite (better-sqlite3), npm. The user chose Next.js + TypeScript from offered options; the ORM offered was Prisma, substituted with Drizzle because Prisma's current release line has proof-of-concept SQLite support. Runs locally; code is published to GitHub.

## Users

Primary: Korean final-year university students and fresh graduates preparing for 공채 (open-recruitment) season, who lack one specific skill or piece of insider knowledge that would let them break into a field. In the demo they are Korea University students and recent graduates. They arrive anxious and time-boxed, usually at night, with a half-written 자기소개서 and a list of application deadlines.

Secondary, equally weighted on the landing page: specialists, working professionals (Korea University alumni in the demo) who consult in exchange for platform credits and public reputation.

Admins review disputes, fraud flags, verifications, and payout requests.

For the hackathon demo, the landing page's first visitors are judges, who may not read Korean and will decide in seconds. The landing must make the idea, the credit mechanism, and the product's polish intelligible to a general audience on first view, with the Korean-first product behind it.

## Product Purpose

SunbaeHub (선배허브) lets seekers book one-on-one, chat-based consultations with verified specialists and pay in platform credits instead of cash. Specialists earn credits per session, build a reviewed reputation, and can request payouts. Success for a seeker is leaving a session with something concrete to add to a resume or application. Success for a specialist is being paid and reviewed fairly.

## Positioning

Prices follow proof, not the specialist's say-so: a specialist's rate rises above base with review count and average score, and the multiplier is shown with its reasons. Dissatisfied seekers get half their credits back after manual review. Review trading is detected by explainable rules and flagged publicly. Verified specialists also earn small credits from clicks on their posts, so expertise pays even between sessions.

## Operating Context

취준 (job-hunt) season. Seekers come from campus community apps and KakaoTalk group chats. Sessions are 60 minutes, booked from a specialist's weekly availability minus existing bookings, and happen only on the platform, only inside the booked window. Credits are held at booking and released to the specialist after the session. Timezone is Asia/Seoul.

## Capabilities and Constraints

- Specialist directory with category filter; profiles with education, experience, resume, reviews, availability, posts.
- Booking with escrow, cancellation rule (full refund more than 24 hours out, automatic 50% split otherwise).
- Session room with gated chat, automatic chat translation between Korean and English, a call placeholder, and session end.
- Reviews scored 0–100, one per completed booking; weighted leaderboard requiring at least three visible reviews.
- Fraud flags: reciprocal reviews, booking rings, repeat reviewers, high-score bursts, new accounts, instant empty reviews. Flagged reviews are excluded from stats until an admin resolves them.
- Refund disputes with a 5% platform fee; verification flow; posts with per-click credits; withdrawal requests.
- Bilingual interface, Korean first with an English toggle. Korean copy uses 해요체.
- Mocked for the MVP: authentication (pick a seeded user), payments (top-up and withdrawal are simulated), chat translation (phrase-map stub with a provider-agnostic interface), calls (placeholder).
- Undecided: real payment rails, real identity verification, real translation provider, encryption.

Terminology: seeker (도움을 구하는 사람), specialist / 선배 (전문가), credits (크레딧), session (세션 / 상담), dispute (환불 요청), flag (검토 표시).

## Brand Commitments

- Name: SunbaeHub (선배허브). 선배 is Korean for a senior or upperclassman; the product is the hub where you find one.
- Minimalism is binding across the product. The landing page may carry orchestrated animation; app screens carry state-change motion only.
- No gamified or playful tone: no confetti, mascots, badges raining down, cutesy copy.
- No generic SaaS template look.
- No logo, palette, or typeface exists yet.
- Landing page: a normal product landing page, the category standard executed at the craft level of Toss, 당근 (Karrot), and Kakao. Chosen by the user over the rolled and re-rolled directions; the demo is a recording of normal use, so no pitch gimmicks.

## Evidence on Hand

None real. Korea University is a demo framing only: seed data presents KU alumni specialists and KU student seekers and is labeled as demo data. No affiliation or partnership is claimed and no official Korea University marks are used. No testimonials, user counts, press, or partners exist, and none may be invented. Seed data is authored at full fidelity and marked synthetic.

## Product Principles

1. Price follows proof. Every multiplier is explained on screen.
2. The seeker is never trapped. Refund and cancellation terms are visible before booking.
3. Trust is earned in public. Reviews, flags, and verification status are legible to everyone they affect.
4. Bilingual by default, Korean first.
5. The tool disappears into the task. Delight is reserved for the landing page.

## Accessibility & Inclusion

Booking and chat are keyboard-operable. The landing page respects reduced-motion preferences and shows all content without waiting on animation. Korean and English copy are of equal quality.
