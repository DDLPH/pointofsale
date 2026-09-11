const SHEET_ID = '1mrVY7T86UcGvm0IYm-0LqvYF5OO9yAWjCCjWMKQF2Z0';
const TAB_NAME = 'สรุปรายวัน';
const HEADERS = ['วันที่', 'บิลที่ชำระแล้ว', 'เงินสด (บาท)', 'เงินโอน (บาท)', 'ยอดขายสุทธิ (บาท)', 'บิลยกเลิก', 'อัปเดตล่าสุด (เวลาไทย)', 'เวลาสรุป (ระบบ)'];

const POS_URL = 'https://chicken-noodle-pos-demmy.dem-290747.chatgpt.site/api/reports/sheets';

// Bound script only. Do not deploy a web app. Retains the existing private key.
function onOpen() {
  SpreadsheetApp.getUi().createMenu('ยอดขายร้าน').addItem('ดึงสรุปวันนี้', 'pullToday').addItem('ดึงสรุปตามวันที่', 'pullDate').addToUi();
}

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
  onOpen();
}

function pullToday() {
  showResult_(Utilities.formatDate(new Date(), 'Asia/Bangkok', 'yyyy-MM-dd'));
}

function pullDate() {
  const ui = SpreadsheetApp.getUi();
  const answer = ui.prompt('ดึงสรุปรายวัน', 'กรอกวันที่ ค.ศ. เช่น 2026-09-11', ui.ButtonSet.OK_CANCEL);
  if (answer.getSelectedButton() !== ui.Button.OK) return;
  showResult_(answer.getResponseText().trim());
}

function showResult_(date) {
  const ui = SpreadsheetApp.getUi();
  try {
    const p = pullSummary_(date);
    ui.alert('อัปเดตวันที่ ' + p.date + ' แล้ว: ' + p.bills + ' บิล รวม ' + (p.total / 100).toFixed(2) + ' บาท');
  } catch (error) { ui.alert('ยังไม่อัปเดตสรุป: ' + error.message); }
}

function pullSummary_(date) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date < '2000-01-01' || date > '2100-12-31' || new Date(date + 'T00:00:00Z').toISOString().slice(0, 10) !== date) throw new Error('วันที่ไม่ถูกต้อง');
  const secret = PropertiesService.getScriptProperties().getProperty('WEBHOOK_SECRET');
  if (!secret) throw new Error('ยังไม่มีคีย์เชื่อมต่อ');
  const payload = JSON.stringify({ action: 'read_daily_summary', sheetId: SHEET_ID, date: date, timestamp: Date.now() });
  const signature = Utilities.computeHmacSha256Signature(payload, secret, Utilities.Charset.UTF_8).map(b => ('0' + ((b + 256) % 256).toString(16)).slice(-2)).join('');
  const response = UrlFetchApp.fetch(POS_URL, { method: 'post', contentType: 'application/json', payload: JSON.stringify({ payload: payload, signature: signature }), muteHttpExceptions: true, followRedirects: false });
  if (response.getResponseCode() !== 200) throw new Error('เชื่อม POS ไม่สำเร็จ กรุณาลองใหม่หรือตรวจคีย์เชื่อมต่อ');
  const p = JSON.parse(response.getContentText());
  if (!p.ok || p.version !== 1 || p.sheetId !== SHEET_ID || p.date !== date || !Number.isSafeInteger(p.snapshotAt) || Math.abs(Date.now() - p.snapshotAt) > 300000 || !['bills', 'cancelled', 'cash', 'transfer', 'total'].every(k => Number.isSafeInteger(p[k]) && p[k] >= 0) || p.total !== p.cash + p.transfer) throw new Error('ข้อมูลตอบกลับไม่ถูกต้อง');
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) throw new Error('กำลังอัปเดตสรุปอยู่ กรุณาลองใหม่');
  try {
    const sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName(TAB_NAME);
    if (!sheet || sheet.getRange(1, 1, 1, HEADERS.length).getValues()[0].join('|') !== HEADERS.join('|')) throw new Error('กรุณาเรียก setup ก่อน และอย่าแก้หัวคอลัมน์');
    const last = sheet.getLastRow();
    const rows = last > 1 ? sheet.getRange(2, 1, last - 1, HEADERS.length).getValues() : [];
    const found = rows.findIndex(row => String(row[0]) === p.date);
    if (found >= 0 && Number(rows[found][7]) >= p.snapshotAt) {
      if (Number(rows[found][7]) === p.snapshotAt) return p;
      throw new Error('มีสรุปที่ใหม่กว่าแล้ว กรุณาดึงใหม่');
    }
    const rowNumber = found >= 0 ? found + 2 : Math.max(2, last + 1);
    sheet.getRange(rowNumber, 1).setNumberFormat('@');
    sheet.getRange(rowNumber, 7).setNumberFormat('@');
    sheet.getRange(rowNumber, 1, 1, HEADERS.length).setValues([[p.date, p.bills, p.cash / 100, p.transfer / 100, p.total / 100, p.cancelled, Utilities.formatDate(new Date(p.snapshotAt), 'Asia/Bangkok', 'yyyy-MM-dd HH:mm:ss'), p.snapshotAt]]);
    sheet.getRange(rowNumber, 3, 1, 3).setNumberFormat('#,##0.00');
    SpreadsheetApp.flush();
    return p;
  } finally { lock.releaseLock(); }
}
