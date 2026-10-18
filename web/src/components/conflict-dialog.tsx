import {Dialog} from "radix-ui";
import type {Item} from "@/lib/storage-photos";
export type Conflict={item:Item;changes:Partial<Item>;latest:Item;diffs:{id:string;name:string;spec:string;unit:string;old:number;now:number}[]};
// 儲存衝突時顯示：哪些商品數量已被改過（原本 → 最新），由使用者選擇如何重新儲存，不會自動覆蓋。
export default function ConflictDialog({conflict,onClose,onResave}:{conflict:Conflict|null;onClose:()=>void;onResave:(base:Item,changes:Partial<Item>)=>Promise<boolean>}){
 if(!conflict)return null;
 const {item,changes,latest,diffs}=conflict;
 const qtyChange=changes.quantity!==undefined?changes.quantity:undefined;
 const delta=qtyChange!==undefined?qtyChange-item.quantity:0;
 const adjusted=Math.max(0,latest.quantity+delta);
 return <Dialog.Root open onOpenChange={o=>!o&&onClose()}><Dialog.Portal><Dialog.Overlay className="conflict-overlay"/>
  <Dialog.Content className="conflict-dialog"><Dialog.Title>庫存已被更動</Dialog.Title>
   <Dialog.Description>剛才的變更尚未儲存。其他裝置或訂單已改過以下數量，畫面已更新為最新值：</Dialog.Description>
   <ul className="conflict-list">{diffs.length?diffs.map(d=><li key={d.id} className={d.id===item.id?"current":""}><span>{d.name} <small>{d.spec}</small></span><b>{d.old} → {d.now} {d.unit}</b></li>):<li><span>{latest.name}</span><b>最新 {latest.quantity} {latest.unit}</b></li>}</ul>
   {qtyChange!==undefined?<>
    <p>您原本要把「{item.name}」從 {item.quantity} 改成 {qtyChange}（{delta>=0?"+":""}{delta}）。</p>
    <div className="conflict-actions">
     <button className="primary" onClick={()=>onResave(latest,{quantity:adjusted})}>依最新數量 {delta>=0?"+":""}{delta}，存為 {adjusted}</button>
     <button onClick={()=>confirm(`確定把「${item.name}」直接設為 ${qtyChange}？這會取代最新的 ${latest.quantity}。`)&&onResave(latest,{quantity:qtyChange})}>直接設為 {qtyChange}</button>
     <button onClick={onClose}>不儲存</button></div>
   </>:<>
    <p>您原本要變更「{item.name}」的位置或分類（數量維持最新的 {latest.quantity}）。</p>
    <div className="conflict-actions"><button className="primary" onClick={()=>onResave(latest,changes)}>以最新數量重新儲存變更</button><button onClick={onClose}>不儲存</button></div>
   </>}
  </Dialog.Content></Dialog.Portal></Dialog.Root>;
}
