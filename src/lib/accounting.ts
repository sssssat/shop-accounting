/* accounting.ts — ตรรกะล้วน ไม่แตะ browser/ฐานข้อมูล (ทดสอบได้ใน tests/run.ts) */

export const CATEGORIES = ['ซื้อสินค้า', 'ค่าจ้าง', 'ค่าเช่า', 'น้ำ ไฟ เน็ต', 'บรรจุภัณฑ์', 'ค่าขนส่ง', 'ซ่อมและอุปกรณ์', 'อื่นๆ'];
export const PAY_METHODS = ['โอนเงิน', 'เงินสด', 'บัตร'];

const TH_MONTHS = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
const TH_MONTHS_FULL = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];

export const baht = (n: number) => '฿' + n.toLocaleString('en-US', { maximumFractionDigits: 2 });

/** วันตามเวลาไทย รูปแบบ YYYY-MM-DD */
export const bangkokDay = (at: string | number | Date) => new Date(at).toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' });
export const today = () => bangkokDay(Date.now());
export const thisMonth = () => today().slice(0, 7);

export function thaiDate(iso: string): string {
  const [, m, d] = iso.split('-').map(Number);
  return `${d} ${TH_MONTHS[m - 1]}`;
}

/** '2026-11' -> 'พฤศจิกายน 2569' */
export function thaiMonth(month: string): string {
  const [y, m] = month.split('-').map(Number);
  return `${TH_MONTHS_FULL[m - 1]} ${y + 543}`;
}

/** '2026-11' -> 'พ.ย. 2569' */
export function thaiMonthShort(month: string): string {
  const [y, m] = month.split('-').map(Number);
  return `${TH_MONTHS[m - 1]} ${y + 543}`;
}

export function monthRange(month: string): { from: string; to: string } {
  const [y, m] = month.split('-').map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return { from: `${month}-01`, to: `${month}-${String(last).padStart(2, '0')}` };
}

/** วันครบกำหนดของรายจ่ายประจำ: วันที่ 31 ในเดือนสั้นจะเป็นวันสุดท้ายของเดือน */
export function recurringDate(month: string, day: number): string {
  const lastDay = Number(monthRange(month).to.slice(-2));
  return `${month}-${String(Math.min(day, lastDay)).padStart(2, '0')}`;
}

export interface Bill {
  id: string;
  no: number;
  total: number;
  refunded: number;
  method: string;
  status: 'paid' | 'void';
  createdAt: string;
}

export const billNet = (b: Pick<Bill, 'status' | 'total' | 'refunded'>) => (b.status === 'void' ? 0 : b.total - b.refunded);

export interface DaySummary {
  date: string;
  bills: Bill[];
  net: number;
}

/** รวมบิลเป็นรายวัน ใหม่ -> เก่า */
export function groupBillsByDay(bills: Bill[]): DaySummary[] {
  const map = new Map<string, DaySummary>();
  bills.forEach((b) => {
    const date = bangkokDay(b.createdAt);
    const d = map.get(date) ?? { date, bills: [], net: 0 };
    d.bills.push(b);
    d.net += billNet(b);
    map.set(date, d);
  });
  const days = [...map.values()].sort((a, b) => b.date.localeCompare(a.date));
  days.forEach((d) => d.bills.sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
  return days;
}

export interface LedgerRow {
  date: string;
  detail: string;
  income: number;
  expense: number;
}

/** รายการรับ-จ่ายเรียงตามวัน: ยอด POS รวมเป็นรายการเดียวต่อวัน */
export function buildLedger(
  bills: Bill[],
  other: { date: string; source: string; amount: number }[],
  expenses: { date: string; vendor: string; category: string; amount: number }[]
): LedgerRow[] {
  const rows: LedgerRow[] = [];
  groupBillsByDay(bills).forEach((d) => {
    if (d.net !== 0) rows.push({ date: d.date, detail: 'ยอดขายจาก POS', income: d.net, expense: 0 });
  });
  other.forEach((o) => rows.push({ date: o.date, detail: `รายรับนอก POS: ${o.source}`, income: o.amount, expense: 0 }));
  expenses.forEach((e) => rows.push({ date: e.date, detail: `${e.category}: ${e.vendor}`, income: 0, expense: e.amount }));
  return rows.sort((a, b) => a.date.localeCompare(b.date) || b.income - a.income);
}

export interface ImportRow {
  line: number;
  date: string;
  vendor: string;
  category: string;
  payMethod: string;
  amount: number;
  error?: string;
}

/** dd/mm/yyyy (พ.ศ. หรือ ค.ศ.) หรือ yyyy-mm-dd -> YYYY-MM-DD, ไม่ใช่วันจริง = null */
export function parseDate(raw: string): string | null {
  const s = raw.trim();
  let y: number, m: number, d: number;
  const dmy = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(s);
  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(s);
  if (dmy) [d, m, y] = [Number(dmy[1]), Number(dmy[2]), Number(dmy[3])];
  else if (iso) [y, m, d] = [Number(iso[1]), Number(iso[2]), Number(iso[3])];
  else return null;
  if (y > 2400) y -= 543;
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return null;
  return dt.toISOString().slice(0, 10);
}

/** ข้อความที่คัดลอกจาก Google Sheet (คั่นด้วย Tab): วันที่, ผู้ขาย, หมวด, ยอดเงิน, วิธีจ่าย(ไม่บังคับ) */
export function parseImport(text: string): ImportRow[] {
  const rows: ImportRow[] = [];
  text.split(/\r?\n/).forEach((raw, i) => {
    if (!raw.trim()) return;
    const [d = '', v = '', c = '', a = '', p = ''] = raw.split('\t').map((x) => x.trim());
    if (i === 0 && d.includes('วันที่')) return; // แถวหัวตาราง
    const date = parseDate(d);
    const amount = Number(a.replace(/,/g, ''));
    const payMethod = p || 'โอนเงิน';
    let error: string | undefined;
    if (!date) error = 'วันที่ไม่ถูกต้อง';
    else if (!v) error = 'ไม่มีผู้ขาย';
    else if (!CATEGORIES.includes(c)) error = 'ไม่รู้จักหมวด';
    else if (!(amount > 0)) error = 'ยอดเงินไม่ถูกต้อง';
    else if (!PAY_METHODS.includes(payMethod)) error = 'ไม่รู้จักวิธีจ่าย';
    rows.push({ line: i + 1, date: date ?? d, vendor: v, category: c, payMethod, amount: amount || 0, error });
  });
  return rows;
}
