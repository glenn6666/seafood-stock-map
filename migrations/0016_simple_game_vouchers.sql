-- Successful claims are limited by LINE nickname and Taiwan date, not by device.
DROP INDEX game_vouchers_daily_player;
DROP INDEX game_vouchers_daily_nickname;
UPDATE game_vouchers SET status='approved',approved_at=created_at WHERE status='pending';
CREATE UNIQUE INDEX game_vouchers_daily_nickname ON game_vouchers(claim_day,nickname_key) WHERE status IN ('approved','redeemed');
