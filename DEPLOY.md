# 部署步驟（訂單／顧客訂購頁／多帳號）

> 本分支只在本機測試過，**尚未部署**。以下指令需在已登入 Cloudflare（`npx wrangler login`，帳號為目前 `seafood-stock-api.iamglenn0630.workers.dev` 所屬帳號）的電腦上執行。

## 0. 準備
```bash
npm ci
npx wrangler d1 list            # 找出線上「既有」庫存資料庫名稱與 ID
```
把名稱與 ID 填入 `wrangler.toml` 的 `database_name`／`database_id`（**不要建立新資料庫**）。
確認 `wrangler.toml` 的 `name = "seafood-stock-api"` 與線上 Worker 名稱相同。

## 1. 備份 D1（必做）
```bash
npx wrangler d1 export <DB名稱> --remote --output backup-$(date +%Y%m%d-%H%M).sql
```
確認備份檔內有 `INSERT INTO inventory` 資料列再繼續。

## 2. 資料庫升級（只新增，不刪除）
```bash
npx wrangler d1 migrations list <DB名稱> --remote
npx wrangler d1 migrations apply <DB名稱> --remote
```
- `0001_inventory_baseline.sql`：`CREATE TABLE IF NOT EXISTS inventory`，表已存在時不做任何事。
- `0002_orders_accounts.sql`：`ALTER TABLE inventory ADD COLUMN`（cost／on_sale／daily_limit／per_order_max，皆有預設值，on_sale 預設 0＝不上架）＋新增 users／sessions／orders／order_items／daily_sales／_guard。
- 沒有 DROP、DELETE、重建資料表。
- 驗證：`npx wrangler d1 execute <DB名稱> --remote --command "SELECT COUNT(*) FROM inventory"` 數量應與備份前相同。

## 3. 機密與 Worker
`INVENTORY_TOKEN` 線上已設定則沿用（它就是目前的「管理密碼」，建立第一位管理員時要用）。若要重設：
```bash
npx wrangler secret put INVENTORY_TOKEN
```
`ALLOWED_ORIGIN` 在 `wrangler.toml` 為 `https://glenn6666.github.io`（非機密）。
```bash
npx wrangler deploy
```
部署後舊版前端仍可用原管理密碼登入（直到建立第一位管理員為止）。

## 4. 前端建置與 GitHub Pages 發布
```bash
npm run build      # 產出 dist/（index.html、order.html、assets/、照片、backend-config.json）
```
目前 Pages 由 `main` 分支根目錄提供。把 `dist/` 內容複製到 `main` 根目錄（覆蓋 `index.html`，新增 `order.html` 與新 `assets/*`），提交推送。
`dist/backend-config.json` 的 `apiOrigin` 為 `https://seafood-stock-api.iamglenn0630.workers.dev`。

## 5. 上線後立即
1. 開啟 https://glenn6666.github.io/seafood-stock-map/ ，帳號留空、輸入原管理密碼登入。
2. 上方黃色區塊「建立第一位管理員」→ 建立後原管理密碼立即停用，改用帳號登入。
3. 「帳號」頁新增店員。
4. 「商品販售」頁勾選要給顧客訂購的商品（預設皆未上架）。
5. 顧客訂購頁：https://glenn6666.github.io/seafood-stock-map/order.html

## 回復
Worker：`npx wrangler rollback`。資料：新欄位／新表不影響舊程式；必要時以備份檔匯入至新資料庫比對。
