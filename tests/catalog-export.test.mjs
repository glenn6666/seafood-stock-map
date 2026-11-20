import {test} from 'node:test';
import assert from 'node:assert/strict';
import {embedCatalogImages} from '../web/src/catalog/export-jpg.ts';

globalThis.FileReader=class {
 readAsDataURL(blob){blob.arrayBuffer().then(bytes=>{this.result=`data:${blob.type};base64,${Buffer.from(bytes).toString('base64')}`;this.onload();},()=>this.onerror());}
};
const base='https://example.test/menu/';
function image(href){return {href,getAttribute(){return this.href;},setAttribute(_name,value){this.href=value;}};}
function svg(images){return {querySelectorAll(){return images;}};}

test('37 menu sources use at most four concurrent fresh CORS fetches and deduplicate shared images',async()=>{
 let active=0,maximum=0;
 const calls=[];
 globalThis.fetch=async(url,options)=>{
  calls.push(url);assert.equal(options.cache,'reload');assert.ok(options.signal instanceof AbortSignal);
  maximum=Math.max(maximum,++active);
  await new Promise(resolve=>setTimeout(resolve,2));active--;
  return new Response(new Blob(['photo'],{type:'image/jpeg'}));
 };
 const images=Array.from({length:37},(_,i)=>image(`photos/${i}.jpg`));
 images.push(image('photos/0.jpg'),image('data:image/jpeg;base64,already'),image(null));
 await embedCatalogImages(svg(images),base);
 assert.equal(calls.length,37);assert.equal(maximum,4);
 assert.equal(calls[0],base+'photos/0.jpg');
 assert.ok(images.slice(0,38).every(i=>i.href.startsWith('data:image/jpeg;base64,')));
 assert.equal(images[38].href,'data:image/jpeg;base64,already');assert.equal(images[39].href,null);
});

test('a transient failure is retried before embedding',async()=>{
 let calls=0;globalThis.fetch=async()=>{if(++calls===1)throw new Error('timeout');return new Response(new Blob(['ok'],{type:'image/jpeg'}));};
 const img=image('/retry.jpg');await embedCatalogImages(svg([img]),base);
 assert.equal(calls,2);assert.ok(img.href.startsWith('data:image/jpeg;base64,'));
});

test('persistent failures identify the failed source without silently dropping it',async()=>{
 let calls=0;globalThis.fetch=async()=>{calls++;return new Response('missing',{status:404});};
 const img=image('/missing.jpg');await assert.rejects(embedCatalogImages(svg([img]),base),/第 1 張菜單圖片無法匯出/);
 assert.equal(calls,2);assert.equal(img.href,'/missing.jpg');
});
