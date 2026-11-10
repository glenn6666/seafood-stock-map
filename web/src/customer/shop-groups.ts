import {LIVE} from "./ShopMap";

export type GroupId="all"|"chilled"|"live"|"dry";
export const GROUPS:{id:GroupId;label:string}[]=[
 {id:"all",label:"全部"},
 {id:"chilled",label:"冷藏・冷凍"},
 {id:"live",label:"活鮮水產"},
 {id:"dry",label:"乾貨醬料"},
];

type Unitish={id:string;type:string;kind?:string}|null|undefined;
export function groupOf(m:{displayUnit?:Unitish;category?:string}):Exclude<GroupId,"all">{
 const u=m.displayUnit;
 if(u){
  if(u.type==="tank"||LIVE.includes(u.id))return "live";
  if(u.kind==="dry"||u.id==="s7")return "dry";
  return "chilled";
 }
 const c=m.category??"";
 if(/活鮮|鮮活|活體/.test(c))return "live";
 if(/乾貨|干貨|乾燥|醬|南北貨|魚乾|蝦米/.test(c))return "dry";
 return "chilled";
}

export const UNIT_BLURB:Record<string,string>={
 t1:"低溫活海水產，現挑現訂。",
 t4:"活體泰國蝦，新鮮現撈。",
 t7:"常溫飼養的活魚，帶點海味回家。",
 f1:"冷藏肉品，適合火鍋與日常料理。",
 f2:"海鮮冷藏，新鮮好料理。",
 f3:"冷藏食品與火鍋料。",
 c1:"冰鮮魚獲，當日現切。",
 c2:"新鮮貝類，適合清蒸或炒食。",
 c3:"蝦蟹類，冰鎮現撈。",
 s7:"乾貨、醬料與南北貨。",
 live:"三個魚缸的活體水產，現挑現訂。",
};

export function inGroupUnits(group:GroupId,u:{id:string;type:string;kind?:string}){
 if(group==="all")return true;
 return groupOf({displayUnit:u})===group;
}
