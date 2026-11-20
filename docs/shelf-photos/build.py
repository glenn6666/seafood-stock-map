exec(open('map_def.py').read())
import json,csv,os,io
from PIL import Image,ImageOps
inv={r['id']:r for r in json.load(open('inventory.json'))[0]['results']}
idx=dict(l.split(' ',1) for l in open('index.txt').read().splitlines())
f=lambda n:OVERRIDE.get(n) or idx[f"{n:03d}"]
PENDING=[n for n,*_ in M if n in OVERRIDE and not os.path.exists('orig/'+OVERRIDE[n])]
if PENDING:print('⚠ 等待替換照片，先不上傳：',PENDING)
M=[m for m in M if m[0] not in PENDING]
os.makedirs('web',exist_ok=True)
out=[]
for n,ids,c,pp,note in sorted(M):
  im=ImageOps.exif_transpose(Image.open('orig/'+f(n))).convert('RGB')
  im.thumbnail((1000,1000),Image.LANCZOS)
  for q in (82,75,68,60,52):
    b=io.BytesIO();im.save(b,'WEBP',quality=q,method=6)
    if b.tell()<=300*1024:break
  p=f'web/p{n:03d}.webp';open(p,'wb').write(b.getvalue())
  out.append({'photo':n,'file':f(n),'webp':p,'bytes':b.tell(),'size':im.size,'items':ids})
json.dump(out,open('upload_plan.json','w'),ensure_ascii=False,indent=1)
w=csv.writer(open('mapping.csv','w',newline='',encoding='utf-8-sig'))
w.writerow(['photo_no','file','item_id','item_name','item_price','photo_price','confidence','role','note'])
for n,ids,c,pp,note in sorted(M):
  for i in ids:
    r=inv[i];w.writerow([n,f(n),i,r['name'],r['price'],pp,c,'main',note+('' if not pp or pp==r['price'] else f'（照片價 {pp}，系統價 {r["price"]}）')])
for n,v in sorted(AMBIG.items()):w.writerow([n,f(n),'','','','','ambiguous','not attached',v])
for n,v in sorted(UNMATCHED.items()):w.writerow([n,f(n),'','','','','unmatched','not attached',v])
for n,v in sorted(ALT.items()):w.writerow([n,f(n),'','','','','duplicate','not attached',f'與 {v:03d} 號同一樣商品（另一張／重複下載）' if v else '與其他未配對照片重複'])
print(len(out),sum(o['bytes'] for o in out)//1024,'KB', max(o['bytes'] for o in out)//1024, min(o['size'][0] for o in out))
