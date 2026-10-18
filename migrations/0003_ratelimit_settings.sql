-- 只新增資料表；不改動 inventory 與既有資料。
CREATE TABLE IF NOT EXISTS settings (
  key text PRIMARY KEY NOT NULL,
  value text NOT NULL,
  updated_at text NOT NULL,
  updated_by text NOT NULL DEFAULT ''
);
-- 顧客端頻率限制計數（IP 僅存雜湊，一天後自動清除舊時間窗）
CREATE TABLE IF NOT EXISTS rate_limits (
  bucket text NOT NULL,
  key_hash text NOT NULL,
  window_start integer NOT NULL,
  count integer NOT NULL DEFAULT 0,
  PRIMARY KEY (bucket, key_hash, window_start)
);
