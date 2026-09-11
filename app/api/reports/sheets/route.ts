import { env } from 'cloudflare:workers';
import { getStaff, sameOrigin, SHOP_ID } from '@/lib/auth';
import { database } from '@/lib/server-db';
import { bangkokDayRange, DAILY_SUMMARY_SQL, SUMMARY_SHEET_ID, signSummary, type DailyTotals } from '@/lib/daily-summary';

export const dynamic = 'force-dynamic';
const json = (value: unknown, status = 200) => Response.json(value, { status, headers: { 'Cache-Control': 'no-store' } });

export async function POST(request: Request) {
  try {
    const user = await getStaff();
    if (!user) return json({ error: 'กรุณาเข้าสู่ระบบ' }, 401);
    if (user.role !== 'admin' || !sameOrigin(request)) return json({ error: 'สำหรับแอดมินเท่านั้น' }, 403);
    let date: string, range: ReturnType<typeof bangkokDayRange>;
    try {
      const body = await request.json() as { date?: unknown };
      if (typeof body?.date !== 'string') throw new Error();
      date = body.date;
      range = bangkokDayRange(date);
    } catch { return json({ error: 'กรุณาเลือกวันที่ให้ถูกต้อง' }, 400); }
    const url = env.GOOGLE_SHEETS_WEBHOOK_URL, secret = env.GOOGLE_SHEETS_WEBHOOK_SECRET;
    if (!url || !/^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(url) || !secret || secret.length < 32) {
      return json({ error: 'ยังไม่ได้เชื่อม Google Sheets กรุณาติดต่อแอดมินเพื่อตั้งค่าการเชื่อมต่อ' }, 503);
    }
    // Timestamp precedes the database snapshot so delayed requests cannot overwrite a later export.
    const snapshotAt = Date.now();
    const totals = await database().prepare(DAILY_SUMMARY_SQL).bind(SHOP_ID, range.start, range.end).first<DailyTotals>();
    if (!totals || !Object.values(totals).every(n => Number.isSafeInteger(n) && n >= 0)) throw new Error('Invalid totals');
    const payload = JSON.stringify({ version: 1, sheetId: SUMMARY_SHEET_ID, date, snapshotAt, ...totals, total: totals.cash + totals.transfer });
    const signature = await signSummary(payload, secret);
    const response = await fetch(url, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ payload, signature }), signal: AbortSignal.timeout(25000), redirect: 'follow',
    });
    if (!response.ok) throw new Error('Receiver unavailable');
    const result = await response.json() as { ok?: boolean; sheetId?: string; date?: string; snapshotAt?: number; error?: string };
    if (result.error === 'stale') return json({ error: 'มีการส่งสรุปที่ใหม่กว่าแล้ว กรุณาส่งอีกครั้งเพื่อยืนยันยอดล่าสุด' }, 409);
    if (!result.ok || result.sheetId !== SUMMARY_SHEET_ID || result.date !== date || result.snapshotAt !== snapshotAt) throw new Error('Unconfirmed export');
    return json({ ok: true, date, ...totals, total: totals.cash + totals.transfer });
  } catch {
    // Never log the signed payload, webhook URL, or secret.
    return json({ error: 'ยังยืนยันการส่งสรุปไม่ได้ กรุณาลองอีกครั้ง วันที่เดิมจะอัปเดตแถวเดิม' }, 502);
  }
}
