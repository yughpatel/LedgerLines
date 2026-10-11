# Roadmap

Last updated: 2026-10-12

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
- [ ] Trend-over-time endpoint
- [ ] Date filters on analytics endpoints
- [ ] pytest suite for analytics and the monthly summary
- [ ] Refund edge cases (refund in a different category than the purchase, refunds larger than spending)

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
