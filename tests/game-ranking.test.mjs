// Local D1 only. Run after tests/api.test.mjs on its isolated seeded database.
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
const base=process.env.API??'http://127.0.0.1:8787';
assert.ok(new URL(base).hostname==='127.0.0.1','Use a local test database only');
const key=()=>crypto.randomUUID();
const hash=async s=>Buffer.from(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s))).toString('base64url');
const sql=command=>execFileSync(process.execPath,['node_modules/wrangler/bin/wrangler.js','d1','execute','DB','--local','--persist-to',process.env.PERSIST??'.wrangler/ranking-tests','--command',command],{stdio:'ignore'});
const ip='192.0.2.151';
async function api(path,body,token){const response=await fetch(base+path,{method:body?'POST':'GET',headers:{'Content-Type':'application/json','CF-Connecting-IP':ip,...(token?{Authorization:'Bearer '+token}:{})},body:body?JSON.stringify(body):undefined});return {status:response.status,data:await response.json()}}
const start=async(nickname,playerId=key(),target='shrimp',tool='rod')=>{
 const r=await api('/api/public/game/start',{target,tool,nickname,playerId});assert.equal(r.status,200,JSON.stringify(r.data));return r.data;
};
async function age(game,seconds){sql(`UPDATE game_sessions SET started_at=CAST(strftime('%s','now') AS INTEGER)-${seconds} WHERE id_hash='${await hash(game.gameId)}'`)}
const finish=(g,caught=6)=>api('/api/public/game/finish',{gameId:g.gameId,caught});
const board=async(target='shrimp')=>(await api('/api/public/game/leaderboard?target='+target)).data.entries;
assert.equal((await api('/api/public/game/start',{target:'__proto__'})).status,400);
assert.equal((await api('/api/public/game/start',{nickname:'<script>',playerId:key()})).status,400);
assert.equal((await api('/api/public/game/leaderboard?target=unknown')).status,400);
const player=key(),g=await start('小蝦高手',player);
assert.equal((await finish(g)).status,400,'too fast cannot rank');
assert.equal((await board()).length,0);
await age(g,30);
const concurrent=await Promise.all([finish(g),finish(g),finish(g)]);
assert.equal(concurrent.filter(r=>r.status===200).length,1,'only one finish claims score and coupon');
let entries=await board();assert.equal(entries.length,1);assert.equal(entries[0].nickname,'小蝦高手');
assert.deepEqual(Object.keys(entries[0]).sort(),['achievedAt','nickname','rank','seconds','tool','score','caught'].sort(),'public response has no player, IP, session or coupon identifiers');
const faster=await start('小蝦高手',player,'shrimp','tongs');await age(faster,30);assert.equal((await finish(faster)).status,200);
entries=await board();assert.equal(entries.length,1,'one personal best per target');assert.equal(entries[0].score,1500,"harder tool earns more points");
const loss=await start('');await age(loss,30);assert.equal((await finish(loss,1)).data.won,false);await age(loss,30);assert.equal((await finish(loss)).status,409,'failed session cannot be upgraded later');
const anonymous=await start('');await age(anonymous,30);const won=await finish(anonymous);assert.ok(won.data.coupon);assert.equal((await board()).length,1,'blank nickname does not publish a score');
const limited=await start('照常排名');await age(limited,30);const overLimit=await finish(limited);assert.equal(overLimit.status,200);assert.equal(overLimit.data.won,true);assert.equal(overLimit.data.coupon,null);assert.equal((await board()).length,2,'coupon rate limit does not discard valid rankings');
assert.equal((await board('lobster')).length,0,'separate species boards');
// Ranking order, ties and top-ten boundary, with local fixture scores only.
sql(`INSERT INTO game_scores(id,player_hash,nickname,target,tool,elapsed_sec,created_at,rule_version,score,caught,difficulty) VALUES ${Array.from({length:12},(_,i)=>`('fixture-${i}','fixture-player-${i}','測試玩家${i}','lobster','cage',30,'2026-11-24T00:00:00Z',3,${1800-Math.floor(i/2)*100},6,'hard')`).join(',')}`);
entries=await board('lobster');assert.equal(entries.length,10);assert.deepEqual(entries.slice(0,3).map(e=>e.rank),[1,1,3]);assert.ok(entries.every((e,i)=>!i||entries[i-1].score>=e.score));
const code=won.data.coupon.code;
assert.equal(won.data.coupon.expiresAt.slice(11),'16:00:00.000Z','Taiwan midnight expiry');
const unlimited=await start('');await age(unlimited,30);
const many=await api('/api/public/game/finish',{gameId:unlimited.gameId,caught:12,score:999999,difficulty:'hard'});
assert.equal(many.status,200);assert.equal(many.data.score,1200,'more than six catches allowed; score uses server-stored tool');
assert.equal(many.data.won,true);
assert.equal(won.data.coupon.scope,'store-products-only');
assert.equal((await api('/api/public/coupons/check',{code,channel:'group-buy'})).status,400);
assert.equal((await api('/api/public/orders',{couponCode:code,channel:'group-buy'})).status,400);
const login=await api('/api/auth/login',{username:'boss',password:'boss-pass-123'});assert.equal(login.status,200);const token=login.data.token;
const add=async(id,category)=>{const r=await api('/api/inventory',{id,zone:'unassigned',name:id,spec:'',quantity:20,unit:'份',minimum:0,batch:'',category,price:'600',tracked:true,photoId:'',fridgeId:'',positionNote:''},token);assert.equal(r.status,200);const p=await fetch(base+'/api/products/'+id,{method:'PATCH',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({onSale:true})});assert.equal(p.status,200)};
await add('rank-store','冷凍海鮮');await add('rank-group','團購現貨');
const order=items=>api('/api/public/orders',{idempotencyKey:key(),customerName:'本機測試',phone:'0911222333',couponCode:code,items});
assert.equal((await order([{id:'rank-group',qty:2}])).status,400,'group-buy total cannot qualify');
assert.equal((await order([{id:'rank-store',qty:1},{id:'rank-group',qty:1}])).status,400,'mixed cart only counts store subtotal');
assert.equal((await api('/api/public/coupons/check',{code})).status,200,'rejected orders preserve coupon');
const accepted=await order([{id:'rank-store',qty:2},{id:'rank-group',qty:1}]);assert.equal(accepted.status,200,JSON.stringify(accepted.data));assert.equal(accepted.data.discount,5);assert.equal(accepted.data.total,1795);
assert.equal((await api('/api/public/coupons/check',{code})).status,409,'valid redemption is single use');
console.log('PASS: 30-second scoring, tool scoring, rankings, duplicate claims, privacy, coupon limit, and store-only eligibility.');
