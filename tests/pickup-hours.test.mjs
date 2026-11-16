import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import ts from "typescript";

const source=readFileSync(new URL("../web/src/lib/dine-menu.ts",import.meta.url),"utf8");
const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const {pickupError,DINE_STORE}=await import("data:text/javascript;charset=utf-8,"+encodeURIComponent(js));
const now=new Date("2026-11-16T00:00:00+08:00");
const valid=["2026-11-17T13:30","2026-11-17T20:30","2026-11-21T12:30","2026-11-21T20:30","2026-11-22T12:30","2026-11-22T20:30"];
const invalid=["2026-11-17T13:00","2026-11-17T13:15","2026-11-17T20:45","2026-11-17T21:00","2026-11-21T12:00","2026-11-21T12:15","2026-11-22T20:45","2026-11-16T13:30"];
for(const value of valid)assert.equal(pickupError(value,now),null,`expected valid: ${value}`);
for(const value of invalid)assert.notEqual(pickupError(value,now),null,`expected invalid: ${value}`);
assert.match(pickupError("2026-11-17T13:00",now),/13:30–20:30/);
assert.match(pickupError("2026-11-21T12:00",now),/12:30–20:30/);
assert.match(DINE_STORE.pickupHoursText,/13:30–20:30.*12:30–20:30/);
assert.equal(DINE_STORE.hoursWeekday,"週二至五 13:00–21:00","營業時間不應改動");
console.log("取餐時間驗證通過：開店後 30 分鐘至 20:30，週一公休；營業時間不變");
