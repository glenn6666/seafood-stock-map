// 3D 顧客頁手機 UI 煙霧測試（選用）：需 playwright-core＋Chrome；本機 D1 先套用 migrations 並匯入 tests/seed-demo-3d.sql，worker:dev 設 ALLOWED_ORIGIN=http://127.0.0.1:4173，vite preview 於 4173。
import {chromium} from "playwright-core";
const B="http://127.0.0.1:4173/seafood-stock-map/order.html",S="/workspace/screens-3d/";
const b=await chromium.launch({executablePath:"/usr/bin/google-chrome",args:["--enable-unsafe-swiftshader","--use-angle=swiftshader","--enable-webgl","--ignore-gpu-blocklist"]});
const ctx=await b.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true});
const p=await ctx.newPage();const errs=[];p.on("pageerror",e=>errs.push(e.message));p.on("console",m=>{if(m.type()==="error")errs.push(m.text())});
const out=[];const ok=(c,m)=>out.push((c?"✅ ":"❌ ")+m);
await p.goto(B+"?e2e");await p.waitForSelector("canvas.scene3d");await p.waitForTimeout(2500);
ok(await p.evaluate(()=>!!window.__shop),"3D 場景已建立（WebGL）");
await p.screenshot({path:S+"1-overview.png"});
// 打開海鮮冷凍櫃
await p.click(".unit-chips button:has-text('海鮮冷凍櫃')");await p.waitForTimeout(1500);
const box=await p.locator("canvas.scene3d").boundingBox();
await p.mouse.click(box.x+box.width/2,box.y+box.height*0.5);await p.waitForTimeout(1800);
await p.screenshot({path:S+"2-fridge-open.png"});
let pos=await p.evaluate(()=>window.__shop.projectItem("demo-fz-3"));
await p.mouse.click(pos.x,pos.y);await p.waitForSelector(".sheet",{timeout:5000});ok((await p.textContent(".sheet")).includes("北海道干貝"),"點冰箱內商品卡開啟商品視窗");
ok(!/成本|700|zone|儲位/.test(await p.textContent(".sheet")),"商品視窗不含成本／儲位");
await p.click(".sheet button[aria-label=增加]");await p.click(".sheet .primary");await p.waitForSelector(".toast");ok(true,"加入購物車 ×2");
// 魚缸
await p.click(".unit-chips button:has-text('活海鮮魚缸')");await p.waitForTimeout(2200);
pos=await p.evaluate(()=>window.__shop.projectItem("demo-live-2"));
await p.mouse.click(pos.x,pos.y);
let opened=await p.locator(".sheet").count();
if(!opened){pos=await p.evaluate(()=>window.__shop.projectItem("demo-live-2"));await p.mouse.click(pos.x,pos.y);await p.waitForTimeout(300)}
await p.waitForSelector(".sheet",{timeout:5000});const st=await p.textContent(".sheet");ok(/活沙公蟹/.test(st),"點魚缸裡的螃蟹開啟商品視窗："+st.slice(0,30));
await p.waitForTimeout(500);await p.screenshot({path:S+"3-aquarium-selected.png"});
await p.click(".sheet .primary");await p.waitForTimeout(400);
// 售完商品
pos=await p.evaluate(()=>window.__shop.projectItem("demo-live-7"));await p.mouse.click(pos.x,pos.y);await p.waitForTimeout(400);
if(await p.locator(".sheet").count()){ok((await p.textContent(".sheet")).includes("已售完")&&await p.locator(".sheet .primary").count()===0,"售完商品不可加入");await p.click(".sheet-close")}
// 購物車
await p.click(".cartbar button");await p.waitForSelector("text=購物車");ok((await p.textContent(".lines")).includes("北海道干貝")&&(await p.textContent(".lines")).includes("活沙公蟹"),"購物車包含冰箱與魚缸商品");
await p.fill("input[autocomplete=name]","測試顧客");await p.fill("input[autocomplete=tel]","0922333444");
await p.screenshot({path:S+"4-cart.png"});
await p.click("text=送出訂單");await p.waitForSelector("text=目前狀態",{timeout:8000});ok(true,"送出訂單→查詢頁");
// FPS（SwiftShader 軟體繪圖，僅供參考）
await p.goto(B);await p.waitForTimeout(2000);
const fps=await p.evaluate(()=>new Promise(r=>{let n=0;const t0=performance.now();const f=()=>{n++;if(performance.now()-t0<2000)requestAnimationFrame(f);else r(n/2)};requestAnimationFrame(f)}));out.push("ℹ️ 軟體繪圖 FPS ≈ "+fps);
// 列表模式（減少動態效果自動切換）
const ctx2=await b.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,reducedMotion:"reduce"});
const q=await ctx2.newPage();await q.goto(B);await q.waitForSelector(".menu .item");ok(await q.locator("canvas").count()===0,"偏好減少動態 → 自動列表模式、未載入 3D");
const reqs=[];q.on("request",r=>reqs.push(r.url()));await q.waitForTimeout(500);ok(!reqs.some(u=>u.includes("Scene3D")),"列表模式不下載 3D 程式");
await q.screenshot({path:S+"5-list-fallback.png"});
// 3D 切換到列表
await p.click(".view-toggle button:has-text('列表')");await p.waitForSelector(".menu .item");ok(true,"可手動切換列表");
// 無 WebGL
const ctx3=await b.newContext({viewport:{width:390,height:844}});await ctx3.addInitScript(()=>{const o=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(t,...a){return /webgl/.test(t)?null:o.call(this,t,...a)}});
const w=await ctx3.newPage();await w.goto(B);await w.waitForSelector(".menu .item");ok(await w.locator(".view-toggle button:has-text('3D')").count()===0,"無 WebGL → 只顯示列表");
ok(errs.length===0,"無前端錯誤 "+errs.join(" | ").slice(0,300));
console.log(out.join("\n"));await b.close();
