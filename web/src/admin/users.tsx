import {useEffect,useState} from "react";
import {inventoryFetch} from "../lib/pages-api";
import {errorText} from "../lib/api-config";
type U={id:string;username:string;displayName:string;role:"admin"|"staff";active:boolean};
const J={"Content-Type":"application/json"};
export default function Users(){
 const [users,setUsers]=useState<U[]>([]),[msg,setMsg]=useState(""),[f,setF]=useState({username:"",displayName:"",password:"",role:"staff"});
 const load=()=>inventoryFetch("/api/users").then(async r=>r.ok?setUsers((await r.json()).users):setMsg(await errorText(r)));
 useEffect(()=>{load()},[]);
 async function patch(u:U,body:object,ok:string){const r=await inventoryFetch(`/api/users/${u.id}`,{method:"PATCH",headers:J,body:JSON.stringify(body)});setMsg(r.ok?ok:await errorText(r));load()}
 async function add(e:React.FormEvent){e.preventDefault();const r=await inventoryFetch("/api/users",{method:"POST",headers:J,body:JSON.stringify(f)});if(r.ok){setF({username:"",displayName:"",password:"",role:"staff"});setMsg("已新增帳號")}else setMsg(await errorText(r));load()}
 return <main className="admin-page"><h1>帳號管理</h1>{msg&&<p className="admin-msg" role="status">{msg}</p>}
  <form className="admin-card admin-form" onSubmit={add}><h2>新增帳號</h2>
   <input placeholder="帳號（英數）" value={f.username} onChange={e=>setF({...f,username:e.target.value})} required autoCapitalize="none"/>
   <input placeholder="顯示名稱" value={f.displayName} onChange={e=>setF({...f,displayName:e.target.value})}/>
   <input type="password" placeholder="密碼（至少 8 字）" value={f.password} onChange={e=>setF({...f,password:e.target.value})} required/>
   <select value={f.role} onChange={e=>setF({...f,role:e.target.value})}><option value="staff">店員</option><option value="admin">管理員</option></select>
   <button>新增</button></form>
  <div className="admin-list">{users.map(u=><div key={u.id} className={"admin-card"+(u.active?"":" muted")}>
   <div className="row"><strong>{u.displayName||u.username}</strong><span className="tag">{u.role==="admin"?"管理員":"店員"}</span>{!u.active&&<span className="tag warn">已停用</span>}</div>
   <small>帳號：{u.username}</small>
   <div className="actions">
    <button onClick={()=>patch(u,{active:!u.active},u.active?"已停用，該帳號登入立即失效":"已啟用")}>{u.active?"停用":"啟用"}</button>
    <button onClick={()=>{const p=prompt(`為 ${u.username} 設定新密碼（至少 8 字）`);if(p)patch(u,{password:p},"已重設密碼，原登入已失效")}}>重設密碼</button>
    <button onClick={()=>patch(u,{role:u.role==="admin"?"staff":"admin"},"已變更角色")}>改為{u.role==="admin"?"店員":"管理員"}</button>
   </div></div>)}</div></main>;
}
