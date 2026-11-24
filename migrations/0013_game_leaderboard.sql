-- Rankings are separate from short-lived sessions; no IP or coupon codes are public.
ALTER TABLE game_sessions ADD COLUMN nickname TEXT NOT NULL DEFAULT '';
ALTER TABLE game_sessions ADD COLUMN player_hash TEXT NOT NULL DEFAULT '';
CREATE TABLE game_scores (
 id TEXT PRIMARY KEY NOT NULL,
 player_hash TEXT NOT NULL,
 nickname TEXT NOT NULL,
 target TEXT NOT NULL CHECK(target IN ('shrimp','crab','lobster')),
 tool TEXT NOT NULL CHECK(tool IN ('rod','net','tongs','cage')),
 elapsed_sec INTEGER NOT NULL CHECK(elapsed_sec>=0),
 created_at TEXT NOT NULL
);
CREATE INDEX game_scores_target_player ON game_scores(target,player_hash,elapsed_sec,created_at);
