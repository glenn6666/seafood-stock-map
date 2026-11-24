export const LINE_GROUP_URL='https://line.me/ti/g2/Mqdxett8EoFm13lvc2gUlTqiIVn1mF8Tc-BLAA?utm_source=invitation&utm_medium=QR_code&utm_campaign=default';
export const VOUCHER_RULE='今天有效，當日 23:59 止。店內商品滿 NT$1,000 折 NT$5；團購不可折抵，也不計入門檻。';
export type GameVoucher={id:string;voucherNo:string;groupNickname:string;status:'pending'|'approved'|'rejected'|'redeemed'|'expired';claimDay:string;expiresAt:string};
export const voucherStatus={pending:'待門市核對',approved:'已核對・可使用',rejected:'核對未通過',redeemed:'已核銷',expired:'已過期'};
