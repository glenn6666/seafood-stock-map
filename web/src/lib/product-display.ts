/** 顧客端顯示用：去掉庫存位置後綴，並合併同一品項的冷凍／架上列。後台與 D1 資料不變。 */
const LOCATION_SUFFIX = /[（(](冷凍|架上)[）)]/g;

export function displayProductName(name: string) {
  return name.replace(LOCATION_SUFFIX, "").replace(/\s+/g, " ").trim();
}

export type ProductDisplayItem = {
  id: string;
  name: string;
  available: number;
  imageUrl?: string;
  price?: string;
  spec?: string;
  unit?: string;
};

/** 優先保留有庫存的列；同樣有庫存（或都售完）時優先有照片，再比可訂數量。 */
export function preferProductDisplayRow<T extends ProductDisplayItem>(a: T, b: T): T {
  const aStock = a.available > 0;
  const bStock = b.available > 0;
  if (aStock !== bStock) return aStock ? a : b;
  const aPhoto = !!a.imageUrl;
  const bPhoto = !!b.imageUrl;
  if (aPhoto !== bPhoto) return aPhoto ? a : b;
  if (a.available !== b.available) return a.available > b.available ? a : b;
  return a;
}

export function dedupeProductsByDisplayName<T extends ProductDisplayItem>(items: T[]): T[] {
  const groups = new Map<string, T[]>();
  const order: string[] = [];
  for (const item of items) {
    const key = displayProductName(item.name);
    if (!groups.has(key)) {
      groups.set(key, []);
      order.push(key);
    }
    groups.get(key)!.push(item);
  }
  return order.map((key) => {
    const chosen = groups.get(key)!.reduce(preferProductDisplayRow);
    return chosen.name === key ? chosen : { ...chosen, name: key };
  });
}
