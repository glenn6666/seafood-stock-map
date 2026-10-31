# seafood-stock-map
水產團購庫存管理

## 原始碼（feature/orders-customer-accounts 起）
- `web/`：Vite 前端原始碼（`index.html` 後台＋庫存地圖、`order.html` 顧客訂購頁）
- `worker/index.ts`：Cloudflare Worker API；`migrations/`：D1 遷移；`wrangler.toml`：綁定（不含機密）
- `tests/api.test.mjs`：本機 API 測試；部署請見 `DEPLOY.md`

### 記帳（管理員限定）
後台「記帳」分頁有這些功能：收支紀錄、月報、日報、損益表（含手動資產負債表）、年度營業額、每日營業額（上傳收銀機 xlsx／csv）、員工薪資、客戶廠商、團購對帳、分類設定、匯入試算表。可與 Google 試算表並行使用，複製與 CSV 都維持 28 欄格式。部署步驟見 DEPLOY.md。
