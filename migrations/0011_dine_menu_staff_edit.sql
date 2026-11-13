-- 餐點菜單：店員／管理員可自行編輯、上傳照片、刪除（隱藏）與查看修改紀錄。
-- 只新增欄位與新表，不改既有菜單內容。此遷移先不要套用到遠端 D1，等使用者說「上線」再套用。
ALTER TABLE dine_menu ADD COLUMN deleted integer NOT NULL DEFAULT 0;   -- 1 = 已刪除（隱藏，可還原）
ALTER TABLE dine_menu ADD COLUMN updated_at text NOT NULL DEFAULT '';
ALTER TABLE dine_menu ADD COLUMN updated_by text NOT NULL DEFAULT '';

-- 餐點照片存 D1（同單據照片做法）：瀏覽器先壓成 800×800 WebP（不支援時 JPEG），每張 ≤300KB。
CREATE TABLE IF NOT EXISTS dine_photos (
  id text PRIMARY KEY NOT NULL,
  mime text NOT NULL,
  size integer NOT NULL,
  data blob NOT NULL,
  created_at text NOT NULL,
  created_by text NOT NULL DEFAULT ''
);

-- 修改紀錄：誰、何時、改了什麼（changes 為 JSON：{欄位:[舊,新]}）
CREATE TABLE IF NOT EXISTS dine_menu_log (
  id integer PRIMARY KEY AUTOINCREMENT,
  item_id text NOT NULL,
  item_name text NOT NULL DEFAULT '',
  action text NOT NULL,           -- create / update / delete / restore
  changes text NOT NULL DEFAULT '{}',
  actor text NOT NULL DEFAULT '',
  created_at text NOT NULL
);
CREATE INDEX IF NOT EXISTS dine_menu_log_created ON dine_menu_log(created_at);
CREATE INDEX IF NOT EXISTS dine_menu_log_item ON dine_menu_log(item_id);
