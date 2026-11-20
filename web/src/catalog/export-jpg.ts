function asDataUrl(blob:Blob):Promise<string>{
 return new Promise((resolve,reject)=>{
  const reader=new FileReader();
  reader.onload=()=>resolve(String(reader.result));
  reader.onerror=()=>reject(new Error('無法讀取菜單圖片'));
  reader.readAsDataURL(blob);
 });
}

async function embeddedImage(url:string){
 // Preview images may have been cached without an Origin/CORS response header.
 // Reload them as CORS requests rather than reusing that image-only cache entry.
 for(let attempt=0;attempt<2;attempt++){
  try{
   const response=await fetch(url,{cache:'reload',signal:AbortSignal.timeout(30000)});
   if(!response.ok)throw new Error(`HTTP ${response.status}`);
   return await asDataUrl(await response.blob());
  }catch(error){if(attempt===1)throw error;}
 }
 throw new Error('無法載入菜單中的圖片');
}

export async function embedCatalogImages(svg:SVGSVGElement,baseURI=document.baseURI){
 const sources=new Map<string,SVGImageElement[]>();
 for(const image of Array.from(svg.querySelectorAll('image'))){
  const href=image.getAttribute('href');
  if(!href||href.startsWith('data:'))continue;
  const url=new URL(href,baseURI).href;
  const images=sources.get(url)??[];
  images.push(image);
  sources.set(url,images);
 }
 // A TV menu has 37 images. Bound concurrency so queued requests do not use
 // their whole timeout before a connection is available.
 const entries=Array.from(sources);
 let next=0;
 await Promise.all(Array.from({length:Math.min(4,entries.length)},async()=>{
  while(next<entries.length){
   const index=next++;
   const [url,images]=entries[index];
   try{
    const data=await embeddedImage(url);
    images.forEach(image=>image.setAttribute('href',data));
   }catch{
    throw new Error(`第 ${index+1} 張菜單圖片無法匯出，請稍後重試，或重新上傳該圖片。`);
   }
  }
 }));
}

export async function downloadCatalogJpg(art:SVGSVGElement,title:string){
 const svg=art.cloneNode(true) as SVGSVGElement;
 svg.querySelectorAll('[data-editor-outline]').forEach(outline=>outline.remove());
 const {width,height}=art.viewBox.baseVal;
 const canvas=document.createElement('canvas');
 canvas.width=width*2;
 canvas.height=height*2;
 svg.setAttribute('width',String(canvas.width));
 svg.setAttribute('height',String(canvas.height));

 // SVGs drawn to a canvas must carry their own images.
 await embedCatalogImages(svg);

 const xml=new XMLSerializer().serializeToString(svg);
 const svgUrl=URL.createObjectURL(new Blob([xml],{type:'image/svg+xml;charset=utf-8'}));
 try{
  const image=new Image();
  image.src=svgUrl;
  await image.decode();
  const context=canvas.getContext('2d');
  if(!context)throw new Error('無法建立 JPG 圖片');
  context.fillStyle=art.style.background||'#fff';
  context.fillRect(0,0,canvas.width,canvas.height);
  context.drawImage(image,0,0);
  const jpg=await new Promise<Blob|null>(resolve=>canvas.toBlob(resolve,'image/jpeg',0.94));
  if(!jpg||jpg.type!=='image/jpeg')throw new Error('無法轉成 JPG 圖片');
  const url=URL.createObjectURL(jpg);
  const link=document.createElement('a');
  link.href=url;
  link.download=(title.trim().replace(/[\\/:*?"<>|]/g,'_')||'完整菜單')+'.jpg';
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(()=>URL.revokeObjectURL(url),30000);
 }finally{
  URL.revokeObjectURL(svgUrl);
 }
}
