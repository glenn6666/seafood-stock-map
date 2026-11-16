function asDataUrl(blob:Blob):Promise<string>{
 return new Promise((resolve,reject)=>{
  const reader=new FileReader();
  reader.onload=()=>resolve(String(reader.result));
  reader.onerror=()=>reject(new Error('無法讀取菜單圖片'));
  reader.readAsDataURL(blob);
 });
}

async function embeddedImage(url:string){
 const response=await fetch(url,{signal:AbortSignal.timeout(10000)});
 if(!response.ok)throw new Error('無法載入菜單中的圖片');
 return asDataUrl(await response.blob());
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

 // SVGs drawn to a canvas must carry their own images. Several layers can use the same source.
 const sources=new Map<string,Promise<string>>();
 await Promise.all(Array.from(svg.querySelectorAll('image'),async image=>{
  const href=image.getAttribute('href');
  if(!href||href.startsWith('data:'))return;
  const url=new URL(href,document.baseURI).href;
  if(!sources.has(url))sources.set(url,embeddedImage(url));
  try{
   image.setAttribute('href',await sources.get(url)!);
  }catch{
   throw new Error('菜單有圖片無法匯出，請確認圖片網址可存取，或先將圖片上傳至後台。');
  }
 }));

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
