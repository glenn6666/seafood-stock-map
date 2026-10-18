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
