// 對帳月結單截圖（選用）：需 worker:dev（ALLOWED_ORIGIN=http://127.0.0.1:4173）與 vite preview，並已匯入 tools/recon-2026-import.py 產生的 SQL。
import {chromium} from "playwright-core";
const B="http://127.0.0.1:4173/seafood-stock-map/",S=process.env.SHOTS??"/workspace/screens-recon/";const out=[],errs=[];
const b=await chromium.launch({executablePath:"/usr/bin/google-chrome"});const p=await (await b.newContext({viewport:{width:390,height:844},deviceScaleFactor:2})).newPage();p.on("pageerror",e=>errs.push(e.message));
await p.goto(B);await p.fill("#user",process.env.UI_USER??"boss");await p.fill("#key",process.env.UI_PASS??"boss-pass-123");await p.click("text=開啟庫存");await p.waitForSelector(".admin-nav");
await p.locator(".admin-tabs button",{hasText:/^記帳$/}).click();await p.waitForSelector(".ledger-sub");await p.click(".ledger-sub button:has-text('團購對帳')");await p.waitForTimeout(2500);
await p.screenshot({path:S+"08-recon-top.png"});out.push(await p.locator('[data-testid="prepaid-balance"]').textContent());
for(const ym of ["2026-01","2026-10"]){await p.locator('[data-testid="statement"] input[type=month]').fill(ym);await p.waitForTimeout(2000);
 out.push(ym+"："+(await p.locator('[data-testid="statement"] .stmt').textContent()));await p.locator('[data-testid="statement"]').scrollIntoViewIfNeeded();await p.screenshot({path:S+`09-statement-${ym}.png`});}
await p.selectOption('[aria-label="對帳對象"]',"龍龍");await p.waitForTimeout(2000);out.push("舊版："+await p.locator('[data-testid="prepaid-balance"]').textContent());await p.screenshot({path:S+"10-legacy.png"});
console.log(out.join("\n"));console.log("errors",errs);await b.close();
