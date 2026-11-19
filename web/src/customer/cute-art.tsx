// 樂甜釣蝦場可愛版圖案（自繪 SVG，100×100；工具的工作端在上、握把在下；蝦／龍蝦頭朝上、螃蟹眼睛朝上）
const INK="#204b60",SW=3.6;
const g={stroke:INK,strokeWidth:SW,strokeLinecap:"round" as const,strokeLinejoin:"round" as const};
const Eye=({x,y,r=5}:{x:number;y:number;r?:number})=><g><circle cx={x} cy={y} r={r} fill="#fff" {...g} strokeWidth={2.6}/><circle cx={x+.6} cy={y+.8} r={r*.55} fill={INK}/><circle cx={x+1.6} cy={y-.6} r={r*.22} fill="#fff"/></g>;
const Blush=({x,y}:{x:number;y:number})=><ellipse cx={x} cy={y} rx={4} ry={2.4} fill="#ff8fa3" opacity={.7}/>;
const ART:Record<string,()=>React.ReactElement>={
 shrimp:()=><>
  <path d="M43 18C36 9 30 6 22 3M57 18c7-9 13-12 21-15" fill="none" {...g} strokeWidth={2.4}/>
  <path d="M38 40l-9 4m9 4-9 5m9 4-8 5m24-22 9 4m-9 4 9 5m-9 4 8 5" fill="none" {...g} strokeWidth={2.4}/>
  <path d="M50 80l-12 14c4 3 9 3 12-1 3 4 8 4 12 1Z" fill="#ffc2ad" {...g}/>
  <ellipse cx="50" cy="75" rx="7" ry="6" fill="#ffb39b" {...g}/>
  <ellipse cx="50" cy="66" rx="9" ry="6.5" fill="#ffa98f" {...g}/>
  <ellipse cx="50" cy="56" rx="11" ry="7.5" fill="#ffa98f" {...g}/>
  <ellipse cx="50" cy="35" rx="15" ry="17" fill="#ff9e85" {...g}/>
  <path d="M41 26q9-6 18 0" fill="none" stroke="#ffd9cc" strokeWidth={3} strokeLinecap="round"/>
  <Eye x={43} y={33}/><Eye x={57} y={33}/><Blush x={39} y={42}/><Blush x={61} y={42}/>
  <path d="M47 43q3 3 6 0" fill="none" {...g} strokeWidth={2.2}/></>,
 crab:()=><>
  <path d="M28 58 12 66m16-2-13 12m19-8-8 13M72 58l16 8m-16-2 13 12m-19-8 8 13" fill="none" {...g}/>
  <path d="M33 44 24 34m43 10 9-10" fill="none" {...g}/>
  <path d="M10 30c-6-10 2-22 12-20 6 1 9 6 8 11l-8-1 6 7c-4 6-13 7-18 3Z" fill="#ff7a68" {...g}/>
  <path d="M90 30c6-10-2-22-12-20-6 1-9 6-8 11l8-1-6 7c4 6 13 7 18 3Z" fill="#ff7a68" {...g}/>
  <ellipse cx="50" cy="58" rx="27" ry="20" fill="#ff6f5e" {...g}/>
  <path d="M33 50q17-10 34 0" fill="none" stroke="#ffb0a3" strokeWidth={3.4} strokeLinecap="round"/>
  <path d="M43 38v-8m14 8v-8" {...g}/>
  <Eye x={43} y={28} r={6}/><Eye x={57} y={28} r={6}/>
  <Blush x={37} y={62}/><Blush x={63} y={62}/>
  <path d="M45 62q5 5 10 0" fill="none" {...g} strokeWidth={2.4}/></>,
 lobster:()=><>
  <path d="M44 22C38 12 30 8 18 4M56 22c6-10 14-14 26-18" fill="none" {...g} strokeWidth={2.2}/>
  <path d="M40 30 28 20m32 10 12-10" fill="none" {...g}/>
  <path d="M27 21c-10-2-15-10-11-16 2-3 7-3 9 0l-4 5 7-2c3 5 3 10-1 13Z" fill="#ff9a52" {...g}/>
  <path d="M73 21c10-2 15-10 11-16-2-3-7-3-9 0l4 5-7-2c-3 5-3 10 1 13Z" fill="#ff9a52" {...g}/>
  <path d="M38 44l-9 3m9 4-9 4m33-11 9 3m-9 4 9 4" fill="none" {...g} strokeWidth={2.4}/>
  <path d="M50 84l-13 12c4 2 9 2 13-2 4 4 9 4 13 2Z" fill="#ffc08f" {...g}/>
  <rect x="42" y="73" width="16" height="12" rx="6" fill="#ffad6b" {...g}/>
  <rect x="40" y="63" width="20" height="12" rx="6" fill="#ffa25e" {...g}/>
  <rect x="39" y="53" width="22" height="12" rx="6" fill="#ffa25e" {...g}/>
  <ellipse cx="50" cy="39" rx="15" ry="17" fill="#ff8f45" {...g}/>
  <path d="M41 30q9-6 18 0" fill="none" stroke="#ffd2ad" strokeWidth={3} strokeLinecap="round"/>
  <Eye x={44} y={37}/><Eye x={56} y={37}/><Blush x={40} y={46}/><Blush x={60} y={46}/>
  <path d="M47 47q3 3 6 0" fill="none" {...g} strokeWidth={2.2}/></>,
 boot:()=><>
  <path d="M47 18c-4-8 0-14 6-15m3 15c2-7 8-10 13-8" fill="none" stroke="#3fae8c" strokeWidth={4} strokeLinecap="round"/>
  <path d="M34 16h30l-2 44c10 2 22 6 24 16v8H24c-4 0-6-3-5-7l7-21Z" fill="#c9895a" {...g}/>
  <path d="M22 84h66" {...g} strokeWidth={5}/>
  <path d="M34 26h28M33 36h28" fill="none" stroke="#e8b48a" strokeWidth={3} strokeLinecap="round"/>
  <circle cx="72" cy="70" r="3" fill={INK}/><circle cx="60" cy="70" r="3" fill={INK}/>
  <path d="M63 77q3-2 6 0" fill="none" {...g} strokeWidth={2.2}/></>,
 bucket:()=><>
  <path d="M10 50C10 18 90 18 90 50" fill="none" stroke="#7a95a3" strokeWidth={5} strokeLinecap="round"/>
  <circle cx="50" cy="52" r="38" fill="#ffd36b" {...g}/>
  <circle cx="50" cy="52" r="29" fill="#8fd8f5" {...g}/>
  <path d="M33 44q8-9 20-9" fill="none" stroke="#e9fbff" strokeWidth={4} strokeLinecap="round"/>
  <path d="M40 62q5 4 10 0 5 4 10 0" fill="none" stroke="#5fbbe0" strokeWidth={3} strokeLinecap="round"/>
  <circle cx="10" cy="50" r="4" fill="#ffd36b" {...g} strokeWidth={2.6}/><circle cx="90" cy="50" r="4" fill="#ffd36b" {...g} strokeWidth={2.6}/></>,
 rod:()=><>
  <path d="M50 8c10 2 14 10 13 20" fill="none" stroke="#5b7a88" strokeWidth={1.8} strokeDasharray="1 0"/>
  <path d="M63 28v6c0 4-6 4-6 0" fill="none" {...g} strokeWidth={2.6}/>
  <circle cx="63" cy="22" r="4" fill="#ff6f5e" {...g} strokeWidth={2.2}/>
  <path d="M50 96V8" stroke={INK} strokeWidth={8} strokeLinecap="round"/>
  <path d="M50 96V8" stroke="#f2b46b" strokeWidth={3.6} strokeLinecap="round"/>
  <path d="M50 96V72" stroke="#3fae8c" strokeWidth={4} strokeLinecap="round"/>
  <circle cx="58" cy="70" r="6" fill="#ffd36b" {...g} strokeWidth={2.6}/></>,
 net:()=><>
  <path d="M50 96V58" stroke={INK} strokeWidth={9} strokeLinecap="round"/>
  <path d="M50 96V58" stroke="#f2b46b" strokeWidth={4.4} strokeLinecap="round"/>
  <path d="M50 96V82" stroke="#3fae8c" strokeWidth={4.4} strokeLinecap="round"/>
  <circle cx="50" cy="32" r="26" fill="#dff6f4" {...g}/>
  <path d="M30 18l40 28M26 32l34 22M38 9l34 24M70 18 30 46M74 32 40 54M62 9 28 33" fill="none" stroke="#8cc9cf" strokeWidth={2}/>
  <circle cx="50" cy="32" r="26" fill="none" stroke="#ffd36b" strokeWidth={5}/>
  <circle cx="50" cy="32" r="28.5" fill="none" {...g} strokeWidth={3}/>
  <path d="M34 19q6-6 14-7" fill="none" stroke="#fff" strokeWidth={3} strokeLinecap="round"/></>,
 tongs:()=><>
  <path d="M50 92 38 10m12 82 12-82" fill="none" stroke={INK} strokeWidth={9} strokeLinecap="round"/>
  <path d="M50 92 38 10m12 82 12-82" fill="none" stroke="#7fd0e8" strokeWidth={4.4} strokeLinecap="round"/>
  <path d="M37 6l-2 12h7m21-12 2 12h-7" fill="#ff8f7e" {...g} strokeWidth={2.6}/>
  <circle cx="50" cy="88" r="7" fill="#ffd36b" {...g} strokeWidth={2.8}/></>,
 cage:()=><>
  <path d="M50 4v10" {...g}/><circle cx="50" cy="4" r="3" fill="#ffd36b" {...g} strokeWidth={2.2}/>
  <circle cx="50" cy="54" r="38" fill="#c9eef2" {...g}/>
  <path d="M50 16v76M12 54h76M23 27l54 54M77 27 23 81" stroke="#7fbcc4" strokeWidth={2}/>
  <circle cx="50" cy="54" r="38" fill="none" stroke="#3fae8c" strokeWidth={5}/>
  <circle cx="50" cy="54" r="40.5" fill="none" {...g} strokeWidth={2.6}/>
  <circle cx="50" cy="54" r="12" fill="#fff6d8" {...g} strokeWidth={3}/>
  <circle cx="50" cy="54" r="4" fill="#ff8f7e"/></>,
 rock:()=><>
  <path d="M12 72c-4-18 8-34 24-38 6-12 26-14 34-2 14 2 22 16 18 32-2 10-12 16-22 16H28c-8 0-14-2-16-8Z" fill="#b9c8da" {...g}/>
  <path d="M30 46q8-6 16-4" fill="none" stroke="#e3ecf6" strokeWidth={4} strokeLinecap="round"/>
  <circle cx="64" cy="62" r="5" fill="#9fb1c6"/><circle cx="40" cy="70" r="3.4" fill="#9fb1c6"/></>,
};
export type ArtName=keyof typeof ART;
export function CuteArt({name,className="",title}:{name:string;className?:string;title?:string}){
 const A=ART[name];if(!A)return null;
 return <svg className={className} viewBox="0 0 100 100" data-sprite={name} role={title?"img":undefined} aria-label={title} aria-hidden={title?undefined:true} focusable="false">{A()}</svg>;
}
