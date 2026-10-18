// 手機 UI 煙霧測試（選用）：需另行安裝 playwright-core 與 Chrome，先執行 worker:dev（ALLOWED_ORIGIN=http://127.0.0.1:4173）與 vite preview，且 api.test.mjs 已跑過。
import {chromium} from "playwright-core";
const API="http://127.0.0.1:8787",B="http://127.0.0.1:4173/seafood-stock-map/";
const j=async(path,{method="GET",token,body}={})=>{const h={"Content-Type":"application/json"};if(token)h.Authorization="Bearer "+token;const r=await fetch(API+path,{method,headers:h,body:body?JSON.stringify(body):undefined});return {status:r.status,data:await r.json()}};
const admin=(await j("/api/auth/login",{method:"POST",body:{username:"boss",password:"boss-pass-123"}})).data.token;
const qty=async id=>(await j("/api/inventory",{token:admin})).data.items.find(i=>i.id===id);
const out=[];const ok=(c,m)=>out.push((c?"✅ ":"❌ ")+m);
const b=await chromium.launch({executablePath:"/usr/bin/google-chrome"});
const errs=[];
async function login(u,p){const pg=await b.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});pg.on("pageerror",e=>errs.push(e.message));pg.on("dialog",d=>d.accept());await pg.goto(B);if(u)await pg.fill("#user",u);await pg.fill("#key",p);await pg.click("text=開啟庫存");await pg.waitForSelector(".admin-nav",{timeout:10000});return pg}
// 1 衝突
let p=await login("boss","boss-pass-123");
await p.waitForSelector("text=資料已載入",{state:"attached"});
await p.click(".storage-shortcuts button:has-text('01')");
await p.waitForSelector(".fridge-hotspot");await p.click(".fridge-hotspot:has-text('冰箱 1')");
const inc=p.locator('[aria-label^="增加 美國安格斯帶骨牛小排"]').first();await inc.waitFor();
const before=await qty("A-肉類-1");
await j("/api/inventory",{method:"POST",token:admin,body:{...before,quantity:before.quantity+5,expectedQuantity:before.quantity}}); // 另一台裝置改數量
await inc.click({force:true});
await p.waitForSelector("text=庫存已被更動",{timeout:8000});
const dtext=await p.textContent(".conflict-dialog");ok(dtext.includes(`${before.quantity} → ${before.quantity+5}`),`衝突視窗列出變動：${before.quantity} → ${before.quantity+5}`);
ok((await qty("A-肉類-1")).quantity===before.quantity+5,"衝突時未覆蓋");
await p.screenshot({path:"/tmp/pw/conflict.png"});
await p.click(".conflict-actions .primary");await p.waitForTimeout(1200);
ok((await qty("A-肉類-1")).quantity===before.quantity+6,"確認後依最新數量 +1 存檔（未重新整理頁面）");
ok(await p.locator(".conflict-dialog").count()===0,"視窗關閉");
await p.keyboard.press("Escape");
// 2 批次上架
await p.click(".admin-tabs >> text=商品販售");await p.waitForSelector(".bulk-bar");
await p.fill(".admin-filter input:not([type=checkbox])","新品");await p.waitForTimeout(300);
await p.click(".bulk-bar label.select");ok((await p.textContent(".bulk-bar")).includes("已選 2 項"),"全選目前列表");
await p.click(".bulk-bar >> text=全部上架");await p.waitForSelector("text=已上架 2 項");ok(true,"全部上架");
await p.screenshot({path:"/tmp/pw/bulk.png"});
await p.click(".bulk-bar label.select");await p.click(".bulk-bar >> text=全部下架");await p.waitForSelector("text=已下架 2 項");ok(true,"全部下架");
// 3 店員
const s=await login("clerk2","clerk2-pass-1");await s.click(".admin-tabs >> text=商品販售");await s.waitForSelector("text=商品販售設定");await s.waitForTimeout(600);
ok(await s.locator("label:has-text('售價')").count()===0&&await s.locator(".bulk-bar").count()===0&&await s.locator("label:has-text('成本')").count()===0,"店員畫面無售價／成本欄、無批次上架");
ok(await s.locator(".admin-tabs >> text=帳號").count()===0,"店員無帳號頁");
await s.screenshot({path:"/tmp/pw/staff-products.png"});
// 4 原管理密碼
await j("/api/settings/legacy-token",{method:"POST",token:admin,body:{enabled:true}});
const l=await login("","local-test-token-123");ok(await l.locator("text=您正以「原管理密碼」登入").count()===1,"原密碼登入顯示提醒橫幅");
await l.screenshot({path:"/tmp/pw/legacy.png"});
await l.click(".admin-tabs >> text=帳號");await l.click("button:has-text('停用原管理密碼')");await l.waitForSelector(".signin form",{timeout:8000});ok(true,"停用後自動登出");
ok((await j("/api/inventory",{token:"local-test-token-123"})).status===401,"停用後原密碼 API 401");
const l2=await b.newPage();await l2.goto(B);await l2.fill("#key","local-test-token-123");await l2.click("text=開啟庫存");await l2.waitForSelector("[role=alert]");ok((await l2.textContent("[role=alert]")).includes("已停用"),"停用後無法登入，顯示中文說明");
ok(errs.length===0,"無前端執行錯誤 "+errs.join("|"));
console.log(out.join("\n"));await b.close();
