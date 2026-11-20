#!/usr/bin/env bash
# 架上商品照片上線（使用者說「上線」、PR 已合併到 main 後才執行）。順序：備份 → 遷移 → 上傳照片 → 驗證 → 部署 Worker →（另外）發布網頁。
set -euo pipefail
export PATH=~/node22/bin:$PATH
cd /tmp/seafood-main 2>/dev/null || cd /workspace/seafood-dev
git fetch -q origin && git checkout -q main && git pull -q --ff-only
test -f migrations/0012_product_photos.sql || { echo '請先把 PR 合併到 main 再跑'; exit 1; }
test -f '/workspace/shelf-photos/orig/107_一排小卷_165_使用者提供.jpg' || { echo '107 一排小卷新照片還沒放進來：先跑 bash /workspace/shelf-photos/apply_107.sh <照片>'; exit 1; }
TS=$(date +%Y%m%d-%H%M)
BK=/workspace/backups/seafood-stock-$TS-pre-shelf-photos.sql
echo "1/5 備份 D1 → $BK"; npx wrangler d1 export seafood-stock --remote --output "$BK"; test -s "$BK"
echo "2/5 套用遷移 0012（只新增 inventory.image_url）"; npx wrangler d1 migrations apply seafood-stock --remote
echo "3/5 上傳 upload_plan.json 內全部照片並配對品項（只填 image_url 空白的品項；可重跑）"
python3 /workspace/shelf-photos/make_upload_sql.py
npx wrangler d1 execute seafood-stock --remote --file /workspace/shelf-photos/upload_live.sql
echo "4/5 驗證"
npx wrangler d1 execute seafood-stock --remote --json --command "SELECT COUNT(*) AS photos, SUM(size=length(data)) AS ok FROM dine_photos WHERE created_by='架上照片匯入'; SELECT COUNT(*) AS items FROM inventory WHERE image_url LIKE '/api/public/dine-photos/%';" | python3 -c "import json,sys;d=json.load(sys.stdin);print(d[0]['results'],d[1]['results'])"
echo "5/5 部署 Worker"; npx wrangler deploy
python3 - <<'P'
import json,hashlib,urllib.request
plan=json.load(open('/workspace/shelf-photos/upload_plan.json'));bad=0
for p in plan:
  b=urllib.request.urlopen(f"https://seafood-stock-api.iamglenn0630.workers.dev/api/public/dine-photos/{p['id']}").read()
  bad+=hashlib.sha256(b).hexdigest()!=p['sha256']
print('線上照片比對：',len(plan)-bad,'/',len(plan),'一致')
P
echo "完成。接著照往例 build 後發布 GitHub Pages（dist → 根目錄），並到線上確認。"
