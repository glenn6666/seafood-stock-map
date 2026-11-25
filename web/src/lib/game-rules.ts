export const GAME_SECONDS=30;
export const COUPON_CATCH_MIN=6;
export const GAME_RULE_VERSION=5;
/** Higher suitability is easier to catch and carry, and awards fewer points. */
export const TOOL_FIT={
 rod:{shrimp:.95,crab:.9,lobster:.85},
 net:{shrimp:1.2,crab:1.2,lobster:1.2},
} as const;
export type GameTool=keyof typeof TOOL_FIT;
export const TOOL_BEHAVIOR={
 rod:{r:3,catchMs:650,carry:45,lag:.08},
 net:{r:14,catchMs:200,carry:100,lag:.04},
} as const;
export const CATCH_POINTS={shrimp:100,crab:150,lobster:200} as const;
export function pointsPerCatch(target:keyof typeof CATCH_POINTS,tool:GameTool){return 100+Math.round((1.2-TOOL_FIT[tool][target])*100)}
export function toolBlocksThreat(target:keyof typeof CATCH_POINTS,tool:GameTool){return tool==='net'&&(target==='crab'||target==='lobster')}
/** Exclusive expiry: next midnight in Taiwan, independent of host timezone. */
export function endOfTaipeiDay(now=new Date()){
 const localDate=new Date(now.getTime()+8*3600e3).toISOString().slice(0,10);
 return new Date(Date.parse(localDate+'T00:00:00+08:00')+86400e3).toISOString();
}
