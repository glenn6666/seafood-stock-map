# 10/31 盤點匯入
- `stock-1031.sql`：126 筆 `INSERT OR IGNORE INTO inventory`（id `stk1031-001`…`126`），只新增、不改不刪；重跑不會重複。
- 來源：「安星水產團購表單」分頁「10/31盤點」（唯讀）。團購商品 45,178 元無明細，未匯入。
- 架上與凍庫同名商品分成兩筆，名稱加（架上）／（冷凍）。全部 on_sale=1，單位預設「份」，帝王蟹為「隻」。
- 上線前先備份：`npx wrangler d1 export seafood-stock --remote --output /workspace/backups/<時間>.sql`
- 上線：`npx wrangler d1 execute seafood-stock --remote --file tools/stock-import/stock-1031.sql`
- 回復（只刪這批）：`DELETE FROM inventory WHERE id LIKE 'stk1031-%';`
