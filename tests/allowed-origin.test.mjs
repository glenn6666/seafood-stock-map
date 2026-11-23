import assert from 'node:assert/strict';
import {isAllowedOrigin} from '../worker/allowed-origin.ts';
const old='https://glenn6666.github.io',current='https://anxing-seafood.pages.dev';
const allowed=` ${old}, ${current} `;
assert.equal(isAllowedOrigin(old,old),true);
assert.equal(isAllowedOrigin(old,allowed),true);
assert.equal(isAllowedOrigin(current,allowed),true);
for(const origin of [null,'','null','http://anxing-seafood.pages.dev','https://anxing-seafood.pages.dev.attacker.com','https://preview.anxing-seafood.pages.dev','https://evil.example','https://anxing-seafood.pages.dev/']){
 assert.equal(isAllowedOrigin(origin,allowed),false,`reject ${origin}`);
}
console.log('Explicit origin allowlist passed');
