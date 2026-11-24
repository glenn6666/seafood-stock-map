-- Retain old rankings, but separate them from the new 30-second scoring rules.
ALTER TABLE game_sessions ADD COLUMN difficulty TEXT NOT NULL DEFAULT 'normal';
ALTER TABLE game_sessions ADD COLUMN rule_version INTEGER NOT NULL DEFAULT 1;
ALTER TABLE game_scores ADD COLUMN difficulty TEXT NOT NULL DEFAULT 'normal';
ALTER TABLE game_scores ADD COLUMN rule_version INTEGER NOT NULL DEFAULT 1;
ALTER TABLE game_scores ADD COLUMN score INTEGER NOT NULL DEFAULT 0;
ALTER TABLE game_scores ADD COLUMN caught INTEGER NOT NULL DEFAULT 0;
CREATE INDEX game_scores_version_target ON game_scores(rule_version,target,player_hash,score DESC,created_at);
-- Existing unused coupons also expire at the end of their Taiwan issue date.
UPDATE coupons SET expires_at=MIN(expires_at,strftime('%Y-%m-%dT%H:%M:%fZ',created_at,'+8 hours','start of day','+1 day','-8 hours')) WHERE used_order_id IS NULL;
