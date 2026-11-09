'use client';

import { billNet, buildLedger, CATEGORIES } from './accounting';
import { fetchBills, listExpenses, listOtherIncome } from './data';

const MONEY = '#,##0.00;(#,##0.00);-';
const FONT = { name: 'Arial' };
const HEAD_FILL = { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'FFFFEDD5' } };

const toDate = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
};

/** ส่งออกรายรับรายจ่ายของช่วงวันที่เป็น Excel และดาวน์โหลด */
export async function exportPeriod(label: string, from: string, to: string): Promise<void> {
  const [bills, other, expenses, ExcelJS] = await Promise.all([fetchBills(from, to), listOtherIncome(from, to), listExpenses(from, to), import('exceljs')]);
  const posTotal = bills.reduce((s, b) => s + billNet(b), 0);
  const otherTotal = other.reduce((s, o) => s + o.amount, 0);
  const expenseTotal = expenses.reduce((s, e) => s + e.amount, 0);
  const missing = expenses.filter((e) => !e.receipt_path).reduce((s, e) => s + e.amount, 0);

  const wb = new ExcelJS.Workbook();
  const sheet = (name: string, title: string, widths: number[]) => {
    const ws = wb.addWorksheet(name);
    ws.columns = widths.map((width) => ({ width }));
    ws.addRow([title]).font = { ...FONT, bold: true, size: 14 };
    ws.addRow([`ช่วงข้อมูล ${from} ถึง ${to}`]).font = { ...FONT, size: 10 };
    ws.addRow([]);
    return ws;
  };
  const header = (ws: import('exceljs').Worksheet, cols: string[]) => {
    const r = ws.addRow(cols);
    r.font = { ...FONT, bold: true };
    r.eachCell((c) => (c.fill = HEAD_FILL));
    ws.views = [{ state: 'frozen', ySplit: r.number }];
  };
  const body = (ws: import('exceljs').Worksheet, values: (string | number | Date)[], moneyCols: number[], dateCol?: number) => {
    const r = ws.addRow(values);
    r.font = FONT;
    moneyCols.forEach((c) => (r.getCell(c).numFmt = MONEY));
    if (dateCol) r.getCell(dateCol).numFmt = 'dd/mm/yyyy';
  };
  const sumRow = (ws: import('exceljs').Worksheet, first: number, cols: number[], width: number) => {
    const last = ws.rowCount;
    const values: (string | { formula: string; result: number })[] = new Array(width).fill('');
    values[0] = 'รวม';
    const r = ws.addRow(values);
    cols.forEach((c) => {
      const L = String.fromCharCode(64 + c);
      let result = 0;
      for (let i = first; i <= last; i++) result += Number(ws.getCell(`${L}${i}`).value) || 0;
      r.getCell(c).value = { formula: `SUM(${L}${first}:${L}${last})`, result };
      r.getCell(c).numFmt = MONEY;
    });
    r.font = { ...FONT, bold: true };
  };

  const s = sheet('สรุป', `รายงานบัญชีร้าน ${label}`, [34, 18]);
  header(s, ['รายการ', 'ยอดเงิน (บาท)']);
  [
    ['รายรับจาก POS', posTotal],
    ['รายรับนอก POS', otherTotal],
    ['รวมรายรับ', posTotal + otherTotal],
    ['รวมรายจ่าย', expenseTotal],
    ['คงเหลือก่อนภาษี', posTotal + otherTotal - expenseTotal],
    ['รายจ่ายที่ยังไม่มีหลักฐาน', missing],
  ].forEach((r) => body(s, r, [2]));
  s.addRow([]);
  s.addRow(['รายจ่ายตามหมวด']).font = { ...FONT, bold: true };
  const known = new Set(CATEGORIES);
  [...CATEGORIES, ...new Set(expenses.map((e) => e.category).filter((c) => !known.has(c)))].forEach((c) => {
    const sum = expenses.filter((e) => e.category === c).reduce((t, e) => t + e.amount, 0);
    if (sum) body(s, [c, sum], [2]);
  });

  const led = sheet('รับ-จ่ายรายวัน', `รายการรับ-จ่ายรายวัน ${label}`, [14, 44, 16, 16]);
  header(led, ['วันที่', 'รายการ', 'รายรับ', 'รายจ่าย']);
  const ledFirst = led.rowCount + 1;
  buildLedger(bills, other, expenses).forEach((r) => body(led, [toDate(r.date), r.detail, r.income, r.expense], [3, 4], 1));
  if (led.rowCount >= ledFirst) sumRow(led, ledFirst, [3, 4], 4);

  const bl = sheet('บิล POS', `บิลจาก POS ${label}`, [12, 20, 12, 12, 14, 14, 14]);
  header(bl, ['เลขบิล', 'วันเวลา', 'วิธีชำระ', 'สถานะ', 'ยอดบิล', 'คืนแล้ว', 'ยอดนับรายรับ']);
  const blFirst = bl.rowCount + 1;
  bills.forEach((b) =>
    body(
      bl,
      [b.no, new Date(b.createdAt).toLocaleString('th-TH', { timeZone: 'Asia/Bangkok', dateStyle: 'short', timeStyle: 'short' }), b.method === 'qr' ? 'QR' : 'เงินสด', b.status === 'void' ? 'ยกเลิก' : 'ชำระแล้ว', b.total, b.refunded, billNet(b)],
      [5, 6, 7]
    )
  );
  if (bl.rowCount >= blFirst) sumRow(bl, blFirst, [7], 7);

  const ex = sheet('รายจ่าย', `รายจ่าย ${label}`, [14, 26, 16, 18, 12, 16, 12]);
  header(ex, ['วันที่', 'ผู้ขาย', 'เลขที่บิล', 'หมวด', 'วิธีจ่าย', 'ยอดเงิน', 'หลักฐาน']);
  const exFirst = ex.rowCount + 1;
  const ordered = [...expenses].reverse();
  ordered.forEach((e) => body(ex, [toDate(e.date), e.vendor, e.bill_ref ?? '', e.category, e.pay_method, e.amount, e.receipt_path ? 'มี' : 'ไม่มี'], [6], 1));
  if (ex.rowCount >= exFirst) sumRow(ex, exFirst, [6], 7);

  // รายการย่อยของแต่ละบิล (เฉพาะบิลที่กรอกรายการไว้)
  const withItems = ordered.filter((e) => e.items.length > 0);
  if (withItems.length) {
    const it = sheet('รายการในบิล', `รายการในบิลรายจ่าย ${label}`, [14, 24, 16, 30, 10, 14, 14]);
    header(it, ['วันที่', 'ผู้ขาย', 'เลขที่บิล', 'รายการ', 'จำนวน', 'ราคาต่อหน่วย', 'รวม']);
    const itFirst = it.rowCount + 1;
    withItems.forEach((e) => e.items.forEach((x) => body(it, [toDate(e.date), e.vendor, e.bill_ref ?? '', x.name, x.qty, x.unit_price, x.qty * x.unit_price], [6, 7], 1)));
    sumRow(it, itFirst, [7], 7);
  }

  const buffer = await wb.xlsx.writeBuffer();
  const url = URL.createObjectURL(new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = `บัญชีร้าน-${label.replace(/\s+/g, '-')}.xlsx`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}
