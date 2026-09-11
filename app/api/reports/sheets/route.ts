import { env } from 'cloudflare:workers';
import { SHOP_ID } from '@/lib/auth';
import { database } from '@/lib/server-db';
import { bangkokDayRange, DAILY_SUMMARY_SQL, SUMMARY_SHEET_ID, verifySummaryRequest, type DailyTotals } from '@/lib/daily-summary';
export const dynamic = 'force-dynamic';
const json = (value: unknown, status = 200) => Response.json(value, { status, headers: { 'Cache-Control': 'no-store' } });
// Read-only, HMAC-authenticated daily aggregates. No bill details or write operations.
export async function POST(request: Request) {
  try {
    const raw = await request.text();
    if (raw.length > 2048) return json({ error: 'คำขอไม่ถูกต้อง' }, 400);
    const secret = env.GOOGLE_SHEETS_PULL_SECRET;
    if (!secret || secret.length < 32) return json({ error: 'ยังไม่ได้ตั้งค่าการเชื่อมต่อชีต' }, 503);
    const date = await verifySummaryRequest(raw, secret);
    if (!date) return json({ error: 'คีย์เชื่อมต่อหรือคำขอไม่ถูกต้อง' }, 401);
    const range = bangkokDayRange(date);
    const snapshotAt = Date.now();
    const totals = await database().prepare(DAILY_SUMMARY_SQL).bind(SHOP_ID, range.start, range.end).first<DailyTotals>();
    if (!totals || !Object.values(totals).every(n => Number.isSafeInteger(n) && n >= 0) || !Number.isSafeInteger(totals.cash + totals.transfer)) throw new Error();
    return json({ ok: true, version: 1, sheetId: SUMMARY_SHEET_ID, date, snapshotAt, ...totals, total: totals.cash + totals.transfer });
  } catch { return json({ error: 'อ่านสรุปไม่สำเร็จ กรุณาลองใหม่' }, 503); }
}
