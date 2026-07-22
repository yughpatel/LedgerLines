# LedgerLines

A personal finance tracker built to be actually used, not just a learning project. Track income and expenses, see monthly summaries, and (coming soon) split shared costs with friends and visualize spending by category.

Built as a full-stack learning project with a focus on backend engineering, security, and production-readiness — not just "make it work."

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
- [Data Models](#data-models)
- [Development Workflow](#development-workflow)
- [Testing](#testing)
- [Deployment (Planned)](#deployment-planned)
- [Roadmap](#roadmap)
- [Known Limitations](#known-limitations)
- [License](#license)

---

## Overview

LedgerLines is a personal finance tracker where a user can:
- Sign up and log in securely (JWT-based auth)
- Log transactions (income or expenses) with custom categories
- View a monthly summary of what they earned, spent, and their net balance
- (Planned) See spending broken down visually by category
- (Planned) Split shared expenses with friends and track who owes whom

The backend is written in **FastAPI** with **PostgreSQL**, and the frontend is a **React + Tailwind** app. This is a solo project by a first-year B.Tech CSE student, built with a career focus on backend development and cybersecurity — so security and correctness are treated as first-class concerns, not afterthoughts.

---

## Features

### ✅ Current

- **Auth:** Signup and login with JWT-based authentication (`python-jose` + `passlib` for password hashing)
- **Transaction CRUD:** Create, read, update, and delete transactions
  - Each transaction has an amount, type (`CREDIT`/`DEBIT`), category, description, and date
  - Amounts stored as `Decimal` (never `float`) for monetary precision
- **Ownership checks:** Users can only access and modify their own transactions
- **Categories:** Built-in default categories (e.g., Food, Rent, Salary, Travel, Utilities) plus user-defined custom categories
- **Monthly Summary:** `GET /transactions/summary` returns total earned, total spent, and net for the current calendar month, computed with a single SQL query using conditional `SUM()`
- **Partial updates:** Editing a transaction only updates the fields that were actually changed (`model_dump(exclude_unset=True)`)
- **Frontend:** React app with login/signup, transaction list, transaction form, and delete confirmation — fully wired to the live backend
- **Auto-refreshing summary:** The monthly summary card updates immediately after any create/edit/delete, without a page reload

### 🔜 Planned

- **Category breakdown + graphs:** `GET /transactions/summary/by-category` endpoint, with pie and bar charts (Recharts) showing spending distribution by category
- **Expense splitting (Splitwise-style):** Log a shared expense, split it among friends (registered or not), track who owes whom, and settle up — including partial payments and auto-calculated net balances
- **Security hardening:** JWT refresh tokens (short-lived access tokens + long-lived refresh tokens), rate limiting on auth and API endpoints, a full input-validation audit, and reversible Alembic migrations
- **Production deployment:** Backend on Render, database on Supabase, frontend on Vercel, with proper secrets management, error monitoring, and load testing
- **AI spending insights (stretch goal):** Trend detection, anomaly alerts, and spending predictions — deferred until the core product is solid

---

## Tech Stack

### Backend
| Component | Choice |
|---|---|
| Framework | FastAPI |
| Database | PostgreSQL |
| ORM | SQLAlchemy v2 |
| Validation | Pydantic v2 |
| Auth | JWT (`python-jose`), password hashing (`passlib[bcrypt]`, pinned to `bcrypt==4.0.1`) |
| Migrations | Alembic |
| Server | Uvicorn |

### Frontend
| Component | Choice |
|---|---|
| Framework | React |
| Styling | Tailwind CSS |
| Charts | Recharts |
| Build tool | Vite |

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
│   │   ├── main.py              # FastAPI app entrypoint, CORS config
│   │   ├── database.py          # DB engine/session setup
│   │   ├── models/               # SQLAlchemy models (User, Transaction, Category, ...)
│   │   ├── schemas/               # Pydantic request/response schemas
│   │   ├── routes/                 # API route definitions (auth, transactions, ...)
│   │   ├── auth.py                  # JWT creation/validation, password hashing
│   │   └── dependencies.py           # Reusable FastAPI dependencies (e.g. get_current_user)
│   ├── alembic/                    # Migration environment
│   │   └── versions/               # Individual migration files
│   ├── requirements.txt
│   ├── alembic.ini
│   └── venv/                        # Local virtual environment (not committed)
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── Auth.jsx
│   │   │   ├── TransactionList.jsx
│   │   │   ├── TransactionForm.jsx
│   │   │   ├── MonthlySummary.jsx
│   │   │   └── DeleteModal.jsx
│   │   ├── App.jsx
│   │   └── main.jsx
│   ├── package.json
│   └── vite.config.js
├── docs/                             # (planned) architecture notes, test reports
├── .gitignore
└── README.md
```

---

## Prerequisites

- **Python** 3.11+
- **Node.js** 18+ and npm
- **PostgreSQL** 15+ (developed/tested against PostgreSQL 18)
- **Git**
- Windows 11 + PowerShell (this project is developed without WSL; all commands below are PowerShell-native)

---

## Local Setup

### 1. Clone the repository

```powershell
git clone https://github.com/yughpatel/LedgerLines.git
cd LedgerLines
```

### 2. Backend setup

```powershell
cd backend
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
```

> Make sure your IDE's Python interpreter points to `backend\venv\Scripts\python.exe` (this project uses PyCharm).

### 3. Frontend setup

```powershell
cd ..\frontend
npm install
```

---

## Environment Variables

Create a `.env` file inside `backend/` (this file is git-ignored and should never be committed):

```env
DATABASE_URL=postgresql://<username>:<password>@localhost:5432/ledgerlines
JWT_SECRET_KEY=<your-secret-key>
JWT_ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=60
```

- `DATABASE_URL` — connection string for your local PostgreSQL instance
- `JWT_SECRET_KEY` — used to sign JWTs; generate a long random string, never reuse across environments
- `JWT_ALGORITHM` — signing algorithm (HS256)
- `ACCESS_TOKEN_EXPIRE_MINUTES` — how long an access token stays valid before refresh tokens are implemented

---

## Database

### Create the local database

Using `psql` or pgAdmin 4:

```powershell
psql -U postgres
CREATE DATABASE ledgerlines;
\q
```

### Run migrations

```powershell
cd backend
venv\Scripts\activate
alembic upgrade head
```

This applies all schema migrations (users, transactions, categories, etc.) to your local database.

### Creating a new migration (when models change)

```powershell
alembic revision --autogenerate -m "describe the change"
alembic upgrade head
```

Always review autogenerated migrations before applying — Alembic doesn't catch everything (e.g., renamed columns may show up as drop + add).

---

## Running the App

### Backend

```powershell
cd backend
venv\Scripts\activate
uvicorn app.main:app --reload
```

- API runs at `http://localhost:8000`
- Interactive API docs (Swagger UI): `http://localhost:8000/docs`
- Alternative docs (ReDoc): `http://localhost:8000/redoc`

### Frontend

In a separate terminal:

```powershell
cd frontend
npm run dev
```

- App runs at `http://localhost:3000`

Both servers need to be running simultaneously for the app to work end-to-end.

---

## API Overview

All endpoints (except signup/login) require a valid JWT in the `Authorization: Bearer <token>` header.

### Auth

| Method | Endpoint | Description |
|---|---|---|
| POST | `/auth/signup` | Create a new user account (201 on success) |
| POST | `/auth/login` | Log in, returns a JWT access token (200 on success) |

### Transactions

| Method | Endpoint | Description |
|---|---|---|
| GET | `/transactions` | List all transactions for the current user |
| POST | `/transactions` | Create a new transaction |
| GET | `/transactions/{id}` | Get a single transaction (must belong to current user) |
| PUT | `/transactions/{id}` | Update a transaction (partial updates supported) |
| DELETE | `/transactions/{id}` | Delete a transaction |
| GET | `/transactions/summary` | Get current month's total earned, spent, and net |

### Categories

| Method | Endpoint | Description |
|---|---|---|
| GET | `/categories` | List built-in + user-defined categories |

> Full request/response schemas are available in the interactive docs at `/docs` once the backend is running.

---

## Authentication

- Passwords are hashed with **bcrypt** (via `passlib`) before storage — plaintext passwords are never stored or logged.
- On login, the backend issues a **JWT access token** signed with `JWT_SECRET_KEY`.
- The frontend sends this token in the `Authorization: Bearer <token>` header on every protected request.
- A FastAPI dependency (`get_current_user`) decodes and validates the token on each request, and rejects invalid/expired tokens.
- **Current limitation:** access tokens are long-lived and there is no refresh token flow yet. This is a known gap and is first on the security-hardening list (see [Roadmap](#roadmap)).

---

## Data Models

### User
- `id`, `email` (unique), `hashed_password`, `created_at`
- Has many `Transaction`s

### Transaction
- `id`, `user_id` (FK → User), `amount` (`Numeric`, never `float`), `type` (enum: `CREDIT` / `DEBIT`), `category_id` (FK → Category), `description`, `transaction_date`, `created_at`
- Belongs to a `User`, belongs to a `Category`

### Category
- `id`, `name`, `is_default` (built-in vs. user-created), `user_id` (nullable — null for built-in categories)

> Additional models (`Friend`, `Split`, `SplitParticipant`) are planned for the expense-splitting feature — see roadmap.

---

## Development Workflow

- **Backend code is written by hand** — this project is a learning exercise as much as a product, so all backend logic is written and understood line-by-line, not generated.
- **Frontend is scaffolded/vibe-coded** — frontend work is lower priority for learning purposes but still fully functional and tested against the live backend.
- **Commit convention:** [Conventional Commits](https://www.conventionalcommits.org/)
  - `feat:` — new feature
  - `fix:` — bug fix
  - `chore:` — tooling, config, dependency changes
  - `refactor:` — restructuring without behavior change
  - `docs:` — documentation only
  - `wip:` — work in progress, used when stopping mid-task
- **Daily habit:** small commits, pushed daily (even on light days) to `master`.
- **Type safety:** enum values (e.g., `TransactionType.CREDIT`) are used instead of raw strings throughout the codebase.

---

## Testing

Manual end-to-end testing is done against the live local backend + frontend (no mocks) covering:
- Auth flows (login, invalid password, duplicate signup, logout)
- Full transaction CRUD, including summary auto-refresh after create/edit/delete
- Mobile responsiveness (tested at 375×812 viewport)
- Console error checks

Test reports are kept in `docs/` (planned) as the test suite grows. Automated testing (pytest for backend) is not yet in place — currently a manual process, with automated tests planned as the project matures.

---

## Deployment (Planned)

Not yet deployed. Planned architecture:

- **Frontend** → Vercel (auto-deploy from `master`)
- **Backend** → Render (auto-deploy from `master`)
- **Database** → Supabase (PostgreSQL), with local PostgreSQL used for development
- Secrets managed via each platform's environment variable panel — never committed to the repo
- Error tracking and load testing planned before public launch

---

## Roadmap

High-level plan (see full details in local planning notes):

1. **Security hardening** — JWT refresh tokens, rate limiting, input validation audit, reversible migrations (in progress, alongside feature work)
2. **Category breakdown + graphs** — new summary-by-category endpoint, pie/bar charts with Recharts
3. **Expense splitting** — Splitwise-style shared expense tracking, friend management (by email), settlement logic, net balance calculation
4. **Production deployment** — Render + Supabase + Vercel, monitoring, load testing
5. **AI spending insights** *(stretch goal, deferred)*

This project is actively evolving — the roadmap above reflects current intent, not a fixed contract.

---

## Known Limitations

- No JWT refresh tokens yet — access tokens are long-lived (security gap, actively being addressed)
- No rate limiting yet — auth and API endpoints are currently unprotected against abuse
- No automated test suite — testing is currently manual/end-to-end
- Not yet deployed — runs locally only
- Expense splitting, category graphs, and AI insights are not yet implemented

---

## License

MIT
