# LedgerLines

A personal finance tracker. Log income, expenses and refunds, see a monthly summary, and see where your money goes by category.

Built as a full-stack project with a focus on backend engineering, security and production readiness.

---

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Prerequisites](#prerequisites)
- [Local Setup](#local-setup)
- [Environment Variables](#environment-variables)
- [Database](#database)
- [Running the App](#running-the-app)
- [API Overview](#api-overview)
- [Authentication](#authentication)
- [Security Decisions](#security-decisions)
- [Data Models](#data-models)
- [Development Workflow](#development-workflow)
- [Testing](#testing)
- [Deployment](#deployment)
- [Roadmap](#roadmap)
- [Known Limitations](#known-limitations)
- [License](#license)

---

## Overview

LedgerLines lets a user:
- Sign up and log in (JWT access token plus a refresh token in an httpOnly cookie)
- Record transactions as `CREDIT` (income), `DEBIT` (spending) or `REFUND` (money back on a purchase)
- Use built-in categories or create their own
- See this month's total earned, total spent and net
- See all-time spending by category as a bar chart

The backend is **FastAPI** with **PostgreSQL**. The frontend is **React + Tailwind**, built with Vite. It is a solo project by a first-year B.Tech CSE student focused on backend development and cybersecurity.

---

## Features

### Current

- **Auth:** signup, login, `/auth/me`, silent refresh, and logout that revokes the refresh token
- **Rate limiting:** signup 2/minute, login 5/minute per IP (slowapi)
- **Transactions:** create, list, get, partial update, delete
  - Amounts stored as `Numeric(10, 2)`, never `float`
  - Each listed transaction gets a per-user sequence number (`seq_number`, from `ROW_NUMBER()`)
- **Categories:** system defaults (Food, Rent, Travel, Utilities, Other) plus custom categories, unique per user ignoring case. Custom categories can be deleted if no transaction uses them.
- **Monthly summary:** total earned, total spent and net for the current calendar month in IST (`Asia/Kolkata`, set by `REPORTING_TIMEZONE` in `core/config.py`), in one SQL query
- **Analytics:** all-time spending by category and income by category, biggest first, with stable ordering for ties, plus a daily or weekly income and spending trend for one IST calendar month
- **Refunds:** a `REFUND` reduces spending in the summary and the category breakdown, and is not counted as income
- **Frontend:** login and signup, transaction table, add/edit form (with inline category creation), delete confirmation, monthly summary cards and a spending-by-category chart. The summary and chart refresh after every create, edit or delete.

### Planned

See [ROADMAP.md](ROADMAP.md). Next up: an income chart, trend over time, date filters and a pytest suite (Phase 1), then deployment (Phase 2).

---

## Tech Stack

### Backend
| Component | Choice |
|---|---|
| Framework | FastAPI |
| Database | PostgreSQL |
| ORM | SQLAlchemy 2.0 |
| Validation | Pydantic v2, pydantic-settings |
| Auth | JWT (`python-jose`), password and refresh token hashing (`passlib` with `bcrypt==4.0.1`) |
| Rate limiting | slowapi (in-memory) |
| Migrations | Alembic |
| Server | Uvicorn |

### Frontend
| Component | Choice |
|---|---|
| Framework | React 19 |
| Styling | Tailwind CSS 4 |
| Charts | Recharts |
| Build tool | Vite 8 |

### Planned Hosting
| Layer | Provider |
|---|---|
| Frontend | Vercel |
| Backend | Render |
| Database (production) | Supabase |
| Database (local dev) | Local PostgreSQL |

---

## Project Structure

```
LedgerLines/
├── backend/
│   ├── app/
│   │   ├── main.py                  # App entrypoint, CORS, limiter, routers
│   │   ├── api/routes/
│   │   │   ├── auth.py              # signup, login, me, refresh, logout
│   │   │   ├── transaction.py       # Transaction CRUD + monthly summary
│   │   │   ├── category.py          # List, create, delete categories
│   │   │   └── analytics.py         # Spending and income by category
│   │   ├── auth/security.py         # Password hashing, JWTs, current user, refresh token checks
│   │   ├── core/
│   │   │   ├── config.py            # Settings from env / .env
│   │   │   └── limiter.py           # Shared slowapi Limiter
│   │   ├── db/session.py            # Engine, session, get_db
│   │   ├── models/                  # user, transaction, category, refresh_token
│   │   ├── schemas/                 # user, transaction, category, analytics
│   │   └── services/
│   │       ├── analytics.py         # Category aggregation queries
│   │       ├── category.py          # Category access checks
│   │       └── transaction.py       # Transaction list with seq_number
│   ├── alembic/versions/            # Migrations
│   ├── tests/                       # pytest suite (conftest, factories, test_*.py)
│   ├── alembic.ini
│   ├── pytest.ini
│   ├── requirements.txt
│   ├── requirements-dev.txt         # requirements.txt + pytest, httpx
│   └── .env.example
├── frontend/
│   ├── src/
│   │   ├── api.js                   # API client, 401 refresh interceptor
│   │   ├── App.jsx
│   │   └── components/
│   │       ├── Auth.jsx
│   │       ├── TransactionList.jsx
│   │       ├── TransactionForm.jsx
│   │       ├── MonthlySummary.jsx
│   │       └── SpendingByCategory.jsx
│   ├── package.json
│   └── vite.config.js
├── ROADMAP.md
└── README.md
```

---

## Prerequisites

- **Python:** developed on 3.14. Older versions are untested.
- **Node.js:** `^20.19.0` or `>=22.12.0` (required by Vite 8)
- **PostgreSQL:** 15 or newer (the category index uses `NULLS NOT DISTINCT`). Developed against PostgreSQL 18.
- **Git**
- Windows 11 + PowerShell. All commands below are PowerShell.

---

## Local Setup

### 1. Clone

```powershell
git clone https://github.com/yughpatel/LedgerLines.git
cd LedgerLines
```

### 2. Backend

```powershell
cd backend
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt
pip install email-validator==2.3.0
```

`email-validator` is needed by the auth schemas (`EmailStr`) but is not in `requirements.txt` yet, so it is installed separately.

### 3. Frontend

```powershell
cd ..\frontend
npm install
```

---

## Environment Variables

Copy the example and fill in real values. `backend/.env` is git-ignored.

```powershell
cd backend
Copy-Item .env.example .env
```

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `SECRET_KEY` | Signs access tokens |
| `ALGORITHM` | JWT algorithm, e.g. `HS256` |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | Access token lifetime |
| `REFRESH_TOKEN_SECRET_KEY` | Signs refresh tokens (separate from `SECRET_KEY`) |
| `REFRESH_TOKEN_EXPIRE_DAYS` | Refresh token lifetime |
| `ENVIRONMENT` | Optional, defaults to `development`. `production` makes the refresh cookie `Secure`. |

Names are not case sensitive (pydantic-settings default).

---

## Database

### Create the local database

```powershell
psql -U postgres
CREATE DATABASE ledgerlines;
\q
```

### Run migrations

```powershell
cd backend
.\venv\Scripts\Activate.ps1
alembic upgrade head
```

Alembic reads `DATABASE_URL` from settings, not from `alembic.ini`.

### New migration

```powershell
alembic revision --autogenerate -m "describe the change"
alembic upgrade head
```

Review autogenerated migrations before applying. Things autogenerate misses here include enum values and data backfills.

---

## Running the App

### Backend

```powershell
cd backend
.\venv\Scripts\Activate.ps1
uvicorn app.main:app --reload
```

- API: `http://localhost:8000`
- Swagger UI: `http://localhost:8000/docs`
- ReDoc: `http://localhost:8000/redoc`

### Frontend

In a second terminal:

```powershell
cd frontend
npm run dev
```

- App: `http://localhost:3000` (fixed port; the backend CORS config only allows this origin)

---

## API Overview

Protected endpoints need `Authorization: Bearer <access token>`. Full schemas are in `/docs`.

### Auth

| Method | Endpoint | Description |
|---|---|---|
| POST | `/auth/signup` | Create an account (201). 409 if the email exists. Limit 2/minute. |
| POST | `/auth/login` | Returns an access token and sets the `refresh_token` cookie. Limit 5/minute. |
| GET | `/auth/me` | Current user (`id`, `email`) |
| POST | `/auth/refresh` | Uses the refresh cookie, returns a new access token |
| POST | `/auth/logout` | Revokes the refresh token and clears the cookie |

### Transactions

| Method | Endpoint | Description |
|---|---|---|
| GET | `/transactions` | List your transactions, newest date first, with `seq_number` |
| POST | `/transactions` | Create (201) |
| GET | `/transactions/summary` | This month's `total_earned`, `total_spent`, `net` |
| GET | `/transactions/{id}` | Get one (404 if missing or not yours) |
| PUT | `/transactions/{id}` | Partial update |
| DELETE | `/transactions/{id}` | Delete (204) |

### Categories

| Method | Endpoint | Description |
|---|---|---|
| GET | `/categories` | System defaults plus yours, alphabetical |
| POST | `/categories` | Create (201). 409 on a duplicate name, ignoring case. |
| DELETE | `/categories/{id}` | Delete your own category (204). 404 for system defaults or other users' categories, 409 if transactions use it. |

### Analytics

| Method | Endpoint | Description |
|---|---|---|
| GET | `/analytics/spending-by-category` | All-time DEBIT minus REFUND per category. Categories at zero or below are left out. |
| GET | `/analytics/income-by-category` | All-time CREDIT per category |
| GET | `/analytics/trend` | Income and spending per `day` or `week` for one IST calendar month. Query: `year` + `month` (both or neither, default current month, 2020 onward, not in the future), `bucket` (default `day`). |

The two category endpoints return `category_id`, `category_name` and `total`, sorted by total (desc), then name, then id. `total` is a decimal string such as `"800.00"`.

`/analytics/trend` returns one row per bucket with `start`, `end` (exclusive), `income` and `spending`, oldest first, with `"0.00"` for empty buckets. Weeks start on Monday and are clipped to the month, so the first and last week can be shorter than 7 days. Spending can be negative when refunds outweigh debits in a bucket.

---

## Authentication

- Passwords are hashed with bcrypt (`passlib`). Signup requires 8 to 20 characters with an uppercase letter, a digit and a special character.
- **Access token:** JWT signed with `SECRET_KEY`, contains `sub` (user id) and `type: "access"`, expires after `ACCESS_TOKEN_EXPIRE_MINUTES`. The frontend keeps it in `localStorage` and sends it as a Bearer token.
- **Refresh token:** JWT signed with `REFRESH_TOKEN_SECRET_KEY`, `type: "refresh"`, expires after `REFRESH_TOKEN_EXPIRE_DAYS`. Only a bcrypt hash is stored, in `refresh_tokens`.
- **Cookie:** `refresh_token`, `httpOnly`, `SameSite=Lax`, `Path=/auth`, `Secure` only when `ENVIRONMENT=production`.
- **Refresh flow:** on a 401, the frontend calls `POST /auth/refresh` once (shared between parallel requests) and retries the request with the new access token. If refresh fails, the user is logged out.
- **Rotation:** not implemented. `/auth/refresh` returns a new access token and the same refresh token stays valid until it expires or is revoked.
- **Logout:** marks the stored refresh token as revoked and clears the cookie. Access tokens already issued stay valid until they expire.

---

## Security Decisions

- **404 for both "not found" and "not yours":** transaction and category lookups filter by owner, so other users' ids are not revealed.
- **Category delete uses the database:** the transactions foreign key is `ON DELETE RESTRICT`, and the relationship uses `passive_deletes="all"` so the ORM does not null out `category_id` before Postgres can refuse the delete.
- **SQLSTATE 23001 and 23503:** PostgreSQL 18 raises 23001 for RESTRICT, older versions raise 23503. Both map to 409. Any other integrity error is re-raised as a 500.
- **Rate limiting:** signup and login are limited per client IP with slowapi.
- **Hashed refresh tokens:** the database stores only a bcrypt hash of each refresh token, and logout revokes it server side.
- **Separate token secrets and a type claim:** refresh and access tokens use different secrets, and `get_current_user` rejects a refresh token used as an access token.
- **Update cannot change ownership:** `PUT /transactions/{id}` drops `id` and `user_id` from the update.

---

## Data Models

### User
- `id`, `email` (unique), `hashed_password`
- Has many transactions, categories and refresh tokens

### Transaction
- `id`, `user_id`, `transaction_date` (timezone-aware), `type` (`CREDIT` / `DEBIT` / `REFUND`), `amount` (`Numeric(10, 2)`, positive for all types; enforced by the API schema, not a database constraint), `category_id` (`ON DELETE RESTRICT`), `description`, `created_at`

### Category
- `id`, `name` (max 50), `user_id` (null for system defaults, `ON DELETE CASCADE`)
- Unique on `(user_id, lower(name))` with `NULLS NOT DISTINCT`

### RefreshToken
- `id`, `user_id` (`ON DELETE CASCADE`), `token_hash`, `expires_at`, `created_at`, `revoked`

Planned for expense splitting: `Friend`, `Split`, `SplitParticipant` (see [ROADMAP.md](ROADMAP.md)).

---

## Development Workflow

- **Authorship:** all backend design decisions are mine. Some backend code was written with AI assistance, and every line was reviewed and tested before it was committed.
- **Commit convention:** [Conventional Commits](https://www.conventionalcommits.org/)
  - `feat:` new feature
  - `fix:` bug fix
  - `refactor:` restructuring without behavior change
  - `docs:` documentation only
  - `chore:` tooling, config, dependencies
- Enum values (for example `TransactionType.CREDIT`) are used instead of raw strings in the backend.
- Routes that use the sync SQLAlchemy session are plain `def`, so FastAPI runs them in its threadpool.

---

## Testing

Backend tests use pytest against a real PostgreSQL database (no mocks). They cover the trend endpoint, the monthly summary, the category analytics, refunds, ownership between users, and signup/login.

One-time setup:

```powershell
# As a Postgres superuser (pgAdmin or psql)
CREATE DATABASE ledgerlines_test OWNER ledgerlines_user;
```

```powershell
cd backend
.\venv\Scripts\Activate.ps1
pip install -r requirements-dev.txt
pytest
```

- The suite uses `ledgerlines_test` on the same server as `DATABASE_URL`, or `TEST_DATABASE_URL` if set. It refuses to run against a database whose name doesn't end in `_test`, or one that isn't on localhost.
- Migrations run once per session. Each test runs inside a transaction that is rolled back, so nothing is left behind.
- Tests use fixed dates; "today" is pinned with the `freeze_now` fixture.
- The frontend has no automated tests.

---

## Deployment

Not deployed yet. This is Phase 2 in [ROADMAP.md](ROADMAP.md):

- Frontend on Vercel, backend on Render, database on Supabase
- Before going live: CORS origins from env, a refresh cookie that works across the frontend and API domains, real client IPs for rate limiting behind the proxy, CI, secrets in each platform's settings, monitoring and a load test

---

## Roadmap

Full list with checkboxes in [ROADMAP.md](ROADMAP.md).

0. **Security and stability:** mostly done. Open: access token revocation, refresh token hash fix, evaluate `python-jose` and `passlib`.
1. **Category analytics and graphs:** in progress
2. **Production deployment** (Render + Supabase + Vercel)
3. **Expense splitting**
4. **AI analysis** (stretch, deferred)

---

## Known Limitations

- No frontend tests, and no backend tests yet for transaction CRUD or category create/delete
- Not deployed; runs locally only
- A refund doesn't have to match a purchase, so a large refund can make spending negative with nothing to show it's bad data
- Access tokens stay valid after logout until they expire
- Refresh tokens are not rotated, and old rows in `refresh_tokens` are never cleaned up
- Refresh token hashes only cover the first 72 bytes of the token (bcrypt limit), so two refresh tokens for the same user issued close together can match the same row
- The access token is stored in `localStorage`, so an XSS bug could read it
- Rate limits cover only signup and login, are in-memory and are per process
- CORS allows only `http://localhost:3000` (hard-coded)
- Category analytics are all-time only, with no date filters. The trend endpoint covers one month at a time and has no frontend chart yet. There is no income chart yet.
- All dates are bucketed in one fixed timezone (`Asia/Kolkata`), not per user
- A refund recorded under a different category than the purchase skews per-category spending
- `requirements.txt` is missing `email-validator`
- One account per user, so there is no "amount cannot exceed balance" check

---

## License

MIT (no LICENSE file in the repo yet)
