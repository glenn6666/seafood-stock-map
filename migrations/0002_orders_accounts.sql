-- 只新增欄位與資料表；不刪除、不重建 inventory，既有商品／庫存／儲位／照片／冰箱資料全部保留。
ALTER TABLE inventory ADD COLUMN cost text DEFAULT '' NOT NULL;
ALTER TABLE inventory ADD COLUMN on_sale integer DEFAULT 0 NOT NULL;        -- 預設不上架，避免商品意外公開
ALTER TABLE inventory ADD COLUMN daily_limit integer DEFAULT 0 NOT NULL;    -- 0 = 不限
ALTER TABLE inventory ADD COLUMN per_order_max integer DEFAULT 0 NOT NULL;  -- 0 = 不限

CREATE TABLE IF NOT EXISTS users (
  id text PRIMARY KEY NOT NULL,
  username text NOT NULL UNIQUE,
  display_name text NOT NULL DEFAULT '',
  role text NOT NULL CHECK (role IN ('admin','staff')),
  pw_hash text NOT NULL,
  pw_salt text NOT NULL,
  pw_iter integer NOT NULL,
  active integer NOT NULL DEFAULT 1,
  token_version integer NOT NULL DEFAULT 0,
  created_at text NOT NULL
);
CREATE TABLE IF NOT EXISTS sessions (
  id text PRIMARY KEY NOT NULL,            -- SHA-256(登入權杖)，不存明文
  user_id text NOT NULL REFERENCES users(id),
  token_version integer NOT NULL,
  created_at text NOT NULL,
  expires_at text NOT NULL,
  revoked integer NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS sessions_user ON sessions(user_id);

CREATE TABLE IF NOT EXISTS orders (
  id text PRIMARY KEY NOT NULL,
  order_no text NOT NULL UNIQUE,
  idempotency_key text NOT NULL UNIQUE,
  lookup_token text NOT NULL UNIQUE,
  source text NOT NULL CHECK (source IN ('admin','customer')),
  customer_name text NOT NULL,
  phone text NOT NULL DEFAULT '',
  note text NOT NULL DEFAULT '',
  status text NOT NULL CHECK (status IN ('待處理','備貨中','可取貨','已完成','已取消')),
  total integer NOT NULL DEFAULT 0,
  sale_date text NOT NULL,
  restocked integer NOT NULL DEFAULT 0,
  created_by text NOT NULL DEFAULT '',
  created_at text NOT NULL,
  updated_at text NOT NULL
);
CREATE INDEX IF NOT EXISTS orders_created ON orders(created_at);
CREATE TABLE IF NOT EXISTS order_items (
  order_id text NOT NULL REFERENCES orders(id),
  item_id text NOT NULL,
  name text NOT NULL,
  spec text NOT NULL DEFAULT '',
  unit text NOT NULL DEFAULT '',
  qty integer NOT NULL CHECK (qty > 0),
  unit_price integer NOT NULL DEFAULT 0,
  PRIMARY KEY (order_id, item_id)
);
CREATE TABLE IF NOT EXISTS daily_sales (
  item_id text NOT NULL,
  sale_date text NOT NULL,
  qty integer NOT NULL DEFAULT 0,
  PRIMARY KEY (item_id, sale_date)
);
-- 交易防護：寫入 ok=0 會違反 CHECK，讓整批（D1 batch 交易）回滾。
CREATE TABLE IF NOT EXISTS _guard (id integer PRIMARY KEY, ok integer NOT NULL CHECK (ok = 1));
