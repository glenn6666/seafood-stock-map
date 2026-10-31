// 店面圖熱區 UI 煙霧測試（選用）：條件同 ui-3d-smoke.mjs（本機 D1 已匯入 seed-demo-3d.sql，worker:dev 於 8787，vite preview 於 4173）。
import {chromium} from "playwright-core";
const B="http://127.0.0.1:4173/seafood-stock-map/order.html",S=process.env.SHOTS??"/workspace/screens-hotspot/",API=process.env.API??"http://127.0.0.1:8787";
const out=[];const ok=(c,m)=>out.push((c?"✅ ":"❌ ")+m);
const b=await chromium.launch({executablePath:"/usr/bin/google-chrome",args:["--enable-unsafe-swiftshader","--use-angle=swiftshader","--enable-webgl","--ignore-gpu-blocklist"]});
async function page(empty=false){const ctx=await b.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true});const p=await ctx.newPage();p.errs=[];p.on("pageerror",e=>p.errs.push(e.message));
 await p.route("**/backend-config.json",r=>r.fulfill({contentType:"application/json",body:JSON.stringify({apiOrigin:API})}));
 if(empty)await p.route("**/api/public/menu",async r=>{const res=await r.fetch();const d=await res.json();r.fulfill({contentType:"application/json",headers:{"access-control-allow-origin":"*"},body:JSON.stringify({...d,items:[]})})});
 return p}
// 以多邊形頂點平均（圖座標）換算成畫面座標點擊，避免 L 形熱區外框中心落在外面
const tap=async(p,id)=>{const pt=await p.evaluate(id=>{const pg=document.querySelector(`.hot-${id}:not(.hot-menu) polygon`),svg=pg.ownerSVGElement,ps=[...pg.points];let x=ps.reduce((s,q)=>s+q.x,0)/ps.length,y=ps.reduce((s,q)=>s+q.y,0)/ps.length;if(id==="t1"){x=150;y=370}scrollTo(0,0);const sc=document.querySelector(".fullmap-scroll");let m=svg.getScreenCTM();sc.scrollLeft+=x*m.a+m.e-innerWidth/2;m=svg.getScreenCTM();return {x:x*m.a+m.e,y:y*m.d+m.f,hit:document.elementFromPoint(x*m.a+m.e,y*m.d+m.f)?.closest(".hot")?.classList[1]}},id);if(pt.hit!=="hot-"+id)throw new Error(`點 ${id} 落在 ${pt.hit}`);await p.touchscreen.tap(pt.x,pt.y)};
// 列表模式
let p=await page();await p.addInitScript(()=>localStorage.setItem("shop-view","list"));await p.goto(B);await p.waitForSelector(".menu .item");
ok(await p.locator(".shop-map .hot").count()===16,"店面圖 12 個熱區＋4 個選單");
const r=await p.locator(".shop-map").boundingBox(),fm=await p.locator(".fullmap").boundingBox();ok(Math.abs(r.width/r.height-1.5)<0.02&&Math.abs(fm.height-844)<2&&Math.abs(fm.width-390)<2,"第一個畫面＝整張店面圖撐滿螢幕（圖 "+Math.round(r.width)+"×"+Math.round(r.height)+"）");
ok(await p.evaluate(()=>{const e=document.querySelector(".fullmap-scroll");return Math.abs(e.scrollLeft-(e.scrollWidth-e.clientWidth)/2)<3}),"一開始置中");
ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),"頁面本身沒有橫向捲動");
ok(await p.evaluate(()=>[...document.querySelectorAll(".shop-map .hot polygon")].every(e=>{const c=getComputedStyle(e);return c.stroke==="none"&&(c.fill==="transparent"||c.fill==="rgba(0, 0, 0, 0)"||c.fill==="none")})),"平常看不到熱區框");
await p.screenshot({path:S+"1-map-phone.png"});
await tap(p,"t1");await p.waitForTimeout(600);let names=await p.locator(".menu .item strong").allTextContents();
ok(names.length===7&&(await p.textContent(".zone-filter")).includes("低溫缸"),"點低溫缸 → 只顯示低溫缸 7 項");ok(await p.locator(".hot-t1.on").count()===1,"低溫缸熱區標示選取");
await p.screenshot({path:S+"2-tap-t1-list.png"});
await p.evaluate(()=>scrollTo(0,0));await tap(p,"f2");await p.waitForTimeout(600);ok((await p.locator(".menu .item").count())===4,"點冰箱 2 → 海鮮冷藏櫃 4 項");await p.screenshot({path:S+"3-tap-f2-list.png"});
await p.evaluate(()=>scrollTo(0,0));await tap(p,"c3");await p.waitForTimeout(300);ok((await p.textContent(".toast")).includes("目前沒有商品"),"空的分區 → 提示沒有商品");await p.screenshot({path:S+"4-tap-empty-c3.png"});
await p.click(".zone-filter button");ok((await p.locator(".menu .item").count())===20,"顯示全部");
await tap(p,"t4");await p.waitForTimeout(1200);await p.evaluate(()=>scrollTo(0,0));{const pt=await p.evaluate(()=>{const g=document.querySelector(".hot-menu.hot-all polygon");scrollTo(0,0);const sc=document.querySelector(".fullmap-scroll");let r=g.getBoundingClientRect();sc.scrollLeft+=r.x+r.width/2-innerWidth/2;r=g.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}});await p.touchscreen.tap(pt.x,pt.y);await p.waitForTimeout(400);{const n=await p.locator(".menu .item").count();ok(n===20,"圖下方「店面」選單 → 回到全部商品（"+n+"）")}}
await p.evaluate(()=>scrollTo(0,0));await tap(p,"game");await p.waitForSelector(".sheet.game");ok((await p.textContent(".sheet.game h2")).includes("樂甜釣蝦場"),"點右上釣蝦池 → 開啟樂甜釣蝦場");await p.screenshot({path:S+"5-tap-game.png"});
await p.click(".sheet.game .sheet-close, .sheet.game button:has-text('關閉')").catch(()=>{});
ok(!p.errs.length,"列表模式無錯誤 "+p.errs.join("|"));
// 3D 模式
p=await page();await p.addInitScript(()=>localStorage.setItem("shop-view","3d"));await p.goto(B);await p.waitForSelector("canvas.scene3d");await p.waitForTimeout(2000);
await tap(p,"t4");await p.waitForTimeout(2000);ok((await p.locator(".unit-chips button.active").textContent()).includes("泰國蝦缸"),"3D 模式點泰國蝦缸 → 3D 鏡頭移到泰國蝦缸");await p.screenshot({path:S+"6-tap-t4-3d.png"});
ok(!p.errs.length,"3D 模式無錯誤 "+p.errs.join("|"));
// 尚無上架商品
p=await page(true);await p.goto(B);await p.waitForSelector(".shop-map");await p.waitForTimeout(800);
ok((await p.textContent("body")).includes("目前沒有開放訂購的商品"),"無商品時仍顯示店面圖");
await tap(p,"game");await p.waitForSelector(".sheet.game");ok(true,"無商品時仍可從店面圖開遊戲");await p.screenshot({path:S+"7-empty-menu-game.png"});
// 圖下方「活鮮」→ 三個魚缸
p=await page();await p.addInitScript(()=>localStorage.setItem("shop-view","list"));await p.goto(B);await p.waitForSelector(".menu .item");
{const pt=await p.evaluate(()=>{const g=document.querySelector(".hot-menu.hot-live polygon");scrollTo(0,0);const sc=document.querySelector(".fullmap-scroll");let r=g.getBoundingClientRect();sc.scrollLeft+=r.x+r.width/2-innerWidth/2;r=g.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}});await p.touchscreen.tap(pt.x,pt.y);await p.waitForTimeout(600);
const n=await p.locator(".menu .item").count();ok(n===8&&(await p.textContent(".zone-filter")).includes("活鮮（三個魚缸）"),"「活鮮」→ 三個魚缸共 8 項（"+n+"）");
ok(await p.locator(".hot.on:not(.hot-menu)").count()===3,"三個魚缸熱區同時標示");
await p.evaluate(()=>scrollTo(0,0));await p.screenshot({path:S+"8-live-all-tanks.png",fullPage:true});}
// 看全部商品按鈕、桌機
p=await page();await p.addInitScript(()=>localStorage.setItem("shop-view","list"));await p.goto(B);await p.waitForSelector(".menu .item");
await p.click(".fullmap-down");await p.waitForTimeout(800);ok(await p.evaluate(()=>scrollY>500),"「看全部商品 ↓」捲到商品列表");await p.screenshot({path:S+"9-list-after-down.png"});
await p.evaluate(()=>scrollTo(0,0));await p.click(".pan-r");await p.waitForTimeout(700);await p.screenshot({path:S+"10-phone-pan-right.png"});
{const ctx=await b.newContext({viewport:{width:1366,height:768}});const d=await ctx.newPage();await d.route("**/backend-config.json",r=>r.fulfill({contentType:"application/json",body:JSON.stringify({apiOrigin:API})}));await d.addInitScript(()=>localStorage.setItem("shop-view","list"));await d.goto(B);await d.waitForSelector(".menu .item");await d.waitForTimeout(800);
const r=await d.locator(".shop-map").boundingBox();ok(Math.abs(r.height-768)<2&&r.width<=1366,"桌機：整張圖放到最大（"+Math.round(r.width)+"×"+Math.round(r.height)+"）");await d.screenshot({path:S+"11-desktop.png"});
const box=await d.locator(".hot-c2:not(.hot-menu) polygon").boundingBox();await d.mouse.click(box.x+box.width/2,box.y+box.height/2);await d.waitForTimeout(800);ok((await d.textContent(".zone-filter")).includes("貝類"),"桌機點中央冰櫃 2 → 貝類");await d.screenshot({path:S+"12-desktop-after-c2.png"});
await d.evaluate(()=>scrollTo(0,0));const g=await d.locator(".hot-game:not(.hot-menu) polygon").boundingBox();await d.mouse.click(g.x+g.width/2,g.y+g.height/2);await d.waitForSelector(".sheet.game");ok(true,"桌機點釣蝦池開遊戲");await d.screenshot({path:S+"13-desktop-game.png"});}
console.log(out.join("\n"));await b.close();
