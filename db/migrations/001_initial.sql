CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE
    accounts (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4 (),
        username TEXT UNIQUE,
        password_hash TEXT,
        is_guest BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW (),
        last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW ()
    );

CREATE INDEX idx_accounts_username ON accounts (username)
WHERE
    username IS NOT NULL;

CREATE TABLE
    sessions (
        token TEXT PRIMARY KEY,
        account_id UUID NOT NULL REFERENCES accounts (id) ON DELETE CASCADE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW (),
        expires_at TIMESTAMPTZ NOT NULL,
        last_used_at TIMESTAMPTZ NOT NULL DEFAULT NOW ()
    );

CREATE INDEX idx_sessions_account ON sessions (account_id);

CREATE INDEX idx_sessions_expires ON sessions (expires_at);

CREATE TABLE
    matches (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4 (),
        room_code TEXT NOT NULL,
        match_type TEXT NOT NULL DEFAULT 'standard',
        started_at TIMESTAMPTZ NOT NULL DEFAULT NOW (),
        ended_at TIMESTAMPTZ
    );

CREATE INDEX idx_matches_room_code ON matches (room_code);

CREATE INDEX idx_matches_started ON matches (started_at);

CREATE TABLE
    match_players (
        match_id UUID NOT NULL REFERENCES matches (id) ON DELETE CASCADE,
        account_id UUID NOT NULL REFERENCES accounts (id) ON DELETE CASCADE,
        final_score INTEGER NOT NULL DEFAULT 0,
        kills INTEGER NOT NULL DEFAULT 0,
        deaths INTEGER NOT NULL DEFAULT 0,
        planets_captured INTEGER NOT NULL DEFAULT 0,
        finishing_rank INTEGER,
        PRIMARY KEY (match_id, account_id)
    );

CREATE INDEX idx_match_players_account ON match_players (account_id);