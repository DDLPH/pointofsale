// Daily totals only. No bill details or user credentials are sent to this spreadsheet.
const SHEET_ID = '1mrVY7T86UcGvm0IYm-0LqvYF5OO9yAWjCCjWMKQF2Z0';
const TAB_NAME = 'สรุปรายวัน';
const HEADERS = ['วันที่', 'บิลที่ชำระแล้ว', 'เงินสด (บาท)', 'เงินโอน (บาท)', 'ยอดขายสุทธิ (บาท)', 'บิลยกเลิก', 'อัปเดตล่าสุด (เวลาไทย)', 'เวลาสรุป (ระบบ)'];

// The owner runs this once and keeps the generated key private in Script Properties.
function setup() {
  const props = PropertiesService.getScriptProperties();
  if (!props.getProperty('WEBHOOK_SECRET')) props.setProperty('WEBHOOK_SECRET', Utilities.getUuid() + Utilities.getUuid());
  const book = SpreadsheetApp.openById(SHEET_ID);
  const sheet = book.getSheetByName(TAB_NAME) || book.insertSheet(TAB_NAME);
  if (!sheet.getLastRow()) sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
  sheet.setFrozenRows(1);
  sheet.getRange(1, 1, 1, HEADERS.length).setBackground('#17634b').setFontColor('#ffffff').setFontWeight('bold');
  sheet.setColumnWidth(1, 120);
  sheet.setColumnWidths(2, 5, 150);
  sheet.setColumnWidth(7, 200);
  sheet.hideColumns(8);
  console.log('พร้อมเชื่อมต่อ: คีย์อยู่ใน Project Settings > Script Properties > WEBHOOK_SECRET');
}

function reply_(value) {
  return ContentService.createTextOutput(JSON.stringify(value)).setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  let lock;
  try {
    const raw = e && e.postData && e.postData.contents;
    if (!raw || raw.length > 4096) return reply_({ ok: false, error: 'invalid' });
    const body = JSON.parse(raw);
    const secret = PropertiesService.getScriptProperties().getProperty('WEBHOOK_SECRET');
    if (!secret || typeof body.payload !== 'string' || !/^[0-9a-f]{64}$/.test(body.signature)) return reply_({ ok: false, error: 'unauthorized' });
    const expected = Utilities.computeHmacSha256Signature(body.payload, secret, Utilities.Charset.UTF_8).map(b => ('0' + ((b + 256) % 256).toString(16)).slice(-2)).join('');
    let difference = 0;
    for (let i = 0; i < 64; i++) difference |= expected.charCodeAt(i) ^ body.signature.charCodeAt(i);
    if (difference) return reply_({ ok: false, error: 'unauthorized' });
    const p = JSON.parse(body.payload);
    if (p.version !== 1 || p.sheetId !== SHEET_ID || typeof p.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(p.date) || p.date < '2000-01-01' || p.date > '2100-12-31') return reply_({ ok: false, error: 'invalid' });
    if (new Date(p.date + 'T00:00:00Z').toISOString().slice(0, 10) !== p.date) return reply_({ ok: false, error: 'invalid' });
    if (!Number.isSafeInteger(p.snapshotAt) || Math.abs(Date.now() - p.snapshotAt) > 300000) return reply_({ ok: false, error: 'expired' });
    if (!['bills', 'cancelled', 'cash', 'transfer', 'total'].every(k => Number.isSafeInteger(p[k]) && p[k] >= 0) || p.total !== p.cash + p.transfer) return reply_({ ok: false, error: 'invalid' });
    lock = LockService.getScriptLock();
    if (!lock.tryLock(10000)) return reply_({ ok: false, error: 'busy' });
    const sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName(TAB_NAME);
    if (!sheet || sheet.getRange(1, 1, 1, HEADERS.length).getValues()[0].join('|') !== HEADERS.join('|')) return reply_({ ok: false, error: 'setup_required' });
    const last = sheet.getLastRow();
    const rows = last > 1 ? sheet.getRange(2, 1, last - 1, HEADERS.length).getValues() : [];
    const found = rows.findIndex(row => String(row[0]) === p.date);
    if (found >= 0 && Number(rows[found][7]) >= p.snapshotAt) {
      if (Number(rows[found][7]) === p.snapshotAt) return reply_({ ok: true, sheetId: SHEET_ID, date: p.date, snapshotAt: p.snapshotAt });
      return reply_({ ok: false, error: 'stale' });
    }
    const rowNumber = found >= 0 ? found + 2 : Math.max(2, last + 1);
    sheet.getRange(rowNumber, 1).setNumberFormat('@');
    sheet.getRange(rowNumber, 7).setNumberFormat('@');
    sheet.getRange(rowNumber, 1, 1, HEADERS.length).setValues([[p.date, p.bills, p.cash / 100, p.transfer / 100, p.total / 100, p.cancelled, Utilities.formatDate(new Date(p.snapshotAt), 'Asia/Bangkok', 'yyyy-MM-dd HH:mm:ss'), p.snapshotAt]]);
    sheet.getRange(rowNumber, 3, 1, 3).setNumberFormat('#,##0.00');
    SpreadsheetApp.flush();
    return reply_({ ok: true, sheetId: SHEET_ID, date: p.date, snapshotAt: p.snapshotAt });
  } catch (_) { return reply_({ ok: false, error: 'failed' }); }
  finally { if (lock && lock.hasLock()) lock.releaseLock(); }
}
