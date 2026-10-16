export async function loadApiOrigin():Promise<string>{
 const r=await fetch(`${import.meta.env.BASE_URL}backend-config.json`,{cache:"no-store"});
 if(!r.ok)throw new Error("無法讀取連線設定。");
 const c=await r.json() as {apiOrigin?:string};
 if(!c.apiOrigin)throw new Error("尚未設定庫存後端，請店主管理員完成部署設定。");
 return c.apiOrigin;
}
export const newKey=()=>crypto.randomUUID().replace(/-/g,"");
export const STATUSES=["待處理","備貨中","可取貨","已完成","已取消"] as const;
export async function errorText(r:Response,fallback="操作失敗，請再試一次。"){try{const d=await r.json();return d?.error||fallback}catch{return fallback}}
