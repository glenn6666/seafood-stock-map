export const GAME_SECONDS=30;
export const COUPON_CATCH_MIN=6;
export const GAME_RULE_VERSION=2;
export const DIFFICULTIES={
 easy:{name:'輕鬆',multiplier:1,speed:.75,struggle:.7,catchTime:.8},
 normal:{name:'標準',multiplier:2,speed:1,struggle:1,catchTime:1},
 hard:{name:'高手',multiplier:3,speed:1.3,struggle:1.4,catchTime:1.2},
} as const;
export type Difficulty=keyof typeof DIFFICULTIES;
export const CATCH_POINTS={shrimp:100,crab:150,lobster:200} as const;
export function pointsPerCatch(target:keyof typeof CATCH_POINTS,difficulty:Difficulty){return CATCH_POINTS[target]*DIFFICULTIES[difficulty].multiplier}
/** Exclusive expiry: next midnight in Taiwan, independent of host timezone. */
export function endOfTaipeiDay(now=new Date()){
 const localDate=new Date(now.getTime()+8*3600e3).toISOString().slice(0,10);
 return new Date(Date.parse(localDate+'T00:00:00+08:00')+86400e3).toISOString();
}
