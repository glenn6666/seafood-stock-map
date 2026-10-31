// 記帳共用：前端（匯入解析）與 Worker（去重鍵）共用。不含任何機密。
export const LEDGER_COLS=["項次","收支(每日)","日期","收支","會計項目","內容","備註 ","數量","單價","員工姓名","小計","稅金","總計","金額計算","客戶/廠商","記錄人","公司名稱","聯絡人","統編","付款方式","郵局/銀行","年月 ","年月日 ","入帳日","金流備註","年月","收支","員工薪資"];
export type EntryIn={date:string;rawDate?:string;kind:string;category:string;item:string;note?:string;qty:number;unitPrice:number;tax?:number;amount?:number;signed?:number;staff?:string;party?:string;recorder?:string;company?:string;contact?:string;taxId?:string;payMethod?:string;bank?:string;postedDate?:string;cashNote?:string;occ?:number};
const r2=(n:number)=>Math.round((Number(n)||0)*100)/100;
// 去重鍵：不含備註，避免試算表改備註後被當成新資料；同鍵多筆以出現次數（occ）區分。
export const entryKey=(e:{date:string;category:string;item:string;qty:number;unitPrice:number;party?:string;staff?:string})=>[e.date,e.category.trim(),(e.item??"").trim(),r2(e.qty),r2(e.unitPrice),(e.party??"").trim(),(e.staff??"").trim()].join("|");
export const s=(v:unknown)=>v===null||v===undefined?"":String(v).trim();
export const num=(v:unknown)=>{if(typeof v==="number")return Number.isFinite(v)?v:0;const n=parseFloat(s(v).replace(/[,\s$元]/g,"").replace(/^NT/,""));return Number.isFinite(n)?n:0};
const pad=(n:number)=>String(n).padStart(2,"0");
/** 各種日期 → YYYY-MM-DD：Excel 序號、Date、2024/01/27、20240127、民國 0113/04/26 或 113/4/26 */
export function toDate(v:unknown):string{
 if(v instanceof Date&&!isNaN(+v))return `${v.getFullYear()}-${pad(v.getMonth()+1)}-${pad(v.getDate())}`;
 if(typeof v==="number"&&v>20000&&v<80000){const d=new Date(Math.round((v-25569)*864e5));return d.toISOString().slice(0,10)}
 const t=s(v).replace(/\.0$/,"");let m=t.match(/^(\d{8})$/);if(m)return `${t.slice(0,4)}-${t.slice(4,6)}-${t.slice(6,8)}`;
 m=t.match(/^(\d{1,4})[\/\-.年](\d{1,2})[\/\-.月](\d{1,2})/);if(m){let y=+m[1];if(y<1911)y+=1911;return `${y}-${pad(+m[2])}-${pad(+m[3])}`}
 return "";
}
/** 「115年9月」「2026年09月」「2026/09」→ 2026-09 */
export function toYm(v:unknown):string{
 if(v instanceof Date)return toDate(v).slice(0,7);
 const m=s(v).match(/^(\d{2,4})\s*[年\/\-.]\s*(\d{1,2})/);if(!m)return "";let y=+m[1];if(y<1911)y+=1911;return `${y}-${pad(+m[2])}`;
}
export type Workbook=Record<string,unknown[][]>;
export type Parsed={entries:EntryIn[];categories:{category:string;item:string;kind:string;sort:number}[];contacts:any[];employees:any[];payroll:any[];pos:any[];prepaid:{account:string;rows:any[]};options:{kind:string;value:string;sort:number}[];sheetMonthly:Record<string,Record<string,number>>;warnings:string[]};
const find=(wb:Workbook,name:string)=>{const k=Object.keys(wb).find(k=>k.trim()===name);return k?wb[k]:undefined};
/** 解析安星水產記帳試算表（xlsx 匯出，取各格的計算結果） */
export function parseLedgerWorkbook(wb:Workbook):Parsed{
 const w:string[]=[];const out:Parsed={entries:[],categories:[],contacts:[],employees:[],payroll:[],pos:[],prepaid:{account:"龍龍",rows:[]},options:[],sheetMonthly:{},warnings:w};
 const cat=find(wb,"分類表");const kindOf=new Map<string,string>();
 if(cat){cat.slice(2).forEach((r,i)=>{const c=s(r[9]),it=s(r[10]),k=s(r[11]);if(c&&(k==="收入"||k==="支出")){out.categories.push({category:c,item:it,kind:k,sort:i});kindOf.set(c,k)}});
  const opt=(col:number,kind:string)=>cat.slice(2).forEach((r,i)=>{const v=s(r[col]);if(v)out.options.push({kind,value:v,sort:i})});
  opt(1,"bank");opt(2,"receipt");opt(3,"bankType");opt(13,"pay");opt(0,"user")}
 else w.push("找不到「分類表」");
 const d=find(wb,"每日收支紀錄");const occ=new Map<string,number>();
 if(d){for(const r of d.slice(2)){const b=s(r[1]);if(!b)continue;
   const sp=b.indexOf(" ");const category=s(r[4])||(sp<0?b:b.slice(0,sp)).trim();const item=s(r[5])||(sp<0?"":b.slice(sp+1)).trim();
   const date=toDate(r[22])||toDate(r[2]);if(!date){w.push(`日期無法判讀：${s(r[2])} ${b}`);continue}
   const qty=num(r[7]),unitPrice=num(r[8]);const amount=num(r[12])||qty*unitPrice;const kind=s(r[26])||kindOf.get(category)||"支出";
   const signed=r[13]!==undefined&&r[13]!==null&&s(r[13])!==""?num(r[13]):(kind==="收入"?amount:-amount);
   const e:EntryIn={date,rawDate:s(r[2]).replace(/\.0$/,""),kind,category,item,note:s(r[6]),qty,unitPrice,tax:num(r[11]),amount,signed,staff:s(r[9]),party:s(r[14]),recorder:s(r[15]),company:s(r[16]),contact:s(r[17]),taxId:s(r[18]),payMethod:s(r[19]),bank:s(r[20]),postedDate:toDate(r[23]),cashNote:s(r[24])};
   const k=entryKey({date,category,item,qty,unitPrice,party:e.party,staff:e.staff});const n=(occ.get(k)??0)+1;occ.set(k,n);e.occ=n;out.entries.push(e)}}
 else w.push("找不到「每日收支紀錄」");
 const c=find(wb,"客戶廠商資料");if(c)for(const r of c.slice(3)){const n=s(r[1]);if(n&&n!=="客戶/廠商")out.contacts.push({name:n,company:s(r[2]),contact:s(r[3]),taxId:s(r[4]),phone:s(r[5]),address:s(r[6]),note:s(r[7])})}
 const em=find(wb,"員工資料庫");if(em)for(const r of em.slice(1)){const n=s(r[2]);const o=(i:number)=>s(r[i])===""?null:num(r[i]);if(n&&n!=="員工姓名")out.employees.push({name:n,title:s(r[3]),dailyWage:o(4),hourlyWage:o(5),monthlyWage:o(6)})}
 const p=find(wb,"員工薪資紀錄");if(p)for(const r of p.slice(5)){const n=s(r[1]),ym=toYm(r[2]);if(!n||!ym)continue;
  out.payroll.push({name:n,ym,base:num(r[3]),overtime:num(r[4]),bonus:num(r[5]),yearEnd:num(r[6]),late:num(r[7]),leave:num(r[8]),laborIns:num(r[9]),healthIns:num(r[10]),pension:num(r[11]),netPay:num(r[12])})}
 const pos=find(wb,"2026每日營業額")??Object.entries(wb).find(([k])=>k.includes("每日營業額"))?.[1];
 if(pos)out.pos=parsePosRows(pos).rows;
 const l=find(wb,"龍龍團購對帳");if(l)l.slice(1).forEach((r,i)=>{const it=s(r[1]);if(!it&&!num(r[4]))return;out.prepaid.rows.push({seq:i+1,item:it,unitPrice:num(r[2]),qty:num(r[3])||1,amount:num(r[4])||num(r[2])*(num(r[3])||1),checked:s(r[7]),status:s(r[8])})});
 const m=find(wb,"整合月報總表");if(m){const year=num(m[1]?.[3]);for(const r of m.slice(9)){const k=s(r[1]);if(!k||k==="目錄"||k==="會計項目")continue;out.sheetMonthly[k]={};for(let i=0;i<12;i++)out.sheetMonthly[k][`${year}-${pad(i+1)}`]=num(r[2+i])}
  out.sheetMonthly["營利"]={};for(let i=0;i<12;i++)out.sheetMonthly["營利"][`${year}-${pad(i+1)}`]=num(m[3]?.[2+i])}
 return out;
}
/** 收銀機日結：依表頭自動對應欄位（可用在試算表分頁或收銀機匯出的 csv／xlsx） */
export const POS_FIELDS:[string,string,RegExp][]=[["date","日期",/期間|日期|營業日|date/i],["gross","原銷售額",/原銷售|銷售總額|總銷售|gross/i],["discount","結帳折讓",/折讓|折扣|discount/i],["cash","現金",/^現金|cash/i],["otherPay","其他付款",/其他付款|刷卡|信用卡|行動支付|other/i],["customers","消費人次",/人次|來客|客數|筆數|customers?/i],["revenue","營收金額",/營收|實收|淨額|net|revenue/i],["uber","UBER",/uber/i]];
export function parsePosRows(rows:unknown[][],mapping?:Record<string,number>){
 const hi=mapping?-1:rows.findIndex(r=>r.some(c=>/期間|日期|營業日|date/i.test(s(c))));
 const head=hi>=0?rows[hi].map(s):[];const map:Record<string,number>=mapping??{};
 if(!mapping)for(const [k,,re] of POS_FIELDS){const i=head.findIndex(h=>re.test(h));if(i>=0)map[k]=i}
 const out:any[]=[];
 for(const r of rows.slice(hi+1)){const date=toDate(r[map.date]);if(!date)continue;const v=(k:string)=>map[k]===undefined?0:num(r[map[k]]);
  const row={date,gross:v("gross"),discount:v("discount"),cash:v("cash"),otherPay:v("otherPay"),customers:Math.round(v("customers")),revenue:v("revenue")||(v("gross")-v("discount")),uber:v("uber")};
  if(!row.gross&&!row.revenue&&!row.cash&&!row.uber&&!row.customers)continue;out.push(row)}
 return {header:head,mapping:map,rows:out};
}
/** SheetJS 活頁簿 → 各分頁二維陣列（一律從 A1 起算，欄位索引與試算表欄位一致） */
export function sheetsFromXlsx(X:any,wb:any):Workbook{
 const o:Workbook={};
 for(const n of wb.SheetNames){const ws=wb.Sheets[n];if(!ws["!ref"]){o[n]=[];continue}const r=X.utils.decode_range(ws["!ref"]);r.s.c=0;r.s.r=0;ws["!ref"]=X.utils.encode_range(r);
  o[n]=X.utils.sheet_to_json(ws,{header:1,raw:true,defval:null,blankrows:true})}
 return o;
}
