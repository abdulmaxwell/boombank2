CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name text NOT NULL,
  phone text UNIQUE NOT NULL,
  password_hash text NOT NULL,
  balance numeric DEFAULT 0,
  verified boolean DEFAULT false,
  otp text,
  otp_expires_at timestamptz,
  created_at timestamptz DEFAULT now()
);
CREATE TABLE IF NOT EXISTS transactions (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  type text CHECK (type IN ('deposit','withdraw','game_win','game_loss')) NOT NULL,
  amount numeric NOT NULL,
  status text CHECK (status IN ('pending','completed','failed')) DEFAULT 'pending',
  reference text,
  created_at timestamptz DEFAULT now()
);
CREATE TABLE IF NOT EXISTS games (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  bet_amount numeric NOT NULL,
  grid jsonb,
  result text CHECK (result IN ('win','loss')),
  multiplier numeric,
  created_at timestamptz DEFAULT now()
);
