export const SUMMARY_SHEET_ID = '1mrVY7T86UcGvm0IYm-0LqvYF5OO9yAWjCCjWMKQF2Z0';

export function bangkokDayRange(date: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date < '2000-01-01' || date > '2100-12-31') throw new Error('Invalid date');
  const calendar = new Date(date + 'T00:00:00.000Z');
  if (!Number.isFinite(calendar.getTime()) || calendar.toISOString().slice(0, 10) !== date) throw new Error('Invalid date');
  const start = new Date(calendar.getTime() - 7 * 3600000);
  return { start: start.toISOString(), end: new Date(start.getTime() + 86400000).toISOString() };
}

export const DAILY_SUMMARY_SQL = `SELECT
  COUNT(CASE WHEN cancelled IS NULL THEN 1 END) AS bills,
  COUNT(CASE WHEN cancelled IS NOT NULL THEN 1 END) AS cancelled,
  COALESCE(SUM(CASE WHEN cancelled IS NULL AND method = 'cash' THEN total ELSE 0 END), 0) AS cash,
  COALESCE(SUM(CASE WHEN cancelled IS NULL AND method = 'transfer' THEN total ELSE 0 END), 0) AS transfer
  FROM orders WHERE owner = ? AND created >= ? AND created < ?`;

export type DailyTotals = { bills: number; cancelled: number; cash: number; transfer: number };

export async function signSummary(payload: string, secret: string) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const bytes = new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(payload)));
  return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
}

export async function verifySummaryRequest(raw: string, secret: string, now = Date.now()): Promise<string | null> {
  try {
    const body = JSON.parse(raw);
    if (typeof body.payload !== 'string' || typeof body.signature !== 'string' || !/^[0-9a-f]{64}$/.test(body.signature)) return null;
    const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']);
    const signature = Uint8Array.from(body.signature.match(/../g)!, (s: string) => parseInt(s, 16));
    if (!await crypto.subtle.verify('HMAC', key, signature, new TextEncoder().encode(body.payload))) return null;
    const p = JSON.parse(body.payload);
    if (p.action !== 'read_daily_summary' || p.sheetId !== SUMMARY_SHEET_ID || !Number.isSafeInteger(p.timestamp) || Math.abs(now - p.timestamp) > 300000 || typeof p.date !== 'string') return null;
    bangkokDayRange(p.date);
    return p.date;
  } catch { return null; }
}
