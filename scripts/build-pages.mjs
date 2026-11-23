import {spawnSync} from 'node:child_process';
import {cpSync,mkdirSync,copyFileSync,writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
for(const args of [['node_modules/typescript/bin/tsc','-p','tsconfig.json'],['node_modules/vite/bin/vite.js','build','--manifest']]){
 const result=spawnSync(process.execPath,args,{cwd:root,stdio:'inherit'});
 if(result.status!==0)process.exit(result.status??1);
}
// Retain existing asset paths and stored photo URLs. The public root opens shopping.
const out=new URL('../dist-pages/',import.meta.url);
mkdirSync(out,{recursive:true});
cpSync(new URL('../dist/',import.meta.url),new URL('seafood-stock-map/',out),{recursive:true});
for(const entry of ['index.html','order.html'])copyFileSync(new URL('../dist/order.html',import.meta.url),new URL(entry,out));
copyFileSync(new URL('../dist/order.html',import.meta.url),new URL('seafood-stock-map/index.html',out));
writeFileSync(new URL('_redirects',out),'/dine.html /seafood-stock-map/dine.html 302\n');
console.log('Cloudflare Pages output: dist-pages/');
