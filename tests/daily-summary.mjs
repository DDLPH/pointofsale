import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHmac } from 'node:crypto';
import vm from 'node:vm';
import { DatabaseSync } from 'node:sqlite';
import { bangkokDayRange, DAILY_SUMMARY_SQL, SUMMARY_SHEET_ID, signSummary } from '../lib/daily-summary.ts';

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
const context = vm.createContext({
  console, Date, PropertiesService: { getScriptProperties: () => ({ getProperty: () => secret }) },
  Utilities: { Charset: { UTF_8: 'UTF-8' }, computeHmacSha256Signature: (p, s) => [...createHmac('sha256', s).update(p).digest()], formatDate: date => date.toISOString() },
  LockService: { getScriptLock: () => ({ tryLock: () => { held = true; return true; }, hasLock: () => held, releaseLock: () => { held = false; } }) },
  SpreadsheetApp: { openById: id => { assert.equal(id, SUMMARY_SHEET_ID); return { getSheetByName: () => sheet }; }, flush: () => {} },
  ContentService: { MimeType: { JSON: 'json' }, createTextOutput: text => ({ setMimeType: () => JSON.parse(text) }) },
});
vm.runInContext(readFileSync(new URL('../integrations/google-sheets/Code.gs', import.meta.url), 'utf8'), context);
data.push(vm.runInContext('HEADERS.slice()', context));
const summary = { version: 1, sheetId: SUMMARY_SHEET_ID, date: '2026-09-11', snapshotAt: Date.now() - 1000, ...totals, total: 8000 };
async function send(p, badSignature = false) {
  const payload = JSON.stringify(p);
  const signature = badSignature ? '0'.repeat(64) : await signSummary(payload, secret);
  return context.doPost({ postData: { contents: JSON.stringify({ payload, signature }) } });
}
assert.equal((await send(summary, true)).error, 'unauthorized');
assert.equal(data.length, 1);
assert.equal((await send(summary)).ok, true);
assert.equal(data.length, 2);
assert.deepEqual(Array.from(data[1].slice(0, 6)), ['2026-09-11', 2, 35, 45, 80, 1]);
assert.equal((await send(summary)).ok, true);
assert.equal(data.length, 2);
assert.equal((await send({ ...summary, snapshotAt: summary.snapshotAt - 1 })).error, 'stale');
assert.equal((await send({ ...summary, snapshotAt: Date.now() - 600000 })).error, 'expired');
assert.equal((await send({ ...summary, total: 1 })).error, 'invalid');
assert.equal((await send({ ...summary, sheetId: 'other' })).error, 'invalid');
assert.equal((await send({ ...summary, cash: -1 })).error, 'invalid');
assert.equal((await send({ ...summary, snapshotAt: summary.snapshotAt + 1, bills: 1, cancelled: 2, cash: 0, total: 4500 })).ok, true);
assert.equal(data.length, 2);
assert.equal(data[1][4], 45);
assert.equal(held, false);
console.log('PASS: Bangkok boundaries, cancelled bills, shop isolation, empty totals, signatures, replay, stale requests and date upsert');
