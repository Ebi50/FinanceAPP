-- ============================================
-- Finanzapp — Postgres-Schema (ohne Supabase)
-- Einzige Quelle der Wahrheit fuer das Datenmodell.
-- Einspielen: psql "$DATABASE_URL" -f db/schema.sql
-- ============================================

-- 1. Profile = Nutzertabelle (ersetzt auth.users + public.profiles)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE,
  password_hash TEXT,
  first_name TEXT,
  last_name TEXT,
  budget NUMERIC DEFAULT 2000,
  auto_logout_timeout INTEGER DEFAULT 0,
  photo_data BYTEA,
  photo_mime TEXT,
  photo_updated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- email ist absichtlich NULL-bar: die aus Supabase uebernommenen Zeilen
-- duerfen ohne Nacharbeit importiert werden. Anmelden kann sich nur,
-- wer eine E-Mail und einen password_hash hat.

-- 2. Sessions (ersetzt Supabase-Auth)
-- Gespeichert wird nur der SHA-256-Hash des Cookie-Tokens, damit ein
-- Datenbank-Dump keine gueltigen Sitzungen enthaelt.
CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Ausgabenkategorien
CREATE TABLE IF NOT EXISTS expense_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. Transaktionen
CREATE TABLE IF NOT EXISTS transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  description TEXT NOT NULL DEFAULT '',
  amount NUMERIC NOT NULL DEFAULT 0,
  date TIMESTAMPTZ NOT NULL DEFAULT now(),
  category_id UUID REFERENCES expense_categories(id) ON DELETE SET NULL,
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  is_recurring BOOLEAN DEFAULT false,
  original_recurring_id UUID,
  recurring_end_date TIMESTAMPTZ DEFAULT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ON DELETE SET NULL statt CASCADE: das Loeschen eines Kontos darf die
-- Haushaltsdaten nicht mitnehmen (so verhielt es sich unter Supabase auch,
-- weil dort profiles und auth.users getrennt waren).

-- 5. Posten einer Transaktion
CREATE TABLE IF NOT EXISTS transaction_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id UUID REFERENCES transactions(id) ON DELETE CASCADE,
  value NUMERIC NOT NULL,
  description TEXT
);

-- ============================================
-- Indizes
-- ============================================

CREATE INDEX IF NOT EXISTS idx_transaction_items_transaction_id ON transaction_items (transaction_id);
CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions (user_id);
CREATE INDEX IF NOT EXISTS idx_categories_user_id ON expense_categories (user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_category_id ON transactions (category_id);
CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions (date DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_user_date ON transactions (user_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_is_recurring ON transactions (is_recurring) WHERE is_recurring = true;
CREATE INDEX IF NOT EXISTS idx_transactions_original_recurring_id ON transactions (original_recurring_id);
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions (user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions (expires_at);

-- Kein Row Level Security: einziger Client der Datenbank ist die App,
-- die Zugriffskontrolle sitzt in den Route Handlers unter src/app/api.
