// 後台記帳 API 測試：需在 api.test.mjs 之後執行（沿用 boss／clerk 帳號）。測試資料用 2001 年，不影響真實年份。
import assert from "node:assert/strict";
const BASE=process.env.API??"http://127.0.0.1:8787";
async function api(path,{method="GET",token,body}={}){const h={};if(token)h.Authorization=`Bearer ${token}`;if(body)h["Content-Type"]="application/json";
 const r=await fetch(BASE+path,{method,headers:h,body:body?JSON.stringify(body):undefined});return {status:r.status,data:await r.json()}}
const results=[];async function t(n,fn){try{await fn();results.push(["✅",n])}catch(e){results.push(["❌",n+"："+e.message])}}
const login=async(u,p)=>(await api("/api/auth/login",{method:"POST",body:{username:u,password:p}})).data.token;
const admin=await login("boss","boss-pass-123");const su="lclerk"+Date.now()%100000;await api("/api/users",{method:"POST",token:admin,body:{username:su,password:"clerk-pass-9",role:"staff"}});const staff=await login(su,"clerk-pass-9");
const row=(o={})=>({date:"2001-03-05",kind:"支出",category:"店面支出",item:"房租",note:"三月房租",qty:1,unitPrice:42040,party:"房東",...o});
await t("記帳：店員、未登入一律拒絕（含報表、匯入）",async()=>{
 for(const p of ["/api/ledger/meta","/api/ledger/entries?from=2001-01-01&to=2001-12-31","/api/ledger/report/monthly?year=2001","/api/ledger/payroll","/api/ledger/pos?ym=2001-03","/api/ledger/prepaid?account=龍龍"]){
  assert.equal((await api(p,{token:staff})).status,403,p);assert.equal((await api(p)).status,401,p)}
 assert.equal((await api("/api/ledger/import",{method:"POST",token:staff,body:{kind:"entries",rows:[row()]}})).status,403);
});
await t("記帳：預設會計項目含「網站收入」",async()=>{const m=(await api("/api/ledger/meta",{token:admin})).data;assert.ok(m.categories.some(c=>c.category==="網站收入"&&c.kind==="收入"))});
await t("匯入收支：重複匯入不重複；同鍵多筆以出現次數區分；改備註不算新資料",async()=>{
 await api("/api/ledger/import",{method:"POST",token:admin,body:{kind:"categories",rows:[{category:"店面支出",item:"房租",kind:"支出",sort:1},{category:"店面收入",item:"",kind:"收入",sort:2}]}});
 const rows=[{...row(),occ:1},{...row({note:"另一筆相同"}),occ:2},{...row({date:"2001-03-06",kind:"收入",category:"店面收入",item:"",unitPrice:15000,party:""}),occ:1}];
 let r=await api("/api/ledger/import",{method:"POST",token:admin,body:{kind:"entries",rows}});assert.equal(r.status,200,JSON.stringify(r.data));assert.deepEqual([r.data.inserted,r.data.skipped],[3,0]);
 r=await api("/api/ledger/import",{method:"POST",token:admin,body:{kind:"entries",rows:rows.map(x=>({...x,note:x.note+"(改)"}))}});assert.deepEqual([r.data.inserted,r.data.skipped],[0,3]);
 r=await api("/api/ledger/import",{method:"POST",token:admin,body:{kind:"entries",rows:[...rows,{...row(),occ:3}]}});assert.deepEqual([r.data.inserted,r.data.skipped],[1,3],"試算表多一筆時只新增那筆");
});
let id;
await t("新增／修改／刪除收支；金額與收支方向由後端計算",async()=>{
 let r=await api("/api/ledger/entries",{method:"POST",token:admin,body:{date:"2001-03-10",kind:"支出",category:"店面支出",item:"水費",qty:2,unitPrice:"1,000",tax:50,note:"測試"}});
 assert.equal(r.status,200,JSON.stringify(r.data));id=r.data.entry.id;assert.equal(r.data.entry.amount,2050);assert.equal(r.data.entry.signed,-2050);assert.equal(r.data.entry.recorder,"boss");
 assert.equal((await api("/api/ledger/entries",{method:"POST",token:admin,body:{date:"2001-13-01",kind:"支出",category:"x",unitPrice:1}})).status,400);
 r=await api("/api/ledger/entries/"+id,{method:"PATCH",token:admin,body:{unitPrice:1500}});assert.equal(r.data.entry.signed,-3050);
 const l=(await api("/api/ledger/entries?from=2001-03-01&to=2001-03-31&sheet=1",{token:admin})).data;
 assert.equal(l.total.count,5);assert.equal(l.columns.length,28);const sr=l.sheetRows.find(x=>x[1]==="店面支出 水費");assert.equal(sr[2],"20010310");assert.equal(sr[7],"2");assert.equal(sr[13],"","公式欄留空");
 assert.equal((await api(`/api/ledger/entries/${id}/delete`,{method:"POST",token:admin,body:{}})).status,200);
 assert.equal((await api("/api/ledger/entries?from=2001-03-01&to=2001-03-31",{token:admin})).data.total.count,4);
});
await t("月報／日報／損益表／年度：與收支加總一致",async()=>{
 const m=(await api("/api/ledger/report/monthly?year=2001",{token:admin})).data;
 assert.equal(m.rows.find(r=>r.category==="店面支出").months[2],-42040*3);assert.equal(m.rows.find(r=>r.category==="店面收入").months[2],15000);assert.equal(m.profit[2],15000-42040*3);
 const d=(await api("/api/ledger/report/daily?ym=2001-03",{token:admin})).data;assert.equal(d.days,31);assert.equal(d.net[4],-42040*3);assert.equal(d.total,m.profit[2]);
 const p=(await api("/api/ledger/report/pnl?ym=2001-03",{token:admin})).data.current;assert.equal(p.income["店面收入"],15000);assert.equal(p.expense["房租"],42040*3);assert.equal(p.profit,m.profit[2]);
 const y=(await api("/api/ledger/report/yearly",{token:admin})).data.months.find(x=>x.ym==="2001-03");assert.equal(y.revenue,15000);
});
await t("網站訂單自動入帳：每天一筆收入（扣優惠券）＋一筆成本；重算不重複",async()=>{
 const day=new Date(Date.now()+8*3600e3).toISOString().slice(0,10);
 const ex=(await api(`/api/export/bookkeeping?from=${day}&to=${day}`,{token:admin})).data.days[0];assert.ok(ex,"今天應有網站訂單（api.test.mjs）");
 for(let i=0;i<2;i++)assert.equal((await api("/api/ledger/sync-web",{method:"POST",token:admin,body:{from:day,to:day}})).status,200);
 const l=(await api(`/api/ledger/entries?from=${day}&to=${day}&source=web`,{token:admin})).data.entries;
 const inc=l.filter(e=>e.category==="網站收入");assert.equal(inc.length,1);assert.equal(inc[0].signed,ex.total);
 const cost=l.filter(e=>e.item==="網站訂單成本");assert.equal(cost.length,ex.cost>0?1:0);if(ex.cost)assert.equal(cost[0].signed,-ex.cost);
});
await t("員工／薪資：薪資紀錄 upsert、實際支領空白時自動加總",async()=>{
 await api("/api/ledger/employees",{method:"POST",token:admin,body:{rows:[{name:"測試員",title:"工讀",hourlyWage:200}]}});
 await api("/api/ledger/payroll",{method:"POST",token:admin,body:{rows:[{name:"測試員",ym:"2001-03",base:20000,overtime:1000,laborIns:-500}]}});
 await api("/api/ledger/payroll",{method:"POST",token:admin,body:{rows:[{name:"測試員",ym:"2001-03",base:21000,overtime:1000,laborIns:-500}]}});
 const r=(await api("/api/ledger/payroll?name="+encodeURIComponent("測試員"),{token:admin})).data.rows;assert.equal(r.length,1);assert.equal(r[0].net_pay,21500);
});
await t("每日營業額：同一天重新上傳覆蓋；與收支「店面收入」對照",async()=>{
 await api("/api/ledger/import",{method:"POST",token:admin,body:{kind:"pos",rows:[{date:"2001-03-06",gross:16000,discount:1000,cash:9000,otherPay:6000,customers:30,revenue:15000,uber:0}]}});
 await api("/api/ledger/import",{method:"POST",token:admin,body:{kind:"pos",rows:[{date:"2001-03-06",gross:16000,discount:1000,cash:9000,otherPay:6000,customers:31,revenue:15000,uber:500}]}});
 const r=(await api("/api/ledger/pos?ym=2001-03",{token:admin})).data;assert.equal(r.rows.length,1);assert.equal(r.rows[0].customers,31);assert.equal(r.ledger.shop,15000);
});
await t("團購對帳：餘額＝加總，重複匯入不重複",async()=>{
 const rows=[{item:"貨款",unitPrice:100000,qty:1,status:"已匯款"},{item:"黃金蝦",unitPrice:-120,qty:145,status:"已入庫"}];
 for(let i=0;i<2;i++)await api("/api/ledger/import",{method:"POST",token:admin,body:{kind:"prepaid",account:"測試團",rows}});
 const r=(await api("/api/ledger/prepaid?account="+encodeURIComponent("測試團"),{token:admin})).data;assert.equal(r.rows.length,2);assert.equal(r.balance,100000-17400);
});
await t("資產負債表手動輸入",async()=>{
 await api("/api/ledger/balance",{method:"POST",token:admin,body:{rows:[{ym:"2001-03",section:"流動資產",label:"庫存現金(店內)",amount:131747}]}});
 const r=(await api("/api/ledger/report/pnl?ym=2001-04",{token:admin})).data;assert.equal(r.balancePrev[0].amount,131747);
});
await t("只限本人：鎖定後其他管理員看不到記帳；解除後恢復",async()=>{
 await api("/api/users",{method:"POST",token:admin,body:{username:"boss3",password:"boss3-pass-123",role:"admin"}});const b2=await login("boss3","boss3-pass-123");
 assert.equal((await api("/api/ledger/meta",{token:b2})).status,200);
 assert.equal((await api("/api/ledger/access",{method:"POST",token:admin,body:{lock:true}})).status,200);
 assert.equal((await api("/api/ledger/meta",{token:b2})).status,403);assert.equal((await api("/api/ledger/access",{method:"POST",token:b2,body:{lock:false}})).status,403,"其他管理員不能解除");
 assert.equal((await api("/api/ledger/meta",{token:admin})).status,200);
 await api("/api/ledger/access",{method:"POST",token:admin,body:{lock:false}});assert.equal((await api("/api/ledger/meta",{token:b2})).status,200);
});
for(const [s,n] of results)console.log(s,n);const pass=results.filter(r=>r[0]==="✅").length;console.log(`\n${pass}/${results.length} 通過`);process.exit(pass===results.length?0:1);
