## Backend (SQLite + stdlib Python)

Lightweight backend for financial advising prototype. Uses SQLite (file-based) and Python standard library only.

### Storage
- **Database file**: `data/fin.db` (auto-created)
- **Schema**: `data/schema.sql`
- **Token signing key**: `data/secret.key` (auto-generated on first token use)

### Requirements
- Python 3.10+ (stdlib only, no extra packages)

### Setup
```bash
python -m backend.manage init-db
```

### Quick start
```bash
# Create a user and log in
python -m backend.manage create-user alice mypassword
python -m backend.manage login-token alice mypassword   # prints token

# Set initial profile
python -m backend.manage set-profile 1 --currency USD --risk-tolerance medium \
  --financial-goal save --time-horizon short --age-range "25-34" --location "PA, US" \
  --net-worth-cents 2500000

# Add data
python -m backend.manage add-income 1 500000 salary --start-date 2026-02-01
python -m backend.manage add-expense 1 12000 food 2026-02-01T12:00:00 --note "lunch"

# Analytics
python -m backend.manage monthly-spend 1 2026-02
python -m backend.manage savings-rate 1 2026-02
python -m backend.manage dashboard 1 2026-02
```

### Run the HTTP API server
```bash
python -m backend.manage serve --host 127.0.0.1 --port 8000
```
- CORS enabled (`*`). Supports `OPTIONS` preflight.

### HTTP API (implemented)
Compatible routes for the Next.js frontend in `web/`:
- POST `/auth/register`
  - Body: `{"username":"alice","password":"pwd"}`
  - 201 → `{"user_id": 1}`
- POST `/auth/login`
  - Body: `{"username":"alice","password":"pwd"}`
  - 200 → `{"token":"<signed token>", "user_id": 1}`
- GET `/auth/me`
  - Headers: `Authorization: Bearer <token>`
  - 200 → `{"user_id": 1}`

Legacy routes (also available):
- POST `/api/users/signup`
  - Body: `{"username":"alice","password":"pwd"}`
  - 201 → `{"userId": 1}`
- POST `/api/users/login`
  - Body: `{"username":"alice","password":"pwd"}`
  - 200 → `{"token":"<signed token>"}`
- GET `/api/profile`
  - Headers: `Authorization: Bearer <token>`
  - 200 → `{"profile": {...}}`
- PATCH `/api/profile`
  - Headers: `Authorization: Bearer <token>`
  - Body: any subset of `{"currency","net_worth_cents","risk_tolerance","financial_goal","time_horizon","age_range","location"}`
  - 200 → `{"updated": true|false, "profile": {...}}`

Example curl:
```bash
curl -X POST http://127.0.0.1:8000/api/users/signup \
  -H "Content-Type: application/json" \
  -d '{"username":"alice","password":"pwd"}'

curl -X POST http://127.0.0.1:8000/api/users/login \
  -H "Content-Type: application/json" \
  -d '{"username":"alice","password":"pwd"}'

curl http://127.0.0.1:8000/api/profile \
  -H "Authorization: Bearer <token>"

curl -X PATCH http://127.0.0.1:8000/api/profile \
  -H "Authorization: Bearer <token>" -H "Content-Type: application/json" \
  -d '{"currency":"USD","risk_tolerance":"medium"}'
```

### Commands (grouped)
Run `python -m backend.manage --help` for full details.

#### Users & Auth
- `init-db` — Initialize SQLite with schema.
- `create-user <username> <password>` — Create user; auto-creates empty profile.
- `signin <username> <password>` — Check credentials (prints user id).
- `login-token <username> <password>` — Issue signed token.
- `verify-token <token>` — Verify token and print `user_id` or `invalid`.
- `set-username <user_id> <new_username>` — Change username (unique).
- `set-password <user_id> <new_password>` — Change password (PBKDF2-SHA256).
- `serve [--host H] [--port P]` — Run the HTTP API server.

Token notes:
- Stateless HMAC-SHA256 tokens (JWT-like), 7-day default TTL.
- Secret at `data/secret.key`. Logout is client-side (discard token).

#### Profile & Onboarding
- `set-profile <user_id> [--currency USD] [--risk-tolerance low|medium|high] [--financial-goal save|invest|retire|reduce_debt] [--time-horizon short|medium|long] [--age-range "25-34"] [--location "PA, US"] [--net-worth-cents 2500000]`
- `load-incomes <user_id> incomes.json`
- `load-expenses <user_id> expenses.json`

Bulk JSON formats:
```json
// incomes.json
[
  {"amount_cents": 500000, "source": "salary", "start_date": "2026-02-01", "end_date": null}
]

// expenses.json
[
  {"amount_cents": 12000, "category": "food", "occurred_at": "2026-02-01T12:00:00", "note": "lunch"}
]
```

#### Incomes
- `add-income <user_id> <amount_cents> <source> [--start-date YYYY-MM-DD] [--end-date YYYY-MM-DD]`
- `update-income <income_id> [--amount-cents N] [--source S] [--start-date D] [--end-date D]`
- `delete-income <income_id>`

#### Expenses
- `add-expense <user_id> <amount_cents> <category> <occurred_at> [--note "text"]`
- `update-expense <expense_id> [--amount-cents N] [--category C] [--occurred-at ISO] [--note "text"]`
- `delete-expense <expense_id>`

#### Recommendations
- `add-reco <user_id> "content"`
- `list-recos <user_id> [--limit 50]`
- `delete-reco <reco_id>`

#### Analytics & Dashboard
- `monthly-spend <user_id> <YYYY-MM>` — Total expense in month.
- `category-dist <user_id> <YYYY-MM>` — List of `[category, total_cents]` pairs (JSON).
- `savings-rate <user_id> <YYYY-MM>` — Fraction (0..1) or `null` if no income.
- `dashboard <user_id> <YYYY-MM>` — Aggregated JSON: income, expense, savings_rate, category_distribution, recent recommendations.

### Data model summary
- `users`: `id`, `username` (unique), `password_hash`, timestamps.
- `financial_profiles`: 1:1 with `users` via `user_id`; fields include `currency`, `net_worth_cents`, `risk_tolerance`, `financial_goal`, `time_horizon`, `age_range`, `location`.
- `incomes`: per-user recurring/nominal monthly amounts in integer cents.
- `expenses`: per-user expenses with `category` and `occurred_at` timestamp.
- `recommendation_history`: per-user recommendation text with timestamp.

Amounts are stored as integer cents. SQLite views provide monthly aggregations; indexes cover common filters (`user_id`, `occurred_at`, `category`).

### Additional endpoints (future, not yet implemented)
- POST `/api/incomes/bulk` (Bearer token) — accept array in the JSON format shown above.
- POST `/api/expenses/bulk` (Bearer token) — accept array in the JSON format shown above.
- GET `/api/dashboard?ym=YYYY-MM` (Bearer token) — return dashboard JSON.

### Programmatic usage (Python)
```python
from backend.db import session
from backend.auth import signup, signin
from backend.finance import add_expense

with session() as conn:
    user_id = signup(conn, "alice", "pwd")
    uid = signin(conn, "alice", "pwd")
    add_expense(conn, uid, 12000, "food", "2026-02-01T12:00:00", "lunch")
```

### Notes
- WAL mode and sane pragmas are enabled by default for speed and durability.
- Back up by copying `data/fin.db`. To reset, delete the file and re-run `init-db`.

### Running the full app (backend + web)
1) Start backend API:
```bash
python -m backend.manage init-db
python -m backend.manage serve --host 127.0.0.1 --port 8000
```
2) Configure frontend to point to backend:
Create or edit `web/.env.local`:
```
NEXT_PUBLIC_BACKEND_URL=http://127.0.0.1:8000
```
3) Install and run frontend:
```bash
cd web
npm install
npm run dev
```
4) Open the app:
- Visit http://localhost:3000/login
- Sign up or sign in; the UI uses the backend `/auth/*` routes automatically.

