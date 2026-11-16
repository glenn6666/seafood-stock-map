/** 官方 LINE 一鍵帶入訂單（無需金鑰；僅組公開的 oaMessage 網址）。 */
import {formatPickup} from "../lib/dine-menu";

export const LINE_OA_ID = "@348vbpnv";
export const LINE_OA_PAGE = "https://page.line.me/348vbpnv";
export const LINE_URL_PREFIX = `https://line.me/R/oaMessage/${encodeURIComponent(LINE_OA_ID)}/?`;
/** 整段網址長度上限，避免 iOS／LINE 截斷。中文編碼後很占空間。 */
export const MAX_LINE_URL_LENGTH = 2000;
const EXTRAS_PREFIX = "dine-line-extras:";

export type LineOrderItem = {
  name: string;
  spec?: string;
  qty: number;
  unit?: string;
  unitPrice?: number | null;
  market?: boolean;
};

export type LineOrderInput = {
  orderNo: string;
  customerName?: string;
  phone?: string;
  pickupAt?: string;
  note?: string;
  total?: number;
  items?: LineOrderItem[];
};

export type LineOrderShare = {
  text: string;
  url: string;
  trimmed: boolean;
};

export type LineOrderExtras = {phone?: string; note?: string};

export function isMarketItem(item: LineOrderItem) {
  return !!(item.market || item.unitPrice === 0 || item.unitPrice == null);
}

function itemPrice(item: LineOrderItem) {
  return isMarketItem(item) ? "時價" : `$${(item.unitPrice ?? 0) * item.qty}`;
}

function itemLine(item: LineOrderItem, mode: "full" | "compact" | "name") {
  const unit = item.unit ? ` ${item.unit}` : "";
  if (mode === "name") return `・${item.name} × ${item.qty}${unit}`;
  const title = mode === "full" && item.spec ? `${item.name}　${item.spec}` : item.name;
  return `・${title} × ${item.qty}${unit}　${itemPrice(item)}`;
}

function totalLine(order: LineOrderInput) {
  const market = (order.items ?? []).some(isMarketItem);
  return `合計 $${order.total ?? 0}${market ? "＋時價" : ""}`;
}

function header(order: LineOrderInput) {
  const lines = [
    "您好，這是我在安星水產的線上點餐，麻煩幫忙確認，謝謝！",
    "",
    `訂單編號：${order.orderNo}`,
  ];
  if (order.customerName) lines.push(`姓名：${order.customerName}`);
  if (order.phone) lines.push(`電話：${order.phone}`);
  if (order.pickupAt) lines.push(`取餐時間：${formatPickup(order.pickupAt)}`);
  return lines.join("\n");
}

const CLOSING = "麻煩店家確認餐點與取餐時間，謝謝！";

function compose(order: LineOrderInput, itemMode: "full" | "compact" | "name" | "none", lookupUrl?: string) {
  const parts = [header(order), ""];
  const items = order.items ?? [];
  if (itemMode !== "none" && items.length) {
    parts.push("餐點：");
    parts.push(...items.map((item) => itemLine(item, itemMode)));
    parts.push("");
  } else if (itemMode === "none" && items.length) {
    parts.push(`餐點共 ${items.length} 項，詳見下方查詢連結。`, "");
  }
  parts.push(totalLine(order));
  if (order.note) parts.push("", `備註：${order.note}`);
  if ((itemMode === "none" || !items.length) && lookupUrl) parts.push("", `查詢連結：${lookupUrl}`);
  parts.push("", CLOSING);
  return parts.join("\n");
}

export function lineOaMessageUrl(text: string) {
  return LINE_URL_PREFIX + encodeURIComponent(text);
}

export function buildLineOrderShare(order: LineOrderInput, lookupUrl?: string): LineOrderShare {
  const modes = ["full", "compact", "name", "none"] as const;
  for (const mode of modes) {
    const text = compose(order, mode, lookupUrl);
    const url = lineOaMessageUrl(text);
    if (url.length <= MAX_LINE_URL_LENGTH) return {text, url, trimmed: mode !== "full"};
  }
  const fallback = [
    `您好，我的訂單編號是 ${order.orderNo}，麻煩店家確認餐點與取餐時間，謝謝！`,
    lookupUrl ? `查詢連結：${lookupUrl}` : "",
  ].filter(Boolean).join("\n");
  return {text: fallback, url: lineOaMessageUrl(fallback), trimmed: true};
}

export function saveDineLineExtras(token: string, extras: LineOrderExtras) {
  try { sessionStorage.setItem(EXTRAS_PREFIX + token, JSON.stringify(extras)); } catch { /* private mode */ }
}

export function loadDineLineExtras(token: string): LineOrderExtras {
  try {
    const raw = sessionStorage.getItem(EXTRAS_PREFIX + token);
    return raw ? JSON.parse(raw) as LineOrderExtras : {};
  } catch {
    return {};
  }
}

export function mergeLineOrderInput(order: {
  orderNo: string;
  customerName?: string;
  phone?: string;
  pickupAt?: string;
  note?: string;
  total?: number;
  items?: LineOrderItem[];
}, token?: string): LineOrderInput {
  const extras = token ? loadDineLineExtras(token) : {};
  return {
    orderNo: order.orderNo,
    customerName: order.customerName,
    phone: order.phone || extras.phone || "",
    pickupAt: order.pickupAt,
    note: order.note || extras.note || "",
    total: order.total,
    items: order.items ?? [],
  };
}

export function isMobileLineClient() {
  return typeof navigator !== "undefined" && /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
}

export function fillLineWindow(win: Window | null, url: string) {
  if (!win || win.closed) return;
  try { win.location.replace(url); } catch { try { win.close(); } catch { /* ignore */ } }
}

export function closeLineWindow(win: Window | null) {
  if (!win || win.closed) return;
  try { win.close(); } catch { /* ignore */ }
}
