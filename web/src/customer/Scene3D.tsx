import {useEffect,useRef} from "react";
import {ShopScene,type SceneItem,type SceneUnit} from "./scene/shop-scene";
export type Scene3DHandle={focus:(i:number)=>void;open:()=>void};
export default function Scene3D({items,units,focus,selectedId,onSelect,onFocus,onError}:{items:SceneItem[];units:SceneUnit[];focus:number;selectedId:string|null;onSelect:(i:SceneItem)=>void;onFocus:(i:number)=>void;onError:()=>void}){
 const ref=useRef<HTMLCanvasElement>(null),scene=useRef<ShopScene|null>(null),cb=useRef({onSelect,onFocus});cb.current={onSelect,onFocus};
 const key=JSON.stringify([units.map(u=>u.id+u.name),items.map(i=>[i.id,i.available,i.price,i.name,i.displayUnit?.id])]);
 useEffect(()=>{
  if(!ref.current)return;
  try{scene.current=new ShopScene(ref.current,items,units,{onSelect:i=>cb.current.onSelect(i),onFocus:i=>cb.current.onFocus(i)})}catch(e){console.error(e);onError();return}
  if(location.search.includes("e2e"))(window as unknown as {__shop:ShopScene|null}).__shop=scene.current;
  const lost=(e:Event)=>{e.preventDefault();onError()};ref.current.addEventListener("webglcontextlost",lost);
  const c=ref.current;
  return()=>{c.removeEventListener("webglcontextlost",lost);scene.current?.dispose();scene.current=null};
 // eslint-disable-next-line react-hooks/exhaustive-deps
 },[key]);
 useEffect(()=>{scene.current?.focus(focus)},[focus,key]);
 useEffect(()=>{scene.current?.setSelected(selectedId)},[selectedId,key]);
 return <canvas ref={ref} className="scene3d" aria-label="3D 店內展示：冷凍冰箱與活海鮮魚缸，點選商品可查看與加入購物車"/>;
}
