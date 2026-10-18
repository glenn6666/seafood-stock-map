import {useState} from "react";
import {inventoryFetch} from "../lib/pages-api";
import {errorText} from "../lib/api-config";
export default function Bootstrap({onDone}:{onDone:()=>void}){
 const [u,setU]=useState(""),[p,setP]=useState(""),[p2,setP2]=useState(""),[msg,setMsg]=useState(""),[busy,setBusy]=useState(false);
 async function submit(e:React.FormEvent){
  e.preventDefault();setMsg("");if(p!==p2)return setMsg("兩次密碼不一致");
  setBusy(true);try{const r=await inventoryFetch("/api/auth/bootstrap",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({username:u,password:p})});
   if(!r.ok)return setMsg(await errorText(r));alert("已建立第一位管理員，請用新帳號重新登入。原管理密碼仍可使用，建議登入後到「帳號」頁停用。");onDone();}finally{setBusy(false)}
 }
 return <section className="admin-banner"><strong>尚未建立帳號</strong><p>目前用原管理密碼登入。建立第一位管理員後，請改用帳號登入並新增店員；原管理密碼會保留到您在「帳號」頁停用為止。</p>
  <form className="admin-form" onSubmit={submit}><input placeholder="管理員帳號（英數）" value={u} onChange={e=>setU(e.target.value)} required autoCapitalize="none"/><input type="password" placeholder="密碼（至少 8 字）" value={p} onChange={e=>setP(e.target.value)} required/><input type="password" placeholder="再輸入一次密碼" value={p2} onChange={e=>setP2(e.target.value)} required/><button disabled={busy}>建立第一位管理員</button></form>{msg&&<p role="alert" className="admin-error">{msg}</p>}</section>;
}
