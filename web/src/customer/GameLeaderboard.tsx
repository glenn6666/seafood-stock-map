import {useEffect,useState} from 'react';
import {DIFFICULTIES,type Difficulty} from '../lib/game-rules';
type Entry={rank:number;nickname:string;tool:string;seconds:number;achievedAt:string;score:number;caught:number;difficulty:Difficulty};
const toolNames:Record<string,string>={rod:'釣竿',net:'網子',tongs:'夾子',cage:'蝦籠'};
export default function GameLeaderboard({origin,target,refresh=0}:{origin:string;target:string;refresh?:number}){
 const [entries,setEntries]=useState<Entry[]>([]),[status,setStatus]=useState('loading'),[retry,setRetry]=useState(0);
 useEffect(()=>{
  const controller=new AbortController();setStatus('loading');
  fetch(origin+'/api/public/game/leaderboard?target='+encodeURIComponent(target),{credentials:'omit',cache:'no-store',signal:controller.signal})
   .then(async r=>{if(!r.ok)throw Error();return r.json()})
   .then(d=>{setEntries(d.entries);setStatus('ready')})
   .catch(()=>{if(!controller.signal.aborted)setStatus('error')});
  return()=>controller.abort();
 },[origin,target,refresh,retry]);
 return <details className="game-leaderboard"><summary>🏆 {({shrimp:'蝦',crab:'螃蟹',lobster:'龍蝦'} as Record<string,string>)[target]}高手排行榜 · 前 10 名</summary>
  <p>30 秒積分由高到低排列，同分並列；每位玩家各保留最高分。輕鬆 1 倍、標準 2 倍、高手 3 倍。</p>
  {status==='loading'?<p role="status">正在讀取排行榜…</p>:status==='error'?<p role="status">暫時無法載入。<button type="button" onClick={()=>setRetry(n=>n+1)}>重新讀取</button></p>:entries.length?<ol aria-label="積分排行榜">{entries.map((entry,i)=><li key={i}><b className="rank-number">{entry.rank}</b><span><strong>{entry.nickname}</strong><small>{DIFFICULTIES[entry.difficulty]?.name} · {toolNames[entry.tool]??entry.tool} · {entry.caught} 隻</small></span><b>{entry.score.toLocaleString()} 分</b></li>)}</ol>:<p>還沒有人上榜，填寫暱稱挑戰第一名！</p>}
 </details>;
}
