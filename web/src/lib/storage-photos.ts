export const storagePhotos = [
 {id:"photo-1",zone:"01",label:"照片 1 · 直立冷凍櫃",src:"/seafood-stock-map/storage/photo-1.webp"},
 {id:"photo-2",zone:"04",label:"冷凍櫃全景",src:"/seafood-stock-map/storage/update-04-freezers.webp"},
 {id:"photo-5",zone:"04",label:"展示櫃",src:"/seafood-stock-map/storage/update-04-display.webp"},
 {id:"photo-3",zone:"07",label:"照片 3 · 常溫貨架",src:"/seafood-stock-map/storage/photo-3.webp"},
 {id:"photo-6",zone:"03",label:"冷凍庫",src:"/seafood-stock-map/storage/update-03.webp"},
 {id:"photo-9",zone:"09",label:"單門冷藏櫃",src:"/seafood-stock-map/storage/update-09.webp"},
 {id:"photo-7",zone:"06",label:"活體水產區",src:"/seafood-stock-map/storage/update-06.webp"},
 {id:"photo-05-shelf",zone:"05",label:"置物架",src:"/seafood-stock-map/storage/zone-05-shelf.webp"},
 {id:"photo-08-freezers",zone:"08",label:"兩台冷凍櫃",src:"/seafood-stock-map/storage/zone-08-freezers.webp"},
];
// The two former freezer views now share the new overview; keep their stock accessible.
export const normalizePhotoId=(zone:string,id:string)=>zone==="04"&&id==="photo-4"?"photo-2":id;
export const fridges = [
 {id:"01-left",label:"冰箱 1 · 牛肉",left:4,width:32},
 {id:"01-middle",label:"冰箱 2 · 海鮮",left:36,width:30},
 {id:"01-right",label:"冰箱 3 · 冷凍食品",left:66,width:30},
];
export type Item={id:string;zone:string;category:string;name:string;spec:string;price:string;quantity:number;unit:string;minimum:number;batch:string;tracked:boolean;photoId?:string;positionNote?:string;fridgeId?:string};
export function photoSections(photoId:string){
 if(photoId==="photo-08-freezers")return [
  {id:"08-front",label:"左前方冷凍櫃",left:1,top:43,width:60,height:50},
  {id:"08-back",label:"右後方冷凍櫃",left:63,top:36,width:34,height:23},
 ];
 if(photoId==="photo-1")return fridges.map(f=>({...f,top:20,height:64}));
 if(photoId==="photo-2")return [
  {id:"04-left",label:"左側冰箱",left:32,top:19,width:22,height:35},
  {id:"04-right",label:"右側冰箱",left:55,top:20,width:33,height:34},
  {id:"04-front",label:"前方冰箱",left:2,top:55,width:96,height:33},
 ];
 if(photoId==="photo-6")return [
  {id:"03-left",label:"左邊架上",left:1,top:3,width:51,height:77},
  {id:"03-right",label:"右邊架上",left:61,top:37,width:37,height:38},
  {id:"03-other",label:"其他",left:18,top:82,width:80,height:16},
 ];
 if(photoId==="photo-7")return [
  {id:"06-left",label:"左側水產區",left:4,top:35,width:49,height:62},
  {id:"06-middle",label:"中間水產區",left:54,top:47,width:16,height:15},
  {id:"06-right",label:"右側水產區",left:77,top:44,width:21,height:33},
 ];
 return [];
}
