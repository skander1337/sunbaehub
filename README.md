# 선배 Sunbae

**Book an hour with a verified senior, pay in credits.** Sunbae (선배, "senior") is a two-sided consultation marketplace for Korean students and fresh graduates: seekers book one-on-one sessions with specialists, pay in platform credits, and leave a review out of 100. Reviews set the specialist's price, dissatisfied seekers get half back after a human review, and review trading is flagged automatically.

Hackathon MVP. Korean first, English toggle. Runs locally on SQLite; nothing external.

## Run it

```bash
git clone <this repo> && cd hackathon
npm install
npm run setup     # creates dev.db and seeds the demo data
npm run dev       # http://localhost:3000
```

Requires Node 20.9+ (built with Node 24). `npm run setup` is safe to re-run: it rebuilds the database from scratch.

## Demo script (the golden path)

Log in at `/login` with the demo credentials below (they are not shown anywhere in the UI). Use a normal window and an incognito window to be two people at once.

| Role | Email | Password |
|---|---|---|
| 후배 (seeker) | jiwoo@korea.ac.kr | hoobae1234 |
| 선배 (expert) | seojun@sunbae.demo | sunbae1234 |
| 관리자 (admin) | admin@sunbae.demo | admin1234 |

Every seeded seeker uses `hoobae1234` and every seeded specialist `sunbae1234`. Sign-up at `/signup` creates real accounts (scrypt-hashed passwords) for either role.

1. **김지우** (seeker) → 선배 찾기 → **박서준**. His price reads *135 크레딧 · 기본가의 1.35배 · 리뷰 12개 · 평균 88점*: the multiplier and its reason. Pick a slot, book. Credits are held.
2. 내 예약 → the live session with 박서준 → **입장하기**. In the incognito window log in as **박서준** → 선배 대시보드 → 입장하기. Chat in Korean from one side and English from the other; each message shows auto-translated with a *원문 보기* toggle. Try *통화* (a placeholder call with a timer). *세션 종료* ends it early.
3. 김지우 leaves a review (0–100). Settlement happens on review: 박서준 gets 95%, the platform 5%. His review count ticks to 13 and the price note updates.
4. **리더보드**: only specialists with 3+ visible reviews are ranked, by a Bayesian score.
5. **관리자** → 리뷰 검토: seven flagged reviews from three rules (reciprocal reviews, a high-score burst, a new account). Confirm one to hide it and strike both users; dismiss another to restore it. → 환불 요청: approve 이서윤's dispute and watch three ledgers split 45 / 50 / 5. → 인증 요청: approve 윤서연 so she can post.
6. **글**: reading a verified specialist's post pays the author 1 credit, once per reader per day.

Dev-only buttons in the session room (*데모: 지금 시작 / 지금 종료*) shift a booking's window so you never wait for a slot while recording.

## What is real and what is mocked

| Real | Mocked for the demo |
|---|---|
| Data model, escrow ledger, dynamic pricing, cancellation rule, refund split, email + password auth (scrypt), DB-backed sessions with hashed tokens, login rate limiting, security headers | No email verification or password reset (no mail infrastructure) |
| Availability → 60-minute slots minus existing bookings, server-side double-booking check | Payments: top-up and withdrawal are simulated |
| Session-window gating of chat (server enforced), lazy session lifecycle, 24h auto-settlement | Chat translation: a phrase-map stub behind a provider-agnostic `translate()`; unmatched text shows *번역 없음* |
| Six explainable fraud rules, admin queues, verification, posts with per-click credits | Calls: a placeholder panel with a timer, no media |

Seed data is synthetic and labeled as demo. Korea University is used as the example community; no affiliation is claimed.

## How credits move (100-credit booking)

| Event | Ledger rows |
|---|---|
| Booking | seeker −100 (hold) |
| Session completed (on review, or 24h later) | specialist +95, platform +5 |
| Dispute approved | seeker +45, specialist +50, platform +5 |
| Cancel > 24h before | seeker +100 |
| Cancel ≤ 24h before | 45 / 50 / 5 split, no admin needed |

Price = base × min(1 + 0.01·min(reviews, 20) + 0.35·clamp((avg − 65)/35, 0, 1), 1.5), from visible reviews only, rounded to 5.

## Stack

Next.js 16 (App Router, Turbopack), React 19, TypeScript, Tailwind v4, Drizzle ORM on SQLite via better-sqlite3 (prebuilt binary, no compile step), Pretendard Variable self-hosted. Drizzle was chosen over Prisma because Prisma's current release line has proof-of-concept SQLite support.

```
src/app          routes: (marketing)/ landing · (app)/ everything behind the nav · api/ chat, clicks, resume files
src/lib/rules    pure business rules: pricing, ranking, refund, slots, session, fraud
src/lib/services ledger, booking, review, dispute, settlement, post, admin (all inside SQLite transactions)
src/db           Drizzle schema, client, seed
src/lib/i18n     ko/en dictionary, locale cookie
```

Design context lives in `PRODUCT.md` and `DESIGN.md` (Impeccable).
