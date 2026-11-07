import {useEffect,useState,type ReactNode} from "react";
import {ArrowDownRight,ArrowUpRight,Banknote,Bike,Building2,CalendarDays,ChartColumn,ChartPie,CircleDollarSign,Coins,Droplets,Fish,Flame,HandCoins,Hammer,Home,Landmark,Minus,Package,Percent,PiggyBank,Printer,Receipt,Scale,ShoppingCart,Store,StickyNote,TrendingDown,TrendingUp,Truck,Users,Wallet,Wifi,Wrench,Zap} from "lucide-react";
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
   <div className="pl-actions"><label className="pl-month"><CalendarDays size={16}/><input type="month" value={ym} onChange={e=>setYm(e.target.value)} aria-label="年月"/></label><button className="pl-print" onClick={()=>window.print()}><Printer size={16}/>列印</button></div></div>
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
