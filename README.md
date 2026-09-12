# 선배허브 SunbaeHub

**Book an hour of 1:1 consultation with a verified senior, pay in credits.** SunbaeHub (선배허브; 선배 means "senior") is a two-sided consultation marketplace for Korean students and fresh graduates: seekers book one-on-one sessions with specialists, pay in platform credits, and leave a review out of 100. Reviews set the specialist's price, dissatisfied seekers get half back after a human review, and review trading is flagged automatically.

Hackathon MVP. Korean first, English toggle. Runs locally on SQLite; nothing external.

## Run it

```bash
git clone <this repo> && cd sunbaehub
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
| 선배 (expert) | seojun@sunbaehub.demo | sunbae1234 |
| 관리자 (admin) | admin@sunbaehub.demo | admin1234 |

Every seeded seeker uses `hoobae1234` and every seeded specialist `sunbae1234`.

**Sign-up** at `/signup` creates real accounts for either role. A seeker is live immediately (optional affiliation, 70 welcome credits: enough for one 30-minute session with most specialists). A 선배 goes through onboarding: account → profile with education, experience, topics, base rate and a required CV (PDF) → *심사 요청* → the admin queue at `/admin/verifications`, where the team sets the specialist's base rate (credits per 60 minutes) on approval; rates can be changed later under 선배 요금. Until approved the profile is hidden from the directory, the leaderboard and the landing page, and cannot be booked; a rejection carries the admin's note and can be resubmitted after editing.

1. **김지우** (seeker) → 선배 찾기 → **박서준**. His price reads *135 크레딧 · 기본가의 1.35배 · 리뷰 12개 · 평균 88점*: the multiplier and its reason. Pick a slot, book. Credits are held.
2. 내 예약 → the live session with 박서준 → **입장하기**. In the incognito window log in as **박서준** → 선배 대시보드 → 입장하기. Both participants can enter only at the scheduled start; the button refreshes automatically, and direct links and chat APIs also enforce the start time. Booking attachments remain available in each participant's booking list for preparation. Messages arrive instantly over server-sent events with a typing indicator. Chat in Korean from one side and English from the other; each message shows auto-translated with a *원문 보기* toggle. Attach a PDF or image with the paperclip during the session, or at booking time. Try *통화* (a placeholder call with a timer). *세션 종료* ends it early.
3. 김지우 leaves a review (0–100). Settlement happens on review: 박서준 gets 95%, the platform 5%. His review count ticks to 13 and the price note updates.
4. **리더보드**: only specialists with 3+ visible reviews are ranked, by a Bayesian score.
5. **관리자** → 리뷰 검토: seven flagged reviews create nine flags across four rules (reciprocal reviews, booking rings, a high-score burst, a new account). Confirm one to hide it and strike both users; dismiss all remaining flags on another review to restore it. → 환불 요청: approve 이서윤's 105-credit dispute and watch three ledgers split 48 / 52 / 5. → 인증 요청: approve 윤서연 so she can post.
6. **글**: reading a verified specialist's post pays the author 1 credit, once per reader per day.

Dev-only buttons in the session room (*데모: 지금 시작 / 지금 종료*) shift a booking's window so you never wait for a slot while recording.

For recording, use `npm run dev`: the time controls are hidden under `npm run start`. Future rooms are locked until their scheduled start, including in development; prepare an active appointment in an isolated recording fixture or wait for its start. The time controls are available after entry. Calls are a timer-only demo; translation supports prepared phrases such as `감사합니다!` and `Feel free to ask anything.` Use separate browser profiles or normal/incognito windows for the two accounts (two normal tabs share login). The UI is shown in Seoul time. Do not reseed while the app is running or midway through a recording; reseeding deletes accounts/bookings and changes their IDs.

The consultation-purpose selector includes **기타 / Other**. Choosing it requires the seeker to describe their purpose (up to 500 characters); both the form and server reject a blank explanation. The description is shown to both participants in their booking details and session.

The specialist directory supports **Available today**, **Within my credits**, and **Soonest available** sorting. Select 30 or 60 minutes to compare the matching price and next bookable time; the selected duration carries into booking. Availability uses the same reservations and lead time as checkout, over the next 14 days in Seoul time. Credit filtering uses the signed-in user's actual balance.

Cancellation confirmation shows the exact credit refund, fee, and specialist compensation before either participant submits. If the refund changes while the page is open (for example, at the 24-hour cutoff), the server leaves the booking untouched and asks the participant to confirm the updated amount.

## What is real and what is mocked

| Real | Mocked for the demo |
|---|---|
| Data model, escrow ledger, dynamic pricing, cancellation rule, refund split, email + password auth (scrypt), DB-backed sessions with hashed tokens, login rate limiting, security headers | No email verification or password reset (no mail infrastructure) |
| Availability → 60-minute slots minus existing bookings, server-side double-booking check | Payments: top-up and withdrawal are simulated |
| Live chat over server-sent events with typing indicators and a polling fallback; file attachments (PDF/PNG/JPG, 10MB) scoped to participants; session-window gating (server enforced); lazy session lifecycle; 24h auto-settlement | Chat translation: a phrase-map stub behind a provider-agnostic `translate()`; unmatched text shows *번역 없음* |
| Six explainable fraud rules, admin queues, verification (requires an uploaded CV), posts with per-click credits, generated one-page CVs for every seeded specialist (`npm run make:cvs`) | Calls: a placeholder panel with a timer, no media |

Seed data is synthetic and labeled as demo. Korea University is used as the example community; no affiliation is claimed.

## How credits move (100-credit booking)

| Event | Ledger rows |
|---|---|
| Booking | seeker −100 (hold) |
| Session completed (on review, or 24h later) | specialist +95, platform +5 |
| Dispute approved | seeker +45, specialist +50, platform +5 |
| Cancel > 24h before | seeker +100 |
| Cancel ≤ 24h before | 45 / 50 / 5 split, no admin needed |

60-minute price = base × min(1 + 0.01·min(reviews, 20) + 0.35·clamp((avg − 65)/35, 0, 1), 1.5), from visible reviews only, rounded to 5, never below the platform floor of 50 credits. The base is set by admins; specialists only propose a rate. A 30-minute session costs half the 60-minute price. Sessions are 30 or 60 minutes, start times every 30 minutes within the specialist's availability.

## Stack

Next.js 16 (App Router, Turbopack), React 19, TypeScript, Tailwind v4, Drizzle ORM on SQLite via better-sqlite3 (prebuilt binary, no compile step), Pretendard Variable self-hosted. Drizzle was chosen over Prisma because Prisma's current release line has proof-of-concept SQLite support.

```
src/app          routes: (marketing)/ landing · (app)/ everything behind the nav · api/ chat, clicks, resume files
src/lib/rules    pure business rules: pricing, ranking, refund, slots, session, fraud
src/lib/services ledger, booking, review, dispute, settlement, post, admin (all inside SQLite transactions)
src/db           Drizzle schema, client, seed
src/lib/i18n     ko/en dictionary, locale cookie
```

Checks: `npm run test:business` runs in-memory regression tests for booking rules, demo time controls, and settlement rollback/retries. `npm run e2e:onboarding` walks a new 선배 through sign-up, onboarding with a CV, the pending state, admin approval and public listing, plus a seeker sign-up. `npm run e2e` drives two real browsers through login, booking with an attachment, live chat with translation, file download, call/session end, review, settlement, certificate navigation, and 30-minute demo controls. `npm run e2e:admin` checks admin login, flag decisions, refund accounting, and verification. `node scripts/mobile-check.mjs <specialistId>` checks 390px overflow, header labels, menu closing, and the reduced-motion landing page.

`npm run e2e:booking` checks both roles' scheduled entry, direct chat API restrictions, automatic button unlocking, preparation files, and required Other-purpose explanations.

`npm run test:refund` checks exact cancellation quotes and stale-confirmation protection in memory. `npm run test:discovery` checks slot availability, Seoul dates, duration prices, affordability, and sorting without opening the demo database. `npm run e2e:qol` checks both features in the browser against its own disposable fixture database; it also requires `BROWSER_DATABASE_IS_DISPOSABLE=1`.

Browser checks require a dev server and **change its demo data**. Run them in a disposable copy with its own seeded `dev.db`, not against the database used for recording. Set `BASE_URL` to that copy's server (for example `http://localhost:3107`); each script reads `dev.db` from its current directory. `npm run e2e` and `npm run e2e:booking` also require `BROWSER_DATABASE_IS_DISPOSABLE=1` because they adjust booking times in that test database. Seed before starting that server, and keep the recording server/database separate.

Design context lives in `PRODUCT.md` and `DESIGN.md` (Impeccable).
