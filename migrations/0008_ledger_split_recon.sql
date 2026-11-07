-- 支出拆分、團購對帳日期／方向、單據照片、收銀機代支：全部為新增欄位或新增資料表，不改既有資料。
ALTER TABLE ledger_prepaid ADD COLUMN entry_date text NOT NULL DEFAULT '';   -- YYYY-MM-DD；舊資料為空白（月結單視為期初）
ALTER TABLE ledger_prepaid ADD COLUMN direction text NOT NULL DEFAULT '';    -- they_owe（對方欠我們，正數）／we_owe（我們欠對方，負數）；空白依正負判斷
ALTER TABLE ledger_prepaid ADD COLUMN payment_id text;                       -- 來源付款（拆分支出）
ALTER TABLE ledger_entries ADD COLUMN payment_id text;
CREATE TABLE IF NOT EXISTS ledger_payments (       -- 一次付款（一張單據），可拆成店內支出與團購對帳
  id text PRIMARY KEY NOT NULL, pay_date text NOT NULL, vendor text NOT NULL DEFAULT '', total real NOT NULL DEFAULT 0,
  pay_method text NOT NULL DEFAULT '', note text NOT NULL DEFAULT '', recorder text NOT NULL DEFAULT '',
  deleted integer NOT NULL DEFAULT 0, created_at text NOT NULL, updated_at text NOT NULL
);
CREATE INDEX IF NOT EXISTS ledger_payments_date ON ledger_payments(deleted,pay_date);
CREATE TABLE IF NOT EXISTS ledger_receipts (       -- 單據照片（檔案存在 R2，只有記帳權限的人能讀）
  id text PRIMARY KEY NOT NULL, payment_id text NOT NULL, r2_key text NOT NULL, mime text NOT NULL, size integer NOT NULL DEFAULT 0,
  deleted integer NOT NULL DEFAULT 0, created_at text NOT NULL
);
CREATE INDEX IF NOT EXISTS ledger_receipts_pay ON ledger_receipts(payment_id,deleted);
CREATE TABLE IF NOT EXISTS ledger_pos_cashout (    -- 收銀機「代支」匯出
  id text PRIMARY KEY NOT NULL, biz_date text NOT NULL, biz_time text NOT NULL DEFAULT '', type text NOT NULL DEFAULT '',
  item text NOT NULL DEFAULT '', staff text NOT NULL DEFAULT '', amount real NOT NULL DEFAULT 0, hash text NOT NULL UNIQUE,
  payment_id text, created_at text NOT NULL
);
CREATE INDEX IF NOT EXISTS ledger_pos_cashout_date ON ledger_pos_cashout(biz_date);
CREATE TABLE IF NOT EXISTS ledger_accounts (       -- 對帳對象顯示名稱（保留原代號，例：龍龍＝蟹老大中港店）
  account text PRIMARY KEY NOT NULL, label text NOT NULL DEFAULT ''
);
INSERT OR IGNORE INTO ledger_accounts (account,label) VALUES ('龍龍','蟹老大中港店');
