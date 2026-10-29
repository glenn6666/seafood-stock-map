-- 安星水產漫畫店面配置＋釣蝦優惠券。只新增欄位／資料表／列；不刪除任何資料或實際儲位。
-- 1) 展示櫃樣式（kind）：沿用 type 的 CHECK（freezer/tank），細分外觀用 kind。
ALTER TABLE display_units ADD COLUMN kind text DEFAULT '' NOT NULL;
ALTER TABLE display_units ADD COLUMN area text DEFAULT '' NOT NULL;  -- 顧客端分區編號（01/04/06/07），與實際儲位 zone 無關
INSERT OR IGNORE INTO display_units (id,name,type,sort,active,kind,area) VALUES
 ('f1','牛肉冷藏櫃','freezer',11,1,'fridge','01'),
 ('f2','海鮮冷藏櫃','freezer',12,1,'fridge','01'),
 ('f3','冷藏食品櫃','freezer',13,1,'fridge','01'),
 ('c1','冰鮮魚展示櫃','freezer',41,1,'case','04'),
 ('c2','貝類展示櫃','freezer',42,1,'case','04'),
 ('c3','蝦蟹展示櫃','freezer',43,1,'case','04'),
 ('t1','低溫缸','tank',61,1,'cold','06'),
 ('t4','泰國蝦缸','tank',62,1,'shrimp','06'),
 ('t7','常溫缸','tank',63,1,'ambient','06'),
 ('s7','乾貨區','freezer',71,1,'dry','07');
-- 舊的 4 個展示櫃改為停用（保留列，可在後台重新啟用）；已手動指定的商品對應到新櫃位
UPDATE display_units SET active=0 WHERE id IN ('freezer-1','freezer-2','freezer-3','tank');
UPDATE inventory SET display_zone=CASE display_zone WHEN 'freezer-1' THEN 'f2' WHEN 'freezer-2' THEN 'f1' WHEN 'freezer-3' THEN 'f3' WHEN 'tank' THEN 't1' END
 WHERE display_zone IN ('freezer-1','freezer-2','freezer-3','tank');

-- 2) 釣蝦遊戲與優惠券（伺服器發券、單次使用、有效期限；只存雜湊）
CREATE TABLE IF NOT EXISTS game_sessions (
  id_hash text PRIMARY KEY NOT NULL,       -- SHA-256(遊戲識別碼)
  ip_hash text NOT NULL,
  started_at integer NOT NULL,             -- epoch 秒（伺服器時間）
  finished integer NOT NULL DEFAULT 0,
  target text NOT NULL DEFAULT 'shrimp',   -- shrimp / crab / lobster（決定過關隻數與時間）
  tool text NOT NULL DEFAULT 'rod'         -- rod / net / tongs / cage（僅記錄，用於調整難度統計）
);
CREATE TABLE IF NOT EXISTS coupons (
  code_hash text PRIMARY KEY NOT NULL,     -- SHA-256(優惠碼)，不存明文
  kind text NOT NULL DEFAULT 'shrimp5',
  discount integer NOT NULL,
  min_total integer NOT NULL,
  ip_hash text NOT NULL,
  created_at text NOT NULL,
  expires_at text NOT NULL,
  used_order_id text                       -- NULL＝未使用
);
CREATE INDEX IF NOT EXISTS coupons_used ON coupons(used_order_id);
ALTER TABLE orders ADD COLUMN subtotal integer;                       -- NULL＝舊訂單（total 即小計）
ALTER TABLE orders ADD COLUMN discount integer NOT NULL DEFAULT 0;
ALTER TABLE orders ADD COLUMN coupon_hash text NOT NULL DEFAULT '';
