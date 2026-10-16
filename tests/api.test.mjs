// 本機 API 測試：需先 `npm run worker:dev`（本機 D1），並已套用 tests/seed-legacy-inventory.sql 與 migrations。
import assert from "node:assert/strict";
const BASE=process.env.API??"http://127.0.0.1:8787",LEGACY=process.env.LEGACY_TOKEN??"local-test-token-123";
const key=()=>crypto.randomUUID().replace(/-/g,"");
async function api(path,{method="GET",token,body}={}){
 const h={};if(token)h.Authorization=`Bearer ${token}`;if(body)h["Content-Type"]="application/json";
 const r=await fetch(BASE+path,{method,headers:h,body:body?JSON.stringify(body):undefined});
 return {status:r.status,data:await r.json()};
}
const results=[];async function t(name,fn){try{await fn();results.push(["✅",name])}catch(e){results.push(["❌",name+"："+e.message]);}}
const qty=async(tok,id)=>(await api("/api/inventory",{token:tok})).data.items.find(i=>i.id===id).quantity;
const A="A-肉類-1",B="A-肉類-2",C="D-乾貨區-1";
let admin,staff,staffId;
await t("首位管理員建立前，舊管理密碼可讀庫存；建立首位管理員",async()=>{
 assert.equal((await api("/api/inventory",{token:LEGACY})).status,200);
 assert.equal((await api("/api/users",{method:"POST",token:LEGACY,body:{username:"x",password:"12345678"}})).status,403);
 const r=await api("/api/auth/bootstrap",{method:"POST",token:LEGACY,body:{username:"boss",password:"boss-pass-123"}});
 assert.equal(r.status,200,JSON.stringify(r.data));
 assert.equal((await api("/api/auth/bootstrap",{method:"POST",token:LEGACY,body:{username:"boss2",password:"boss-pass-123"}})).status,403);
 assert.equal((await api("/api/inventory",{token:LEGACY})).status,401,"建立管理員後舊密碼應失效");
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
 assert.equal((await api("/api/inventory",{method:"POST",token:staff,body:{...inv,quantity:99,expectedQuantity:inv.quantity}})).status,409,"過期數量應被拒（避免覆蓋）");
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
for(const [s,n] of results)console.log(s,n);
const failed=results.filter(r=>r[0]==="❌").length;console.log(`\n${results.length-failed}/${results.length} 通過`);process.exit(failed?1:0);
