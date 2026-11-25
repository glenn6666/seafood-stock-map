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
 assert.equal(rules.pointsPerCatch(target,'net'),100);
 assert.ok(rules.pointsPerCatch(target,'rod')>rules.pointsPerCatch(target,'net'));
 assert.equal(rules.toolBlocksThreat(target,'rod'),false);
}
assert.equal(rules.pointsPerCatch('shrimp','rod'),125);
assert.equal(rules.pointsPerCatch('lobster','rod'),135);
assert.ok(rules.TOOL_BEHAVIOR.net.r>rules.TOOL_BEHAVIOR.rod.r*4);
assert.ok(rules.TOOL_BEHAVIOR.net.carry>rules.TOOL_BEHAVIOR.rod.carry*2);
assert.ok(rules.TOOL_BEHAVIOR.rod.catchMs>rules.TOOL_BEHAVIOR.net.catchMs*3);
assert.equal(rules.toolBlocksThreat('crab','net'),true);
assert.equal(rules.toolBlocksThreat('lobster','net'),true);
for(const [now,expiry] of [
 ['2026-11-23T16:00:00.000Z','2026-11-24T16:00:00.000Z'],
 ['2026-11-24T15:59:59.999Z','2026-11-24T16:00:00.000Z'],
 ['2026-11-24T16:00:00.000Z','2026-11-25T16:00:00.000Z'],
 ['2026-12-31T15:59:59.999Z','2026-12-31T16:00:00.000Z'],
 ['2026-12-31T16:00:00.000Z','2027-01-01T16:00:00.000Z'],
])assert.equal(rules.endOfTaipeiDay(new Date(now)),expiry);
console.log('PASS: 30 seconds, six catches, tool-based scoring, Taiwan midnight and year boundaries.');
