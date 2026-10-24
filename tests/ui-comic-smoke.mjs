// 漫畫風＋釣蝦遊戲＋優惠券 UI 煙霧測試（選用）：條件同 ui-3d-smoke.mjs（本機 D1 已匯入 seed-demo-3d.sql）。
// 遊戲是即時操作，測試只驗證開局／畫面；優惠券由同一台機器（同 IP）經 API 正常完成一局取得，再測試結帳折抵。
import {chromium} from "playwright-core";
const API="http://127.0.0.1:8787",B="http://127.0.0.1:4173/seafood-stock-map/order.html",S="/workspace/screens-comic/";
const j=async(path,{method="GET",token,body}={})=>{const h={"Content-Type":"application/json"};if(token)h.Authorization="Bearer "+token;const r=await fetch(API+path,{method,headers:h,body:body?JSON.stringify(body):undefined});return {status:r.status,data:await r.json()}};
const out=[];const ok=(c,m)=>out.push((c?"✅ ":"❌ ")+m);
const b=await chromium.launch({executablePath:"/usr/bin/google-chrome",args:["--enable-unsafe-swiftshader","--use-angle=swiftshader","--enable-webgl","--ignore-gpu-blocklist"]});
const ctx=await b.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true});
const p=await ctx.newPage();const errs=[];p.on("pageerror",e=>errs.push(e.message));p.on("console",m=>{if(m.type()==="error")errs.push(m.text())});
await p.goto(B+"?e2e");await p.waitForSelector("canvas.scene3d");await p.waitForTimeout(2500);
ok(await p.locator(".comic-hero img").evaluate(i=>i.complete&&i.naturalWidth>0),"漫畫店面橫幅載入");
await p.screenshot({path:S+"1-comic-overview.png"});
for(const [name,file] of [["冰鮮魚展示櫃","2-case-c1.png"],["泰國蝦缸","3-tank-t4.png"],["乾貨區","4-dry-s7.png"]]){
 await p.click(`.unit-chips button:has-text('${name}')`);await p.waitForTimeout(1800);await p.screenshot({path:S+file});
}
ok((await p.locator(".unit-chips button").allTextContents()).join("|").includes("牛肉冷藏櫃"),"新展示櫃名稱出現在選單");
// 展示櫃（無門）直接點商品
await p.click(".unit-chips button:has-text('冰鮮魚展示櫃')");await p.waitForTimeout(1800);
let pos=await p.evaluate(()=>window.__shop.projectItem("demo-ice-1"));await p.mouse.click(pos.x,pos.y);
await p.waitForSelector(".sheet",{timeout:5000});ok((await p.textContent(".sheet")).includes("冰鮮白鯧"),"無門展示櫃可直接點商品");await p.click(".sheet-close");
// 遊戲
await p.click(".game-banner");await p.waitForSelector(".sheet.game");ok((await p.textContent(".sheet.game")).includes("滿 NT$1,000 折 NT$5"),"遊戲規則顯示獎勵");
await p.screenshot({path:S+"5-game-intro.png"});
await p.click(".sheet.game .primary");await p.waitForSelector(".pond");await p.waitForTimeout(1200);
await p.click(".sheet.game .primary");await p.waitForTimeout(300);await p.screenshot({path:S+"6-game-play.png"});
ok(/秒/.test(await p.textContent(".game-stats")),"遊戲開局（伺服器發局）");
await p.goto(B);
// 經 API 完成一局取得券（同 IP）
const g=(await j("/api/public/game/start",{method:"POST"})).data;await new Promise(r=>setTimeout(r,6500));
const f=await j("/api/public/game/finish",{method:"POST",body:{gameId:g.gameId,caught:4}});ok(f.data.won,"API 完成一局取得優惠券");
await p.evaluate(c=>localStorage.setItem("shrimp-coupon",JSON.stringify(c)),f.data.coupon);
await p.evaluate(()=>localStorage.setItem("shop-view","list"));await p.goto(B);await p.waitForSelector(".menu .item");
ok((await p.textContent(".game-banner")).includes("已有優惠券"),"橫幅顯示已有優惠券");
await p.screenshot({path:S+"7-list-comic.png"});
const add=async(name,n)=>{const it=p.locator(".menu .item",{hasText:name});for(let i=0;i<n;i++)await it.locator("button[aria-label=增加]").click()};
await add("北海道干貝",1);await p.click(".cartbar button");
ok((await p.textContent(".coupon-line")).includes("再買 NT$10"),"未滿 1000 提示差額、不折抵");
await p.click("text=繼續選購");await add("海瓜子",1);await p.click(".cartbar button");
ok((await p.textContent(".coupon-line")).includes("已套用"),"滿 1000 自動套用");ok((await p.textContent(".total")).includes("1135"),"合計 990+150−5＝1135");
await p.fill("input[autocomplete=name]","券測試");await p.fill("input[autocomplete=tel]","0922333555");
await p.screenshot({path:S+"8-cart-coupon.png"});
await p.click("text=送出訂單");await p.waitForSelector("text=目前狀態",{timeout:8000});
ok((await p.textContent(".card")).includes("釣蝦優惠券 −$5"),"查詢頁顯示折抵");await p.screenshot({path:S+"9-lookup-discount.png"});
ok(await p.evaluate(()=>localStorage.getItem("shrimp-coupon")===null),"用過的券從購物車移除");
// 後台
const admin=(await j("/api/auth/login",{method:"POST",body:{username:"boss",password:"boss-pass-123"}})).data.token;
const a=await b.newContext({viewport:{width:390,height:844}});const q=await a.newPage();
await q.goto("http://127.0.0.1:4173/seafood-stock-map/");await q.evaluate(t=>{sessionStorage.setItem("inventory-token",t);localStorage.setItem("inventory-token",t)},admin);
out.push("ℹ️ 後台訂單：以 API 驗證（登入流程由 ui-smoke 覆蓋）");
const ao=(await j("/api/orders",{token:admin})).data.orders.find(o=>o.customerName==="券測試");ok(ao&&ao.discount===5&&ao.subtotal===1140&&ao.total===1135,"後台訂單含小計／折抵／合計");
ok(errs.length===0,"無前端錯誤 "+errs.join(" | ").slice(0,300));
console.log(out.join("\n"));await b.close();
