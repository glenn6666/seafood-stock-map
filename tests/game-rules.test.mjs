import assert from 'node:assert/strict';
import {build} from 'esbuild';
const bundled=await build({entryPoints:['web/src/lib/game-rules.ts'],bundle:true,write:false,format:'esm',platform:'node'});
const rules=await import('data:text/javascript;base64,'+Buffer.from(bundled.outputFiles[0].text).toString('base64'));
assert.equal(rules.GAME_SECONDS,30);assert.equal(rules.COUPON_CATCH_MIN,6);
for(const target of ['shrimp','crab','lobster']){
 for(const a of Object.keys(rules.TOOL_FIT))for(const b of Object.keys(rules.TOOL_FIT)){
  if(rules.TOOL_FIT[a][target]<rules.TOOL_FIT[b][target])assert.ok(rules.pointsPerCatch(target,a)>rules.pointsPerCatch(target,b),'harder tool must score higher');
 }
}
assert.deepEqual(Object.keys(rules.TOOL_FIT),['rod','net']);
for(const target of ['shrimp','crab','lobster']){
 assert.equal(rules.pointsPerCatch(target,'net'),target==='lobster'?310:110);
 assert.ok(rules.pointsPerCatch(target,'rod')>=rules.pointsPerCatch(target,'net')*2);
 assert.equal(rules.toolBlocksThreat(target,'rod'),false);
}
assert.equal(rules.pointsPerCatch('shrimp','rod'),250);
assert.equal(rules.pointsPerCatch('crab','rod'),260);
assert.equal(rules.gameScore('lobster','rod',2,1),1290);
for(const tool of ['rod','net'])assert.ok(rules.pointsPerCatch('lobster',tool)>rules.pointsPerCatch('crab',tool)*1.7,'harder lobster mode has a meaningful reward');
assert.equal(rules.pointsPerCatch('lobster','rod'),670);
assert.ok(rules.TOOL_BEHAVIOR.net.r>rules.TOOL_BEHAVIOR.rod.r*2);
assert.ok(rules.TOOL_BEHAVIOR.net.carry>rules.TOOL_BEHAVIOR.rod.carry);
assert.ok(rules.TOOL_BEHAVIOR.rod.catchMs>rules.TOOL_BEHAVIOR.net.catchMs);
assert.equal(rules.toolBlocksThreat('crab','net'),true);
assert.equal(rules.toolBlocksThreat('lobster','net'),false);
assert.equal(rules.gameScore('shrimp','net',6,2),560);
assert.equal(rules.gameScore('shrimp','rod',1,10),0);
assert.equal(rules.taipeiDay(new Date('2026-11-24T16:00:00.000Z')),'2026-11-25');
for(const target of ['crab','lobster']){
 const rod=rules.toolBehavior(target,'rod'),old=rules.TOOL_BEHAVIOR.rod;
 assert.ok(rod.r>=old.r*2,'double the precise aiming tolerance for difficult species');
 assert.ok(rod.catchMs/rules.TOOL_FIT.rod[target]<rules.CRAB_ATTACK_WINDUP_SEC*1000,'hook before crab attack can land');
 assert.ok(rod.carry>old.carry,'transport has room to reach the bucket');
}
assert.deepEqual(rules.toolBehavior('shrimp','rod'),rules.TOOL_BEHAVIOR.rod);
assert.deepEqual(rules.toolBehavior('lobster','net'),rules.TOOL_BEHAVIOR.net);
assert.equal(rules.rodCatchProtected('rod',1000,2000),true);
assert.equal(rules.rodCatchProtected('rod',1000,3400),false);
assert.equal(rules.rodCatchProtected('net',1000,2000),false);
for(const [now,expiry] of [
 ['2026-11-23T16:00:00.000Z','2026-11-24T16:00:00.000Z'],
 ['2026-11-24T15:59:59.999Z','2026-11-24T16:00:00.000Z'],
 ['2026-11-24T16:00:00.000Z','2026-11-25T16:00:00.000Z'],
 ['2026-12-31T15:59:59.999Z','2026-12-31T16:00:00.000Z'],
 ['2026-12-31T16:00:00.000Z','2027-01-01T16:00:00.000Z'],
])assert.equal(rules.endOfTaipeiDay(new Date(now)),expiry);
console.log('PASS: 30 seconds, six catches, tool-based scoring, Taiwan midnight and year boundaries.');
