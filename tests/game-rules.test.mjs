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
assert.equal(rules.pointsPerCatch('shrimp','rod'),100);
assert.equal(rules.pointsPerCatch('shrimp','tongs'),250);
assert.equal(rules.pointsPerCatch('lobster','net'),600);
assert.equal(rules.pointsPerCatch('lobster','cage'),190);
for(const [now,expiry] of [
 ['2026-11-23T16:00:00.000Z','2026-11-24T16:00:00.000Z'],
 ['2026-11-24T15:59:59.999Z','2026-11-24T16:00:00.000Z'],
 ['2026-11-24T16:00:00.000Z','2026-11-25T16:00:00.000Z'],
 ['2026-12-31T15:59:59.999Z','2026-12-31T16:00:00.000Z'],
 ['2026-12-31T16:00:00.000Z','2027-01-01T16:00:00.000Z'],
])assert.equal(rules.endOfTaipeiDay(new Date(now)),expiry);
console.log('PASS: 30 seconds, six catches, tool-based scoring, Taiwan midnight and year boundaries.');
