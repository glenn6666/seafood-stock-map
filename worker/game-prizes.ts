export type GamePrize='coupon'|'gift';

/** Rejection sampling avoids modulo bias: exactly 90 of 100 outcomes are coupons. */
export function drawGamePrize(fill=(values:Uint32Array)=>crypto.getRandomValues(values)):GamePrize{
 const values=new Uint32Array(1);
 do{fill(values)}while(values[0]>=4294967200);
 return values[0]%100<90?'coupon':'gift';
}
