export const COUPON_SCOPE='store-products-only';
export const COUPON_RULE='今天有效，當日 23:59 止。限店內商品使用，團購不適用；滿額門檻不含團購金額。';
export function isStoreCouponItem(item:{category?:string}){
 return !/團購|group[\s_-]?buy/i.test(item.category??'');
}
export function storeCouponSubtotal<T extends {category?:string}>(items:T[],amount:(item:T)=>number){
 return items.filter(isStoreCouponItem).reduce((sum,item)=>sum+amount(item),0);
}
