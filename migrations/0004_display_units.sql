-- 顧客端 3D 展示用的「展示櫃」設定。與實際儲位（zone／照片／冰箱）完全分開，顧客端只看得到展示櫃名稱與類型。
-- 只新增欄位與資料表；不改動既有資料。
ALTER TABLE inventory ADD COLUMN display_zone text DEFAULT '' NOT NULL;   -- '' = 依分類自動分配
CREATE TABLE IF NOT EXISTS display_units (
  id text PRIMARY KEY NOT NULL,
  name text NOT NULL,
  type text NOT NULL CHECK (type IN ('freezer','tank')),
  sort integer NOT NULL DEFAULT 0,
  active integer NOT NULL DEFAULT 1
);
INSERT OR IGNORE INTO display_units (id,name,type,sort) VALUES
 ('freezer-1','海鮮冷凍櫃','freezer',1),
 ('freezer-2','肉品冷凍櫃','freezer',2),
 ('freezer-3','火鍋料・熟食冷凍櫃','freezer',3),
 ('tank','活海鮮魚缸','tank',4);
