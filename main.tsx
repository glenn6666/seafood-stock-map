import {useState} from 'react';
import {createRoot} from 'react-dom/client';
import Home from '../app/page';
import {connectInventory,disconnectInventory,inventoryFetch} from '../lib/pages-api';
import '../app/globals.css';
import './signin.css';
function App(){
 const [ready,setReady]=useState(false),[key,setKey]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 async function login(e:React.FormEvent){
  e.preventDefault();setBusy(true);setError('');
  try{
   const configResponse=await fetch(`${import.meta.env.BASE_URL}backend-config.json`,{cache:'no-store'});
   if(!configResponse.ok)throw new Error('無法讀取連線設定。');
   const config=await configResponse.json() as {apiOrigin?:string};
   if(!config.apiOrigin)throw new Error('尚未設定庫存後端，請店主管理員完成部署設定。');
   connectInventory(config.apiOrigin,key);
   const res=await inventoryFetch('/api/inventory');
   if(res.status===401)throw new Error('管理密碼不正確。');
   if(!res.ok)throw new Error('庫存後端尚未就緒，請稍後再試。');
   setKey('');setReady(true);
  }catch(e){disconnectInventory();setError(e instanceof Error?e.message:'無法連線，請稍後再試。');}finally{setBusy(false);}
 }
 if(ready)return <><button className="signout" onClick={()=>{disconnectInventory();setReady(false)}}>登出庫存</button><Home/></>;
 return <main className="signin"><form onSubmit={login}><h1>鮮庫</h1><p>安星水產庫存地圖</p><label htmlFor="key">管理密碼</label><input id="key" type="password" value={key} onChange={e=>setKey(e.target.value)} required autoComplete="current-password"/><button disabled={busy}>{busy?'連線中…':'開啟庫存'}</button>{error&&<p role="alert">{error}</p>}<small>請輸入管理密碼。重新整理後需再次登入。</small></form></main>;
}
createRoot(document.getElementById('root')!).render(<App/>);
