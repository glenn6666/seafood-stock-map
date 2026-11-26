export const LINE_GROUP_URL='https://line.me/ti/g2/Mqdxett8EoFm13lvc2gUlTqiIVn1mF8Tc-BLAA?utm_source=invitation&utm_medium=QR_code&utm_campaign=default';
export const VOUCHER_RULE='今天有效，當日 23:59 止。店內商品滿 NT$1,000 折 NT$10；團購不可折抵，也不計入門檻。';
export type GameVoucher={prizeType?:'coupon'|'gift';id:string;voucherNo:string;groupNickname:string;status:'pending'|'approved'|'rejected'|'redeemed'|'expired';claimDay:string;expiresAt:string};
export const voucherStatus={pending:'待門市核對',approved:'獎項已取得・今天有效',rejected:'核對未通過',redeemed:'已兌換・不可重複使用',expired:'已過期'};

export const GACHA_RULE='2000 分（含）以上，每個 LINE 群組暱稱每天可扭蛋一次；95% 折價券、5% 神秘小禮。';
export const isGift=(voucher:GameVoucher)=>voucher.prizeType==='gift';
export const prizeName=(voucher:GameVoucher)=>isGift(voucher)?'神秘小禮':'店內滿 NT$1,000 折 NT$10';
export const GIFT_RULE='神秘小禮免消費，需加入 LINE 社群並由店員核對會員資格與暱稱；實際品項由門市安排；限當天到店兌換一次，當日 23:59 止。';
export const prizeRule=(voucher:GameVoucher)=>isGift(voucher)?GIFT_RULE:VOUCHER_RULE;
