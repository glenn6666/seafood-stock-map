import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {readFile} from 'node:fs/promises';

const result = await build({entryPoints:['web/src/lib/frozen-product-details.ts'],bundle:true,write:false,format:'esm',platform:'node'});
const {frozenProductDetails: details} = await import('data:text/javascript;base64,'+Buffer.from(result.outputFiles[0].text).toString('base64'));
const evidence=JSON.parse(await readFile('tools/product-photos/20261124-details-evidence.json','utf8'));
assert.equal(new Set(evidence.map(x=>x.name)).size,80);
for(const row of evidence){
  assert.ok(row.description.trim(),row.name+' lacks description');
  assert.ok(row.source.trim(),row.name+' lacks source');
  assert.equal(details({name:row.name}).spec,row.spec,row.name);
  assert.equal(details({name:row.name+'（冷凍）'}).description,row.description,row.name);
}
assert.equal(details({name:'鮭魚切片',spec:'400g／包'}).spec,'400g／包');
assert.equal(details({name:'6兩烏魚子質感禮盒組',spec:'附禮盒'}).spec,'6兩・附禮盒');
assert.deepEqual(details({name:'新商品'}),{spec:'',description:''});
assert.equal(details({name:'甜蝦'}).spec,'50尾／盤');
assert.equal(details({name:'小龍蝦各'}).spec,'');
assert.equal(details({name:'鯖魚'}).spec,'含紙板170–190g；淨重約140–150g');
console.log('80 product details, source coverage, inventory precedence and packaging distinctions passed.');
