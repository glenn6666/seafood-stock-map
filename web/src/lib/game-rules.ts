export const GAME_SECONDS=30;
export const COUPON_CATCH_MIN=6;
export const GAME_RULE_VERSION=3;
/** Higher suitability is easier to catch and carry, and awards fewer points. */
export const TOOL_FIT={
 rod:{shrimp:1.5,crab:.7,lobster:.6},
 net:{shrimp:1.3,crab:1.2,lobster:.5},
 tongs:{shrimp:.6,crab:1.5,lobster:1.2},
 cage:{shrimp:.8,crab:1,lobster:1.6},
} as const;
export type GameTool=keyof typeof TOOL_FIT;
export const CATCH_POINTS={shrimp:100,crab:150,lobster:200} as const;
export function pointsPerCatch(target:keyof typeof CATCH_POINTS,tool:GameTool){return Math.round(CATCH_POINTS[target]*1.5/TOOL_FIT[tool][target]/10)*10}
/** Exclusive expiry: next midnight in Taiwan, independent of host timezone. */
export function endOfTaipeiDay(now=new Date()){
 const localDate=new Date(now.getTime()+8*3600e3).toISOString().slice(0,10);
 return new Date(Date.parse(localDate+'T00:00:00+08:00')+86400e3).toISOString();
}
