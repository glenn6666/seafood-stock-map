/** 商品照片網址解析（後台庫存、商品販售、顧客訂購頁、冷凍現貨共用）。
 * 照片本體存 D1（dine_photos），inventory.image_url 存 /api/public/dine-photos/<id>，需接上後端網址。
 * 網站路徑或 https 網址則原樣使用。 */
import {DINE_PHOTO_PATH_RE} from "./dine-photos";
export function productImageSrc(imageUrl:string|undefined|null,apiOrigin:string){
 if(!imageUrl)return "";
 if(DINE_PHOTO_PATH_RE.test(imageUrl))return apiOrigin?apiOrigin+imageUrl:"";
 return imageUrl;
}
/** 商品照片：保留原圖比例（海報文字不裁切），最長邊 1000px，優先 WebP，≤300KB。 */
export async function compressProductPhoto(f:File|Blob):Promise<Blob>{
 const bmp=await createImageBitmap(f).catch(()=>{throw new Error("無法讀取這張照片，請改用 JPG／PNG")});
 for(const [edge,q] of [[1000,.82],[1000,.72],[900,.64],[800,.58],[700,.52]] as const){
  const k=Math.min(1,edge/Math.max(bmp.width,bmp.height)),w=Math.round(bmp.width*k),h=Math.round(bmp.height*k);
  const c=document.createElement("canvas");c.width=w;c.height=h;
  const g=c.getContext("2d")!;g.fillStyle="#fff";g.fillRect(0,0,w,h);g.drawImage(bmp,0,0,w,h);
  let b=await new Promise<Blob|null>(r=>c.toBlob(r,"image/webp",q));
  if(!b||b.type!=="image/webp")b=await new Promise<Blob|null>(r=>c.toBlob(r,"image/jpeg",q));
  if(b&&b.size<=300*1024)return b;
 }
 throw new Error("照片太大，請換一張");
}
