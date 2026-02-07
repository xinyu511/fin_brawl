-- SQLite schema for lightweight financial advising backend
-- Uses integer cents for money and ISO8601 timestamps/text for dates

PRAGMA foreign_keys = ON;

-- 1) Users
CREATE TABLE IF NOT EXISTS users (
  id              INTEGER PRIMARY KEY,
  username        TEXT NOT NULL UNIQUE,
  password_hash   TEXT NOT NULL,
  created_at      TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
  last_login_at   TEXT
);

-- 2) Financial Profile (1:1 with user)
CREATE TABLE IF NOT EXISTS financial_profiles (
  id               INTEGER PRIMARY KEY,
  user_id          INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  currency         TEXT NOT NULL DEFAULT 'USD',
  net_worth_cents  INTEGER,
  risk_tolerance   TEXT CHECK (risk_tolerance IN ('low','medium','high')),
  financial_goal   TEXT CHECK (financial_goal IN ('save','invest','retire','reduce_debt')),
  time_horizon     TEXT CHECK (time_horizon IN ('short','medium','long')),
  age_range        TEXT,
  location         TEXT,
  created_at       TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
  updated_at       TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
);

-- 3) Incomes (per-month amount)
CREATE TABLE IF NOT EXISTS incomes (
  id                INTEGER PRIMARY KEY,
  user_id           INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount_cents      INTEGER NOT NULL,
  source            TEXT NOT NULL,
  start_date        TEXT,
  end_date          TEXT,
  created_at        TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
);
CREATE INDEX IF NOT EXISTS idx_incomes_user ON incomes(user_id);

-- 4) Expenses
CREATE TABLE IF NOT EXISTS expenses (
  id                INTEGER PRIMARY KEY,
  user_id           INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount_cents      INTEGER NOT NULL,
  category          TEXT NOT NULL,
  occurred_at       TEXT NOT NULL,
  note              TEXT,
  created_at        TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
);
CREATE INDEX IF NOT EXISTS idx_expenses_user_time ON expenses(user_id, occurred_at);
CREATE INDEX IF NOT EXISTS idx_expenses_user_category ON expenses(user_id, category);

-- 5) Recommendations
CREATE TABLE IF NOT EXISTS recommendation_history (
  id                INTEGER PRIMARY KEY,
  user_id           INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content           TEXT NOT NULL,
  created_at        TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
);
CREATE INDEX IF NOT EXISTS idx_reco_user_created ON recommendation_history(user_id, created_at);

-- Helpful views
CREATE VIEW IF NOT EXISTS v_monthly_expense AS
SELECT
  user_id,
  strftime('%Y-%m', occurred_at) AS year_month,
  SUM(amount_cents) AS total_expense_cents
FROM expenses
GROUP BY user_id, year_month;

CREATE VIEW IF NOT EXISTS v_monthly_expense_by_category AS
SELECT
  user_id,
  strftime('%Y-%m', occurred_at) AS year_month,
  category,
  SUM(amount_cents) AS total_expense_cents
FROM expenses
GROUP BY user_id, year_month, category;

