#!/bin/bash
# 用法：bash apply_107.sh <使用者提供的一排小卷照片路徑>
# 複製到 orig/，重新壓縮、重產 upload_plan.json / upload_live.sql（含 sha256）。只動本機檔案，不碰線上。
set -e
cd /workspace/shelf-photos
cp "$1" "orig/107_一排小卷_165_使用者提供.jpg"
python3 build.py && python3 make_upload_sql.py
python3 -c "import json;p=[x for x in json.load(open('upload_plan.json')) if x['photo']==107][0];print('107 OK',p['webp'],p['bytes'],'bytes',p['size'],p['items'],p['sha256'][:12])"
