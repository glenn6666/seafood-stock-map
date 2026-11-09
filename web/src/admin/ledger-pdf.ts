/**
 * 損益表＋當月明細 PDF（瀏覽器端產生，不經伺服器）
 * 作法：把畫面上的損益表區塊（含圖示、圖表）複製到 A4 大小的隱藏頁面，
 * 表格逐列排版、放不下就換頁並重複表頭（不會把一列切成兩半），
 * 每頁用 html2canvas-pro 轉成 JPEG，再寫成 PDF。html2canvas-pro 只在按下按鈕時才載入。
 */
const PAGE_W = 794, PAGE_H = 1123, PAD = 30; // A4 @96dpi（CSS px）
const FOOT = 26;
const money = (n: number) => (n < 0 ? "-" : "") + Math.abs(Math.round(n)).toLocaleString("en-US");
const money2 = (n: number) => (n < 0 ? "-" : "") + Math.abs(n).toLocaleString("en-US", {maximumFractionDigits: 2});

export type MonthData = {
  ym: string; last: number; days: number;
  pos: any[]; // 依日期排序的每日日結（沒有日結的日子為 null）
  posTotal: {gross: number; discount: number; cash: number; other_pay: number; customers: number; revenue: number; uber: number};
  entries: any[]; entTotal: {count: number; income: number; expense: number; net: number};
};

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, text?: string) {
  const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e;
}
const SVG = (paths: string) => `<svg xmlns="http://www.w3.org/2000/svg" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${paths}</svg>`;
// lucide 的 CalendarDays、Receipt 圖示（跟畫面同一套）
const ICON_CAL = SVG('<path d="M8 2v4"/><path d="M16 2v4"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/><path d="M8 14h.01"/><path d="M12 14h.01"/><path d="M16 14h.01"/><path d="M8 18h.01"/><path d="M12 18h.01"/><path d="M16 18h.01"/>');
const ICON_REC = SVG('<path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z"/><path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8"/><path d="M12 17.5v-11"/>');

type Block = {node: HTMLElement} | {table: HTMLTableElement; title: HTMLElement};

function buildTable(head: string[], rows: (string | number)[][], cls: string, rowCls: (i: number) => string = () => "") {
  const t = el("table", "ledger-table pdf-t " + cls), th = el("thead"), tr = el("tr");
  head.forEach(h => tr.appendChild(el("th", "", h))); th.appendChild(tr); t.appendChild(th);
  const tb = el("tbody"); rows.forEach((r, i) => { const x = el("tr", rowCls(i)); r.forEach(c => x.appendChild(el("td", "", String(c ?? "")))); tb.appendChild(x); }); t.appendChild(tb);
  return t;
}

/** 依頁面高度分頁：一般區塊整塊放；表格逐列放，換頁時重複標題列 */
function paginate(host: HTMLElement, blocks: Block[], header: string) {
  const pages: HTMLElement[] = [];
  let body!: HTMLElement;
  const newPage = () => {
    const pg = el("div", "pdf-page pl"); pg.style.cssText = `width:${PAGE_W}px;height:${PAGE_H}px;padding:${PAD}px ${PAD}px ${PAD + FOOT}px`;
    if (pages.length) pg.appendChild(el("div", "pdf-runhead", header));
    body = el("div", "pdf-body"); pg.appendChild(body);
    const f = el("div", "pdf-foot"); pg.appendChild(f); host.appendChild(pg); pages.push(pg);
  };
  const limit = () => PAGE_H - PAD - FOOT; // body 底部不能超過的位置（相對頁面）
  const fits = () => { const pg = pages[pages.length - 1]; return body.getBoundingClientRect().bottom - pg.getBoundingClientRect().top <= limit() + 0.5; };
  newPage();
  for (const b of blocks) {
    if ("node" in b) { body.appendChild(b.node); if (!fits() && body.childElementCount > 1) { b.node.remove(); newPage(); body.appendChild(b.node); } continue; }
    const rows = [...b.table.tBodies[0].rows];
    const start = (cont: boolean) => {
      const title = b.title.cloneNode(true) as HTMLElement; if (cont) title.appendChild(el("small", "pdf-cont", "（續）"));
      const t = b.table.cloneNode(false) as HTMLTableElement; t.appendChild(b.table.tHead!.cloneNode(true)); const tb = el("tbody"); t.appendChild(tb);
      body.appendChild(title); body.appendChild(t); return {title, t, tb};
    };
    let cur = start(false);
    // 標題＋表頭＋第一列都放不下就整個移到下一頁
    if (rows.length) { cur.tb.appendChild(rows[0]); if (!fits() && body.childElementCount > 2) { cur.title.remove(); cur.t.remove(); newPage(); cur = start(false); cur.tb.appendChild(rows[0]); } }
    for (const r of rows.slice(1)) {
      cur.tb.appendChild(r);
      if (!fits()) { r.remove(); newPage(); cur = start(true); cur.tb.appendChild(r); }
    }
  }
  pages.forEach((p, i) => { p.querySelector(".pdf-foot")!.textContent = `${header}　·　第 ${i + 1} / ${pages.length} 頁`; });
  return pages;
}

/** 把多張 JPEG（每頁一張）寫成 A4 PDF */
function jpegsToPdf(imgs: {bytes: Uint8Array; w: number; h: number}[]) {
  const enc = new TextEncoder(), parts: Uint8Array[] = [], offs: number[] = []; let len = 0;
  const push = (b: Uint8Array | string) => { const u = typeof b === "string" ? enc.encode(b) : b; parts.push(u); len += u.length; };
  const obj = (n: number, body: (string | Uint8Array)[]) => { offs[n] = len; push(`${n} 0 obj\n`); body.forEach(push); push("\nendobj\n"); };
  const W = 595.28, H = 841.89, n = imgs.length; // pt
  push(new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34, 0x0a, 0x25, 0xe2, 0xe3, 0xcf, 0xd3, 0x0a])); // %PDF-1.4 + binary marker
  const kids = imgs.map((_, i) => `${3 + i * 3} 0 R`).join(" ");
  obj(1, ["<< /Type /Catalog /Pages 2 0 R >>"]);
  obj(2, [`<< /Type /Pages /Kids [${kids}] /Count ${n} >>`]);
  imgs.forEach((im, i) => {
    const p = 3 + i * 3, c = p + 1, x = p + 2, cs = `q ${W} 0 0 ${H} 0 0 cm /Im0 Do Q`;
    obj(p, [`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${W} ${H}] /Resources << /XObject << /Im0 ${x} 0 R >> >> /Contents ${c} 0 R >>`]);
    obj(c, [`<< /Length ${cs.length} >>\nstream\n${cs}\nendstream`]);
    obj(x, [`<< /Type /XObject /Subtype /Image /Width ${im.w} /Height ${im.h} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${im.bytes.length} >>\nstream\n`, im.bytes, "\nendstream"]);
  });
  const total = 3 + n * 3, xref = len;
  push(`xref\n0 ${total}\n0000000000 65535 f \n` + offs.slice(1).map(o => String(o).padStart(10, "0") + " 00000 n \n").join(""));
  push(`trailer\n<< /Size ${total} /Root 1 0 R /Info << /Producer (seafood-stock-map) >> >>\nstartxref\n${xref}\n%%EOF\n`);
  return new Blob(parts as BlobPart[], {type: "application/pdf"});
}

/** 產生並下載 PDF；回傳頁數 */
export async function exportMonthPdf(root: HTMLElement, d: MonthData, onProgress?: (s: string) => void) {
  const {default: html2canvas} = await import("html2canvas-pro");
  const [y, m] = d.ym.split("-"), header = `安星水產 損益表與明細　民國${+y - 1911}年${+m}月`;
  const host = el("div", "pdf-host"); host.setAttribute("aria-hidden", "true"); document.body.appendChild(host);
  try {
    // 1) 損益表：直接複製畫面上的區塊（含圖示與圖表）
    const pick = (sel: string) => { const n = root.querySelector(sel); return n ? n.cloneNode(true) as HTMLElement : null; };
    const top = pick(".pl-top"); top?.querySelector(".pl-actions")?.remove();
    if (top) top.appendChild(el("div", "pdf-stamp", `匯出：${new Date(Date.now() + 8 * 3600e3).toISOString().slice(0, 16).replace("T", " ")}（台北時間）`));
    const pnl = pick(".pnl-grid > .admin-card"); // 損益明細（資產負債表含輸入框，不放）
    const blocks: Block[] = [top, pick(".pl-kpis"), pick(".pl-trend"), pick(".pl-two"), pnl].filter(Boolean).map(n => ({node: n!}));

    // 2) 每日營業額
    const W = "日一二三四五六";
    const posRows = d.pos.map((x, i) => {
      const w = W[new Date(+y, +m - 1, i + 1).getDay()];
      if (!x) return [`${+m}/${i + 1}`, w, "", "", "", "", "", "", "無日結資料"];
      return [`${+m}/${i + 1}`, w, money(x.revenue), money(x.cash), money(x.other_pay), money(x.uber), money(x.revenue + x.uber), x.customers ?? "", x.customers ? money(x.revenue / x.customers) : ""];
    });
    const t = d.posTotal;
    posRows.push(["合計", `${d.days} 天`, money(t.revenue), money(t.cash), money(t.other_pay), money(t.uber), money(t.revenue + t.uber), t.customers, t.customers ? money(t.revenue / t.customers) : ""]);
    const posT = buildTable(["日期", "星期", "營收金額", "現金", "其他付款", "UBER", "總計", "人次", "客單價"], posRows, "pdf-pos", i => i === posRows.length - 1 ? "sum" : d.pos[i] ? "" : "none");
    const posTitle = el("h3", "pl-h pdf-h"); posTitle.innerHTML = ICON_CAL; posTitle.append(`每日營業額（收銀機日結）`); posTitle.appendChild(el("span", "pl-h-r", `${d.days} 天・總計 ${money(t.revenue + t.uber)}`));
    blocks.push({table: posT, title: posTitle});

    // 3) 收支紀錄
    const es = d.entries;
    const entRows = es.map(e => [e.date?.slice(5).replace("-", "/") ?? "", e.kind ?? "", e.category ?? "", e.item ?? "", e.note ?? "", e.signed > 0 ? money2(e.signed) : "", e.signed < 0 ? money2(-e.signed) : "", e.party ?? "", e.payMethod ?? ""]);
    entRows.push(["合計", `${es.length} 筆`, "", "", `淨額 ${money2(d.entTotal.net)}`, money2(d.entTotal.income), money2(-d.entTotal.expense), "", ""]);
    // 客戶/廠商、付款方式整個月都沒填就不印，讓內容欄寬一點
    const entHead = ["日期", "收支", "會計項目", "內容", "備註", "收入", "支出", "客戶/廠商", "付款方式"];
    const keep = entHead.map((_, c) => c < 7 || entRows.slice(0, -1).some(r => r[c]));
    const entT = buildTable(entHead.filter((_, c) => keep[c]), entRows.map(r => r.filter((_, c) => keep[c])), "pdf-ent", i => i === entRows.length - 1 ? "sum" : "");
    const entTitle = el("h3", "pl-h pdf-h"); entTitle.innerHTML = ICON_REC; entTitle.append("收支紀錄"); entTitle.appendChild(el("span", "pl-h-r", `${es.length} 筆・淨額 ${money(d.entTotal.net)}`));
    blocks.push({table: entT, title: entTitle});

    const pages = paginate(host, blocks, header);
    if ((document as any).fonts?.ready) await (document as any).fonts.ready;
    const imgs: {bytes: Uint8Array; w: number; h: number}[] = [];
    const scale = 2;
    for (let i = 0; i < pages.length; i++) {
      onProgress?.(`正在產生 PDF…第 ${i + 1} / ${pages.length} 頁`);
      const cv = await html2canvas(pages[i], {scale, backgroundColor: "#ffffff", logging: false, useCORS: true, width: PAGE_W, height: PAGE_H, windowWidth: PAGE_W, scrollX: 0, scrollY: 0});
      const blob: Blob = await new Promise((ok, no) => cv.toBlob(b => b ? ok(b) : no(new Error("無法轉成圖片")), "image/jpeg", 0.9));
      imgs.push({bytes: new Uint8Array(await blob.arrayBuffer()), w: cv.width, h: cv.height});
      cv.width = cv.height = 0; // 釋放記憶體（手機）
    }
    const pdf = jpegsToPdf(imgs), name = `安星水產_${d.ym}_損益表與明細.pdf`;
    const url = URL.createObjectURL(pdf), a = el("a"); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
    return {pages: pages.length, name};
  } finally { host.remove(); }
}
