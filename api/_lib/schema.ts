// Idempotent schema. Nutrient columns store values for one serving.
// Bump SCHEMA_VERSION whenever a statement is added so existing databases pick it up.

export const SCHEMA_VERSION = 1;

const NUTRIENT_COLUMNS = `
  calories double precision NOT NULL DEFAULT 0,
  protein double precision NOT NULL DEFAULT 0,
  carbs double precision NOT NULL DEFAULT 0,
  fat double precision NOT NULL DEFAULT 0,
  fiber double precision NOT NULL DEFAULT 0,
  sugar double precision NOT NULL DEFAULT 0,
  sodium double precision NOT NULL DEFAULT 0,
  water double precision NOT NULL DEFAULT 0`;

export const SCHEMA: string[] = [
  `CREATE TABLE IF NOT EXISTS users (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    email text NOT NULL,
    name text NOT NULL,
    password_hash text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS users_email_idx ON users (lower(email))`,

  `CREATE TABLE IF NOT EXISTS sessions (
    token_hash text PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at timestamptz NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE INDEX IF NOT EXISTS sessions_user_idx ON sessions (user_id)`,

  `CREATE TABLE IF NOT EXISTS profiles (
    user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    data jsonb NOT NULL,
    updated_at timestamptz NOT NULL DEFAULT now()
  )`,

  `CREATE TABLE IF NOT EXISTS entries (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    date date NOT NULL,
    meal text NOT NULL CHECK (meal IN ('breakfast', 'lunch', 'dinner', 'snack')),
    name text NOT NULL,
    brand text NOT NULL DEFAULT '',
    serving_amount double precision NOT NULL DEFAULT 1,
    serving_unit text NOT NULL DEFAULT '份',
    quantity double precision NOT NULL DEFAULT 1,
    source text NOT NULL DEFAULT 'manual',
    ${NUTRIENT_COLUMNS},
    created_at timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE INDEX IF NOT EXISTS entries_user_date_idx ON entries (user_id, date)`,

  `CREATE TABLE IF NOT EXISTS foods (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name text NOT NULL,
    brand text NOT NULL DEFAULT '',
    serving_amount double precision NOT NULL DEFAULT 1,
    serving_unit text NOT NULL DEFAULT '份',
    barcode text,
    favorite boolean NOT NULL DEFAULT false,
    use_count integer NOT NULL DEFAULT 0,
    ${NUTRIENT_COLUMNS},
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE INDEX IF NOT EXISTS foods_user_idx ON foods (user_id)`,

  `CREATE TABLE IF NOT EXISTS water_logs (
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    date date NOT NULL,
    ml double precision NOT NULL DEFAULT 0,
    PRIMARY KEY (user_id, date)
  )`,

  `CREATE TABLE IF NOT EXISTS weights (
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    date date NOT NULL,
    kg double precision NOT NULL,
    PRIMARY KEY (user_id, date)
  )`,

  `CREATE TABLE IF NOT EXISTS ai_usage (
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    date date NOT NULL,
    count integer NOT NULL DEFAULT 0,
    PRIMARY KEY (user_id, date)
  )`,
];
