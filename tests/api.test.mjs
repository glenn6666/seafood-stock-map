// 本機 API 測試：需先 `npm run worker:dev`（本機 D1），並已套用 tests/seed-legacy-inventory.sql 與 migrations。
import assert from "node:assert/strict";
const BASE=process.env.API??"http://127.0.0.1:8787",LEGACY=process.env.LEGACY_TOKEN??"local-test-token-123";
const key=()=>crypto.randomUUID().replace(/-/g,"");
let ipSeq=0;const freshIp=()=>`203.0.113.${++ipSeq}`;
async function api(path,{method="GET",token,body,ip="198.51.100.1"}={}){
 const h={"CF-Connecting-IP":ip};if(token)h.Authorization=`Bearer ${token}`;if(body)h["Content-Type"]="application/json";
 const r=await fetch(BASE+path,{method,headers:h,body:body?JSON.stringify(body):undefined});
 return {status:r.status,data:await r.json()};
}
const results=[];async function t(name,fn){try{await fn();results.push(["✅",name])}catch(e){results.push(["❌",name+"："+e.message]);}}
const qty=async(tok,id)=>(await api("/api/inventory",{token:tok})).data.items.find(i=>i.id===id).quantity;
const A="A-肉類-1",B="A-肉類-2",C="D-乾貨區-1";
let admin,staff,staffId,staff2Token;const staff2=()=>staff2Token;
await t("首位管理員建立前，舊管理密碼可讀庫存；建立首位管理員",async()=>{
 assert.equal((await api("/api/inventory",{token:LEGACY})).status,200);
 assert.equal((await api("/api/users",{method:"POST",token:LEGACY,body:{username:"x",password:"12345678"}})).status,403);
 const r=await api("/api/auth/bootstrap",{method:"POST",token:LEGACY,body:{username:"boss",password:"boss-pass-123"}});
 assert.equal(r.status,200,JSON.stringify(r.data));
 assert.equal((await api("/api/auth/bootstrap",{method:"POST",token:LEGACY,body:{username:"boss2",password:"boss-pass-123"}})).status,409,"已有管理員時不能再用原密碼建立");
 assert.equal((await api("/api/inventory",{token:LEGACY})).status,200,"建立管理員後舊密碼仍可用（直到停用）");
 assert.equal((await api("/api/me",{token:LEGACY})).data.needsBootstrap,false);
 admin=(await api("/api/auth/login",{method:"POST",body:{username:"boss",password:"boss-pass-123"}})).data.token;assert.ok(admin);
 assert.equal((await api("/api/auth/login",{method:"POST",body:{username:"boss",password:"wrong-pass"}})).status,401);
});
await t("既有庫存、儲位、照片、冰箱資料保留",async()=>{
 const it=(await api("/api/inventory",{token:admin})).data.items;
 const a=it.find(i=>i.id===A),b=it.find(i=>i.id===B);
 assert.deepEqual([a.zone,a.quantity,a.photoId,a.fridgeId],["01",10,"photo-1","01-left"]);
 assert.deepEqual([b.zone,b.photoId,b.fridgeId,b.positionNote],["04","photo-2","04-right","03右側"]);
});
await t("新增店員帳號並登入",async()=>{
 const r=await api("/api/users",{method:"POST",token:admin,body:{username:"clerk",password:"clerk-pass-1",role:"staff"}});
 assert.equal(r.status,200,JSON.stringify(r.data));staffId=r.data.user.id;
 staff=(await api("/api/auth/login",{method:"POST",body:{username:"clerk",password:"clerk-pass-1"}})).data.token;assert.ok(staff);
});
await t("後端限制店員：看不到成本、不能管帳號、不能改價",async()=>{
 assert.equal((await api(`/api/products/${encodeURIComponent(A)}`,{method:"PATCH",token:admin,body:{cost:"180",onSale:true,dailyLimit:0,perOrderMax:5}})).status,200);
 const sp=(await api("/api/products",{token:staff})).data.items;assert.ok(sp.every(p=>!("cost" in p)),"店員回應不可含成本");
 assert.equal((await api("/api/products",{token:admin})).data.items.find(p=>p.id===A).cost,"180");
 assert.equal((await api("/api/users",{token:staff})).status,403);
 assert.equal((await api("/api/users",{method:"POST",token:staff,body:{username:"evil",password:"12345678"}})).status,403);
 assert.equal((await api(`/api/products/${encodeURIComponent(A)}`,{method:"PATCH",token:staff,body:{price:"1"}})).status,403);
 const inv=(await api("/api/inventory",{token:staff})).data.items.find(i=>i.id===A);
 assert.equal((await api("/api/inventory",{method:"POST",token:staff,body:{...inv,price:"1"}})).status,403,"店員改價應被拒");
 const ok=await api("/api/inventory",{method:"POST",token:staff,body:{...inv,quantity:inv.quantity+2,expectedQuantity:inv.quantity}});
 assert.equal(ok.status,200,"店員可調整數量");
 const cf=await api("/api/inventory",{method:"POST",token:staff,body:{...inv,quantity:99,expectedQuantity:inv.quantity}});
 assert.equal(cf.status,409,"過期數量應被拒（避免覆蓋）");
 assert.equal(cf.data.conflict,true);assert.equal(cf.data.latest.quantity,inv.quantity+2,"409 需回傳最新數量");
 assert.equal(await qty(admin,A),inv.quantity+2,"衝突時不得覆蓋");
 await api("/api/inventory",{method:"POST",token:admin,body:{...inv,quantity:10,expectedQuantity:inv.quantity+2}});
 assert.equal(await qty(admin,A),10);
});
await t("建立訂單扣庫存；重複送出不重複扣",async()=>{
 const k=key(),body={idempotencyKey:k,customerName:"王小明",phone:"0912345678",items:[{id:A,qty:3}]};
 const r1=await api("/api/orders",{method:"POST",token:staff,body});assert.equal(r1.status,200,JSON.stringify(r1.data));
 assert.equal(await qty(admin,A),7);
 const r2=await api("/api/orders",{method:"POST",token:staff,body});assert.equal(r2.data.duplicate,true);assert.equal(r2.data.order.id,r1.data.order.id);
 assert.equal(await qty(admin,A),7,"重複送出不得再扣");
 globalThis.o1=r1.data.order;
});
await t("取消補回庫存，重複取消只補一次",async()=>{
 const c1=await api(`/api/orders/${o1.id}/cancel`,{method:"POST",token:staff});assert.equal(c1.status,200);
 assert.equal(await qty(admin,A),10);
 const c2=await api(`/api/orders/${o1.id}/cancel`,{method:"POST",token:staff});assert.equal(c2.data.alreadyCancelled,true);
 await Promise.all([1,2,3].map(()=>api(`/api/orders/${o1.id}/cancel`,{method:"POST",token:admin})));
 assert.equal(await qty(admin,A),10,"多次取消不得多補");
});
await t("庫存不足拒絕",async()=>{
 const r=await api("/api/orders",{method:"POST",token:admin,body:{idempotencyKey:key(),customerName:"A",items:[{id:C,qty:4}]}});
 assert.equal(r.status,409);assert.equal(await qty(admin,C),3);
});
await t("超過每日限量拒絕",async()=>{
 await api(`/api/products/${encodeURIComponent(B)}`,{method:"PATCH",token:admin,body:{dailyLimit:2,onSale:true}});
 assert.equal((await api("/api/orders",{method:"POST",token:admin,body:{idempotencyKey:key(),customerName:"A",items:[{id:B,qty:2}]}})).status,200);
 const r=await api("/api/orders",{method:"POST",token:admin,body:{idempotencyKey:key(),customerName:"A",items:[{id:B,qty:1}]}});
 assert.equal(r.status,409);assert.match(r.data.error,/今日限量/);
 assert.equal(await qty(admin,B),3,"失敗訂單不得扣庫存");
});
await t("同時多台裝置下單不會超賣",async()=>{
 // C 庫存 3，同時送 10 筆各 1 件
 const rs=await Promise.all(Array.from({length:10},()=>api("/api/orders",{method:"POST",token:admin,body:{idempotencyKey:key(),customerName:"併發",items:[{id:C,qty:1}]}})));
 assert.equal(rs.filter(r=>r.status===200).length,3,"只能成立 3 筆");
 assert.equal(await qty(admin,C),0);
});
await t("訂單狀態流程",async()=>{
 const o=(await api("/api/orders",{token:staff})).data.orders.find(x=>x.status==="待處理");
 for(const s of ["備貨中","可取貨","已完成"])assert.equal((await api(`/api/orders/${o.id}/status`,{method:"POST",token:staff,body:{status:s}})).status,200);
 assert.equal((await api(`/api/orders/${o.id}/cancel`,{method:"POST",token:staff})).status,409,"已完成不可取消");
});
let lookup;
await t("顧客頁：只顯示上架商品與可訂數量，不含成本／儲位",async()=>{
 const m=(await api("/api/public/menu")).data.items;
 assert.ok(m.length>=1&&m.every(i=>["A-肉類-1","A-肉類-2"].includes(i.id)),"只顯示上架商品");
 const s=JSON.stringify(m);for(const f of ["cost","zone","photoId","fridgeId","positionNote","quantity","batch","180"])assert.ok(!s.includes(`"${f}"`)&&!s.includes(':"180"'),`不可含 ${f}`);
 const a=m.find(i=>i.id===A);assert.equal(a.available,5,"可訂數量受每筆上限限制");
 assert.equal((await api("/api/public/menu")).data.items.find(i=>i.id===C),undefined);
});
await t("顧客下單（免密碼）、未上架/超過上限拒絕、重複送出不重扣",async()=>{
 assert.equal((await api("/api/public/orders",{method:"POST",body:{idempotencyKey:key(),customerName:"林",phone:"0911222333",items:[{id:C,qty:1}]}})).status,400);
 assert.equal((await api("/api/public/orders",{method:"POST",body:{idempotencyKey:key(),customerName:"林",phone:"0911222333",items:[{id:A,qty:6}]}})).status,409);
 const k=key(),body={idempotencyKey:k,customerName:"林小姐",phone:"0911222333",items:[{id:A,qty:2}]};
 const r=await api("/api/public/orders",{method:"POST",body});assert.equal(r.status,200,JSON.stringify(r.data));
 const r2=await api("/api/public/orders",{method:"POST",body});assert.equal(r2.data.lookupToken,r.data.lookupToken);
 assert.equal(await qty(admin,A),8);lookup=r.data.lookupToken;assert.ok(lookup.length>=32);
});
await t("訂單查詢連結：可看狀態，不含電話/成本/儲位；錯誤代碼查不到",async()=>{
 let r=await api(`/api/public/orders/${lookup}`);assert.equal(r.status,200);assert.equal(r.data.order.status,"待處理");
 const s=JSON.stringify(r.data);for(const f of ["phone","0911222333","zone","cost","lookupToken","id\""])assert.ok(!s.includes(f),`不可含 ${f}`);
 const o=(await api("/api/orders",{token:staff})).data.orders.find(x=>x.lookupToken===lookup);
 await api(`/api/orders/${o.id}/status`,{method:"POST",token:staff,body:{status:"可取貨"}});
 r=await api(`/api/public/orders/${lookup}`);assert.equal(r.data.order.status,"可取貨");
 assert.equal((await api(`/api/public/orders/${"x".repeat(32)}`)).status,404);
 assert.equal((await api("/api/orders")).status,401,"未登入不能看訂單列表");
});
await t("停用帳號、重設密碼後登入立即失效",async()=>{
 assert.equal((await api("/api/inventory",{token:staff})).status,200);
 assert.equal((await api(`/api/users/${staffId}`,{method:"PATCH",token:admin,body:{password:"new-clerk-pass"}})).status,200);
 assert.equal((await api("/api/inventory",{token:staff})).status,401,"重設密碼後舊登入失效");
 assert.equal((await api("/api/auth/login",{method:"POST",body:{username:"clerk",password:"clerk-pass-1"}})).status,401);
 staff=(await api("/api/auth/login",{method:"POST",body:{username:"clerk",password:"new-clerk-pass"}})).data.token;
 assert.equal((await api("/api/inventory",{token:staff})).status,200);
 await api(`/api/users/${staffId}`,{method:"PATCH",token:admin,body:{active:false}});
 assert.equal((await api("/api/inventory",{token:staff})).status,401,"停用後失效");
 assert.equal((await api("/api/auth/login",{method:"POST",body:{username:"clerk",password:"new-clerk-pass"}})).status,401);
});
await t("不能停用最後一位管理員",async()=>{
 const u=(await api("/api/users",{token:admin})).data.users.find(x=>x.username==="boss");
 assert.equal((await api(`/api/users/${u.id}`,{method:"PATCH",token:admin,body:{active:false}})).status,409);
});
await t("店員新增商品不能設定售價（後端改用目錄售價／空白）",async()=>{
 assert.equal((await api("/api/users",{method:"POST",token:admin,body:{username:"clerk2",password:"clerk2-pass-1",role:"staff"}})).status,200);
 const st=staff2Token=(await api("/api/auth/login",{method:"POST",body:{username:"clerk2",password:"clerk2-pass-1"}})).data.token;assert.ok(st);
 const base={zone:"01",spec:"350g",quantity:4,unit:"件",minimum:0,batch:"",category:"肉類",tracked:true,photoId:"",fridgeId:"",positionNote:""};
 let r=await api("/api/inventory",{method:"POST",token:st,body:{...base,id:"A-肉類-3",name:"美國安格斯霜降比臉大牛排",price:"1"}});
 assert.equal(r.status,200);assert.equal(r.data.item.price,"269");
 assert.equal((await api("/api/inventory",{token:admin})).data.items.find(i=>i.id==="A-肉類-3").price,"269","店員送的售價不得寫入");
 r=await api("/api/inventory",{method:"POST",token:st,body:{...base,id:"custom-new-1",name:"新品",price:"999"}});
 assert.equal(r.status,200);assert.equal((await api("/api/inventory",{token:admin})).data.items.find(i=>i.id==="custom-new-1").price,"");
 r=await api("/api/inventory",{method:"POST",token:admin,body:{...base,id:"custom-new-2",name:"新品2",price:"150"}});
 assert.equal((await api("/api/inventory",{token:admin})).data.items.find(i=>i.id==="custom-new-2").price,"150","管理員可設售價");
});
await t("批次上架／下架：僅管理員；預設不上架",async()=>{
 const ids=["A-肉類-3","custom-new-1","custom-new-2"];
 let m=(await api("/api/public/menu")).data.items;assert.ok(ids.every(id=>!m.some(i=>i.id===id)),"新商品預設不上架");
 assert.equal((await api("/api/products/bulk-on-sale",{method:"POST",token:staff2(),body:{ids,onSale:true}})).status,403);
 let r=await api("/api/products/bulk-on-sale",{method:"POST",token:admin,body:{ids,onSale:true}});assert.equal(r.data.changed,3);
 m=(await api("/api/public/menu")).data.items;assert.ok(ids.every(id=>m.some(i=>i.id===id)));
 r=await api("/api/products/bulk-on-sale",{method:"POST",token:admin,body:{ids,onSale:false}});assert.equal(r.data.changed,3);
 m=(await api("/api/public/menu")).data.items;assert.ok(ids.every(id=>!m.some(i=>i.id===id)));
});
await t("顧客端展示櫃：自動分配、管理員可設定、店員不能改、公開 API 不含儲位／成本",async()=>{
 let m=(await api("/api/public/menu")).data;
 assert.ok(Array.isArray(m.units)&&m.units.some(u=>u.type==="tank")&&m.units.some(u=>u.type==="freezer"),"預設展示櫃");
 const a=m.items.find(i=>i.id===A);assert.deepEqual(Object.keys(a.displayUnit).sort(),["area","id","kind","name","type"]);
 assert.equal(a.displayUnit.id,"f1","肉類自動分到 01 牛肉冷藏櫃");
 assert.deepEqual(m.units.map(u=>u.id),["f1","f2","f3","c1","c2","c3","t1","t4","t7","s7"],"新配置 10 個展示櫃，舊櫃停用");
 const s=JSON.stringify(m);for(const f of ["zone","cost","photoId","fridgeId","positionNote","quantity","displayZone","01-left","photo-1"])assert.ok(!s.includes(`"${f}"`)&&!s.includes(f==="01-left"||f==="photo-1"?f:"\u0000"),`公開 API 不可含 ${f}`);
 assert.equal((await api(`/api/products/${encodeURIComponent(A)}`,{method:"PATCH",token:staff2(),body:{displayZone:"t1"}})).status,403,"店員不能改展示櫃");
 assert.equal((await api("/api/display-units/t1",{method:"PATCH",token:staff2(),body:{name:"x"}})).status,403,"店員不能改展示櫃名稱");
 assert.equal((await api(`/api/products/${encodeURIComponent(A)}`,{method:"PATCH",token:admin,body:{displayZone:"no-such"}})).status,400);
 assert.equal((await api(`/api/products/${encodeURIComponent(A)}`,{method:"PATCH",token:admin,body:{displayZone:"t1"}})).status,200);
 m=(await api("/api/public/menu")).data;assert.equal(m.items.find(i=>i.id===A).displayUnit.type,"tank");
 assert.equal((await api("/api/display-units/t1",{method:"PATCH",token:admin,body:{name:"活體魚缸"}})).status,200);
 m=(await api("/api/public/menu")).data;assert.equal(m.items.find(i=>i.id===A).displayUnit.name,"活體魚缸");
 const sp=(await api("/api/products",{token:staff2()})).data;assert.equal(sp.items.find(i=>i.id===A).displayZone,"t1");assert.ok(sp.items.every(i=>!("cost" in i)));
 await api(`/api/products/${encodeURIComponent(A)}`,{method:"PATCH",token:admin,body:{displayZone:""}});
 m=(await api("/api/public/menu")).data;assert.equal(m.items.find(i=>i.id===A).displayUnit.id,"f1","清空後回到自動分配");
});
await t("展示櫃自動分配：活泰國蝦→t4、常溫活魚→t7、乾貨→s7、冰鮮貝類→c2、火鍋料→f3",async()=>{
 const base={zone:"unassigned",spec:"",quantity:5,unit:"份",minimum:0,batch:"",price:"100",tracked:true,photoId:"",fridgeId:"",positionNote:""};
 const cases=[["auto-1","活泰國蝦","活海鮮","t4"],["auto-2","活吳郭魚","活魚 常溫","t7"],["auto-3","蝦米","乾貨","s7"],["auto-4","海瓜子","冰鮮","c2"],["auto-5","蛋餃","火鍋料","f3"],["auto-6","鮭魚","冷凍海鮮","f2"],["auto-7","活龍蝦","活海鮮","t1"]];
 for(const [id,name,category] of cases)assert.equal((await api("/api/inventory",{method:"POST",token:admin,body:{...base,id,name,category}})).status,200);
 const p=(await api("/api/products",{token:admin})).data.items;
 for(const [id,,,u] of cases)assert.equal(p.find(i=>i.id===id).displayUnitId,u,id);
});
const COUPON_ID="coupon-test-1";
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
let coupon;
await t("釣蝦遊戲：目標／工具驗證、太快／未達標不發券；正常完成發券，同一局不能領第二次",async()=>{
 await api("/api/inventory",{method:"POST",token:admin,body:{id:COUPON_ID,zone:"unassigned",name:"帝王蟹腳",spec:"1kg",quantity:20,unit:"盒",minimum:0,batch:"",category:"冷凍海鮮",price:"600",tracked:true,photoId:"",fridgeId:"",positionNote:""}});
 await api(`/api/products/${COUPON_ID}`,{method:"PATCH",token:admin,body:{onSale:true}});
 const ip=freshIp();
 let g=(await api("/api/public/game/start",{method:"POST",ip})).data;assert.ok(g.gameId&&g.seconds===40&&g.target===4&&g.kind==="shrimp"&&g.tool==="rod","預設：蝦＋釣竿");
 assert.equal((await api("/api/public/game/start",{method:"POST",ip,body:{target:"whale",tool:"rod"}})).status,400,"未知目標");
 assert.equal((await api("/api/public/game/start",{method:"POST",ip,body:{target:"crab",tool:"bomb"}})).status,400,"未知工具");
 const gl=(await api("/api/public/game/start",{method:"POST",ip,body:{target:"lobster",tool:"cage"}})).data;assert.ok(gl.seconds===45&&gl.target===2,"龍蝦 45 秒 2 隻");
 assert.equal((await api("/api/public/game/finish",{method:"POST",ip,body:{gameId:g.gameId,caught:4}})).status,400,"8 秒內完成視為作弊");
 assert.equal((await api("/api/public/game/finish",{method:"POST",ip:freshIp(),body:{gameId:g.gameId,caught:4}})).status,404,"其他 IP 不能代領");
 const g2=(await api("/api/public/game/start",{method:"POST",ip,body:{target:"crab",tool:"tongs"}})).data;assert.ok(g2.seconds===40&&g2.target===3,"螃蟹 40 秒 3 隻");
 await sleep(8500);
 assert.deepEqual((await api("/api/public/game/finish",{method:"POST",ip,body:{gameId:g.gameId,caught:3}})).data,{won:false},"蝦未達 4 隻不發券");
 assert.deepEqual((await api("/api/public/game/finish",{method:"POST",ip,body:{gameId:gl.gameId,caught:1}})).data,{won:false},"龍蝦未達 2 隻不發券");
 const rs=await Promise.all([1,2,3].map(()=>api("/api/public/game/finish",{method:"POST",ip,body:{gameId:g2.gameId,caught:3}})));
 const wins=rs.filter(r=>r.status===200&&r.data.won);assert.equal(wins.length,1,"同一局同時送出只發一張");
 coupon=wins[0].data.coupon;assert.match(coupon.code,/^SHRIMP-/);assert.equal(coupon.discount,5);assert.equal(coupon.minTotal,1000);
 assert.ok(new Date(coupon.expiresAt)>Date.now()+23*3600e3);
 assert.equal((await api("/api/public/game/finish",{method:"POST",ip,body:{gameId:g2.gameId,caught:4}})).status,409);
});
await t("優惠券：驗證、未滿 1000 拒絕（不消耗）、滿 1000 折 5、重複使用拒絕、後台看得到折抵",async()=>{
 let r=await api("/api/public/coupons/check",{method:"POST",body:{code:coupon.code}});assert.equal(r.status,200);assert.equal(r.data.discount,5);
 assert.equal((await api("/api/public/coupons/check",{method:"POST",body:{code:"SHRIMP-"+"x".repeat(24)}})).status,404);
 const ip=freshIp(),before=await qty(admin,COUPON_ID);
 r=await api("/api/public/orders",{method:"POST",ip,body:{idempotencyKey:key(),customerName:"券",phone:"0911000111",couponCode:coupon.code,items:[{id:COUPON_ID,qty:1}]}});
 assert.equal(r.status,400);assert.match(r.data.error,/未滿/);assert.equal(await qty(admin,COUPON_ID),before,"門檻失敗不扣庫存");
 assert.equal((await api("/api/public/coupons/check",{method:"POST",body:{code:coupon.code}})).status,200,"門檻失敗不消耗券");
 r=await api("/api/public/orders",{method:"POST",ip,body:{idempotencyKey:key(),customerName:"券",phone:"0911000111",couponCode:coupon.code,items:[{id:COUPON_ID,qty:2}]}});
 assert.equal(r.status,200,JSON.stringify(r.data));assert.equal(r.data.total,1195);assert.equal(r.data.discount,5);
 const lk=(await api(`/api/public/orders/${r.data.lookupToken}`)).data.order;assert.deepEqual([lk.subtotal,lk.discount,lk.total],[1200,5,1195]);
 const ao=(await api("/api/orders",{token:admin})).data.orders.find(o=>o.lookupToken===r.data.lookupToken);assert.deepEqual([ao.subtotal,ao.discount,ao.total],[1200,5,1195]);
 const again=await Promise.all([1,2].map(()=>api("/api/public/orders",{method:"POST",ip:freshIp(),body:{idempotencyKey:key(),customerName:"券",phone:"0911000111",couponCode:coupon.code,items:[{id:COUPON_ID,qty:2}]}})));
 assert.ok(again.every(x=>x.status===409&&/已使用/.test(x.data.error)),"同一張券不能再用");
 assert.equal(await qty(admin,COUPON_ID),before-2,"重複使用失敗不扣庫存");
 assert.equal((await api("/api/orders",{method:"POST",token:admin,body:{idempotencyKey:key(),customerName:"x",couponCode:coupon.code,items:[{id:COUPON_ID,qty:2}]}})).status,400,"後台訂單不收顧客券");
});
await t("優惠券：過期拒絕",async()=>{
 const {execFileSync}=await import("node:child_process");const {createHash}=await import("node:crypto");
 const code="SHRIMP-expiredexpiredexpired01",h=createHash("sha256").update(code).digest("base64url");
 execFileSync("npx",["wrangler","d1","execute","DB","--local","--persist-to",".wrangler/state","--command",`INSERT OR REPLACE INTO coupons (code_hash,kind,discount,min_total,ip_hash,created_at,expires_at) VALUES ('${h}','shrimp5',5,1000,'t','2026-01-01T00:00:00.000Z','2026-01-02T00:00:00.000Z')`],{stdio:"ignore"});
 assert.equal((await api("/api/public/coupons/check",{method:"POST",body:{code}})).status,409);
 const r=await api("/api/public/orders",{method:"POST",ip:freshIp(),body:{idempotencyKey:key(),customerName:"券",phone:"0911000111",couponCode:code,items:[{id:COUPON_ID,qty:2}]}});
 assert.equal(r.status,409);assert.match(r.data.error,/過期/);
});
await t("顧客端頻率限制：下單每 IP 10 分鐘 5 次、查詢 60 次，超過回 429 中文訊息",async()=>{
 const ip=freshIp();
 for(let k=0;k<5;k++)assert.equal((await api("/api/public/orders",{method:"POST",ip,body:{idempotencyKey:key(),customerName:"",items:[]}})).status,400);
 const r=await api("/api/public/orders",{method:"POST",ip,body:{idempotencyKey:key(),customerName:"x",phone:"0911000000",items:[{id:A,qty:1}]}});
 assert.equal(r.status,429);assert.match(r.data.error,/太頻繁/);
 assert.equal((await api("/api/public/orders",{method:"POST",ip:freshIp(),body:{idempotencyKey:key(),customerName:"",items:[]}})).status,400,"其他 IP 不受影響");
 const ip2=freshIp();
 for(let k=0;k<60;k++)assert.equal((await api(`/api/public/orders/${lookup}`,{ip:ip2})).status,200);
 const l=await api(`/api/public/orders/${lookup}`,{ip:ip2});assert.equal(l.status,429);assert.match(l.data.error,/太頻繁/);
});
await t("原管理密碼：管理員停用後完全不能使用，且無法自行重新啟用",async()=>{
 assert.equal((await api("/api/users",{token:LEGACY})).status,200,"停用前具管理員權限");
 assert.equal((await api("/api/settings/legacy-token",{method:"POST",token:staff2(),body:{enabled:false}})).status,403,"店員不能停用");
 assert.equal((await api("/api/settings/legacy-token",{method:"POST",token:admin,body:{enabled:false}})).data.enabled,false);
 for(const [path,opt] of [["/api/inventory",{}],["/api/me",{}],["/api/orders",{}],["/api/users",{}],["/api/products",{}],
  ["/api/orders",{method:"POST",body:{idempotencyKey:key(),customerName:"x",items:[{id:A,qty:1}]}}],
  ["/api/inventory",{method:"POST",body:{id:A,zone:"01",name:"x",spec:"",quantity:0,unit:"",minimum:0,batch:"",category:"",price:"0",tracked:true}}],
  ["/api/settings/legacy-token",{method:"POST",body:{enabled:true}}],["/api/auth/bootstrap",{method:"POST",body:{username:"hack",password:"12345678"}}],
  ["/api/products/bulk-on-sale",{method:"POST",body:{ids:[A],onSale:false}}]])
  assert.ok([401,403].includes((await api(path,{...opt,token:LEGACY})).status),`停用後 ${path} 應被拒`);
 assert.equal(await qty(admin,A),8,"停用後的嘗試不得改動庫存");
 assert.equal((await api("/api/settings/legacy-token",{token:admin})).data.enabled,false);
 assert.equal((await api("/api/settings/legacy-token",{method:"POST",token:admin,body:{enabled:true}})).data.enabled,true,"管理員帳號可重新啟用");
 assert.equal((await api("/api/inventory",{token:LEGACY})).status,200);
 await api("/api/settings/legacy-token",{method:"POST",token:admin,body:{enabled:false}});
 assert.equal((await api("/api/inventory",{token:LEGACY})).status,401);
});
for(const [s,n] of results)console.log(s,n);
const failed=results.filter(r=>r[0]==="❌").length;console.log(`\n${results.length-failed}/${results.length} 通過`);process.exit(failed?1:0);
