// 損益表「下載當月明細」PDF 煙霧測試（選用）：需前端（BASE）與有記帳資料的 worker（API）。
// 例：BASE=http://localhost:5199/seafood-stock-map/ API=http://localhost:8812 PNL_USER=… PNL_PASS=… YM=2026-10 node tests/ui-pnl-pdf-smoke.mjs
import {chromium} from "playwright-core";
import {readFileSync} from "node:fs";
const B=process.env.BASE??"http://127.0.0.1:4173/seafood-stock-map/",API=process.env.API,YM=process.env.YM??"2026-10";
const U=process.env.PNL_USER??"boss",P=process.env.PNL_PASS??"boss-pass-123";
const out=[];const ok=(c,m)=>out.push((c?"✅ ":"❌ ")+m);const errs=[];
const b=await chromium.launch({executablePath:"/usr/bin/google-chrome"});
for(const vp of [{width:1280,height:900},{width:390,height:844}]){
 const ctx=await b.newContext({viewport:vp,acceptDownloads:true});const p=await ctx.newPage();p.on("pageerror",e=>errs.push(e.message));
 if(API)await p.route("**/backend-config.json",r=>r.fulfill({status:200,contentType:"application/json",body:JSON.stringify({apiOrigin:API})}));
 await p.goto(B);await p.fill("#user",U);await p.fill("#key",P);await p.click("text=開啟庫存");await p.waitForSelector(".admin-nav",{timeout:10000});
 await p.locator(".admin-tabs button",{hasText:/^記帳$/}).click();await p.waitForSelector(".ledger-sub");
 await p.click(".ledger-sub button:has-text('損益表')");await p.fill('[aria-label="年月"]',YM);await p.waitForTimeout(1500);
 const [dl]=await Promise.all([p.waitForEvent("download",{timeout:120000}),p.getByRole("button",{name:"下載當月明細"}).click()]);
 const buf=readFileSync(await dl.path()),txt=buf.toString("latin1"),pages=(txt.match(/\/Type \/Page /g)??[]).length;
 ok(dl.suggestedFilename()===`安星水產_${YM}_損益表與明細.pdf`,`${vp.width}px：PDF 檔名 ${dl.suggestedFilename()}`);
 ok(txt.startsWith("%PDF-")&&txt.trimEnd().endsWith("%%EOF")&&/MediaBox \[0 0 595.28 841.89\]/.test(txt),`${vp.width}px：A4 PDF`);
 ok(pages>=2,`${vp.width}px：${pages} 頁`);
 ok(await p.locator(".pdf-host").count()===0,`${vp.width}px：隱藏頁面已清除`);
 if(vp.width>700){await p.click(".ledger-sub button:has-text('每日營業額')");await p.fill('[aria-label="年月"]',YM);await p.waitForTimeout(1500);
  const rv=await p.locator(".export-table tbody tr").evaluateAll(rs=>rs.map(r=>({v:+r.cells[8].textContent.replace(/,/g,""),hi:r.classList.contains("hi-day")})));
  ok(rv.length>0&&rv.every(x=>x.hi===(x.v>=45000)),`每日營業額：營收達 45,000 整列標色（${rv.filter(x=>x.hi).length} 天）`);ok(await p.locator(".hi-note").count()===1,"每日營業額：有底色說明");
  await p.click(".ledger-sub button:has-text('損益表')");await p.fill('[aria-label="年月"]',YM);await p.waitForTimeout(1500)}
 if(vp.width>700){const [x]=await Promise.all([p.waitForEvent("download"),p.getByRole("button",{name:"Excel"}).click()]);ok(x.suggestedFilename().endsWith(".xlsx"),"Excel 仍可下載："+x.suggestedFilename())}
 await ctx.close()}
ok(!errs.length,"沒有前端錯誤"+(errs.length?"："+errs.join(" | "):""));
console.log(out.join("\n"));await b.close();process.exit(out.some(x=>x.startsWith("❌"))?1:0);
