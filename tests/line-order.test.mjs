// node --experimental-strip-types --import ./tests/ts-ext-loader.mjs tests/line-order.test.mjs
import assert from "node:assert/strict";
import {buildLineOrderShare, lineOaMessageUrl, LINE_OA_ID, LINE_URL_PREFIX, MAX_LINE_URL_LENGTH} from "../web/src/dine/line-order.ts";

const sample = {
  orderNo: "20261116-DEMO1",
  customerName: "測試客人",
  phone: "0900000000",
  pickupAt: "2026-11-17T18:00",
  note: "不要香菜，謝謝",
  total: 880,
  items: [
    {name: "清蒸活體大紅蟳", spec: "活體皆為時價", qty: 1, unit: "隻", unitPrice: 0, market: true},
    {name: "胡椒泰國蝦", spec: "料理費用", qty: 2, unit: "份", unitPrice: 300, market: false},
    {name: "豪華螃蟹海鮮粥", qty: 1, unit: "份", unitPrice: 280, market: false},
  ],
};

const lookup = "https://glenn6666.github.io/seafood-stock-map/dine.html#/o/demo-lookup-token-xxxx";
const share = buildLineOrderShare(sample, lookup);

assert.equal(share.trimmed, false);
assert.match(share.text, /訂單編號：20261116-DEMO1/);
assert.match(share.text, /姓名：測試客人/);
assert.match(share.text, /電話：0900000000/);
assert.match(share.text, /取餐時間：11\/17 18:00/);
assert.match(share.text, /清蒸活體大紅蟳/);
assert.match(share.text, /時價/);
assert.match(share.text, /胡椒泰國蝦　料理費用 × 2 份　\$600/);
assert.match(share.text, /豪華螃蟹海鮮粥 × 1 份　\$280/);
assert.match(share.text, /合計 \$880＋時價/);
assert.match(share.text, /備註：不要香菜，謝謝/);
assert.match(share.text, /麻煩店家確認餐點與取餐時間，謝謝！/);
assert.equal(share.url, LINE_URL_PREFIX + encodeURIComponent(share.text));
assert.ok(share.url.startsWith(`https://line.me/R/oaMessage/${encodeURIComponent(LINE_OA_ID)}/?`));
assert.ok(share.url.length <= MAX_LINE_URL_LENGTH);
assert.doesNotMatch(share.text, /demo-lookup-token/);

const longItems = Array.from({length: 40}, (_, i) => ({
  name: `很長的測試餐點名稱用來撐長網址${i}`.repeat(4),
  spec: "附餐說明與備註寫得很長好讓編碼後超過上限",
  qty: 3,
  unit: "份",
  unitPrice: 1234,
  market: false,
}));
const trimmed = buildLineOrderShare({...sample, items: longItems, total: 99999, note: "x".repeat(300)}, lookup);
assert.equal(trimmed.trimmed, true);
assert.ok(trimmed.url.length <= MAX_LINE_URL_LENGTH, trimmed.url.length);
assert.match(trimmed.text, /20261116-DEMO1/);
assert.match(trimmed.text, /查詢連結：/);

const noPhone = buildLineOrderShare({orderNo: "20261116-DEMO2", total: 100, items: [{name: "烤魚", qty: 1, unit: "份", unitPrice: 100}]}, lookup);
assert.doesNotMatch(noPhone.text, /電話：/);
assert.doesNotMatch(noPhone.text, /備註：/);
assert.match(noPhone.text, /合計 \$100$/m);
assert.equal(noPhone.trimmed, false);

console.log("line-order tests ok");
console.log("--- sample text ---");
console.log(share.text);
console.log("--- url length ---", share.url.length);
