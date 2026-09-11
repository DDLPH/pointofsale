'use client';
import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { money } from '@/lib/pos';

export default function SheetsExport({ date }: { date: string }) {
  const lock = useRef(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<{ error: boolean; text: string } | null>(null);
  async function send() {
    if (lock.current) return;
    lock.current = true; setBusy(true); setStatus(null);
    const selectedDate = date;
    try {
      const response = await fetch('/api/reports/sheets', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ date: selectedDate }),
      });
      const result = await response.json() as { ok?: boolean; error?: string; bills: number; total: number };
      if (!response.ok || !result.ok || !Number.isSafeInteger(result.total) || !Number.isSafeInteger(result.bills)) throw new Error(result.error || 'ส่งสรุปไม่สำเร็จ');
      setStatus({ error: false, text: `ส่งสรุปวันที่ ${selectedDate} แล้ว · ${result.bills} บิล · ${money(result.total)}` });
    } catch (error) { setStatus({ error: true, text: error instanceof Error ? error.message : 'ส่งสรุปไม่สำเร็จ กรุณาลองอีกครั้ง' }); }
    finally { lock.current = false; setBusy(false); }
  }
  return <section className="report-section">
    <h3>สรุปรายวันใน Google Sheets</h3>
    <p className="small-muted">ส่งยอดวันที่เลือกตามเวลาไทย ไม่รวมยอดบิลยกเลิก ส่งซ้ำจะอัปเดตแถวเดิม หากแก้บิลภายหลังให้ส่งวันนั้นใหม่</p>
    <Button disabled={busy || !date} onClick={send}>{busy ? 'กำลังส่งสรุป…' : 'ส่งสรุปไป Google Sheets'}</Button>
    {status && <p className={status.error ? 'dialog-error' : 'small-muted'} role={status.error ? 'alert' : 'status'}>{status.text}</p>}
  </section>;
}
