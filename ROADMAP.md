# Roadmap

Last updated: 2026-10-18

Deployment comes before splitting because a live, tested app is a stronger portfolio piece than a bigger unfinished one. Phase 1 closes before Phase 2 starts.

## Phase 0: Security and stability

- [x] JWT access tokens plus refresh tokens (refresh token in an httpOnly cookie, stored hashed, revoked on logout)
- [x] Rate limiting on signup (2/minute) and login (5/minute) with slowapi
- [x] Input validation: email format, password rules, amount ceiling (500,000), 2 decimal places, transaction date range (2020-01-01 to now)
- [x] Ownership checks that return 404 for both "not found" and "not yours"
- [x] Reversible migrations audit (enum cleanup on downgrade, backfill before NOT NULL)
- [x] Category delete with `ON DELETE RESTRICT` (409 while transactions still use it)
- [ ] Access token revocation after logout (jti blacklist or `token_version` on the user)
- [ ] Fix refresh token hashing: bcrypt only reads the first 72 bytes, so two refresh tokens for the same user issued close together match each other's hash
- [ ] Evaluate `python-jose` and `passlib` (current FastAPI docs use PyJWT and pwdlib; deprecation unconfirmed)

## Phase 1: Category analytics and graphs

- [x] `GET /analytics/spending-by-category` endpoint and bar chart (Recharts)
- [x] `GET /analytics/income-by-category` endpoint
- [x] `REFUND` transaction type (reduces spending, not counted as income)
- [ ] Income chart in the frontend
- [x] Trend-over-time endpoint (`GET /analytics/trend`, day or week buckets within one IST month)
- [ ] Trend chart in the frontend
- [ ] Multi-month trend (month buckets over a range, with a bucket-count cap)
- [ ] Date filters on the category analytics endpoints
- [x] pytest suite for analytics and the monthly summary (plus ownership and signup/login)
- [x] Refund edge cases covered by tests: refund in a later month, refund larger than a category's spending, refund with no purchase
- [ ] Decide on refunds with no matching purchase: link refunds to a purchase (`refund_of_id`) or explicitly accept them. Today a refund of any amount is accepted and can make spending negative; `test_refund_without_any_purchase_is_accepted` documents this and should change with the fix
- [ ] Refund recorded in a different category than its purchase (needs the same link)
- [ ] Make the 2020-01-01 transaction date floor an IST midnight (currently UTC, so 00:00 to 05:30 IST on Jan 1, 2020 is rejected)
- [ ] Summary card month label from the backend instead of the browser's timezone

## Phase 2: Production deployment (Render + Supabase + Vercel)

- [ ] CORS origins from an env var (currently hard-coded to `http://localhost:3000`)
- [ ] Refresh cookie that works between the frontend and the API (currently `samesite=lax`; needs same-site domains or a different design)
- [ ] Rate limiter that sees the real client IP behind the proxy (currently `get_remote_address`)
- [ ] Per-environment settings
- [ ] CI
- [x] `.env.example`
- [ ] Secrets in each platform's env settings
- [ ] Monitoring
- [ ] Load test
- [ ] Redis for the rate limiter when running more than one instance (currently in-memory)
- [ ] Access token revocation (if not done in Phase 0)

## Phase 3: Expense splitting

- [ ] Models: `Friend`, `Split`, `SplitParticipant`
- [ ] Email as the friend identifier
- [ ] Settlement and net balances
- [ ] Multiple accounts, which unblocks the "amount cannot exceed balance" rule

## Phase 4: AI analysis

- [ ] Stretch goal, deferred
