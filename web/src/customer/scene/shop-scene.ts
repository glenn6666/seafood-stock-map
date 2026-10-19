// 顧客訂購頁 3D 場景（Three.js，僅在 order.html 動態載入）。
// 展示櫃（冷凍冰箱／魚缸）是顧客端展示分組，與實際儲位無關。
import * as THREE from "three";

export type SceneUnit={id:string;name:string;type:"freezer"|"tank"};
export type SceneItem={id:string;name:string;spec:string;unit:string;category:string;price:string;available:number;displayUnit:SceneUnit|null};
type Opts={onSelect:(item:SceneItem)=>void;onFocus:(index:number)=>void};
type Animal={group:THREE.Group;kind:string;item:SceneItem;phase:number;speed:number;radius:number;cx:number;cy:number;cz:number;home:THREE.Vector3};

const PALETTE=["#e9724c","#f4a259","#5b8e7d","#bc4b51","#3d7ea6","#8cb369","#c86b98","#f2c14e"];
const hash=(s:string)=>{let h=0;for(const c of s)h=(h*31+c.charCodeAt(0))|0;return Math.abs(h)};
export function animalKind(name:string,category:string){
 const t=name+category;
 if(/蟹/.test(t))return "crab";
 if(/蝦/.test(t))return "shrimp";
 if(/貝|蛤|蚵|螺|鮑|蜆|扇|淡菜|海瓜子/.test(t))return "shell";
 if(/魷|章|透抽|花枝|小卷/.test(t))return "squid";
 return "fish";
}
function roundRect(g:CanvasRenderingContext2D,x:number,y:number,w:number,h:number,r:number){g.beginPath();g.moveTo(x+r,y);g.arcTo(x+w,y,x+w,y+h,r);g.arcTo(x+w,y+h,x,y+h,r);g.arcTo(x,y+h,x,y,r);g.arcTo(x,y,x+w,y,r);g.closePath()}
function wrap(g:CanvasRenderingContext2D,text:string,max:number,lines:number){
 const out:string[]=[];let cur="";
 for(const ch of text){if(g.measureText(cur+ch).width>max){out.push(cur);cur=ch;if(out.length===lines)break}else cur+=ch}
 if(out.length<lines&&cur)out.push(cur);
 if(out.length===lines&&out.join("").length<text.length)out[lines-1]=out[lines-1].slice(0,-1)+"…";
 return out;
}
const FONT='"Noto Sans TC","PingFang TC","Microsoft JhengHei",Arial,sans-serif';
function canvasTex(w:number,h:number,draw:(g:CanvasRenderingContext2D)=>void){
 const c=document.createElement("canvas");c.width=w;c.height=h;const g=c.getContext("2d")!;draw(g);
 const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=4;return t;
}
function cardTexture(item:SceneItem){
 const col=PALETTE[hash(item.category)%PALETTE.length],sold=item.available<=0;
 return canvasTex(256,192,g=>{
  g.fillStyle=sold?"#c9cfd3":"#fffaf0";roundRect(g,4,4,248,184,22);g.fill();
  g.fillStyle=sold?"#9aa4ab":col;roundRect(g,4,4,248,40,22);g.fill();g.fillRect(4,26,248,18);
  g.fillStyle="#fff";g.font=`700 22px ${FONT}`;g.textBaseline="middle";g.fillText(item.category.slice(0,8),18,25);
  g.fillStyle=sold?"#6b767d":"#2b2118";g.font=`700 30px ${FONT}`;g.textBaseline="top";
  wrap(g,item.name,220,2).forEach((l,i)=>g.fillText(l,18,54+i*36));
  g.font=`800 32px ${FONT}`;g.fillStyle=sold?"#6b767d":"#c0392b";g.textBaseline="bottom";g.fillText(sold?"已售完":"$"+item.price,18,180);
 });
}
function labelSprite(text:string,sub:string|null,{bg="#7a3e1d",fg="#fff",scale=1}={}){
 const t=canvasTex(512,sub?150:110,g=>{
  g.fillStyle=bg;roundRect(g,6,6,500,(sub?150:110)-12,40);g.fill();
  g.fillStyle=fg;g.textAlign="center";g.textBaseline="middle";g.font=`800 52px ${FONT}`;g.fillText(text.slice(0,12),256,sub?56:55);
  if(sub){g.font=`600 34px ${FONT}`;g.fillText(sub,256,112)}
 });
 const s=new THREE.Sprite(new THREE.SpriteMaterial({map:t,depthWrite:false,transparent:true}));
 s.scale.set(1.6*scale,(sub?0.47:0.34)*scale,1);return s;
}
function tagSprite(item:SceneItem){
 const sold=item.available<=0;
 const t=canvasTex(320,110,g=>{g.fillStyle=sold?"#8d979dcc":"#ffffffee";roundRect(g,4,4,312,102,30);g.fill();g.fillStyle=sold?"#fff":"#173c51";g.textAlign="center";g.font=`700 38px ${FONT}`;g.textBaseline="middle";g.fillText(item.name.slice(0,7),160,36);g.fillStyle=sold?"#fff":"#c0392b";g.font=`800 32px ${FONT}`;g.fillText(sold?"已售完":"$"+item.price,160,80)});
 const s=new THREE.Sprite(new THREE.SpriteMaterial({map:t,depthWrite:false,transparent:true}));s.scale.set(0.62,0.21,1);return s;
}

export class ShopScene{
 private renderer:THREE.WebGLRenderer;private scene=new THREE.Scene();private camera=new THREE.PerspectiveCamera(42,1,0.1,100);
 private ray=new THREE.Raycaster();private pickables:THREE.Object3D[]=[];private clock=new THREE.Clock();
 private units:{u:SceneUnit;group:THREE.Group;x:number;w:number;h:number;door?:THREE.Group;doorTarget:number;mist?:THREE.Points;hint?:THREE.Sprite;label?:THREE.Sprite}[]=[];
 private animals:Animal[]=[];private bubbles?:THREE.InstancedMesh;private bubbleData:{x:number;y:number;z:number;v:number}[]=[];private weeds:THREE.Mesh[]=[];
 private focusIndex=-1;private camPos=new THREE.Vector3(0,4,14);private camLook=new THREE.Vector3(0,1.2,0);private lookCur=new THREE.Vector3(0,1.2,0);
 private raf=0;private down:{x:number;y:number;t:number}|null=null;private selectedId:string|null=null;private cards=new Map<string,THREE.Mesh>();
 private ro:ResizeObserver;private disposed=false;private tankMeta?:{x:number;y:number;w:number;h:number;d:number};
 constructor(private canvas:HTMLCanvasElement,private items:SceneItem[],private unitList:SceneUnit[],private opts:Opts){
  this.renderer=new THREE.WebGLRenderer({canvas,antialias:true,powerPreference:"low-power"});
  this.renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,2));
  this.renderer.outputColorSpace=THREE.SRGBColorSpace;this.renderer.toneMapping=THREE.ACESFilmicToneMapping;
  this.build();
  this.ro=new ResizeObserver(()=>this.resize());this.ro.observe(canvas);this.resize();
  canvas.addEventListener("pointerdown",this.onDown);canvas.addEventListener("pointerup",this.onUp);
  document.addEventListener("visibilitychange",this.onVis);
  this.loop();
 }
 // ---------- 建構場景 ----------
 private build(){
  const s=this.scene;
  s.background=new THREE.Color("#f6e7cf");s.fog=new THREE.Fog("#f6e7cf",14,34);
  s.add(new THREE.HemisphereLight("#fff4e0","#8a6a4a",1.1));
  const sun=new THREE.DirectionalLight("#ffffff",1.6);sun.position.set(4,8,6);s.add(sun);
  // 木地板與牆
  const floorTex=canvasTex(256,256,g=>{for(let i=0;i<8;i++){g.fillStyle=i%2?"#c99a6b":"#d4a676";g.fillRect(0,i*32,256,32);g.fillStyle="#b88a5c";g.fillRect(0,i*32+30,256,2)}});
  floorTex.wrapS=floorTex.wrapT=THREE.RepeatWrapping;floorTex.repeat.set(10,6);
  const floor=new THREE.Mesh(new THREE.PlaneGeometry(60,30),new THREE.MeshStandardMaterial({map:floorTex,roughness:.9}));floor.rotation.x=-Math.PI/2;floor.position.z=4;s.add(floor);
  const wall=new THREE.Mesh(new THREE.PlaneGeometry(60,12),new THREE.MeshStandardMaterial({color:"#efd9b8",roughness:1}));wall.position.set(0,6,-1.2);s.add(wall);
  const stripe=new THREE.Mesh(new THREE.PlaneGeometry(60,.35),new THREE.MeshStandardMaterial({color:"#2f7f8a"}));stripe.position.set(0,3.6,-1.18);s.add(stripe);
  // 依序排列展示櫃
  let x=0;const gap=.9;
  this.unitList.forEach((u,i)=>{
   const w=u.type==="tank"?2.5:1.6;if(i>0)x+=gap;x+=w/2;
   const g=new THREE.Group();g.position.x=x;s.add(g);
   const entry={u,group:g,x,w,h:u.type==="tank"?2.45:2.5,doorTarget:0} as ShopScene["units"][number];
   if(u.type==="tank")this.buildTank(entry,i);else this.buildFreezer(entry,i);
   const lbl=labelSprite(u.name,u.type==="tank"?"點海鮮挑選":"點我開門",{bg:u.type==="tank"?"#1f6f8b":"#7a3e1d"});lbl.position.set(0,entry.h+.42,0);g.add(lbl);entry.label=lbl;
   const shadow=new THREE.Mesh(new THREE.CircleGeometry(w*.62,24),new THREE.MeshBasicMaterial({color:"#000",transparent:true,opacity:.12,depthWrite:false}));shadow.rotation.x=-Math.PI/2;shadow.position.y=.005;shadow.scale.y=.55;g.add(shadow);
   this.units.push(entry);x+=w/2;
  });
  this.overviewCenter=x/2;
 }
 private overviewCenter=0;
 private itemsFor(u:SceneUnit){return this.items.filter(i=>i.displayUnit?.id===u.id)}
 private buildFreezer(e:ShopScene["units"][number],index:number){
  const {group:g,w,h}=e,d=.85;
  const body=new THREE.MeshStandardMaterial({color:"#f4f7f8",roughness:.35,metalness:.25});
  const pick=(m:THREE.Object3D)=>{m.userData={kind:"unit",index};this.pickables.push(m)};
  // 外殼（左右、頂、底、背）
  const t=.08;
  const parts:[number,number,number,number,number,number][]=[[t,h,d,-w/2+t/2,h/2,0],[t,h,d,w/2-t/2,h/2,0],[w,t,d,0,h-t/2,0],[w,.28,d,0,.14,0],[w,h,t,0,h/2,-d/2+t/2]];
  for(const [a,b,c,px,py,pz] of parts){const m=new THREE.Mesh(new THREE.BoxGeometry(a,b,c),body);m.position.set(px,py,pz);g.add(m);pick(m)}
  const inner=new THREE.Mesh(new THREE.PlaneGeometry(w-2*t,h-.36-t),new THREE.MeshStandardMaterial({color:"#dff3ff",emissive:"#cfeaff",emissiveIntensity:.35}));inner.position.set(0,.28+(h-.36-t)/2,-d/2+t+.002);g.add(inner);pick(inner);
  const light=new THREE.Mesh(new THREE.BoxGeometry(w-2*t,.04,.1),new THREE.MeshBasicMaterial({color:"#ffffff"}));light.position.set(0,h-t-.04,0);g.add(light);
  const brand=new THREE.Mesh(new THREE.BoxGeometry(w,.2,.02),new THREE.MeshStandardMaterial({color:"#2f7f8a"}));brand.position.set(0,.14,d/2+.01);g.add(brand);
  // 層架與商品卡
  const items=this.itemsFor(e.u).slice(0,15),cols=3,rows=Math.max(3,Math.min(5,Math.ceil(items.length/cols))),innerH=h-.36-t-.1,rowH=innerH/rows;
  const shelfMat=new THREE.MeshStandardMaterial({color:"#cfd8dc",metalness:.6,roughness:.3});
  for(let r=0;r<rows;r++){const sh=new THREE.Mesh(new THREE.BoxGeometry(w-2*t,.025,d-.15),shelfMat);sh.position.set(0,.3+r*rowH,-.02);g.add(sh)}
  const cw=(w-2*t-.12)/cols,ch=Math.min(rowH*.78,cw*.75);
  items.forEach((it,k)=>{
   const r=rows-1-Math.floor(k/cols),c=k%cols;
   const geo=new THREE.BoxGeometry(cw*.92,ch,.12);
   const mats=[0,1,2,3].map(()=>new THREE.MeshStandardMaterial({color:it.available>0?PALETTE[hash(it.category)%PALETTE.length]:"#aab3b8"}));
   const front=new THREE.MeshStandardMaterial({map:cardTexture(it),roughness:.6});
   const m=new THREE.Mesh(geo,[...mats,front,front]);
   m.position.set(-w/2+t+.06+cw*(c+.5),.3+.013+r*rowH+ch/2,.05);m.rotation.x=-.08;
   m.userData={kind:"item",item:it,index};g.add(m);this.pickables.push(m);this.cards.set(it.id,m);
  });
  // 玻璃門（左側鉸鏈）
  const door=new THREE.Group();door.position.set(-w/2,0,d/2+.03);g.add(door);
  const frameMat=new THREE.MeshStandardMaterial({color:"#e3e8ea",metalness:.4,roughness:.3});
  const fw=.07,dh=h-.3;
  const fr:[number,number,number,number][]= [[fw,dh,fw/2,.28+dh/2],[fw,dh,w-fw/2,.28+dh/2],[w,fw,w/2,.28+fw/2],[w,fw,w/2,.28+dh-fw/2]];
  for(const [a,b,px,py] of fr){const m=new THREE.Mesh(new THREE.BoxGeometry(a,b,.05),frameMat);m.position.set(px,py,0);door.add(m);pick(m)}
  const frost=canvasTex(256,512,gg=>{const gr=gg.createLinearGradient(0,0,0,512);gr.addColorStop(0,"rgba(255,255,255,.75)");gr.addColorStop(.35,"rgba(220,240,255,.25)");gr.addColorStop(1,"rgba(255,255,255,.6)");gg.fillStyle=gr;gg.fillRect(0,0,256,512);for(let i=0;i<260;i++){gg.fillStyle=`rgba(255,255,255,${Math.random()*.5})`;gg.beginPath();gg.arc(Math.random()*256,Math.random()*512,Math.random()*3,0,7);gg.fill()}});
  const glass=new THREE.Mesh(new THREE.PlaneGeometry(w-fw*2,dh-fw*2),new THREE.MeshStandardMaterial({map:frost,color:"#e8f6ff",transparent:true,opacity:.55,roughness:.1,metalness:.1,depthWrite:false,side:THREE.DoubleSide}));
  glass.position.set(w/2,.28+dh/2,0);door.add(glass);pick(glass);
  const handle=new THREE.Mesh(new THREE.CylinderGeometry(.025,.025,.7,10),new THREE.MeshStandardMaterial({color:"#9aa5ab",metalness:.9,roughness:.2}));handle.position.set(w-.16,1.3,.06);door.add(handle);pick(handle);
  e.door=door;
  // 冷氣霧
  const n=60,pos=new Float32Array(n*3);for(let i=0;i<n;i++){pos[i*3]=(Math.random()-.5)*w;pos[i*3+1]=.4+Math.random()*(h-.8);pos[i*3+2]=d/2+Math.random()*.5}
  const pg=new THREE.BufferGeometry();pg.setAttribute("position",new THREE.BufferAttribute(pos,3));
  const mist=new THREE.Points(pg,new THREE.PointsMaterial({color:"#ffffff",size:.07,map:canvasTex(64,64,gg=>{const gr=gg.createRadialGradient(32,32,0,32,32,32);gr.addColorStop(0,"rgba(255,255,255,1)");gr.addColorStop(1,"rgba(255,255,255,0)");gg.fillStyle=gr;gg.fillRect(0,0,64,64)}),transparent:true,opacity:0,depthWrite:false}));g.add(mist);e.mist=mist;
  const hint=labelSprite("點一下打開",null,{bg:"#2f7f8a",scale:.7});hint.position.set(0,1.35,d/2+.25);g.add(hint);e.hint=hint;hint.visible=false;
 }
 private buildTank(e:ShopScene["units"][number],index:number){
  const {group:g,w}=e,standH=.85,th=1.45,d=1.05;
  const pick=(m:THREE.Object3D)=>{m.userData={kind:"unit",index};this.pickables.push(m)};
  const wood=new THREE.MeshStandardMaterial({color:"#8b5a35",roughness:.8});
  const stand=new THREE.Mesh(new THREE.BoxGeometry(w+.1,standH,d+.1),wood);stand.position.y=standH/2;g.add(stand);pick(stand);
  const sand=new THREE.Mesh(new THREE.BoxGeometry(w-.04,.14,d-.04),new THREE.MeshStandardMaterial({color:"#e8d3a2",roughness:1}));sand.position.y=standH+.07;g.add(sand);
  const water=new THREE.Mesh(new THREE.BoxGeometry(w-.05,th-.2,d-.05),new THREE.MeshStandardMaterial({color:"#3aa7d8",transparent:true,opacity:.28,roughness:.1,depthWrite:false}));water.position.y=standH+.14+(th-.2)/2-.07;g.add(water);pick(water);
  const glass=new THREE.Mesh(new THREE.BoxGeometry(w,th,d),new THREE.MeshStandardMaterial({color:"#dff6ff",transparent:true,opacity:.12,roughness:0,metalness:.2,depthWrite:false,side:THREE.BackSide}));glass.position.y=standH+th/2;g.add(glass);
  const edges=new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(w,th,d)),new THREE.LineBasicMaterial({color:"#9fd3e6"}));edges.position.copy(glass.position);g.add(edges);
  const lid=new THREE.Mesh(new THREE.BoxGeometry(w+.04,.08,d+.04),new THREE.MeshStandardMaterial({color:"#2b2b2b"}));lid.position.y=standH+th+.04;g.add(lid);
  const back=new THREE.Mesh(new THREE.PlaneGeometry(w-.05,th-.1),new THREE.MeshBasicMaterial({map:canvasTex(256,256,gg=>{const gr=gg.createLinearGradient(0,0,0,256);gr.addColorStop(0,"#7fd0ea");gr.addColorStop(1,"#1d6e91");gg.fillStyle=gr;gg.fillRect(0,0,256,256)})}));back.position.set(0,standH+th/2,-d/2+.03);g.add(back);pick(back);
  // 石頭、海草
  for(let i=0;i<6;i++){const r=new THREE.Mesh(new THREE.DodecahedronGeometry(.08+Math.random()*.1),new THREE.MeshStandardMaterial({color:["#7d7461","#9a8f7a","#5f5a4e"][i%3],flatShading:true}));r.position.set((Math.random()-.5)*(w-.4),standH+.16,(Math.random()-.5)*(d-.4)-.15);g.add(r)}
  for(let i=0;i<9;i++){const h2=.4+Math.random()*.55;const sw=new THREE.Mesh(new THREE.ConeGeometry(.04,h2,5,4),new THREE.MeshStandardMaterial({color:i%2?"#3f9b4f":"#2e7d3e",flatShading:true}));sw.geometry.translate(0,h2/2,0);sw.position.set((Math.random()-.5)*(w-.3),standH+.14,-d/2+.15+Math.random()*.25);sw.userData.phase=Math.random()*6;g.add(sw);this.weeds.push(sw)}
  // 氣泡
  const nb=40;this.bubbles=new THREE.InstancedMesh(new THREE.SphereGeometry(.022,8,6),new THREE.MeshStandardMaterial({color:"#ffffff",transparent:true,opacity:.7}),nb);
  for(let i=0;i<nb;i++)this.bubbleData.push({x:-w/2+.25+(i%3)*.06,y:standH+.2+Math.random()*(th-.3),z:-.3+Math.random()*.2,v:.15+Math.random()*.25});
  g.add(this.bubbles);
  this.tankMeta={x:e.x,y:standH,w,h:th,d};
  // 海鮮
  const items=this.itemsFor(e.u).slice(0,14);
  items.forEach((it,k)=>{
   const kind=animalKind(it.name,it.category),grp=this.makeAnimal(kind,it);
   const bottom=kind==="crab"||kind==="shell"||kind==="shrimp";
   const home=new THREE.Vector3((k%5-2)*(w-.5)/4.5,bottom?standH+.2:standH+.55+((k*37)%60)/100*.55,((k*53)%70)/100*(d-.45)-(d-.45)/2+.05);
   grp.position.copy(home);g.add(grp);
   const tag=tagSprite(it);tag.position.set(0,.22,0);grp.add(tag);
   grp.traverse(o=>{if((o as THREE.Mesh).isMesh||(o as THREE.Sprite).isSprite){o.userData={kind:"item",item:it,index};this.pickables.push(o)}});
   this.animals.push({group:grp,kind,item:it,phase:k*1.7,speed:.35+((k*13)%10)/25,radius:.25+((k*7)%10)/30,cx:home.x,cy:home.y,cz:home.z,home});
  });
 }
 private makeAnimal(kind:string,it:SceneItem){
  const g=new THREE.Group(),sold=it.available<=0;
  const col=sold?"#9aa4ab":kind==="fish"?["#f08a4b","#e3b23c","#d1495b","#5aa9e6"][hash(it.id)%4]:kind==="shrimp"?"#f4845f":kind==="crab"?"#c8553d":kind==="squid"?"#f3c5c5":"#d9cbb0";
  const mat=new THREE.MeshStandardMaterial({color:col,roughness:.55,flatShading:true});
  const eye=new THREE.MeshBasicMaterial({color:"#111"});
  if(kind==="fish"){
   const body=new THREE.Mesh(new THREE.SphereGeometry(.13,10,8),mat);body.scale.set(1.5,.85,.5);g.add(body);
   const tail=new THREE.Mesh(new THREE.ConeGeometry(.09,.16,4),mat);tail.rotation.z=Math.PI/2;tail.position.x=-.24;tail.name="tail";g.add(tail);
   const fin=new THREE.Mesh(new THREE.ConeGeometry(.05,.1,3),mat);fin.position.set(0,.11,0);g.add(fin);
   const e1=new THREE.Mesh(new THREE.SphereGeometry(.018,6,4),eye);e1.position.set(.13,.03,.06);g.add(e1);
  }else if(kind==="shrimp"){
   for(let i=0;i<5;i++){const seg=new THREE.Mesh(new THREE.SphereGeometry(.05-i*.006,8,6),mat);const a=i*.45;seg.position.set(.12-Math.sin(a)*.12-i*.02,Math.cos(a)*.06-.06+i*.01,0);seg.scale.set(1.2,.9,.9);g.add(seg)}
   const tail=new THREE.Mesh(new THREE.ConeGeometry(.05,.08,4),mat);tail.position.set(-.07,-.06,0);tail.rotation.z=-1.2;g.add(tail);
   for(const s of [-1,1]){const ant=new THREE.Mesh(new THREE.CylinderGeometry(.004,.004,.28,4),mat);ant.position.set(.24,.07,.02*s);ant.rotation.z=-1.1;g.add(ant)}
   const e1=new THREE.Mesh(new THREE.SphereGeometry(.014,6,4),eye);e1.position.set(.17,.03,.03);g.add(e1);
   g.scale.setScalar(1.15);
  }else if(kind==="crab"){
   const body=new THREE.Mesh(new THREE.SphereGeometry(.12,10,8),mat);body.scale.set(1.3,.5,1);g.add(body);
   for(const s of [-1,1]){
    for(let i=0;i<3;i++){const leg=new THREE.Mesh(new THREE.CylinderGeometry(.012,.01,.16,4),mat);leg.position.set((i-1)*.07,-.03,s*.13);leg.rotation.x=s*1.0;leg.name="leg";g.add(leg)}
    const claw=new THREE.Mesh(new THREE.SphereGeometry(.045,8,6),mat);claw.position.set(.15,.02,s*.09);claw.scale.set(1.3,.8,.8);g.add(claw);
    const e1=new THREE.Mesh(new THREE.SphereGeometry(.016,6,4),eye);e1.position.set(.1,.07,s*.035);g.add(e1);
   }
  }else if(kind==="squid"){
   const body=new THREE.Mesh(new THREE.ConeGeometry(.07,.28,8),mat);body.rotation.z=-Math.PI/2;body.position.x=.1;g.add(body);
   for(let i=0;i<6;i++){const t=new THREE.Mesh(new THREE.CylinderGeometry(.008,.004,.16,4),mat);t.rotation.z=Math.PI/2+(i-2.5)*.12;t.position.set(-.1,(i-2.5)*.012,(i%2-.5)*.03);g.add(t)}
  }else{
   const top=new THREE.Mesh(new THREE.SphereGeometry(.09,10,6,0,Math.PI*2,0,Math.PI/2),mat);top.scale.set(1.2,.5,1);top.name="shellTop";g.add(top);
   const bot=new THREE.Mesh(new THREE.SphereGeometry(.09,10,6,0,Math.PI*2,Math.PI/2,Math.PI/2),new THREE.MeshStandardMaterial({color:"#cbb994",flatShading:true}));bot.scale.set(1.2,.35,1);g.add(bot);
  }
  return g;
 }
 // ---------- 互動 ----------
 private onDown=(e:PointerEvent)=>{this.down={x:e.clientX,y:e.clientY,t:performance.now()}};
 private onUp=(e:PointerEvent)=>{
  const d=this.down;this.down=null;if(!d)return;
  const dx=e.clientX-d.x,dy=e.clientY-d.y;
  if(Math.abs(dx)>45&&Math.abs(dx)>Math.abs(dy)){ // 左右滑動切換展示櫃
   const n=this.units.length,next=this.focusIndex<0?(dx<0?0:n-1):this.focusIndex+(dx<0?1:-1);
   this.focus(Math.max(-1,Math.min(n-1,next)));return;
  }
  if(Math.hypot(dx,dy)>12)return;
  const r=this.canvas.getBoundingClientRect();
  const p=new THREE.Vector2(((e.clientX-r.left)/r.width)*2-1,-((e.clientY-r.top)/r.height)*2+1);
  this.ray.setFromCamera(p,this.camera);
  const hits=this.ray.intersectObjects(this.pickables,false).filter(h=>h.object.visible);
  // 已聚焦時優先選商品（魚缸的水、玻璃不擋住點選）；冰箱門關著時以門為準
  const f=this.units[this.focusIndex],doorClosed=f?.u.type==="freezer"&&f.doorTarget===0;
  const hit=(!doorClosed&&hits.find(h=>h.object.userData.kind==="item"&&h.object.userData.index===this.focusIndex))||hits[0];
  if(!hit)return;
  const ud=hit.object.userData as {kind:string;index:number;item?:SceneItem};
  const unit=this.units[ud.index];
  if(this.focusIndex!==ud.index){this.focus(ud.index);return}
  if(unit.u.type==="freezer"&&unit.doorTarget===0){this.openDoor(ud.index);return}
  if(ud.kind==="item"&&ud.item)this.opts.onSelect(ud.item);
  else if(unit.u.type==="freezer")this.toggleDoor(ud.index);
 };
 private openDoor(i:number){const u=this.units[i];if(u.door){u.doorTarget=-1.95}}
 private toggleDoor(i:number){const u=this.units[i];if(u.door)u.doorTarget=u.doorTarget===0?-1.95:0}
 focus(i:number){
  this.focusIndex=i;
  this.units.forEach((u,k)=>{if(k!==i&&u.door)u.doorTarget=0});
  this.opts.onFocus(i);
 }
 openFocused(){if(this.focusIndex>=0)this.openDoor(this.focusIndex)}
 setSelected(id:string|null){this.selectedId=id}
 private onVis=()=>{if(document.hidden)cancelAnimationFrame(this.raf);else{this.clock.getDelta();this.loop()}};
 private resize(){
  const w=this.canvas.clientWidth,h=this.canvas.clientHeight;if(!w||!h)return;
  this.renderer.setSize(w,h,false);this.camera.aspect=w/h;this.camera.updateProjectionMatrix();
 }
 private fitDistance(width:number,height:number){
  const v=THREE.MathUtils.degToRad(this.camera.fov)/2,hz=Math.atan(Math.tan(v)*this.camera.aspect);
  return Math.max((width/2)/Math.tan(hz),(height/2)/Math.tan(v))*1.08;
 }
 // ---------- 動畫 ----------
 private loop=()=>{
  if(this.disposed)return;
  this.raf=requestAnimationFrame(this.loop);
  const dt=Math.min(this.clock.getDelta(),.05),t=this.clock.elapsedTime;
  // 相機：總覽或聚焦，加上輕微擺動
  if(this.focusIndex<0){
   const last=this.units[this.units.length-1],total=last?last.x+last.w/2:4;
   const dist=this.fitDistance(total+.6,3.6);
   this.camPos.set(this.overviewCenter+Math.sin(t*.25)*.4,1.9+dist*.18,dist);this.camLook.set(this.overviewCenter,1.25,0);
  }else{
   const u=this.units[this.focusIndex],open=u.u.type==="freezer"&&u.doorTarget!==0;
   const dist=this.fitDistance(u.w+(open?.35:.5),u.h+.9);
   this.camPos.set(u.x+Math.sin(t*.4)*.18,u.h*.62+.25,dist+(u.u.type==="tank"?.1:0));this.camLook.set(u.x,u.h*.5+(u.u.type==="tank"?.25:.05),0);
  }
  const k=1-Math.pow(.02,dt);
  this.camera.position.lerp(this.camPos,k);this.lookCur.lerp(this.camLook,k);this.camera.lookAt(this.lookCur);
  // 冰箱門、冷氣；總覽時放大名稱牌，聚焦時隱藏（上方已有名稱）
  this.units.forEach((u,i)=>{
   if(u.label){const ov=this.focusIndex<0,sc=ov?1.25:1;u.label.visible=ov||i!==this.focusIndex;u.label.scale.lerp(new THREE.Vector3(1.6*sc,.47*sc,1),.15);u.label.position.y=u.h+(ov?.75:.42)}
   if(u.door){u.door.rotation.y+= (u.doorTarget-u.door.rotation.y)*(1-Math.pow(.004,dt));
    const open=-u.door.rotation.y/1.95;
    if(u.mist){const m=u.mist.material as THREE.PointsMaterial;m.opacity=.35*open*(.8+Math.sin(t*2)*.2);const a=u.mist.geometry.attributes.position as THREE.BufferAttribute;for(let j=0;j<a.count;j++){let y=a.getY(j)-dt*.12,z=a.getZ(j)+dt*.08;if(y<.2||z>u.w){y=.4+Math.random()*(u.h-.8);z=.45}a.setY(j,y);a.setZ(j,z)}a.needsUpdate=true}
    if(u.hint){u.hint.visible=i===this.focusIndex&&u.doorTarget===0;u.hint.position.y=1.35+Math.sin(t*3)*.04}}
  });
  // 卡片選取效果
  this.cards.forEach((m,id)=>{const s=id===this.selectedId?1.12:1;m.scale.lerp(new THREE.Vector3(s,s,s),.2)});
  // 魚缸
  const tm=this.tankMeta;
  if(tm&&this.bubbles){const mtx=new THREE.Matrix4();this.bubbleData.forEach((b,i)=>{b.y+=b.v*dt;if(b.y>tm.y+tm.h-.1)b.y=tm.y+.2;mtx.makeTranslation(b.x+Math.sin(t*3+i)*.02,b.y,b.z);this.bubbles!.setMatrixAt(i,mtx)});this.bubbles.instanceMatrix.needsUpdate=true}
  this.weeds.forEach(w=>{w.rotation.z=Math.sin(t*1.2+w.userData.phase)*.18});
  if(tm)this.animals.forEach(a=>{
   const sel=a.item.id===this.selectedId,sc=sel?1.35:1;a.group.scale.lerp(new THREE.Vector3(sc,sc,sc),.15);
   const lim=tm.w/2-.3;
   if(a.kind==="fish"||a.kind==="squid"){
    a.phase+=dt*a.speed*(sel?.3:1);
    const x=a.cx*.4+Math.cos(a.phase)*Math.min(lim,a.radius+.5),z=a.cz*.6+Math.sin(a.phase)*.18;
    const nx=a.cx*.4+Math.cos(a.phase+.05)*Math.min(lim,a.radius+.5),nz=a.cz*.6+Math.sin(a.phase+.05)*.18;
    a.group.position.set(x,a.cy+Math.sin(a.phase*2.3)*.05,z);
    a.group.rotation.y=Math.atan2(-(nz-z),nx-x);
    const tail=a.group.getObjectByName("tail");if(tail)tail.rotation.y=Math.sin(t*10+a.phase)*.5;
   }else if(a.kind==="shrimp"||a.kind==="crab"){
    a.phase+=dt*a.speed*.5*(sel?.2:1);
    const off=Math.sin(a.phase)*.35;
    if(a.kind==="crab"){a.group.position.set(Math.max(-lim,Math.min(lim,a.home.x+off)),a.home.y,a.home.z);a.group.rotation.y=0;a.group.children.forEach(c=>{if(c.name==="leg")c.rotation.z=Math.sin(t*12+c.position.x*20)*.3})}
    else{a.group.position.set(Math.max(-lim,Math.min(lim,a.home.x+off)),a.home.y+Math.abs(Math.sin(t*2+a.phase))*.03,a.home.z);a.group.rotation.y=Math.cos(a.phase)>0?0:Math.PI}
   }else{const top=a.group.getObjectByName("shellTop");if(top)top.rotation.z=-Math.max(0,Math.sin(t*.8+a.phase))*.35}
  });
  this.renderer.render(this.scene,this.camera);
 };
 dispose(){
  this.disposed=true;cancelAnimationFrame(this.raf);this.ro.disconnect();
  this.canvas.removeEventListener("pointerdown",this.onDown);this.canvas.removeEventListener("pointerup",this.onUp);document.removeEventListener("visibilitychange",this.onVis);
  this.scene.traverse(o=>{const m=o as THREE.Mesh;m.geometry?.dispose();const mats=Array.isArray(m.material)?m.material:m.material?[m.material]:[];mats.forEach((x:any)=>{x.map?.dispose();x.dispose()})});
  this.renderer.dispose();
 }
 // 測試用：回傳商品在畫面上的座標（僅 ?e2e 時由外部呼叫）
 projectItem(id:string){
  let obj:THREE.Object3D|undefined=this.cards.get(id)??this.animals.find(a=>a.item.id===id)?.group;if(!obj)return null;
  const v=new THREE.Vector3();obj.getWorldPosition(v);v.project(this.camera);const r=this.canvas.getBoundingClientRect();
  return {x:r.left+(v.x+1)/2*r.width,y:r.top+(1-v.y)/2*r.height};
 }
 get unitCount(){return this.units.length}
 unitAt(i:number){return this.units[i]?.u}
}
export function webglAvailable(){try{const c=document.createElement("canvas");return !!(c.getContext("webgl2")||c.getContext("webgl"))}catch{return false}}
