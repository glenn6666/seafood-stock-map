export const GAME_SECONDS=30;
export const COUPON_CATCH_MIN=6;
export const GAME_RULE_VERSION=4;
/** Higher suitability is easier to catch and carry, and awards fewer points. */
export const TOOL_FIT={
 rod:{shrimp:1.2,crab:.9,lobster:.85},
 net:{shrimp:1.05,crab:1,lobster:.9},
 tongs:{shrimp:.9,crab:1.2,lobster:1.1},
 cage:{shrimp:1,crab:1.05,lobster:1.2},
} as const;
export type GameTool=keyof typeof TOOL_FIT;
export const TOOL_BEHAVIOR={
 rod:{r:4.5,catchMs:350,carry:85,lag:.04},
 net:{r:13,catchMs:700,carry:28,lag:.35},
 tongs:{r:2.8,catchMs:100,carry:70,lag:.015},
 cage:{r:9,catchMs:1700,carry:35,lag:.22},
} as const;
export const CATCH_POINTS={shrimp:100,crab:150,lobster:200} as const;
export function pointsPerCatch(target:keyof typeof CATCH_POINTS,tool:GameTool){return 100+Math.round((1.2-TOOL_FIT[tool][target])*100)}
export function toolBlocksThreat(target:keyof typeof CATCH_POINTS,tool:GameTool){return target==='crab'?(tool==='tongs'||tool==='cage'):target==='lobster'&&tool==='cage'}
/** Exclusive expiry: next midnight in Taiwan, independent of host timezone. */
export function endOfTaipeiDay(now=new Date()){
 const localDate=new Date(now.getTime()+8*3600e3).toISOString().slice(0,10);
 return new Date(Date.parse(localDate+'T00:00:00+08:00')+86400e3).toISOString();
}
