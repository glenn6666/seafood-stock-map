-- 單據照片改存 D1（不用 R2）：只新增，不改舊資料。
-- 照片先在瀏覽器壓縮（長邊 ≤1600px、JPEG），每張 ≤400KB，存一列 BLOB（D1 單值上限 2MB）。
-- 保存 2 年：每日排程刪除照片內容並記下 expired_at；對帳／付款紀錄本身保留。
CREATE TABLE IF NOT EXISTS ledger_receipt_data (
  receipt_id text PRIMARY KEY NOT NULL,
  data blob NOT NULL
);
ALTER TABLE ledger_receipts ADD COLUMN expired_at text;
CREATE INDEX IF NOT EXISTS ledger_receipts_created ON ledger_receipts(created_at);
