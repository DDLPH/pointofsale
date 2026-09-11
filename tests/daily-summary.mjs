import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHmac } from 'node:crypto';
import vm from 'node:vm';
import { DatabaseSync } from 'node:sqlite';
import { bangkokDayRange, DAILY_SUMMARY_SQL, SUMMARY_SHEET_ID, signSummary, verifySummaryRequest } from '../lib/daily-summary.ts';

const range = bangkokDayRange('2026-09-11');
assert.deepEqual(range, { start: '2026-09-10T17:00:00.000Z', end: '2026-09-11T17:00:00.000Z' });
for (const date of ['2026-02-30', '2025-02-29', '2026-9-1', '', '=IMPORTXML(...)']) assert.throws(() => bangkokDayRange(date));
assert.equal(bangkokDayRange('2024-02-29').end, '2024-02-29T17:00:00.000Z');
const db = new DatabaseSync(':memory:');
db.exec('CREATE TABLE orders(owner TEXT,created TEXT,total INTEGER,method TEXT,cancelled TEXT)');
const insert = db.prepare('INSERT INTO orders VALUES (?,?,?,?,?)');
insert.run('main-shop', range.start, 3500, 'cash', null);
insert.run('main-shop', '2026-09-11T16:59:59.999Z', 4500, 'transfer', null);
insert.run('main-shop', '2026-09-11T08:00:00.000Z', 5000, 'cash', 'cancelled');
insert.run('main-shop', range.end, 99999, 'cash', null);
insert.run('main-shop', '2026-09-10T16:59:59.999Z', 99999, 'cash', null);
insert.run('other-shop', range.start, 99999, 'cash', null);
const totals = { ...db.prepare(DAILY_SUMMARY_SQL).get('main-shop', range.start, range.end) };
assert.deepEqual(totals, { bills: 2, cancelled: 1, cash: 3500, transfer: 4500 });
assert.deepEqual({ ...db.prepare(DAILY_SUMMARY_SQL).get('empty', range.start, range.end) }, { bills: 0, cancelled: 0, cash: 0, transfer: 0 });
db.close();

const secret = 'test-only-random-key-never-used-in-production';
const data = [];
let held = false;
const sheet = {
  getLastRow: () => data.length,
  getRange: (row, column, height = 1, width = 1) => ({
    getValues: () => Array.from({ length: height }, (_, r) => Array.from({ length: width }, (_, c) => data[row - 1 + r]?.[column - 1 + c] ?? '')),
    setValues: values => { values.forEach((cells, r) => { data[row - 1 + r] ??= []; cells.forEach((v, c) => data[row - 1 + r][column - 1 + c] = v); }); },
    setNumberFormat: () => {},
  }),
};
let responseData;
let responseCode = 200;
const context = vm.createContext({
  UrlFetchApp: { fetch: (url, options) => { assert.ok(url.endsWith("/api/reports/sheets")); assert.equal(options.followRedirects, false); const b=JSON.parse(options.payload); assert.equal(b.signature, createHmac("sha256", secret).update(b.payload).digest("hex")); return { getResponseCode: () => responseCode, getContentText: () => JSON.stringify(responseData) }; } },
  console, Date, PropertiesService: { getScriptProperties: () => ({ getProperty: () => secret }) },
  Utilities: { Charset: { UTF_8: 'UTF-8' }, computeHmacSha256Signature: (p, s) => [...createHmac('sha256', s).update(p).digest()], formatDate: date => date.toISOString() },
  LockService: { getScriptLock: () => ({ tryLock: () => { held = true; return true; }, hasLock: () => held, releaseLock: () => { held = false; } }) },
  SpreadsheetApp: { openById: id => { assert.equal(id, SUMMARY_SHEET_ID); return { getSheetByName: () => sheet }; }, flush: () => {} },
  ContentService: { MimeType: { JSON: 'json' }, createTextOutput: text => ({ setMimeType: () => JSON.parse(text) }) },
});
vm.runInContext(readFileSync(new URL('../integrations/google-sheets/Code.gs', import.meta.url), 'utf8'), context);
data.push(vm.runInContext('HEADERS.slice()', context));
const summary = { version: 1, sheetId: SUMMARY_SHEET_ID, date: '2026-09-11', snapshotAt: Date.now() - 1000, ...totals, total: 8000 };
const requestBody = { action: 'read_daily_summary', sheetId: SUMMARY_SHEET_ID, date: '2026-09-11', timestamp: Date.now() };
async function envelope(p, key=secret) { const payload=JSON.stringify(p); return JSON.stringify({payload, signature:await signSummary(payload,key)}); }
assert.equal(await verifySummaryRequest(await envelope(requestBody), secret), requestBody.date);
assert.equal(await verifySummaryRequest(await envelope(requestBody,'wrong'), secret), null);
for(const change of [{timestamp:0},{sheetId:'other'},{action:'write'},{date:'2026-02-30'}]) assert.equal(await verifySummaryRequest(await envelope({...requestBody,...change}),secret), null);
assert.equal(await verifySummaryRequest('garbage', secret),null);
responseData={ok:true,...summary};
context.pullSummary_('2026-09-11');
assert.equal(data.length,2);
assert.deepEqual(Array.from(data[1].slice(0,6)), ['2026-09-11',2,35,45,80,1]);
context.pullSummary_('2026-09-11'); assert.equal(data.length,2);
responseData={ok:true,...summary,snapshotAt:summary.snapshotAt-1}; assert.throws(()=>context.pullSummary_('2026-09-11'));
responseData={ok:true,...summary,sheetId:'other'}; assert.throws(()=>context.pullSummary_('2026-09-11'));
responseData={ok:true,...summary,total:1}; assert.throws(()=>context.pullSummary_('2026-09-11'));
responseCode=503; assert.throws(()=>context.pullSummary_('2026-09-11')); responseCode=200;
responseData={ok:true,...summary,snapshotAt:summary.snapshotAt+1,bills:1,cancelled:2,cash:0,total:4500}; context.pullSummary_('2026-09-11');
assert.equal(data.length,2); assert.equal(data[1][4],45); assert.equal(held,false);
console.log('PASS: Bangkok dates, cancellations, shop isolation, HMAC authentication, expiry, response validation, retry and upsert');
