// 團購對帳（ledger_prepaid）客戶端篩選：不改餘額，只決定歷史紀錄要顯示哪些列
export const PENDING = "未到貨";
/** 狀態篩選：未到貨且尚未勾「到貨正確」 */
export const ST_UNCHECKED = "__unchecked__";
/** 狀態篩選：已勾「到貨正確」 */
export const ST_ARRIVED = "__arrived__";

export type PrepaidDir = "" | "plus" | "minus";

export type PrepaidRow = {
  seq?: number;
  item: string;
  amount: number;
  checked: string | null;
  status: string;
  entry_date: string;
  direction?: string;
  note?: string;
  notes?: string;
};

export type PrepaidFilters = {
  q: string;
  st: string;
  dir: PrepaidDir;
  from: string;
  to: string;
};

export const emptyFilters = (): PrepaidFilters => ({q: "", st: "", dir: "", from: "", to: ""});

export const isFiltering = (f: PrepaidFilters) => !!(f.q.trim() || f.st || f.dir || f.from || f.to);

export const isPendingUnchecked = (x: PrepaidRow) =>
  x.status === PENDING && (x.checked == null || x.checked === "" || x.checked !== "○");

export const isArrived = (x: PrepaidRow) => x.checked === "○";

function haystack(x: PrepaidRow) {
  return [x.item, String(x.seq ?? ""), x.status, x.note ?? "", x.notes ?? "", String(Math.abs(x.amount))]
    .join("\n")
    .toLowerCase();
}

export function matchesPrepaid(x: PrepaidRow, f: PrepaidFilters) {
  const k = f.q.trim().toLowerCase();
  if (k) {
    const kAmt = k.replace(/[,−+\-]/g, "");
    if (!haystack(x).includes(k) && !(kAmt && String(Math.abs(x.amount)).includes(kAmt))) return false;
  }
  if (f.st === ST_UNCHECKED) {
    if (!isPendingUnchecked(x)) return false;
  } else if (f.st === ST_ARRIVED) {
    if (!isArrived(x)) return false;
  } else if (f.st && (x.status || "（無狀態）") !== f.st) return false;
  if (f.dir === "plus" && !(x.amount > 0)) return false;
  if (f.dir === "minus" && !(x.amount < 0)) return false;
  if (f.from || f.to) {
    if (!x.entry_date) return false;
    if (f.from && x.entry_date < f.from) return false;
    if (f.to && x.entry_date > f.to) return false;
  }
  return true;
}

export function filterPrepaid<T extends PrepaidRow>(rows: T[], f: PrepaidFilters) {
  const hit = rows.filter(x => matchesPrepaid(x, f));
  return {rows: hit, count: hit.length, amount: hit.reduce((s, x) => s + x.amount, 0)};
}
