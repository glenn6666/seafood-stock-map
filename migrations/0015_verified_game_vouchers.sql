ALTER TABLE game_sessions ADD COLUMN caught INTEGER NOT NULL DEFAULT 0;
ALTER TABLE game_sessions ADD COLUMN finished_at TEXT NOT NULL DEFAULT '';
CREATE TABLE game_vouchers (
 id TEXT PRIMARY KEY NOT NULL,
 token_hash TEXT UNIQUE NOT NULL,
 game_hash TEXT UNIQUE NOT NULL,
 player_hash TEXT NOT NULL,
 nickname_key TEXT NOT NULL,
 group_nickname TEXT NOT NULL,
 claim_day TEXT NOT NULL,
 voucher_no TEXT UNIQUE NOT NULL,
 status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected','redeemed')),
 created_at TEXT NOT NULL,
 expires_at TEXT NOT NULL,
 approved_by TEXT NOT NULL DEFAULT '',
 approved_at TEXT NOT NULL DEFAULT '',
 redeemed_by TEXT NOT NULL DEFAULT '',
 redeemed_at TEXT NOT NULL DEFAULT ''
);
CREATE UNIQUE INDEX game_vouchers_daily_nickname ON game_vouchers(claim_day,nickname_key) WHERE status<>'rejected';
CREATE UNIQUE INDEX game_vouchers_daily_player ON game_vouchers(claim_day,player_hash) WHERE status<>'rejected';
CREATE INDEX game_vouchers_review ON game_vouchers(claim_day,status,created_at);
