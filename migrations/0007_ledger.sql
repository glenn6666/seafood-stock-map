-- 記帳整合（後台記帳）：全部為新增資料表，不修改既有資料表或資料。
CREATE TABLE IF NOT EXISTS ledger_categories (
  id integer PRIMARY KEY AUTOINCREMENT,
  category text NOT NULL,            -- 會計項目（例：店面支出）
  item text NOT NULL DEFAULT '',     -- 內容（例：房租；可空白）
  kind text NOT NULL CHECK (kind IN ('收入','支出')),
  sort integer NOT NULL DEFAULT 0,
  active integer NOT NULL DEFAULT 1,
  UNIQUE(category,item)
);
CREATE TABLE IF NOT EXISTS ledger_entries (
  id text PRIMARY KEY NOT NULL,
  entry_date text NOT NULL,          -- YYYY-MM-DD
  raw_date text NOT NULL DEFAULT '', -- 試算表原始「日期」欄文字
  kind text NOT NULL,                -- 收入／支出
  category text NOT NULL,
  item text NOT NULL DEFAULT '',
  note text NOT NULL DEFAULT '',
  qty real NOT NULL DEFAULT 1,
  unit_price real NOT NULL DEFAULT 0,
  tax real NOT NULL DEFAULT 0,       -- 只記錄，不計算營業稅
  amount real NOT NULL DEFAULT 0,    -- 總計（正數）
  signed real NOT NULL DEFAULT 0,    -- 金額計算（收入正、支出負）
  staff text NOT NULL DEFAULT '',
  party text NOT NULL DEFAULT '',
  recorder text NOT NULL DEFAULT '',
  company text NOT NULL DEFAULT '',
  contact text NOT NULL DEFAULT '',
  tax_id text NOT NULL DEFAULT '',
  pay_method text NOT NULL DEFAULT '',
  bank text NOT NULL DEFAULT '',
  posted_date text NOT NULL DEFAULT '',
  cash_note text NOT NULL DEFAULT '',
  source text NOT NULL DEFAULT 'manual',  -- manual／sheet（匯入）／web（網站訂單）
  web_key text,                           -- 網站訂單每日彙總：web:日期:income|cost
  hash text NOT NULL,                     -- 去重用（日期、項目、數量、單價、對象、員工）
  deleted integer NOT NULL DEFAULT 0,
  created_at text NOT NULL,
  updated_at text NOT NULL
);
CREATE INDEX IF NOT EXISTS ledger_entries_date ON ledger_entries(deleted,entry_date);
CREATE INDEX IF NOT EXISTS ledger_entries_hash ON ledger_entries(hash);
CREATE UNIQUE INDEX IF NOT EXISTS ledger_entries_web ON ledger_entries(web_key) WHERE web_key IS NOT NULL;
CREATE TABLE IF NOT EXISTS ledger_contacts (
  name text PRIMARY KEY NOT NULL, company text NOT NULL DEFAULT '', contact text NOT NULL DEFAULT '', tax_id text NOT NULL DEFAULT '',
  phone text NOT NULL DEFAULT '', address text NOT NULL DEFAULT '', note text NOT NULL DEFAULT '', updated_at text NOT NULL
);
CREATE TABLE IF NOT EXISTS ledger_employees (
  name text PRIMARY KEY NOT NULL, title text NOT NULL DEFAULT '', daily_wage real, hourly_wage real, monthly_wage real,
  active integer NOT NULL DEFAULT 1, updated_at text NOT NULL
);
CREATE TABLE IF NOT EXISTS ledger_payroll (
  name text NOT NULL, ym text NOT NULL,   -- ym＝YYYY-MM
  base real NOT NULL DEFAULT 0, overtime real NOT NULL DEFAULT 0, bonus real NOT NULL DEFAULT 0, year_end real NOT NULL DEFAULT 0,
  late real NOT NULL DEFAULT 0, leave real NOT NULL DEFAULT 0, labor_ins real NOT NULL DEFAULT 0, health_ins real NOT NULL DEFAULT 0,
  pension real NOT NULL DEFAULT 0, net_pay real NOT NULL DEFAULT 0, note text NOT NULL DEFAULT '', updated_at text NOT NULL,
  PRIMARY KEY(name,ym)
);
CREATE TABLE IF NOT EXISTS ledger_pos_daily (
  sale_date text PRIMARY KEY NOT NULL,    -- 收銀機日結
  gross real NOT NULL DEFAULT 0, discount real NOT NULL DEFAULT 0, cash real NOT NULL DEFAULT 0, other_pay real NOT NULL DEFAULT 0,
  customers integer NOT NULL DEFAULT 0, revenue real NOT NULL DEFAULT 0, uber real NOT NULL DEFAULT 0, source text NOT NULL DEFAULT 'manual',
  updated_at text NOT NULL
);
CREATE TABLE IF NOT EXISTS ledger_prepaid (
  id text PRIMARY KEY NOT NULL, account text NOT NULL,   -- 例：龍龍
  seq integer NOT NULL DEFAULT 0, item text NOT NULL DEFAULT '', unit_price real NOT NULL DEFAULT 0, qty real NOT NULL DEFAULT 1,
  amount real NOT NULL DEFAULT 0, checked text NOT NULL DEFAULT '', status text NOT NULL DEFAULT '', hash text NOT NULL,
  deleted integer NOT NULL DEFAULT 0, created_at text NOT NULL
);
CREATE INDEX IF NOT EXISTS ledger_prepaid_acct ON ledger_prepaid(account,deleted,seq);
CREATE TABLE IF NOT EXISTS ledger_balance (       -- 資產負債表（手動輸入）與損益表調整項目
  ym text NOT NULL, section text NOT NULL, label text NOT NULL, amount real NOT NULL DEFAULT 0, sort integer NOT NULL DEFAULT 0,
  updated_at text NOT NULL, PRIMARY KEY(ym,section,label)
);
CREATE TABLE IF NOT EXISTS ledger_options (       -- 付款方式、銀行等下拉選單
  kind text NOT NULL, value text NOT NULL, sort integer NOT NULL DEFAULT 0, PRIMARY KEY(kind,value)
);
INSERT OR IGNORE INTO ledger_categories (category,item,kind,sort) VALUES ('網站收入','網站訂單','收入',900),('進貨支出','網站訂單成本','支出',901);
INSERT OR IGNORE INTO ledger_options (kind,value,sort) VALUES ('pay','現金',1),('pay','刷卡',2),('pay','匯款',3),('pay','支票',4);
