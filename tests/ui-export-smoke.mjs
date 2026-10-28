// 記帳匯出 UI 煙霧測試（選用）：條件同 ui-smoke.mjs（worker:dev 的 ALLOWED_ORIGIN=http://127.0.0.1:4173、vite preview，且 api.test.mjs 已跑過）。
import {chromium} from "playwright-core";
import {readFileSync} from "node:fs";
const B="http://127.0.0.1:4173/seafood-stock-map/",S=process.env.SHOTS??"/workspace/screens-export/";
const out=[];const ok=(c,m)=>out.push((c?"✅ ":"❌ ")+m);
const b=await chromium.launch({executablePath:"/usr/bin/google-chrome"});
const today=new Date(Date.now()+8*3600e3).toISOString().slice(0,10);
const errs=[];
async function login(u,pw,vp){const ctx=await b.newContext({viewport:vp,acceptDownloads:true,permissions:["clipboard-read","clipboard-write"]});const pg=await ctx.newPage();pg.on("pageerror",e=>errs.push(e.message));pg.on("dialog",d=>d.accept());
 await pg.goto(B);await pg.fill("#user",u);await pg.fill("#key",pw);await pg.click("text=開啟庫存");await pg.waitForSelector(".admin-nav",{timeout:10000});return pg}
// 管理員（桌機）
let p=await login("boss","boss-pass-123",{width:1280,height:900});
await p.click(".admin-tabs button:has-text('商品販售')");await p.waitForSelector(".admin-card .grid");
ok(await p.locator("text=舊成本無法自動轉成數字").count()>0,"商品頁提示有無法判讀的舊成本");
ok(await p.locator('[data-testid="cost-unparsed"]').count()>0,"該商品成本欄顯示舊文字並要求重新輸入");
await p.locator('[data-testid="cost-unparsed"]').first().scrollIntoViewIfNeeded();await p.screenshot({path:S+"1-products-cost-flag.png"});
await p.click(".admin-tabs button:has-text('記帳匯出')");
await p.fill('[aria-label="開始日期"]',today);await p.fill('[aria-label="結束日期"]',today);
await p.click("text=產生預覽");await p.waitForSelector(".export-table");
const rows=await p.locator(".export-table tbody tr").allTextContents();
ok(rows.some(r=>r.includes("網站收入 網站訂單")),"預覽有網站收入列");ok(rows.some(r=>r.includes("進貨支出 網站訂單成本")),"預覽有進貨支出（網站訂單成本）列");
ok(rows.some(r=>r.includes(today.replace(/-/g,""))),"日期格式 20260902 樣式");
ok(await p.locator('[data-testid="dup-warning"]').count()===1,"已匯出日期顯示重複警告");
ok(rows.some(r=>/優惠券 \d+ 筆折/.test(r)),"備註寫入優惠券折抵");
await p.screenshot({path:S+"2-export-preview.png",fullPage:true});
const [dl]=await Promise.all([p.waitForEvent("download"),p.click("text=下載 CSV")]);
const csv=readFileSync(await dl.path(),"utf8");const head=csv.replace(/^\ufeff/,"").split("\r\n")[0].split(",");
ok(head.length===28&&head[0]==="項次"&&head[15]==="記錄人","CSV 有 28 欄，順序同「每日收支紀錄」");
await p.click("text=複製（貼到試算表）");await p.waitForSelector("text=已複製");
const clip=await p.evaluate(()=>navigator.clipboard.readText());const first=clip.split("\n")[0].split("\t");
ok(first.length===28&&first[4]==="網站收入"&&first[15]==="boss","複製內容為 28 欄 TSV、記錄人為登入帳號");
await p.locator("summary:has-text('匯出紀錄')").click();await p.screenshot({path:S+"3-export-after-copy.png",fullPage:true});
// 空白區間
await p.fill('[aria-label="開始日期"]',"2001-01-01");await p.fill('[aria-label="結束日期"]',"2001-01-31");await p.click("text=產生預覽");
await p.waitForSelector("text=沒有未取消的網站訂單");ok(true,"空白區間顯示提示");
// 手機
const m=await login("boss","boss-pass-123",{width:390,height:844});
await m.click(".admin-tabs button:has-text('記帳匯出')");await m.fill('[aria-label="開始日期"]',today);await m.fill('[aria-label="結束日期"]',today);await m.click("text=產生預覽");await m.waitForSelector(".export-table");
await m.screenshot({path:S+"4-export-mobile.png",fullPage:true});
// 店員看不到
const API="http://127.0.0.1:8787",post=(path,body,token)=>fetch(API+path,{method:"POST",headers:{"Content-Type":"application/json",...(token?{Authorization:"Bearer "+token}:{})},body:JSON.stringify(body)}).then(r=>r.json());
const at=(await post("/api/auth/login",{username:"boss",password:"boss-pass-123"})).token,su="clerk"+Date.now()%100000;
await post("/api/users",{username:su,password:"clerk-ui-pass-1",role:"staff"},at);
const s=await login(su,"clerk-ui-pass-1",{width:390,height:844});
ok(await s.locator(".admin-tabs button:has-text('記帳匯出')").count()===0,"店員沒有記帳匯出分頁");
ok(!errs.length,"沒有前端錯誤"+(errs.length?"："+errs.join(" | "):""));
console.log(out.join("\n"));await b.close();process.exit(out.some(x=>x.startsWith("❌"))?1:0);
