#!/usr/bin/env python3
"""產生「架上照片」上線用 SQL：照片存 dine_photos（D1），inventory.image_url 指向 /api/public/dine-photos/<id>。
- 每張照片 id 由檔案 sha256 推出（uuid5），重跑不會重複新增。
- D1 單句上限 100KB，所以照片分段寫入（每段 45,000 bytes），每段只在長度剛好等於該段起點時才接上 → 重跑安全。
- 只更新 image_url 目前是空白的品項（不覆蓋之後手動換的照片）。不刪任何資料。"""
import json,hashlib,uuid,sys
plan=json.load(open('/workspace/shelf-photos/upload_plan.json'))
NS=uuid.UUID('6f1c1d1e-5a8b-4c3e-9a7d-2b1f0e9c8a01')
CH=45000;TS='2026-11-20T00:00:00.000Z';WHO='架上照片匯入'
out=[];ver=[]
for p in plan:
  b=open('/workspace/shelf-photos/'+p['webp'],'rb').read()
  pid=str(uuid.uuid5(NS,hashlib.sha256(b).hexdigest()))
  p['id']=pid;p['sha256']=hashlib.sha256(b).hexdigest();p['len']=len(b)
  ch=[b[i:i+CH] for i in range(0,len(b),CH)]
  out.append(f"INSERT OR IGNORE INTO dine_photos (id,mime,size,data,created_at,created_by) VALUES ('{pid}','image/webp',{len(b)},X'{ch[0].hex()}','{TS}','{WHO}');")
  off=len(ch[0])
  for c in ch[1:]:
    out.append(f"UPDATE dine_photos SET data=CAST(data||X'{c.hex()}' AS BLOB) WHERE id='{pid}' AND length(data)={off};")
    off+=len(c)
  for i in p['items']:
    iid=i.replace("'","''")
    out.append(f"UPDATE inventory SET image_url='/api/public/dine-photos/{pid}' WHERE id='{iid}' AND image_url='';")
open('/workspace/shelf-photos/upload_live.sql','w').write('\n'.join(out)+'\n')
json.dump(plan,open('/workspace/shelf-photos/upload_plan.json','w'),ensure_ascii=False,indent=1)
print('statements',len(out),'max stmt bytes',max(len(s.encode()) for s in out),'photos',len(plan),'items',sum(len(p['items']) for p in plan))
