// 付款拆分／對帳月結單／單據照片／收銀代支 API 測試：需在 api.test.mjs、ledger.test.mjs 之後執行。用 2001 年資料。
import assert from "node:assert/strict";
const BASE=process.env.API??"http://127.0.0.1:8787";
async function api(path,{method="GET",token,body,raw,type}={}){const h={};if(token)h.Authorization=`Bearer ${token}`;if(body)h["Content-Type"]="application/json";if(raw)h["Content-Type"]=type;
 const r=await fetch(BASE+path,{method,headers:h,body:raw??(body?JSON.stringify(body):undefined)});const ct=r.headers.get("Content-Type")??"";return {status:r.status,data:ct.includes("json")?await r.json():new Uint8Array(await r.arrayBuffer()),ct}}
const results=[];async function t(n,fn){try{await fn();results.push(["✅",n])}catch(e){results.push(["❌",n+"："+e.message])}}
const login=async(u,p)=>(await api("/api/auth/login",{method:"POST",body:{username:u,password:p}})).data.token;
const admin=await login("boss","boss-pass-123");const su="rclerk"+Date.now()%100000;await api("/api/users",{method:"POST",token:admin,body:{username:su,password:"clerk-pass-9",role:"staff"}});const staff=await login(su,"clerk-pass-9");
let pid,cid;
await t("店員、未登入不能用付款、對帳單、照片、代支",async()=>{for(const p of ["/api/ledger/payments?ym=2001-05","/api/ledger/statement?account=龍龍&ym=2001-05","/api/ledger/cashout?ym=2001-05","/api/ledger/accounts"]){assert.equal((await api(p,{token:staff})).status,403,p);assert.equal((await api(p)).status,401,p)}});
await t("龍龍顯示為蟹老大中港店（保留原代號）",async()=>{const r=(await api("/api/ledger/accounts",{token:admin})).data.rows.find(x=>x.account==="龍龍");assert.equal(r.label,"蟹老大中港店")});
await t("代支匯入：重複上傳不重複",async()=>{const rows=[{date:"2001-05-03",time:"10:20",type:"代支(-)",item:"泰國蝦",staff:"小王",amount:-4600},{date:"2001-05-03",time:"15:00",type:"代支(-)",item:"運費",staff:"小王",amount:200}];
 let r=await api("/api/ledger/import",{method:"POST",token:admin,body:{kind:"cashout",rows}});assert.deepEqual([r.data.inserted,r.data.skipped],[2,0]);
 r=await api("/api/ledger/import",{method:"POST",token:admin,body:{kind:"cashout",rows}});assert.deepEqual([r.data.inserted,r.data.skipped],[0,2]);
 const c=(await api("/api/ledger/cashout?ym=2001-05",{token:admin})).data;assert.equal(c.rows.length,2);assert.equal(c.matched,0);assert.equal(c.total,4800);cid=c.rows.find(x=>x.item==="泰國蝦").id});
await t("拆分合計不等於總額時拒絕",async()=>{const r=await api("/api/ledger/payments",{method:"POST",token:admin,body:{date:"2001-05-03",vendor:"泰國蝦場",total:4600,lines:[{type:"store",category:"進貨支出",amount:3000},{type:"partner",account:"龍龍",amount:1000}]}});assert.equal(r.status,400)});
await t("一筆付款拆成店內＋團購；代支變成已對應",async()=>{const r=await api("/api/ledger/payments",{method:"POST",token:admin,body:{date:"2001-05-03",vendor:"泰國蝦場",total:4600,cashoutId:cid,lines:[{type:"store",category:"進貨支出",item:"泰國蝦",amount:3000},{type:"partner",account:"龍龍",item:"泰國蝦 1 箱",amount:1600}]}});
 assert.equal(r.status,200,JSON.stringify(r.data));pid=r.data.id;
 const l=(await api("/api/ledger/payments?ym=2001-05",{token:admin})).data.rows[0];assert.equal(l.lines.length,2);assert.equal(l.payMethod,"收銀機代支");assert.equal(l.cashout.id,cid);
 const e=(await api("/api/ledger/entries?from=2001-05-01&to=2001-05-31",{token:admin})).data;assert.equal(e.total.expense,-3000,"只有店內部分算支出");
 const c=(await api("/api/ledger/cashout?ym=2001-05",{token:admin})).data;assert.equal(c.matched,1);
 assert.equal((await api("/api/ledger/payments",{method:"POST",token:admin,body:{date:"2001-05-03",total:10,cashoutId:cid,lines:[{type:"store",category:"進貨支出",amount:10}]}})).status,409,"同一筆代支不能對應兩次")});
await t("月結對帳單：期初含舊資料，本月對方欠我們 +1600",async()=>{const before=(await api("/api/ledger/prepaid?account=龍龍",{token:admin})).data.balance;
 const s=(await api("/api/ledger/statement?account=龍龍&ym=2001-05",{token:admin})).data;assert.equal(s.label,"蟹老大中港店");assert.equal(s.theyOwe,1600);assert.equal(s.rows[0].direction,"they_owe");assert.equal(s.closing,Math.round((s.opening+1600)*100)/100);assert.equal(Math.round((before)*100)/100,s.closing,"期末＝目前餘額（沒有更晚的資料）")});
await t("單據照片：只收圖片，管理員可讀，店員不行",async()=>{const png=Uint8Array.from(atob("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="),c=>c.charCodeAt(0));
 assert.equal((await api(`/api/ledger/payments/${pid}/receipts`,{method:"POST",token:admin,raw:"<svg/>",type:"image/svg+xml"})).status,415);
 const r=await api(`/api/ledger/payments/${pid}/receipts`,{method:"POST",token:admin,raw:png,type:"image/png"});assert.equal(r.status,200,JSON.stringify(r.data));
 const g=await api("/api/ledger/receipts/"+r.data.id,{token:admin});assert.equal(g.status,200);assert.equal(g.ct,"image/png");assert.equal(g.data.length,png.length);
 assert.equal((await api("/api/ledger/receipts/"+r.data.id,{token:staff})).status,403);assert.equal((await api("/api/ledger/receipts/"+r.data.id)).status,401)});
await t("刪除付款：拆分的收支、對帳一起刪，代支回到未對應",async()=>{assert.equal((await api(`/api/ledger/payments/${pid}/delete`,{method:"POST",token:admin,body:{}})).status,200);
 assert.equal((await api("/api/ledger/entries?from=2001-05-01&to=2001-05-31",{token:admin})).data.total.count,0);
 assert.equal((await api("/api/ledger/statement?account=龍龍&ym=2001-05",{token:admin})).data.theyOwe,0);assert.equal((await api("/api/ledger/cashout?ym=2001-05",{token:admin})).data.matched,0)});
for(const [s,n] of results)console.log(s,n);if(results.some(r=>r[0]==="❌"))process.exit(1);
