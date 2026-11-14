export type Layer={id:string;type:'text'|'image'|'rect';x:number;y:number;width:number;height:number;rotation:number;opacity:number;hidden:boolean;text?:string;color?:string;fontSize?:number;fontFamily?:string;bold?:boolean;src?:string;crop?:[number,number,number,number];imageWidth?:number;imageHeight?:number};
export type CatalogPage={id:string;title:string;original:string;mode:'original'|'layers';background:string;layers:Layer[]};
export type Catalog={version:1;pages:CatalogPage[]};
const root='/seafood-stock-map/catalog/';
const text=(id:string,t:string,x:number,y:number,w:number,size=22,color='#082d47'):Layer=>({id,type:'text',text:t,x,y,width:w,height:size*1.5,rotation:0,opacity:1,hidden:false,color,fontSize:size,fontFamily:'serif',bold:true});
const rect=(id:string,x:number,y:number,width:number,height:number,color:string):Layer=>({id,type:'rect',x,y,width,height,color,rotation:0,opacity:1,hidden:false});
function page(n:number,title:string,groups:{title:string;y:number;items:[string,string,number,number,number,number][]}[]):CatalogPage{
 const original=root+`menu-${n}.webp`;
 const layers:Layer[]=[rect('header',0,0,1055,80,'#082d47'),text('brand','安星水產',70,8,260,46,'#ffffff'),text('branch','泰山旗艦店',330,20,210,25,'#ffffff'),text('title',title,575,15,460,30,'#ffffff'),rect('gold',0,78,1055,3,'#b89549')];
 groups.forEach((g,gi)=>{layers.push(text(`group-${gi}`,g.title,30,g.y,160,34));g.items.forEach(([name,price,x,y,w,h],ii)=>{
 const id=`dish-${gi}-${ii}`;
 layers.push({id:id+'-image',type:'image',src:original,x,y,width:w,height:h,crop:[x,y,w,h],imageWidth:1055,imageHeight:1491,rotation:0,opacity:1,hidden:false});
 layers.push(rect(id+'-label',x,y+h,w,36,'#fff7e7'),text(id+'-name',name,x+5,y+h+3,w*.68,Math.min(18,(w*.65)/name.length)),text(id+'-price',price,x+w*.70,y+h+3,w*.30-4,Math.min(18,(w*.28)/price.length)));
 });});
 layers.push(text('note',n===1?'點餐小提醒｜活體依當日 LINE 群報價｜鮭魚生魚片不定時供應':'點餐小提醒｜活體依當日 LINE 群報價｜泰國蝦為料理費，蝦本身另計',50,1392,965,21));
 layers.push(text('address','新北市泰山區文程路23號1樓（全聯隔壁）',50,1440,610,22),text('phone','預約取餐 02-29097057',660,1440,370,22));
 return {id:`page-${n}`,title,original,mode:'original',background:'#f1dbc0',layers};
}
export function defaultCatalog():Catalog{return {version:1,pages:[
page(1,'海味日常・暖心上桌',[
{title:'海鮮粥',y:180,items:[['紅蟳海鮮粥','$499',185,90,250,170],['日本大干貝海鮮粥','$499',470,90,250,170],['大片虱目魚肚蛤蜊粥','$240',750,90,260,170]]},
{title:'鮮味湯品',y:385,items:[['大片虱目魚肚蛤蜊湯','$220',185,325,260,140],['酒煮蛤蜊','當日蛤蜊價＋80元',470,325,255,140],['薑絲蛤蜊湯','當日蛤蜊價＋50元',750,325,270,140]]},
{title:'鹽烤鮮魚',y:620,items:[['鹽烤母蛋蛋大香魚','$199',185,520,260,140],['鹽烤大隻午仔魚','$230',470,520,255,140],['鹽烤大片虱目魚肚','$195',750,520,260,140],['鹽烤白帶魚卷','$209',185,705,260,125],['鹽烤大片挪威鯖魚','$139',470,705,255,125],['火烤喜知次一夜干','$189',750,705,260,125]]},
{title:'烤蝦',y:925,items:[['鹽烤4隻巨大草蝦','$230',210,890,315,100],['鹽烤8P大草蝦','$200',625,890,315,100]]},
{title:'肉類',y:1090,items:[['鹽烤美國帶骨牛小排','$329',210,1050,315,110],['鹽烤伊比利松阪豬','$238',625,1050,315,110]]},
{title:'生魚片',y:1255,items:[['尼信切盒','$195',225,1218,295,115],['挪威鮭魚現切生魚片','時價',610,1218,350,115]]}]),
page(2,'鮮活嚴選・現點料理',[
{title:'川燙類',y:205,items:[['川燙大白蝦','$349',238,88,270,152],['川燙超大小卷','$215',625,88,300,152],['川燙大透抽','$200',238,285,270,125],['川燙大軟絲','$220',625,285,300,125]]},
{title:'清蒸料理',y:525,items:[['日本生蠔三顆','$197',195,463,250,150],['麻辣小龍蝦','$349',480,463,250,150],['蒜味小龍蝦','$349',765,463,250,150]]},
{title:'熱炒類',y:708,items:[['胡椒大鳳螺（一斤整）','$250',230,670,300,125],['胡椒蟹腳（半斤）','$250',625,670,300,125]]},
{title:'鮮活料理',y:968,items:[['紅蟳','時價',195,845,235,132],['水姑娘','時價',465,845,270,132],['沙公','時價',755,845,270,132],['麵包蟹','時價',195,1024,235,120],['帝王蟹','時價',465,1024,270,120],['波士頓龍蝦','時價',755,1024,270,120]]},
{title:'泰國蝦',y:1240,items:[['泰國蝦（鹽烤）','料理費$50',180,1200,260,130],['泰國蝦（清蒸）','料理費$80',470,1200,260,130],['泰國蝦（胡椒）','料理費$150',765,1200,265,130]]}])
]};}
export function imageUrl(src:string,origin:string){return src.startsWith('/api/')?origin+src:src;}
