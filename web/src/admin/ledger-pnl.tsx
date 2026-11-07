import {useEffect,useState,type ReactNode} from "react";
import {ArrowDownRight,ArrowUpRight,Banknote,Bike,Building2,CalendarDays,ChartColumn,ChartPie,CircleDollarSign,Coins,Droplets,Fish,Flame,HandCoins,Hammer,Home,Landmark,Minus,Package,Percent,PiggyBank,Printer,Receipt,FileSpreadsheet,Scale,ShoppingCart,Store,StickyNote,TrendingDown,TrendingUp,Truck,Users,Wallet,Wifi,Wrench,Zap} from "lucide-react";
import {inventoryFetch} from "../lib/pages-api";
import {errorText} from "../lib/api-config";

async function api(path:string,body?:unknown){const r=await inventoryFetch("/api/ledger"+path,body===undefined?{}:{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});if(!r.ok)throw new Error(await errorText(r));return r.json()}
const money=(n:number)=>(n<0?"-":"")+Math.abs(Math.round(n)).toLocaleString("en-US");
const thisYm=()=>new Date(Date.now()+8*3600e3).toISOString().slice(0,7);
const pct=(a:number,b:number)=>b?Math.round(a/b*1000)/10:0;

/** 依項目名稱挑圖示（找不到就用收據） */
function iconFor(label:string){
 const rules:[RegExp,any][]=[[/UBER|外送/i,Bike],[/店面收入|銷貨收入|營業收入/,Store],[/固定收入|租金收入|樂/,HandCoins],[/薪資|員工/,Users],[/房租/,Home],[/網路|電話/,Wifi],[/電/,Zap],[/水費|自來水/,Droplets],[/瓦斯|燃料/,Flame],[/設備/,Wrench],[/裝潢/,Hammer],[/運費/,Truck],[/團購/,ShoppingCart],[/進貨|成本/,Fish],[/稅/,Landmark],[/店面支出|用品/,Package],[/股東|投資/,PiggyBank]];
 return rules.find(([re])=>re.test(label))?.[1]??Receipt;
}
function Delta({cur,prev,goodUp=true}:{cur:number;prev:number;goodUp?:boolean}){
 const d=cur-prev;if(!d)return <span className="pl-delta flat"><Minus size={14}/>持平</span>;
 const up=d>0,good=up===goodUp,p=prev?Math.abs(Math.round(d/Math.abs(prev)*1000)/10):null;
 return <span className={"pl-delta "+(good?"good":"bad")}>{up?<ArrowUpRight size={14}/>:<ArrowDownRight size={14}/>}{money(Math.abs(d))}{p!==null&&` (${p}%)`}</span>;
}
function Kpi({icon:I,tone,label,value,sub,children}:{icon:any;tone:string;label:string;value:string;sub?:ReactNode;children?:ReactNode}){
 return <div className={"pl-kpi "+tone}><div className="pl-kpi-ic"><I size={22}/></div><div className="pl-kpi-body"><span className="pl-kpi-l">{label}</span><b className="pl-kpi-v">{value}</b>{sub&&<span className="pl-kpi-s">{sub}</span>}{children}</div></div>;
}
/** 橫向比例條：每個收入／費用項目一條 */
function Breakdown({title,icon:I,tone,items,total}:{title:string;icon:any;tone:"inc"|"exp";items:[string,number][];total:number}){
 return <div className="admin-card pl-card"><h3 className="pl-h"><I size={18}/>{title}<span className="pl-h-r">{money(total)}</span></h3>
  {items.length===0?<p className="pl-empty">本月沒有資料</p>:<ul className="pl-break">{items.map(([k,v])=>{const Ic=iconFor(k),w=total?Math.max(2,Math.abs(v)/Math.abs(total)*100):0;
   return <li key={k}><span className={"pl-dot "+tone}><Ic size={15}/></span><span className="pl-bk">{k}</span><span className="pl-bv">{money(v)}<small>{pct(v,total)}%</small></span><span className="pl-track"><i className={tone} style={{width:w+"%"}}/></span></li>})}</ul>}
 </div>;
}
/** 近 12 個月：營業額／成本柱狀＋營餘折線（純 SVG） */
function Trend({months,ym}:{months:{ym:string;revenue:number;cogs:number;profit:number}[];ym:string}){
 const list:string[]=[];{let [y,m]=ym.split("-").map(Number);for(let i=0;i<12;i++){list.unshift(`${y}-${String(m).padStart(2,"0")}`);if(--m===0){m=12;y--}}}
 const data=list.map(k=>months.find(x=>x.ym===k)??{ym:k,revenue:0,cogs:0,profit:0});
 const max=Math.max(1,...data.flatMap(d=>[d.revenue,d.cogs,Math.abs(d.profit)])),min=Math.min(0,...data.map(d=>d.profit));
 const W=720,H=230,top=14,bot=34,left=8,ch=H-top-bot,span=max-min,y=(v:number)=>top+(max-v)/span*ch,bw=(W-left*2)/12;
 const pts=data.map((d,i)=>`${left+bw*i+bw/2},${y(d.profit)}`).join(" ");
 return <div className="admin-card pl-card pl-trend"><h3 className="pl-h"><ChartColumn size={18}/>近 12 個月趨勢
  <span className="pl-legend"><i className="inc"/>營業額<i className="cogs"/>銷貨成本<i className="line"/>營餘</span></h3>
  <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="近 12 個月營業額、成本與營餘">
   <line x1={left} x2={W-left} y1={y(0)} y2={y(0)} className="pl-axis"/>
   {data.map((d,i)=>{const x=left+bw*i;return <g key={d.ym} className={d.ym===ym?"cur":""}>
    {d.ym===ym&&<rect x={x+1} y={top-6} width={bw-2} height={ch+12} className="pl-hl" rx={6}/>}
    <rect x={x+bw*.16} y={y(d.revenue)} width={bw*.32} height={Math.max(0,y(0)-y(d.revenue))} className="pl-b-inc" rx={3}><title>{d.ym} 營業額 {money(d.revenue)}</title></rect>
    <rect x={x+bw*.52} y={y(d.cogs)} width={bw*.32} height={Math.max(0,y(0)-y(d.cogs))} className="pl-b-cogs" rx={3}><title>{d.ym} 銷貨成本 {money(d.cogs)}</title></rect>
    <text x={x+bw/2} y={H-12} className="pl-tick">{+d.ym.slice(5)}月</text></g>})}
   <polyline points={pts} className="pl-line"/>
   {data.map((d,i)=><circle key={d.ym} cx={left+bw*i+bw/2} cy={y(d.profit)} r={3.5} className={d.profit<0?"pl-pt neg":"pl-pt"}><title>{d.ym} 營餘 {money(d.profit)}</title></circle>)}
  </svg></div>;
}

/** 下載當月：摘要＋每日營業額（收銀機日結，含付款方式）＋收支紀錄，一個 xlsx 三個工作表 */
async function exportMonth(ym:string,r:any){
 const X=await import("xlsx");const last=new Date(+ym.slice(0,4),+ym.slice(5),0).getDate();
 const [pos,ent]=await Promise.all([api("/pos?ym="+ym),api("/entries?"+new URLSearchParams({from:`${ym}-01`,to:`${ym}-${String(last).padStart(2,"0")}`,limit:"5000"}))]);
 const W="日一二三四五六",R=(n:number)=>Math.round(n*100)/100;
 const posHead=["日期","星期","原銷售額","結帳折讓","現金","其他付款（刷卡／行動支付等）","消費人次","人均消費","營收金額","UBER","總計（營收＋UBER）","帳差（現金＋其他付款－營收）","資料來源"];
 const byDay=new Map(pos.rows.map((x:any)=>[x.sale_date,x]));const posRows:any[][]=[];const t={gross:0,discount:0,cash:0,other_pay:0,customers:0,revenue:0,uber:0};let days=0;
 for(let d=1;d<=last;d++){const ds=`${ym}-${String(d).padStart(2,"0")}`,w=W[new Date(+ym.slice(0,4),+ym.slice(5)-1,d).getDay()],x:any=byDay.get(ds);
  if(!x){posRows.push([ds,w,"","","","","","","","","","","無日結資料"]);continue}
  days++;for(const k of Object.keys(t))(t as any)[k]+=x[k]??0;
  posRows.push([ds,w,R(x.gross),R(x.discount),R(x.cash),R(x.other_pay),x.customers,x.customers?R(x.revenue/x.customers):"",R(x.revenue),R(x.uber),R(x.revenue+x.uber),R(x.cash+x.other_pay-x.revenue),x.source??""])}
 posRows.push(["合計",`${days} 天`,R(t.gross),R(t.discount),R(t.cash),R(t.other_pay),t.customers,t.customers?R(t.revenue/t.customers):"",R(t.revenue),R(t.uber),R(t.revenue+t.uber),R(t.cash+t.other_pay-t.revenue),""]);
 const entHead=["日期","收支","會計項目","內容","備註","數量","單價","稅金","金額","收入","支出","客戶/廠商","員工","付款方式","銀行","入帳日","記錄人","來源"];
 const es=[...ent.entries].sort((a:any,b:any)=>a.date<b.date?-1:a.date>b.date?1:0);
 const entRows=es.map((e:any)=>[e.date,e.kind,e.category,e.item,e.note,e.qty,e.unitPrice,e.tax||"",R(e.amount),e.signed>0?R(e.signed):"",e.signed<0?R(-e.signed):"",e.party,e.staff,e.payMethod,e.bank,e.postedDate,e.recorder,e.source]);
 entRows.push(["合計",`${es.length} 筆`,"","","","","","","",R(ent.total.income),R(-ent.total.expense),"","","","","","",""]);
 const c=r.current,[y,m]=ym.split("-"),nm=(k:string)=>k==="店面收入"?"銷貨收入":k;
 const sum:any[][]=[["安星水產 月報匯出"],[`民國${+y-1911}年${+m}月（${ym}-01 至 ${ym}-${last}）`],[`匯出時間：${new Date(Date.now()+8*3600e3).toISOString().slice(0,16).replace("T"," ")}（台北時間）`],[],
  ["損益摘要","金額"],...Object.entries(c.income).map(([k,v])=>[nm(k),v]),["收入合計",c.incomeTotal],["銷貨成本（進貨＋團購）",c.cogs],["銷售毛利",c.gross],...Object.entries(c.expense).map(([k,v])=>[k,v]),["費用合計",c.expenseTotal],...(c.capital?[["股東投資（不算營業額）",c.capital]]:[]),["本月營餘",c.profit],[],
  ["收銀機日結","金額"],["有日結的天數",days],["營收金額合計",R(t.revenue)],["現金合計",R(t.cash)],["其他付款合計",R(t.other_pay)],["UBER 合計",R(t.uber)],["消費人次合計",t.customers],[],
  ["收支紀錄","金額"],["筆數",ent.total.count],["收入合計",R(ent.total.income)],["支出合計",R(-ent.total.expense)],["淨額",R(ent.total.net)],[],
  ["說明：損益表的營業收入取自收支紀錄（店面收入／UBER收入），每日營業額工作表為收銀機日結，兩者可互相核對。"]];
 const wb=X.utils.book_new(),add=(name:string,aoa:any[][],cols:number[])=>{const ws=X.utils.aoa_to_sheet(aoa);ws["!cols"]=cols.map(w=>({wch:w}));X.utils.book_append_sheet(wb,ws,name)};
 add("摘要",sum,[30,16]);add("每日營業額",[posHead,...posRows],[12,6,11,10,11,16,9,9,11,10,14,16,10]);add("收支紀錄",[entHead,...entRows],[12,6,12,18,24,6,10,8,11,11,11,14,8,10,10,12,8,8]);
 X.writeFile(wb,`安星水產_${ym}_每日營業額與收支紀錄.xlsx`);
 return {days,entries:es.length};
}

const BAL_SECTIONS=["流動資產","非流動資產","負債","資本額","損益表備註"];
const BAL_ICON:Record<string,any>={流動資產:Wallet,非流動資產:Building2,負債:Scale,資本額:PiggyBank};

export function Pnl(){
 const [ym,setYm]=useState(thisYm()),[r,setR]=useState<any>(null),[trend,setTrend]=useState<any[]>([]),[msg,setMsg]=useState(""),[nb,setNb]=useState({section:"流動資產",label:"",amount:""});
 const load=()=>api("/report/pnl?ym="+ym).then(setR).catch(e=>setMsg(e.message));useEffect(()=>{load()},[ym]);
 useEffect(()=>{api("/report/yearly").then(d=>setTrend(d.months??[])).catch(()=>{})},[]);
 async function saveBal(rows:any[]){try{await api("/balance",{rows});setNb({...nb,label:"",amount:""});load()}catch(e:any){setMsg(e.message)}}
 if(!r)return msg?<p className="admin-msg">{msg}</p>:null;
 const c=r.current,p=r.previous,keys=(a:any,b:any)=>[...new Set([...Object.keys(a),...Object.keys(b)])];
 const [y,m]=ym.split("-");const nm=(k:string)=>k==="店面收入"?"銷貨收入":k;
 const margin=pct(c.gross,c.incomeTotal),pMargin=pct(p.gross,p.incomeTotal),netMargin=pct(c.profit,c.incomeTotal);
 const sortDesc=(o:any):[string,number][]=>Object.entries(o).map(([k,v])=>[nm(k),v as number] as [string,number]).filter(([,v])=>v).sort((a,b)=>b[1]-a[1]);
 const line=(l:string,a:number|undefined,b:number|undefined,cls="",goodUp=true,icon=true)=>{const I=iconFor(l);return <tr key={l} className={cls}><th>{icon&&<I size={15} className="pl-ri"/>}{l}</th><td>{money(a??0)}</td><td>{money(b??0)}</td><td><Delta cur={a??0} prev={b??0} goodUp={goodUp}/></td></tr>};
 const sec=(I:any,t:string,tone:string)=><tr className={"pl-sec "+tone}><th colSpan={4}><I size={16}/>{t}</th></tr>;
 const assets=(list:any[])=>list.filter((b:any)=>b.section.includes("資產")).reduce((s:number,b:any)=>s+b.amount,0);
 return <div className="pl">
  <div className="pl-top"><div><h2 className="pl-title"><ChartPie size={22}/>安星水產損益表</h2><span className="pl-period"><CalendarDays size={15}/>民國{+y-1911}年{+m}月1日至{+m}月{new Date(+y,+m,0).getDate()}日・與上月 {r.prevYm} 比較</span></div>
   <div className="pl-actions"><label className="pl-month"><CalendarDays size={16}/><input type="month" value={ym} onChange={e=>setYm(e.target.value)} aria-label="年月"/></label><button className="pl-print pl-dl" onClick={async()=>{setMsg("正在產生檔案…");try{const x=await exportMonth(ym,r);setMsg(`已下載：每日營業額 ${x.days} 天、收支紀錄 ${x.entries} 筆。`)}catch(e:any){setMsg("下載失敗："+e.message)}}}><FileSpreadsheet size={16}/>下載當月明細</button><button className="pl-print" onClick={()=>window.print()}><Printer size={16}/>列印</button></div></div>
  {msg&&<p className="admin-msg">{msg}</p>}
  <div className="pl-kpis">
   <Kpi icon={CircleDollarSign} tone="inc" label="營業收入" value={money(c.incomeTotal)} sub={<Delta cur={c.incomeTotal} prev={p.incomeTotal}/>}/>
   <Kpi icon={Fish} tone="cogs" label="銷貨成本" value={money(c.cogs)} sub={<Delta cur={c.cogs} prev={p.cogs} goodUp={false}/>}/>
   <Kpi icon={Coins} tone="gross" label="銷售毛利" value={money(c.gross)} sub={<span className="pl-chip"><Percent size={12}/>毛利率 {margin}%（上月 {pMargin}%）</span>}/>
   <Kpi icon={Receipt} tone="exp" label="營業費用" value={money(c.expenseTotal)} sub={<Delta cur={c.expenseTotal} prev={p.expenseTotal} goodUp={false}/>}/>
   <Kpi icon={c.profit>=0?TrendingUp:TrendingDown} tone={c.profit>=0?"profit":"loss"} label="本月營餘" value={money(c.profit)} sub={<><Delta cur={c.profit} prev={p.profit}/><span className="pl-chip"><Percent size={12}/>淨利率 {netMargin}%</span></>}/>
  </div>
  <Trend months={trend} ym={ym}/>
  <div className="pl-two">
   <Breakdown title="收入組成" icon={Banknote} tone="inc" items={sortDesc(c.income)} total={c.incomeTotal}/>
   <Breakdown title="費用組成" icon={Wallet} tone="exp" items={sortDesc(c.expense)} total={c.expenseTotal}/>
  </div>
  <div className="pnl-grid">
   <div className="admin-card pl-card"><h3 className="pl-h"><Receipt size={18}/>損益明細</h3>
    <table className="ledger-table num pnl pl-table" data-testid="pnl"><thead><tr><th></th><th>本月</th><th>上月</th><th>增減</th></tr></thead><tbody>
     {sec(TrendingUp,"營業收入","inc")}{keys(c.income,p.income).map(k=>line(nm(k),c.income[k],p.income[k]))}{line("收入合計",c.incomeTotal,p.incomeTotal,"sum",true,false)}
     {sec(Fish,"營業成本","cogs")}{line("銷貨成本（進貨＋團購）",c.cogs,p.cogs,"",false)}{line("銷售毛利",c.gross,p.gross,"sum",true,false)}
     {sec(TrendingDown,"營業費用","exp")}{keys(c.expense,p.expense).map(k=>line(k,c.expense[k],p.expense[k],"",false))}{line("費用合計",c.expenseTotal,p.expenseTotal,"sum",false,false)}
     {(c.capital||p.capital)?line("股東投資（不算營業額）",c.capital,p.capital):null}
     <tr className={"profit "+(c.profit<0?"loss":"")}><th>{c.profit>=0?<TrendingUp size={16} className="pl-ri"/>:<TrendingDown size={16} className="pl-ri"/>}本月營餘</th><td>{money(c.profit)}</td><td>{money(p.profit)}</td><td><Delta cur={c.profit} prev={p.profit}/></td></tr>
     {r.balance.filter((b:any)=>b.section==="損益表備註").map((b:any)=><tr key={b.label} className="memo"><th><StickyNote size={14} className="pl-ri"/>備註：{b.label}</th><td>{money(b.amount)}</td><td colSpan={2}></td></tr>)}
    </tbody></table></div>
   <div className="admin-card pl-card"><h3 className="pl-h"><Scale size={18}/>資產負債表（手動輸入）</h3>
    <table className="ledger-table num pl-table"><thead><tr><th></th><th>本月</th><th>上月</th><th></th></tr></thead><tbody>
     {BAL_SECTIONS.filter(s=>s!=="損益表備註").map(s=>{const rows=r.balance.filter((b:any)=>b.section===s),prev=r.balancePrev.filter((b:any)=>b.section===s);const labels=[...new Set([...rows,...prev].map((b:any)=>b.label))];const SI=BAL_ICON[s]??Landmark;
      return [<tr key={s} className="pl-sec bal"><th colSpan={4}><SI size={16}/>{s}</th></tr>,...labels.map(l=>{const cur=rows.find((b:any)=>b.label===l);return <tr key={s+l}><th>{l}</th><td><input className="cell" defaultValue={cur?.amount??""} aria-label={`${l} 本月`} onBlur={e=>{if(e.target.value!==String(cur?.amount??""))saveBal([{ym,section:s,label:l,amount:e.target.value||0}])}}/></td><td>{money(prev.find((b:any)=>b.label===l)?.amount??0)}</td><td>{cur&&<button onClick={()=>saveBal([{ym,section:s,label:l,delete:true}])}>刪</button>}</td></tr>})]})}
     <tr className="sum"><th><Landmark size={15} className="pl-ri"/>總資產</th><td>{money(assets(r.balance))}</td><td>{money(assets(r.balancePrev))}</td><td></td></tr>
    </tbody></table>
    <div className="admin-filter pl-noprint"><select value={nb.section} onChange={e=>setNb({...nb,section:e.target.value})} aria-label="區塊">{BAL_SECTIONS.map(s=><option key={s}>{s}</option>)}</select><input placeholder="項目（例：庫存現金(店內)）" value={nb.label} onChange={e=>setNb({...nb,label:e.target.value})} aria-label="項目"/><input placeholder="金額" inputMode="decimal" value={nb.amount} onChange={e=>setNb({...nb,amount:e.target.value})} aria-label="金額"/>
     <button onClick={()=>nb.label&&saveBal([{ym,...nb,amount:nb.amount||0}])}>新增</button>
     {r.balancePrev.length>0&&<button onClick={()=>saveBal(r.balancePrev.filter((b:any)=>!r.balance.some((x:any)=>x.section===b.section&&x.label===b.label)).map((b:any)=>({ym,section:b.section,label:b.label,amount:b.amount,sort:b.sort})))}>沿用上月數字</button>}</div>
   </div></div>
 </div>;
}
