## Fin Brawl - Dev Guide

This repo contains:
- `backend/` — Python stdlib-only backend with SQLite (file DB), HTTP API, and a CLI
- `web/` — Next.js frontend that talks to the backend HTTP API
- `data/` — SQLite database file (`fin.db`) and schema (`schema.sql`)

### Prerequisites
- Python 3.10+ installed
- macOS Terminal with zsh (default on macOS)

### 1) Run the backend (Terminal 1)
Initialize the database and start the HTTP API server:
```bash
python -m backend.manage init-db
python -m backend.manage serve --host 127.0.0.1 --port 8000
```
- API base URL: `http://127.0.0.1:8000`
- Data is stored in `data/fin.db`

Optional smoke test (new terminal):
```bash
curl -X POST http://127.0.0.1:8000/auth/register -H "Content-Type: application/json" -d '{"username":"alice","password":"pwd"}'
curl -X POST http://127.0.0.1:8000/auth/login -H "Content-Type: application/json" -d '{"username":"alice","password":"pwd"}'
```

### 2) Install npm via nvm (recommended, Option A)
Install Node Version Manager (nvm) and latest LTS Node.js:
```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
# reload your shell (or open a new terminal), then:
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
nvm install --lts
nvm use --lts
nvm alias default 'lts/*'   # optional: make LTS default
node -v
npm -v
```

### 3) Configure the frontend to point to the backend
Create or edit `web/.env.local`:
```
NEXT_PUBLIC_BACKEND_URL=http://127.0.0.1:8000
```

### 4) Run the frontend (Terminal 2)
```bash
cd web
npm install
npm run dev
```
Open the app in your browser: `http://localhost:3000/login`

### Common backend CLI commands
```bash
# Users
python -m backend.manage create-user alice mypassword
python -m backend.manage login-token alice mypassword

# Profile
python -m backend.manage set-profile 1 --currency USD --risk-tolerance medium --financial-goal save --time-horizon short

# Data
python -m backend.manage add-income 1 500000 salary --start-date 2026-02-01
python -m backend.manage add-expense 1 12000 food 2026-02-01T12:00:00 --note "lunch"

# Analytics
python -m backend.manage dashboard 1 2026-02
```

### Troubleshooting
- ModuleNotFoundError or imports fail:
  - Always run as a module: `python -m backend.manage ...`
- “no such table” errors:
  - Run: `python -m backend.manage init-db`
  - To reset: `rm -f data/fin.db && python -m backend.manage init-db`
- Frontend can’t reach backend:
  - Confirm `web/.env.local` has `NEXT_PUBLIC_BACKEND_URL=http://127.0.0.1:8000`
  - Make sure backend is running on port 8000
