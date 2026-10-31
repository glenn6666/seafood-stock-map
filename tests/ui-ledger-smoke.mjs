// 記帳 UI 煙霧測試（選用）：需 worker:dev（ALLOWED_ORIGIN=http://127.0.0.1:4173）、vite preview，且 api.test.mjs 已跑過。
// LEDGER_XLSX 指向試算表匯出的 xlsx（私人資料，不放進 repo）。
import {chromium} from "playwright-core";
const B="http://127.0.0.1:4173/seafood-stock-map/",S=process.env.SHOTS??"/workspace/screens-ledger/",X=process.env.LEDGER_XLSX??"/workspace/ledger.xlsx";
const out=[];const ok=(c,m)=>out.push((c?"✅ ":"❌ ")+m);const errs=[];
const b=await chromium.launch({executablePath:"/usr/bin/google-chrome"});
async function login(u,pw,vp){const ctx=await b.newContext({viewport:vp});const pg=await ctx.newPage();pg.on("pageerror",e=>errs.push(e.message));pg.on("dialog",d=>d.accept());
 await pg.goto(B);await pg.fill("#user",u);await pg.fill("#key",pw);await pg.click("text=開啟庫存");await pg.waitForSelector(".admin-nav",{timeout:10000});return pg}
const sub=async(pg,l)=>{await pg.click(`.ledger-sub button:has-text('${l}')`);await pg.waitForTimeout(1500)};
const p=await login("boss","boss-pass-123",{width:1366,height:900});
await p.click(".admin-tabs button:has-text('記帳')");await p.waitForSelector(".ledger-sub");
await sub(p,"匯入試算表");await p.setInputFiles('[aria-label="選擇試算表檔案"]',X);await p.waitForSelector('[data-testid="import-preview"]',{timeout:60000});
await p.screenshot({path:S+"01-import-preview.png",fullPage:true});
await p.click("text=開始匯入");await p.waitForSelector('[data-testid="import-check"]',{timeout:300000});
const chk=await p.locator('[data-testid="import-check"] h2').textContent();ok(chk.includes("✅"),"匯入後與整合月報總表核對："+chk);
await p.screenshot({path:S+"02-import-check.png",fullPage:true});
await p.click(".admin-tabs button:has-text('記帳匯出')");await p.waitForTimeout(800);await p.locator(".admin-tabs button",{hasText:/^記帳$/}).click();await p.waitForSelector(".ledger-sub");
const shots=[["收支紀錄","03-entries"],["月報","04-monthly"],["日報","05-daily"],["損益表","06-pnl"],["年度營業額","07-yearly"],["每日營業額","08-pos"],["員工薪資","09-payroll"],["客戶廠商","10-contacts"],["團購對帳","11-prepaid"],["分類設定","12-settings"]];
for(const [l,f] of shots){await sub(p,l);
 if(l==="月報")await p.selectOption('[aria-label="年度"]',"2026").catch(()=>{});
 if(l==="損益表"){await p.fill('[aria-label="年月"]',"2026-09");await p.waitForTimeout(1500);const t=await p.locator('[data-testid="pnl"]').textContent();ok(t.includes("1,011,005")&&t.includes("644,653")&&t.includes("133,589"),"損益表 2026-09 營收／成本／淨利與試算表一致")}
 if(l==="團購對帳"){await p.fill('[aria-label="對帳對象"]',"龍龍");await p.waitForTimeout(1500);ok((await p.locator('[data-testid="prepaid-balance"]').textContent()).includes("60,284"),"龍龍餘額 60,284.86")}
 await p.screenshot({path:S+f+".png",fullPage:!["團購對帳","收支紀錄"].includes(l)});ok(true,"畫面："+l)}
const m=await login("boss","boss-pass-123",{width:390,height:844});
await m.click(".admin-tabs button:has-text('記帳')");await m.waitForSelector(".ledger-sub");await m.screenshot({path:S+"13-mobile-entries.png",fullPage:true});
await sub(m,"月報");await m.screenshot({path:S+"14-mobile-monthly.png"});
// 店員
const mp=await (await b.newContext()).newPage();const r=await mp.request.post("http://127.0.0.1:8787/api/auth/login",{data:{username:"boss",password:"boss-pass-123"}}).catch(()=>null);
const su="uiclerk"+Date.now()%100000;const tk=(await r?.json())?.token;
if(tk)await mp.request.post("http://127.0.0.1:8787/api/users",{headers:{authorization:"Bearer "+tk},data:{username:su,password:"clerk-pass-9",role:"staff"}});
const s=await login(su,"clerk-pass-9",{width:1280,height:900});
ok(await s.locator(".admin-tabs button:has-text('記帳')").count()===0,"店員看不到「記帳」分頁");await s.screenshot({path:S+"15-staff-no-ledger.png"});
ok(errs.length===0,"無前端錯誤"+(errs.length?"："+errs.slice(0,3).join("|"):""));
await b.close();console.log(out.join("\n"));process.exit(out.some(x=>x.startsWith("❌"))?1:0);
