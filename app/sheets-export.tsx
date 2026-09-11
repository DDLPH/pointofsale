import { SUMMARY_SHEET_ID } from '@/lib/daily-summary';
export default function SheetsExport({ date }: { date: string }) {
  return <section className="report-section">
    <h3>สรุปรายวันใน Google Sheets</h3>
    <p className="small-muted">เปิดชีต แล้วเลือกเมนู “ยอดขายร้าน” → “ดึงสรุปตามวันที่” กรอก {date} ดึงวันเดิมซ้ำเพื่ออัปเดตหลังยกเลิกบิล</p>
    <a className="underline" href={'https://docs.google.com/spreadsheets/d/'+SUMMARY_SHEET_ID+'/edit'} target="_blank" rel="noopener noreferrer">เปิด Google Sheets ของร้าน ↗</a>
    <p className="small-muted">เมนูสคริปต์ใช้ผ่าน Google Sheets บนคอมพิวเตอร์</p>
  </section>;
}
