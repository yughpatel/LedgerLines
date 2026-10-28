# Roadmap

Last updated: 2026-10-24

Deployment comes before splitting because a live, tested app is a stronger portfolio piece than a bigger unfinished one. Phase 1 closes before Phase 2 starts.

## Phase 0: Security and stability

- [x] JWT access tokens plus refresh tokens (refresh token in an httpOnly cookie, stored hashed, revoked on logout)
- [x] Rate limiting on signup (2/minute) and login (5/minute) with slowapi
- [x] Input validation: email format, password rules, amount ceiling (500,000), 2 decimal places, transaction date range (2020-01-01 to now)
- [x] Ownership checks that return 404 for both "not found" and "not yours"
- [x] Reversible migrations audit (enum cleanup on downgrade, backfill before NOT NULL)
- [x] Category delete with `ON DELETE RESTRICT` (409 while transactions still use it)
- [ ] Access token revocation after logout (jti blacklist or `token_version` on the user)
- [x] Fix refresh token hashing: SHA-256 digest with a unique index instead of bcrypt (which only read the first 72 bytes, so same-user tokens collided), plus a random `jti` per token
- [ ] Refresh token rotation with reuse detection (reuse detection only means something once rotation exists)
- [ ] Clean up expired and revoked rows in `refresh_tokens`
- [x] Replace `python-jose` with PyJWT and `passlib` with pwdlib (bcrypt kept, so existing hashes still verify; `bcrypt` pinned below 5.0, which raises on passwords over 72 bytes instead of truncating)

## Phase 1: Category analytics and graphs

- [x] `GET /analytics/spending-by-category` endpoint and bar chart (Recharts)
- [x] `GET /analytics/income-by-category` endpoint
- [x] `REFUND` transaction type (reduces spending, not counted as income)
- [x] Income chart in the frontend
- [x] Trend-over-time endpoint (`GET /analytics/trend`, day or week buckets within one IST month)
- [x] Trend chart in the frontend (current month, daily or weekly)
- [x] pytest suite for analytics and the monthly summary (plus ownership and signup/login)
- [x] Refund edge cases covered by tests: refund in a later month, refund larger than a category's spending, refund with no purchase
- [x] Decide on refunds with no matching purchase: unlinked refunds are accepted on purpose for v1. A refund of any amount is allowed and can make spending negative; `test_refund_without_any_purchase_is_accepted` pins this as intended behavior. Linking refunds to a purchase is deferred (see Later)
- [x] Make the 2020-01-01 transaction date floor an IST midnight (was UTC, so 00:00 to 05:30 IST on Jan 1, 2020 was rejected)
- [x] Summary card month label from the backend instead of the browser's timezone

## Phase 2: Production deployment (Render + Supabase + Vercel)

- [x] Pin Python 3.14: `py -3.14 -m venv venv` in the README setup and a `.python-version` file at the repo root, which Render reads (3.15 is the `py` launcher default on the dev machine, and the project is untested on it). CI should read the same file when it's added
- [x] Add `email-validator` to `requirements.txt` (needed by `EmailStr`; a fresh install crashes on import without it)
- [ ] Frontend API base URL from a Vite env var instead of hard-coded `http://localhost:8000`
- [ ] Refresh cookie `path` configurable (needed if the API is proxied under `/api`)
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
- Deploy note: migration `b81f3d2c9a47` deletes every stored refresh token, so every user is logged out once when it runs. Run it at a quiet time, not mid-session.

## Later

Deferred because nothing calls them yet. Pick them up when a real need appears.

- [ ] Multi-month trend (month buckets over a range, with a bucket-count cap)
- [ ] Date filters on the category analytics endpoints
- [ ] Link refunds to their purchase (`refund_of_id`): catches refunds larger than the purchase, and refunds recorded under a different category. Would change `test_refund_without_any_purchase_is_accepted`

## Phase 3: Expense splitting

- [ ] Models: `Friend`, `Split`, `SplitParticipant`
- [ ] Email as the friend identifier
- [ ] Settlement and net balances
- [ ] Multiple accounts, which unblocks the "amount cannot exceed balance" rule

## Phase 4: AI analysis

- [ ] Stretch goal, deferred
