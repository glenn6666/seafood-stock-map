// Reconstructed from the live GitHub Pages bundle (assets/index-dad8f87a0776.js).
let apiOrigin="",token="";
export function connectInventory(origin:string,key:string){
 const u=new URL(origin);
 if(u.protocol!=="https:"&&!(u.protocol==="http:"&&(u.hostname==="127.0.0.1"||u.hostname==="localhost"))||u.username||u.password||u.search||u.hash||u.pathname!=="/")throw new Error("請使用 HTTPS 後端網址，不含路徑或登入資訊。");
 apiOrigin=u.origin;token=key;
}
export function disconnectInventory(){token="";apiOrigin="";}
export function getApiOrigin(){return apiOrigin;}
export function setToken(t:string){token=t;}
export function inventoryFetch(path:string,init:RequestInit={}){
 if(!apiOrigin||!token)return Promise.reject(new Error("請先登入庫存系統"));
 const h=new Headers(init.headers);h.set("Authorization",`Bearer ${token}`);
 return fetch(apiOrigin+path,{...init,headers:h,credentials:"omit",cache:"no-store",redirect:"error"});
}
