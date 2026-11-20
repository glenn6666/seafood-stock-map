import {useEffect,useRef,useState} from 'react';
import {createRoot} from 'react-dom/client';
import '../customer/customer.css';
import '../customer/comic.css';
import Dine from '../dine/main';
import {DINE_STORE} from '../lib/dine-menu';
import {LINE_OA_PAGE} from '../dine/line-order';
import {loadApiOrigin} from '../lib/api-config';
import {groupOf} from '../customer/shop-groups';
import {productImageSrc} from '../lib/product-photos';
import {dedupeProductsByDisplayName} from '../lib/product-display';
import './portal.css';

const ARCADE_URL='https://anxing-seafood-arcade.lisa50921.chatgpt.site/';
const tabs=[['lookup','團購到貨查詢'],['stock','團購現貨'],['frozen','冷凍現貨'],['menu','線上點餐與菜單'],['game','小遊戲']] as const;
type Tab=typeof tabs[number][0];
const current=():Tab=>location.hash.startsWith('#/o/')?'menu':tabs.find(t=>'#'+t[0]===location.hash)?.[0]??'lookup';
const base=import.meta.env.BASE_URL;
function App(){
 const [active,setActive]=useState<Tab>(current),[visited,setVisited]=useState<Set<Tab>>(()=>new Set([current()]));
 const [origin,setOrigin]=useState(''),[error,setError]=useState('');
 useEffect(()=>{loadApiOrigin().then(setOrigin).catch(e=>setError(e.message));const change=()=>{const t=current();setActive(t);setVisited(v=>new Set([...v,t]))};addEventListener('hashchange',change);return()=>removeEventListener('hashchange',change)},[]);
 return <div className="portal">
  <header className="portal-head"><div className="portal-head-inner">
   <a href="#lookup" className="portal-brand"><img src={base+'dine/logo.webp'} alt="安星水產"/><span><strong>{DINE_STORE.branch}</strong><small>ANXING · SEAFOOD</small></span></a>
   <details className="portal-store"><summary>門市資訊 <span>營業時間・地址・電話</span></summary><div><p>{DINE_STORE.hoursText}</p><p>{DINE_STORE.address}</p><a href={'tel:'+DINE_STORE.phone}>{DINE_STORE.phone}</a></div></details>
  </div></header>
  <nav className="portal-nav" aria-label="五大分類">{tabs.map(([id,label])=><a key={id} href={id==='game'?ARCADE_URL:'#'+id} target={id==='game'?'_blank':undefined} rel={id==='game'?'noopener noreferrer':undefined} aria-label={id==='game'?'小遊戲（共用快手捕撈王，另開分頁）':undefined} aria-current={active===id?'page':undefined}>{label}</a>)}</nav>
  <div className="portal-body"><aside className="portal-notice"><b>♧ 店家公告</b><span>歡迎使用安星水產泰山店線上服務。</span></aside>
   <a className="portal-line" href={LINE_OA_PAGE} target="_blank" rel="noopener noreferrer"><b>LINE</b><span><strong>官方 LINE 客服</strong><small>商品問題、訂購與配送資訊 ↗</small></span></a>
   {visited.has('lookup')&&<section hidden={active!=='lookup'} className="portal-card"><p className="portal-eyebrow">YOUR GROUP-BUY ORDERS</p><h1>您的到貨查詢</h1><p className="portal-desc">輸入團購暱稱或部分文字，選擇自己的名字後查看到貨明細。</p><GroupFrame mode="lookup" active={active==='lookup'}/><div className="portal-guide"><h2>取貨這樣做</h2><p><b>01　確認商品狀態</b><br/>先查看已到貨與未到貨明細。</p><p><b>02　到店核對取貨</b><br/>向現場工作人員報團購暱稱，核對品項與金額後取貨。</p></div></section>}
   {visited.has('stock')&&<section hidden={active!=='stock'} className="portal-card"><p className="portal-eyebrow">READY TO TAKE HOME</p><h1>團購現貨</h1><p className="portal-desc">團購好康免等待。需要商品請先聯繫小編確認並登記，再到店取貨。</p><GroupFrame mode="stock" active={active==='stock'}/></section>}
   {visited.has('frozen')&&<section hidden={active!=='frozen'} className="portal-card"><p className="portal-eyebrow">ANXING · FROZEN SELECTION</p><h1>冷凍現貨</h1><p className="portal-desc">店內冷藏・冷凍食材一覽。顯示目前開放訂購品項，供應情況以店家確認為準。</p>{origin?<Frozen origin={origin}/>:<p role="status">{error||'正在讀取商品…'}</p>}</section>}
   {visited.has('menu')&&<section hidden={active!=='menu'} className="portal-menu" aria-label="線上點餐與菜單"><Dine/></section>}
   {visited.has('game')&&<section hidden={active!=='game'} className="portal-card portal-game"><p className="portal-eyebrow">ANXING · CATCH & PLAY</p><div className="portal-game-art" aria-hidden>🦀</div><h1>快手捕撈王</h1><p>小網子準備好，海鮮好友來報到！</p><p className="portal-desc">和中港店一起挑戰，同一個遊戲、同一份排行榜。</p><a className="portal-game-launch" href={ARCADE_URL} target="_blank" rel="noopener noreferrer">前往快手捕撈王 ↗</a></section>}
  </div>
  <footer className="portal-footer">© {new Date().getFullYear()} 安星水產泰山旗艦店 · 每一份鮮，安心交給我們。<a href={base+'index.html'}>店家管理 ↗</a></footer>
 </div>;
}
function GroupFrame({mode,active}:{mode:'lookup'|'stock';active:boolean}){
 const ref=useRef<HTMLIFrameElement>(null);
 const [height,setHeight]=useState(420);
 useEffect(()=>{if(!active)return;let observer:ResizeObserver|undefined;
 const attach=()=>{observer?.disconnect();const body=ref.current?.contentDocument?.body;if(!body)return;const resize=()=>setHeight(Math.max(240,body.scrollHeight+32));resize();observer=new ResizeObserver(resize);observer.observe(body)};
 const frame=ref.current;frame?.addEventListener('load',attach);attach();return()=>{observer?.disconnect();frame?.removeEventListener('load',attach)}},[active]);
 return <iframe ref={ref} className="portal-group" title={mode==='lookup'?'團購到貨查詢':'團購現貨商品'} src={base+'group-buy.html?mode='+mode} style={{height}}/>;
}
type Item={id:string;name:string;spec:string;unit:string;category:string;price:string;available:number;displayUnit:{id:string;type:string;kind?:string}|null;imageUrl?:string};
function Frozen({origin}:{origin:string}){
 const [items,setItems]=useState<Item[]>([]),[status,setStatus]=useState('loading'),[query,setQuery]=useState(''),[category,setCategory]=useState('全部'),[updated,setUpdated]=useState('');
 async function load(){setStatus('loading');try{const r=await fetch(origin+'/api/public/menu',{cache:'no-store',credentials:'omit'});if(!r.ok)throw Error();const d=await r.json();setItems(dedupeProductsByDisplayName(d.items.filter((i:Item)=>groupOf(i)==='chilled')));setUpdated(new Date().toLocaleString('zh-TW',{timeZone:'Asia/Taipei'}));setStatus('ready')}catch{setStatus('error')}}
 useEffect(()=>{load()},[origin]);
 const categories=['全部',...new Set(items.map(i=>i.category))],shown=items.filter(i=>(category==='全部'||i.category===category)&&(!query||[i.name,i.spec,i.category].join(' ').includes(query.trim())));
 return <><div className="portal-stock-tools"><label>搜尋商品<input type="search" value={query} onChange={e=>setQuery(e.target.value)} placeholder="搜尋品名、規格…"/></label><button disabled={status==='loading'} onClick={load}>重新整理</button></div>
 <div className="portal-filters" aria-label="商品分類">{categories.map(c=><button key={c} aria-pressed={category===c} onClick={()=>setCategory(c)}>{c}</button>)}</div>
 {status==='loading'?<p role="status">正在更新商品…</p>:status==='error'?<p role="alert">目前無法讀取商品，請按「重新整理」再試一次，或聯繫 LINE 客服。</p>:<><p className="portal-count">{shown.length} 項商品 <small>更新時間：{updated}</small></p>
 <div className="portal-products">{shown.map(i=><article key={i.id} className="has-photo">{productImageSrc(i.imageUrl,origin)?<a className="portal-product-photo" href={productImageSrc(i.imageUrl,origin)} target="_blank" rel="noopener noreferrer" aria-label={i.name+" 看大圖"}><img src={productImageSrc(i.imageUrl,origin)} alt={i.name} loading="lazy" decoding="async"/></a>:<div className="portal-product-photo empty" aria-hidden><span>🧊</span><small>照片準備中</small></div>}<div className="portal-product-top"><span>{i.category}</span><small>{i.available>0?'可訂購':'暫時售完'}</small></div><h2>{i.name}</h2><p>{i.spec||'規格請洽店員'}</p><strong>NT$ {i.price||'洽詢'} <small>／{i.unit}</small></strong><a href={LINE_OA_PAGE} target="_blank" rel="noopener noreferrer">詢問商品 ↗</a></article>)}</div>{!shown.length&&<p className="portal-empty">{items.length?'沒有符合條件的商品，請換個關鍵字。':'目前沒有上架的冷藏・冷凍商品，歡迎洽詢小編。'}</p>}<a className="portal-original" href={base+'order.html'}>前往海鮮購物下單 →</a></>}
 </>;
}
createRoot(document.getElementById('root')!).render(<App/>);
