export const GAME_SECONDS=30;
export const COUPON_SCORE_MIN=2000;
export const GAME_RULE_VERSION=11;
export const BOOT_PENALTY=50;
/** Higher suitability is easier to catch and carry, and awards fewer points. */
export const TOOL_FIT={
 rod:{shrimp:.95,crab:.9,lobster:.85},
 net:{shrimp:1.1,crab:1.1,lobster:1.1},
} as const;
export type GameTool=keyof typeof TOOL_FIT;
export const TOOL_BEHAVIOR={
 rod:{r:3,catchMs:650,carry:45,lag:.08},
 net:{r:8,catchMs:450,carry:65,lag:.12},
} as const;
export const CATCH_POINTS={shrimp:100,crab:150,lobster:200} as const;
export const CRAB_ATTACK_WINDUP_SEC=1.2;
export const CRAB_ATTACK_RANGE=.17;
export const CRAB_ALERT_RANGE=.22;
export const ROD_CATCH_GRACE_MS=2400;
export function toolBehavior(target:keyof typeof CATCH_POINTS,tool:GameTool){
 return tool==='rod'&&target!=='shrimp'?{r:6,catchMs:400,carry:75,lag:.035}:TOOL_BEHAVIOR[tool];
}
export function rodCatchProtected(tool:GameTool,caughtAt:number,now:number){return tool==='rod'&&caughtAt>0&&now>=caughtAt&&now-caughtAt<ROD_CATCH_GRACE_MS}
export function pointsPerCatch(target:keyof typeof CATCH_POINTS,tool:GameTool){
 const points=(target==='lobster'?300:100)+Math.round((1.2-TOOL_FIT[tool][target])*100);
 return tool==='rod'?points*2:points;
}
export function toolBlocksThreat(target:keyof typeof CATCH_POINTS,tool:GameTool){return tool==='net'&&target==='crab'}
export function gameScore(target:keyof typeof CATCH_POINTS,tool:GameTool,caught:number,boots:number){return Math.max(0,caught*pointsPerCatch(target,tool)-boots*BOOT_PENALTY)}
export const taipeiDay=(date=new Date())=>new Date(date.getTime()+8*3600e3).toISOString().slice(0,10);
/** Exclusive expiry: next midnight in Taiwan, independent of host timezone. */
export function endOfTaipeiDay(now=new Date()){
 const localDate=new Date(now.getTime()+8*3600e3).toISOString().slice(0,10);
 return new Date(Date.parse(localDate+'T00:00:00+08:00')+86400e3).toISOString();
}
