-- Existing issued vouchers remain discount vouchers.
ALTER TABLE game_vouchers ADD COLUMN prize_type TEXT NOT NULL DEFAULT 'coupon' CHECK(prize_type IN ('coupon','gift'));
