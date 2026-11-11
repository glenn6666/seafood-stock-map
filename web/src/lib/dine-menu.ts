/** 泰山旗艦店線上點餐菜單（對照 2026 菜單設計稿 v5）。時價品項 price 為 null。 */
export const DINE_STORE={
 name:"安星水產",
 branch:"泰山旗艦店",
 hoursWeekday:"週二至五 13:00–21:00",
 hoursWeekend:"週六、日 12:00–21:00",
 closed:"每週一公休",
 hoursText:"週二至五 13:00–21:00、週六日 12:00–21:00，每週一公休",
 address:"新北市泰山區文程路23號1樓（全聯隔壁）",
 phone:"02-29097057",
 phoneNote:"預約取餐專線",
} as const;

export const DINE_CATEGORIES=[
 {id:"porridge",label:"海鮮粥類",note:"以上海鮮為大鮑魚2、滿滿蛤蜊、數隻白蝦、主食材"},
 {id:"fish",label:"魚類料理",note:""},
 {id:"steam",label:"清蒸、代加熱類",note:""},
 {id:"soup",label:"湯類",note:""},
 {id:"grill",label:"烤蝦類",note:"烤蝦顆比川燙容易黏殼為正常現象"},
 {id:"stir",label:"熱炒類",note:""},
 {id:"blanch",label:"川燙類",note:"川燙類會附芥末醬油"},
 {id:"meat",label:"肉類",note:""},
 {id:"sashimi",label:"生魚片類",note:""},
 {id:"live",label:"鮮活料理",note:"活體皆為時價，以當日 LINE 群報價為主"},
 {id:"thai",label:"泰國蝦料理費用",note:"以下為活體泰國蝦的料理費用；蝦本身以當日報價另計"},
] as const;
export type DineCategoryId=(typeof DINE_CATEGORIES)[number]["id"];
export type DineBadge="hot"|"best";

export type DineSeed={
 id:string;category:DineCategoryId;name:string;description:string;
 price:number|null;priceNote:string;unit:string;badges:DineBadge[];image:string;sort:number;
};

const img=(f:string)=>`/seafood-stock-map/dine/${f}`;

export const DINE_SEED:DineSeed[]=[
 {id:"dine-porridge-crab",category:"porridge",name:"紅蟳海鮮粥",description:"以上海鮮為大鮑魚2、滿滿蛤蜊、數隻白蝦、主食材",price:499,priceNote:"",unit:"份",badges:[],image:img("congee-crab.webp"),sort:10},
 {id:"dine-porridge-scallop",category:"porridge",name:"日本大干貝海鮮粥",description:"以上海鮮為大鮑魚2、滿滿蛤蜊、數隻白蝦、主食材",price:499,priceNote:"",unit:"份",badges:[],image:img("congee-scallop.webp"),sort:20},
 {id:"dine-porridge-milkfish",category:"porridge",name:"大片虱目魚肚蛤蜊粥",description:"虱目魚肚、大顆蛤蜊",price:240,priceNote:"",unit:"份",badges:["hot"],image:img("porridge-milkfish.webp"),sort:30},

 {id:"dine-fish-sweetfish",category:"fish",name:"鹽烤母蛋蛋大香魚",description:"",price:199,priceNote:"",unit:"份",badges:["best"],image:img("fish-sweetfish.webp"),sort:40},
 {id:"dine-fish-baby",category:"fish",name:"鹽烤大隻午仔魚",description:"",price:230,priceNote:"",unit:"份",badges:[],image:"",sort:50},
 {id:"dine-fish-milkfish",category:"fish",name:"鹽烤大片虱目魚肚",description:"",price:195,priceNote:"",unit:"份",badges:["best"],image:img("fish-milkfish.webp"),sort:60},
 {id:"dine-fish-hairtail",category:"fish",name:"鹽烤白帶魚卷",description:"",price:209,priceNote:"",unit:"份",badges:[],image:"",sort:70},
 {id:"dine-fish-mackerel",category:"fish",name:"鹽烤大片挪威鯖魚",description:"",price:139,priceNote:"",unit:"份",badges:["best"],image:img("fish-plate.webp"),sort:80},
 {id:"dine-fish-kinmedai",category:"fish",name:"火烤喜知次一夜干",description:"",price:189,priceNote:"",unit:"份",badges:[],image:"",sort:90},

 {id:"dine-steam-oyster",category:"steam",name:"日本生蠔三顆",description:"附芥末醬油＋檸檬",price:197,priceNote:"",unit:"份",badges:[],image:img("oysters-hi.webp"),sort:100},
 {id:"dine-steam-mala",category:"steam",name:"麻辣小龍蝦",description:"",price:349,priceNote:"",unit:"份",badges:[],image:img("crayfish-mala.webp"),sort:110},
 {id:"dine-steam-garlic",category:"steam",name:"蒜味小龍蝦",description:"",price:349,priceNote:"",unit:"份",badges:[],image:img("crayfish-garlic.webp"),sort:120},

 {id:"dine-soup-milkfish",category:"soup",name:"大片虱目魚肚蛤蜊湯",description:"",price:220,priceNote:"",unit:"份",badges:[],image:img("soup-milkfish.webp"),sort:130},
 {id:"dine-soup-wine",category:"soup",name:"酒煮蛤蜊",description:"蛤蜊足一斤份，當日蛤蜊價＋80元",price:null,priceNote:"當日蛤蜊價＋80元",unit:"份",badges:[],image:img("soup-wine.webp"),sort:140},
 {id:"dine-soup-ginger",category:"soup",name:"薑絲蛤蜊湯",description:"蛤蜊足一斤份，當日蛤蜊價＋50元",price:null,priceNote:"當日蛤蜊價＋50元",unit:"份",badges:[],image:img("soup-ginger.webp"),sort:150},

 {id:"dine-grill-giant",category:"grill",name:"鹽烤4隻巨大草蝦",description:"馬來西亞高品質最大規格",price:230,priceNote:"",unit:"份",badges:["hot"],image:img("grill-prawn.webp"),sort:160},
 {id:"dine-grill-white",category:"grill",name:"鹽烤大白蝦",description:"泰國大白蝦",price:349,priceNote:"",unit:"份",badges:[],image:img("grill-white.webp"),sort:170},
 {id:"dine-grill-8p",category:"grill",name:"鹽烤8P大草蝦",description:"",price:200,priceNote:"",unit:"份",badges:[],image:img("grill-8p.webp"),sort:180},

 {id:"dine-stir-snail",category:"stir",name:"胡椒大鳳螺（一斤整）",description:"",price:250,priceNote:"",unit:"份",badges:["hot"],image:img("stir-snail.webp"),sort:190},
 {id:"dine-stir-crableg",category:"stir",name:"胡椒蟹腳（半斤）",description:"",price:250,priceNote:"",unit:"份",badges:["hot"],image:img("stir-crab.webp"),sort:200},

 {id:"dine-blanch-white",category:"blanch",name:"川燙大白蝦",description:"泰國大白蝦",price:349,priceNote:"",unit:"份",badges:["hot"],image:img("grill-white.webp"),sort:210},
 {id:"dine-blanch-cuttle",category:"blanch",name:"川燙超大小卷",description:"",price:215,priceNote:"",unit:"份",badges:[],image:img("blanch-hi.webp"),sort:220},
 {id:"dine-blanch-squid",category:"blanch",name:"川燙大透抽",description:"",price:200,priceNote:"",unit:"份",badges:[],image:img("blanch-hi.webp"),sort:230},
 {id:"dine-blanch-soft",category:"blanch",name:"川燙大軟絲",description:"",price:220,priceNote:"",unit:"份",badges:[],image:img("blanch-squid.webp"),sort:240},

 {id:"dine-meat-rib",category:"meat",name:"鹽烤美國帶骨牛小排",description:"",price:329,priceNote:"",unit:"份",badges:["best"],image:img("meat-rib.webp"),sort:250},
 {id:"dine-meat-iberico",category:"meat",name:"鹽烤伊比利松阪豬",description:"",price:238,priceNote:"",unit:"份",badges:[],image:"",sort:260},

 {id:"dine-sashimi-nishin",category:"sashimi",name:"尼信切盒",description:"",price:195,priceNote:"",unit:"份",badges:[],image:img("sashimi-nishin.webp"),sort:270},
 {id:"dine-sashimi-salmon",category:"sashimi",name:"挪威鮭魚現切生魚片（不定時）",description:"不定時供應，下單後由店家確認",price:null,priceNote:"時價",unit:"份",badges:[],image:img("sashimi-salmon.webp"),sort:280},

 {id:"dine-live-crab",category:"live",name:"紅蟳",description:"活體時價，以當日 LINE 群報價為主",price:null,priceNote:"時價",unit:"份",badges:[],image:"",sort:290},
 {id:"dine-live-wugu",category:"live",name:"水姑娘",description:"活體時價，以當日 LINE 群報價為主",price:null,priceNote:"時價",unit:"份",badges:[],image:"",sort:300},
 {id:"dine-live-shagong",category:"live",name:"沙公",description:"活體時價，以當日 LINE 群報價為主",price:null,priceNote:"時價",unit:"份",badges:[],image:"",sort:310},
 {id:"dine-live-bread",category:"live",name:"麵包蟹",description:"活體時價，以當日 LINE 群報價為主",price:null,priceNote:"時價",unit:"份",badges:[],image:"",sort:320},
 {id:"dine-live-king",category:"live",name:"帝王蟹",description:"活體時價，以當日 LINE 群報價為主",price:null,priceNote:"時價",unit:"份",badges:[],image:"",sort:330},
 {id:"dine-live-lobster",category:"live",name:"波士頓龍蝦",description:"活體時價，以當日 LINE 群報價為主",price:null,priceNote:"時價",unit:"份",badges:[],image:img("live-lobster.webp"),sort:340},

 {id:"dine-thai-salt",category:"thai",name:"泰國蝦（鹽烤）",description:"料理費用；活體泰國蝦另計",price:50,priceNote:"",unit:"份",badges:[],image:img("thai-prawn.webp"),sort:350},
 {id:"dine-thai-steam",category:"thai",name:"泰國蝦（清蒸）",description:"料理費用；活體泰國蝦另計",price:80,priceNote:"",unit:"份",badges:[],image:img("thai-prawn.webp"),sort:360},
 {id:"dine-thai-pepper",category:"thai",name:"泰國蝦（胡椒）",description:"料理費用；活體泰國蝦另計",price:150,priceNote:"",unit:"份",badges:[],image:img("thai-prawn.webp"),sort:370},
];

export const DINE_ID_RE=/^dine-[a-z0-9-]+$/;
export const PICKUP_RE=/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/;
export const MARKET_LABEL="時價，店家確認後報價";

/** 將「台北時間」的年月日時分轉成絕對時間。 */
export function pickupToDate(s:string):Date|null{
 const m=PICKUP_RE.exec(s);if(!m)return null;
 const y=+m[1],mo=+m[2],d=+m[3],h=+m[4],mi=+m[5];
 if(mo<1||mo>12||d<1||d>31||h>23||mi>59)return null;
 const dt=new Date(Date.UTC(y,mo-1,d,h-8,mi));
 // 回推檢查是否為真實日期（例如 2/31）
 const back=new Date(dt.getTime()+8*3600e3);
 if(back.getUTCFullYear()!==y||back.getUTCMonth()+1!==mo||back.getUTCDate()!==d)return null;
 return dt;
}
export function taipeiParts(d:Date){
 const t=new Date(d.getTime()+8*3600e3);
 return {date:t.toISOString().slice(0,10),hour:t.getUTCHours(),minute:t.getUTCMinutes(),dow:t.getUTCDay()};
}
const pad=(n:number)=>String(n).padStart(2,"0");
export function formatPickup(s:string){
 const m=PICKUP_RE.exec(s);if(!m)return s;
 return `${+m[2]}/${+m[3]} ${m[4]}:${m[5]}`;
}
/** 回傳錯誤訊息；通過則回 null。 */
export function pickupError(s:string,now=new Date()):string|null{
 const dt=pickupToDate(s);if(!dt)return "請選擇取餐時間";
 if(dt.getTime()<now.getTime()-5*60e3)return "取餐時間不能早於現在";
 if(dt.getTime()>now.getTime()+14*86400e3)return "請選擇 14 天內的取餐時間";
 const p=taipeiParts(dt);
 if(p.dow===1)return "每週一公休，請改選其他日期";
 const mins=p.hour*60+p.minute;
 const open=(p.dow===0||p.dow===6)?12*60:13*60;
 if(mins<open||mins>21*60)return `當天營業時間為 ${pad(Math.floor(open/60))}:00–21:00`;
 return null;
}
export function isValidImageUrl(s:string){
 if(s==="")return true;
 if(s.length>500)return false;
 if(s.startsWith("/seafood-stock-map/"))return !s.includes("..")&&!/\s/.test(s);
 try{const u=new URL(s);return u.protocol==="https:"||u.protocol==="http:"}catch{return false}
}
