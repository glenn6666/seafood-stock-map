-- 記帳匯出：成本改為數字欄位、訂單明細記錄下單當時成本、匯出紀錄。只新增欄位／資料表；舊的文字成本欄位 cost 保留不動。
ALTER TABLE inventory ADD COLUMN cost_num integer;                 -- NULL＝尚未設定或舊文字無法判讀
-- 只轉換「明確是一個整數金額」的舊成本文字（可含逗號、空白、NT$/$、結尾「元」）；其餘保持 NULL，後台會標示待確認。
UPDATE inventory SET cost_num=CAST(replace(replace(replace(replace(replace(trim(cost),',',''),' ',''),'NT$',''),'$',''),'元','') AS INTEGER)
 WHERE cost_num IS NULL
   AND replace(replace(replace(replace(replace(trim(cost),',',''),' ',''),'NT$',''),'$',''),'元','')<>''
   AND replace(replace(replace(replace(replace(trim(cost),',',''),' ',''),'NT$',''),'$',''),'元','') NOT GLOB '*[^0-9]*'
   AND length(replace(replace(replace(replace(replace(trim(cost),',',''),' ',''),'NT$',''),'$',''),'元',''))<=9;
ALTER TABLE order_items ADD COLUMN unit_cost integer;               -- 下單當時的單位成本；NULL＝舊訂單或當時未設定
CREATE TABLE IF NOT EXISTS export_log (
  id text PRIMARY KEY NOT NULL,
  kind text NOT NULL DEFAULT 'bookkeeping',
  from_date text NOT NULL,
  to_date text NOT NULL,
  days text NOT NULL DEFAULT '',                                     -- 有資料的日期（逗號分隔）
  exported_by text NOT NULL,
  exported_at text NOT NULL
);
CREATE INDEX IF NOT EXISTS export_log_range ON export_log(kind,from_date,to_date);
