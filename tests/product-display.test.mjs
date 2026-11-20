import assert from "node:assert/strict";
import {displayProductName,preferProductDisplayRow,dedupeProductsByDisplayName} from "../web/src/lib/product-display.ts";

assert.equal(displayProductName("午仔魚（冷凍）"), "午仔魚");
assert.equal(displayProductName("午仔魚（架上）"), "午仔魚");
assert.equal(displayProductName("午仔魚(冷凍)"), "午仔魚");
assert.equal(displayProductName("午仔魚(架上)"), "午仔魚");
assert.equal(displayProductName("泰國蝦（鹽烤）"), "泰國蝦（鹽烤）");
assert.equal(displayProductName("6兩烏魚子"), "6兩烏魚子");

const frozen = {id:"f",name:"桂花豬肋排（冷凍）",available:12,price:"329",imageUrl:"",spec:"",unit:"份"};
const shelf = {id:"s",name:"桂花豬肋排（架上）",available:4,price:"339",imageUrl:"",spec:"",unit:"份"};
assert.equal(preferProductDisplayRow(frozen, shelf).id, "f", "both in stock, no photo: keep more stock");
assert.equal(preferProductDisplayRow(shelf, frozen).id, "f");
assert.equal(preferProductDisplayRow({...shelf,available:0}, frozen).id, "f", "keep in-stock");
assert.equal(preferProductDisplayRow(frozen, {...shelf,available:0,imageUrl:"/p"}).id, "f", "stock beats photo-only sold-out");
assert.equal(preferProductDisplayRow({...frozen,available:0}, {...shelf,imageUrl:"/p"}).id, "s", "both-or-one photo when choosing among stock");
assert.equal(preferProductDisplayRow({...frozen,available:4,imageUrl:""}, {...shelf,available:4,imageUrl:"/p"}).id, "s", "same stock: prefer photo");

const items = [
  {id:"a",name:"午仔魚（冷凍）",available:10,price:"180",imageUrl:"/p"},
  {id:"b",name:"午仔魚（架上）",available:22,price:"180",imageUrl:"/p"},
  {id:"c",name:"6兩烏魚子",available:12,price:"900",imageUrl:""},
  {id:"d",name:"烏龍麵（冷凍）",available:8,price:"139",imageUrl:"/u"},
  {id:"e",name:"烏龍麵（架上）",available:7,price:"139",imageUrl:"/u"},
];
const out = dedupeProductsByDisplayName(items);
assert.deepEqual(out.map(i=>[i.id,i.name,i.available]), [
  ["b","午仔魚",22],
  ["c","6兩烏魚子",12],
  ["d","烏龍麵",8],
]);
console.log("product-display ok");
