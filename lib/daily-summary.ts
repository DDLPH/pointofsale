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
