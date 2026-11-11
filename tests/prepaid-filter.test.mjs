// 團購對帳客戶端查詢：用虛構測試資料，不含真實客戶暱稱
import assert from "node:assert/strict";
import {PENDING,ST_ARRIVED,ST_UNCHECKED,emptyFilters,filterPrepaid,isFiltering,matchesPrepaid} from "../web/src/lib/prepaid-filter.ts";

const row=(p)=>({seq:1,item:"測試蘋果派",amount:-100,checked:"",status:"未到貨",entry_date:"2026-11-04",...p});
const rows=[
 row({seq:10,item:"測試蘋果派",amount:-250,status:"未到貨",checked:"",entry_date:"2026-11-04"}),
 row({seq:11,item:"測試羊肉爐",amount:-7395,status:"未到貨",checked:"",entry_date:"2026-10-30"}),
 row({seq:12,item:"測試羊肉爐",amount:-3315,status:"未到貨",checked:"○",entry_date:"2026-10-09"}),
 row({seq:13,item:"HERSHEY Sample Cone",amount:-80,status:"流團",checked:"○",entry_date:"2026-10-15"}),
 row({seq:14,item:"測試匯款",amount:5000,status:"已匯款",checked:"",entry_date:"2026-11-01",note:"測試備註ABC"}),
 row({seq:15,item:"中港取測試麵包",amount:-390,status:"中港取",checked:"",entry_date:"2026-09-23"}),
 row({seq:16,item:"舊資料無日期",amount:-10,status:"已入庫",checked:"○",entry_date:""}),
];
const f=(p)=>({...emptyFilters(),...p});
const results=[];
async function t(n,fn){try{await fn();results.push(["✅",n])}catch(e){results.push(["❌",n+"："+e.message])}}

await t("未篩選時回傳全部列，合計等於全部加總",()=>{
 const r=filterPrepaid(rows,emptyFilters());
 assert.equal(r.count,7);
 assert.equal(r.amount,rows.reduce((s,x)=>s+x.amount,0));
 assert.equal(isFiltering(emptyFilters()),false);
});
await t("品名部分比對且不分大小寫",()=>{
 const r=filterPrepaid(rows,f({q:"hershey sample"}));
 assert.equal(r.count,1);
 assert.equal(r.rows[0].item,"HERSHEY Sample Cone");
 assert.equal(r.amount,-80);
});
await t("也可比對編號與備註",()=>{
 assert.equal(filterPrepaid(rows,f({q:"14"})).count,1);
 assert.equal(filterPrepaid(rows,f({q:"測試備註abc"})).rows[0].seq,14);
});
await t("未到貨未勾不含已勾到貨正確",()=>{
 const r=filterPrepaid(rows,f({st:ST_UNCHECKED}));
 assert.deepEqual(r.rows.map(x=>x.item),["測試蘋果派","測試羊肉爐"]);
 assert.equal(r.count,2);
 assert.equal(r.amount,-250-7395);
});
await t("已到貨只含已勾到貨正確",()=>{
 const r=filterPrepaid(rows,f({st:ST_ARRIVED}));
 assert.equal(r.count,3);
 assert.ok(r.rows.every(x=>x.checked==="○"));
});
await t("既有狀態（流團、中港取）仍可篩",()=>{
 assert.equal(filterPrepaid(rows,f({st:"流團"})).count,1);
 assert.equal(filterPrepaid(rows,f({st:"中港取"})).rows[0].item,"中港取測試麵包");
});
await t("日期區間不含沒有日期的舊資料",()=>{
 const r=filterPrepaid(rows,f({from:"2026-10-01",to:"2026-10-31"}));
 assert.deepEqual(r.rows.map(x=>x.item).sort(),["HERSHEY Sample Cone","測試羊肉爐","測試羊肉爐"]);
 assert.ok(!r.rows.some(x=>!x.entry_date));
});
await t("正負方向依金額",()=>{
 assert.equal(filterPrepaid(rows,f({dir:"plus"})).count,1);
 assert.equal(filterPrepaid(rows,f({dir:"minus"})).count,6);
});
await t("多條件同時成立，篩選合計獨立計算",()=>{
 const r=filterPrepaid(rows,f({q:"羊肉",from:"2026-10-01",to:"2026-10-31",st:ST_UNCHECKED,dir:"minus"}));
 assert.equal(r.count,1);
 assert.equal(r.rows[0].entry_date,"2026-10-30");
 assert.equal(r.amount,-7395);
 assert.equal(isFiltering(f({q:"羊肉"})),true);
});
await t("PENDING 常數為未到貨",()=>{
 assert.equal(PENDING,"未到貨");
 assert.equal(matchesPrepaid(rows[0],f({st:ST_UNCHECKED})),true);
});

for(const [s,n] of results)console.log(s,n);
if(results.some(r=>r[0]==="❌"))process.exit(1);
