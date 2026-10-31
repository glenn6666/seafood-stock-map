import {useState} from "react";
import {createRoot} from "react-dom/client";
import Home from "./app/page";
import {connectInventory,disconnectInventory,inventoryFetch,setToken} from "./lib/pages-api";
import {loadApiOrigin,errorText} from "./lib/api-config";
import Orders from "./admin/orders";
import Products from "./admin/products";
import Users from "./admin/users";
import Bookkeeping from "./admin/bookkeeping";
import Ledger from "./admin/ledger";
import Bootstrap from "./admin/bootstrap";
import "./app/globals.css";
import "./signin.css";
import "./admin/admin.css";
export type Me={role:"admin"|"staff";legacy:boolean;username:string|null;needsBootstrap?:boolean};
type Tab="map"|"orders"|"products"|"users"|"books"|"ledger";
function App(){
 const [me,setMe]=useState<Me|null>(null),[username,setUsername]=useState(""),[key,setKey]=useState(""),[error,setError]=useState(""),[busy,setBusy]=useState(false),[tab,setTab]=useState<Tab>("map");
 async function login(e:React.FormEvent){
  e.preventDefault();setBusy(true);setError("");
  try{
   const origin=await loadApiOrigin();
   if(username.trim()){
    connectInventory(origin,"pending");
    const r=await fetch(origin+"/api/auth/login",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({username:username.trim(),password:key}),credentials:"omit",cache:"no-store"});
    if(!r.ok)throw new Error(r.status===401?"帳號或密碼不正確。":await errorText(r,"登入失敗，請稍後再試。"));
    setToken((await r.json()).token);
   }else connectInventory(origin,key); // 舊版共用管理密碼（僅在尚未建立帳號前有效）
   const res=await inventoryFetch("/api/me");
   if(res.status===401)throw new Error(username.trim()?"登入已失效，請重新登入。":"管理密碼不正確，或原管理密碼已停用（請輸入帳號登入）。");
   if(!res.ok)throw new Error("庫存後端尚未就緒，請稍後再試。");
   setKey("");setMe(await res.json());setTab("map");
  }catch(e){disconnectInventory();setError(e instanceof Error?e.message:"無法連線，請稍後再試。");}finally{setBusy(false);}
 }
 async function logout(){try{await inventoryFetch("/api/auth/logout",{method:"POST"})}catch{}disconnectInventory();setMe(null)}
 if(me){
  const tabs:[Tab,string][]=[["map","庫存地圖"],["orders","訂單"],["products","商品販售"],...(me.role==="admin"&&!me.needsBootstrap?[["ledger","記帳"] as [Tab,string],["books","記帳匯出"] as [Tab,string],["users","帳號"] as [Tab,string]]:[])];
  return <>
   <nav className="admin-nav"><div className="admin-tabs">{tabs.map(([id,l])=><button key={id} className={tab===id?"active":""} onClick={()=>setTab(id)}>{l}</button>)}</div>
    <span className="admin-who">{me.legacy?"管理密碼":me.username}・{me.role==="admin"?"管理員":"店員"}</span>
    <button className="signout" onClick={logout}>登出庫存</button></nav>
   {me.legacy&&(me.needsBootstrap?<Bootstrap onDone={logout}/>:<section className="admin-banner legacy" role="status"><strong>您正以「原管理密碼」登入（管理員權限）</strong><p>建議改用個人帳號登入，並到「帳號」頁停用原管理密碼；停用後此密碼將完全無法使用。</p></section>)}
   {tab==="map"&&<Home/>}{tab==="orders"&&<Orders me={me}/>}{tab==="products"&&<Products me={me}/>}{tab==="books"&&<Bookkeeping/>}{tab==="ledger"&&<Ledger/>}{tab==="users"&&<Users me={me} onLegacyDisabled={()=>{if(me.legacy){alert("已停用原管理密碼，請改用帳號登入。");logout()}}}/>}
  </>;
 }
 return <main className="signin"><form onSubmit={login}><h1>鮮庫</h1><p>安星水產庫存地圖</p>
  <label htmlFor="user">帳號</label><input id="user" value={username} onChange={e=>setUsername(e.target.value)} autoComplete="username" autoCapitalize="none" placeholder="尚未建立帳號時請留空"/>
  <label htmlFor="key" style={{marginTop:12}}>密碼</label><input id="key" type="password" value={key} onChange={e=>setKey(e.target.value)} required autoComplete="current-password"/>
  <button disabled={busy}>{busy?"連線中…":"開啟庫存"}</button>{error&&<p role="alert">{error}</p>}
  <small>請輸入帳號與密碼。使用原管理密碼時，帳號請留空。重新整理後需再次登入。</small></form></main>;
}
createRoot(document.getElementById("root")!).render(<App/>);
