# seafood-stock-map
水產團購庫存管理

## 原始碼（feature/orders-customer-accounts 起）
- `web/`：Vite 前端原始碼（`index.html` 後台＋庫存地圖、`order.html` 顧客訂購頁）
- `worker/index.ts`：Cloudflare Worker API；`migrations/`：D1 遷移；`wrangler.toml`：綁定（不含機密）
- `tests/api.test.mjs`：本機 API 測試；部署請見 `DEPLOY.md`
