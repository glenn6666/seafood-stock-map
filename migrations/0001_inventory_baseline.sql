-- 既有庫存資料表基準（與線上 D1 欄位一致）。資料表已存在時不做任何事，不會改動既有資料。
CREATE TABLE IF NOT EXISTS inventory (
  id text PRIMARY KEY NOT NULL,
  zone text NOT NULL,
  name text NOT NULL,
  spec text NOT NULL,
  quantity integer NOT NULL,
  unit text NOT NULL,
  minimum integer NOT NULL,
  batch text NOT NULL,
  category text DEFAULT '未分類' NOT NULL,
  price text DEFAULT '' NOT NULL,
  tracked integer DEFAULT false NOT NULL,
  photo_id text DEFAULT '' NOT NULL,
  position_note text DEFAULT '' NOT NULL,
  fridge_id text DEFAULT '' NOT NULL
);
