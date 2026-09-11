import assert from 'node:assert/strict';
import {signSummary,SUMMARY_SHEET_ID} from '../lib/daily-summary.ts';
const root=process.env.TEST_BASE_URL || 'http://localhost:5173';
const secret=process.env.TEST_PULL_SECRET;
assert.ok(secret);
async function call(body) { const r=await fetch(root+'/api/reports/sheets',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}); return {status:r.status,data:await r.json()}; }
assert.equal((await call({date:'2026-09-11'})).status,401);
const p={action:'read_daily_summary',sheetId:SUMMARY_SHEET_ID,date:'2026-09-11',timestamp:Date.now()};
async function signed(p,key=secret){const payload=JSON.stringify(p);return call({payload,signature:await signSummary(payload,key)});}
assert.equal((await signed(p,'wrong')).status,401);
assert.equal((await signed({...p,timestamp:0})).status,401);
assert.equal((await signed({...p,date:'2026-02-30'})).status,401);
const result=await signed(p);assert.equal(result.status,200);assert.equal(result.data.date,p.date);assert.equal(result.data.total,result.data.cash+result.data.transfer);assert.ok(!('orders' in result.data));
console.log('PASS: live route signed read, invalid key, expiry, invalid date, aggregates only');
