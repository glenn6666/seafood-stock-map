# 上線部署（訂單／顧客訂購頁／多帳號）

> 本分支只在本機（wrangler dev --local＋本機 D1）測試過，**尚未部署**。以下指令會改動線上資源，需在已登入 Cloudflare 的電腦執行（`npx wrangler login`，帳號為 `seafood-stock-api.iamglenn0630.workers.dev` 所屬帳號）。

## 部署前檢查表（全部打勾才開始）
- [ ] `npx wrangler whoami` 顯示的帳號，就是 `seafood-stock-api` Worker 所在帳號。
- [ ] `npx wrangler d1 list` 找到線上**既有**庫存資料庫，已把名稱與 ID 填入 `wrangler.toml`（不是佔位值、不是新資料庫）。
- [ ] `wrangler.toml` 的 `name = "seafood-stock-api"` 與線上 Worker 名稱相同；`ALLOWED_ORIGIN = "https://glenn6666.github.io"`。
- [ ] `npx wrangler secret list` 有 `INVENTORY_TOKEN`（就是目前的「管理密碼」；請確認自己記得它）。
- [ ] 已執行 D1 備份（步驟 1），備份檔內可找到 `INSERT INTO "inventory"` 或 `INSERT INTO inventory` 資料列，並記下目前筆數：`SELECT COUNT(*) FROM inventory`。
- [ ] `npx wrangler d1 migrations list seafood-stock --remote` 只列出 0001、0002、0003 待套用（若顯示其他名稱，先停下確認）。
- [ ] 本機 `npm ci && npm run typecheck && npm run build` 成功；`backend-config.json` 的 `apiOrigin` 是 `https://seafood-stock-api.iamglenn0630.workers.dev`。
- [ ] repo、`dist/` 內沒有 `.dev.vars` 或任何密碼（`git status` 不應出現 `.dev.vars`）。
- [ ] 選一個店內沒人在操作庫存的時段（舊畫面在前端更新前，存檔不會做「版本衝突」檢查）。

## 1. 備份 D1
```bash
npx wrangler d1 export seafood-stock --remote --output backup-$(date +%Y%m%d-%H%M).sql
npx wrangler d1 execute seafood-stock --remote --command "SELECT COUNT(*) AS n FROM inventory"
```

## 2. 資料庫升級（只新增，不刪除）
```bash
npx wrangler d1 migrations apply seafood-stock --remote
npx wrangler d1 execute seafood-stock --remote --command "SELECT COUNT(*) AS n FROM inventory"   # 應與備份前相同
```
- `0001_inventory_baseline.sql`：`CREATE TABLE IF NOT EXISTS inventory`（表已存在＝不做事）。
- `0002_orders_accounts.sql`：inventory 新增 cost／on_sale（預設 0＝不上架）／daily_limit／per_order_max；新增 users、sessions、orders、order_items、daily_sales、_guard。
- `0003_ratelimit_settings.sql`：新增 settings（原管理密碼開關）、rate_limits（顧客端頻率限制，IP 僅存雜湊）。
- 全部沒有 DROP、DELETE、重建 inventory。

## 3. 更新 Worker
```bash
npx wrangler deploy
curl -s https://seafood-stock-api.iamglenn0630.workers.dev/api/auth/status     # 應回 {"needsBootstrap":true}
```
此時舊版前端仍可用原管理密碼登入使用。

## 4. 前端發布到 GitHub Pages
```bash
npm run build
```
把 `dist/` 內所有檔案複製到 `main` 分支根目錄（覆蓋 `index.html`、新增 `order.html` 與 `assets/` 內新檔），提交並推送。Pages 更新後強制重新整理。

## 5. 上線後立即
1. 開 https://glenn6666.github.io/seafood-stock-map/ ，帳號留空、輸入原管理密碼 → 依黃色區塊建立第一位管理員 → 以新帳號重新登入。
2. 「帳號」頁新增店員；確認店員登入後看不到成本、帳號頁、售價欄。
3. 「商品販售」頁勾選商品 →「全部上架」（預設皆未上架）。
4. 手機開 https://glenn6666.github.io/seafood-stock-map/order.html 試下一筆單 → 後台取消，確認庫存補回。
5. 所有人改用個人帳號後，到「帳號」頁按「停用原管理密碼」。停用後該密碼對所有 API 都無效；只有管理員帳號能重新啟用。

## 回復
- Worker：`npx wrangler rollback`（舊程式只用 inventory 原欄位，新增的欄位／表不影響）。
- 前端：在 main 還原上一版 `index.html`。
- 資料：以備份檔匯入新建的 D1 比對，不要直接覆蓋線上庫。

---
# 追加：顧客訂購頁 3D 逛店（feature/3d-customer-order）
1. 備份：`npx wrangler d1 export seafood-stock --remote --output backup-$(date +%Y%m%d-%H%M).sql`
2. 資料庫：`npx wrangler d1 migrations apply seafood-stock --remote`（只會套用 `0004_display_units.sql`：inventory 新增 `display_zone`（預設空白＝自動），新增 `display_units` 並以 `INSERT OR IGNORE` 建立 3 台冷凍冰箱＋1 座魚缸）。
3. Worker：`npx wrangler deploy`
4. 前端：`npm run build`，將 `dist/` 的 `index.html`、`order.html`、`assets/*` 複製到 main 根目錄並推送。
5. 驗證：`/api/public/menu` 回應有 `units`，每項商品只有 `displayUnit{id,name,type}`，沒有儲位或成本。

## 0005：漫畫店面配置＋釣蝦優惠券（feature/comic-game-zones）
1. 先備份：`npx wrangler d1 export seafood-stock --remote --output backups/seafood-stock-<日期>-pre0005.sql`
2. 若 0004 尚未上線，會與 0005 一起套用：`npx wrangler d1 migrations apply seafood-stock --remote`（只新增欄位／資料表／展示櫃列；舊展示櫃改為停用，不刪除；不動實際儲位）。
3. `npx wrangler deploy`（不需新增機密；優惠券與遊戲雜湊沿用 INVENTORY_TOKEN 做 IP 雜湊鹽）。
4. 合併 PR 後建置並發布 GitHub Pages；確認 `backend-config.json` 指向線上 Worker。
5. 回滾：`npx wrangler rollback <前一版 version id>`；資料庫新增欄位不影響舊版 Worker。

---
# 追加：記帳匯出（feature/bookkeeping-export，疊在 feature/comic-game-zones 之上）
> 只在本機測試過，**尚未部署**。需先（或同時）上線 0004、0005（PR #2、#3）。
1. 備份：`npx wrangler d1 export seafood-stock --remote --output backup-$(date +%Y%m%d-%H%M).sql`，記下 `SELECT COUNT(*) FROM inventory`、`SELECT COUNT(*) FROM orders`。
2. 先看哪些舊成本無法轉數字（唯讀）：
   `npx wrangler d1 execute seafood-stock --remote --command "SELECT id,name,cost FROM inventory WHERE trim(cost)<>''"`
3. 資料庫：`npx wrangler d1 migrations list seafood-stock --remote` 應只列出待套用的 0004／0005／0006 → `npx wrangler d1 migrations apply seafood-stock --remote`。
   - `0006_bookkeeping_export.sql`：inventory 新增 `cost_num`（舊文字 `cost` 保留；只轉換明確的整數金額，其餘 NULL）、order_items 新增 `unit_cost`、新增 `export_log`。沒有 DROP／DELETE。
   - 套用後再數一次 inventory、orders 筆數，應與備份前相同；`SELECT COUNT(*) FROM inventory WHERE trim(cost)<>'' AND cost_num IS NULL` 為後台會標示「成本待確認」的數量。
4. `npx wrangler deploy` → `npm run build` → 發布 `dist/` 到 main（同前）。
5. 上線後：管理員到「商品販售」補齊標示「成本待確認」的商品成本；到「記帳匯出」選日期 → 產生預覽 → 複製，貼到「每日收支紀錄」最後一列的「項次」欄。
回復：`npx wrangler rollback`；新增的欄位／表不影響舊程式。
