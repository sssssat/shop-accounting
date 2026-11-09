import { billNet, buildLedger, itemsTotal, groupBillsByDay, monthRange, parseDate, parseImport, recurringDate, type Bill } from '../src/lib/accounting';

let pass = 0;
let fail = 0;
function check(name: string, ok: boolean) {
  if (ok) pass++;
  else {
    fail++;
    console.log('ล้มเหลว: ' + name);
  }
}

const bill = (id: string, createdAt: string, total: number, status: Bill['status'] = 'paid', refunded = 0): Bill => ({ id, no: 1, total, refunded, method: 'qr', status, createdAt });

check('บิลยกเลิกนับเป็น 0', billNet(bill('a', '2026-11-01T01:00:00Z', 100, 'void')) === 0);
check('หักยอดคืนสินค้า', billNet(bill('a', '2026-11-01T01:00:00Z', 100, 'paid', 30)) === 70);

const days = groupBillsByDay([bill('a', '2026-11-01T18:00:00Z', 100), bill('b', '2026-11-01T17:10:00Z', 50), bill('c', '2026-11-01T17:30:00Z', 20, 'void')]);
check('แบ่งวันตามเวลาไทย', days.length === 1 && days[0].date === '2026-11-02' && days[0].net === 150);
const edge = groupBillsByDay([bill('a', '2026-11-01T16:59:00Z', 1), bill('b', '2026-11-01T17:00:00Z', 2)]);
check('เที่ยงคืนไทยแยกวัน', edge.length === 2 && edge[0].date === '2026-11-02' && edge[1].date === '2026-11-01');

check('วันสุดท้ายของ ก.พ.', monthRange('2026-02').to === '2026-02-28');
check('ธันวาคม', monthRange('2026-12').to === '2026-12-31');
check('รายจ่ายวันที่ 31 ในเดือนสั้น', recurringDate('2026-02', 31) === '2026-02-28');
check('รายจ่ายวันปกติ', recurringDate('2026-11', 5) === '2026-11-05');

check('วันที่ พ.ศ.', parseDate('06/11/2569') === '2026-11-06');
check('วันที่ ค.ศ.', parseDate('6/11/2026') === '2026-11-06');
check('วันที่ ISO', parseDate('2026-11-06') === '2026-11-06');
check('วันที่ไม่มีจริง', parseDate('31/02/2026') === null);

const imp = parseImport('วันที่\tผู้ขาย\tหมวด\tยอดเงิน\n06/11/2569\tตลาดสด\tซื้อสินค้า\t1,250\tเงินสด\n\tไม่มีวัน\tซื้อสินค้า\t10\n07/11/2569\tร้าน\tไม่มีหมวดนี้\t10\n07/11/2569\tร้าน\tอื่นๆ\t0');
check('ข้ามหัวตาราง อ่านแถวครบ', imp.length === 4);
check('แถวปกติ', !imp[0].error && imp[0].amount === 1250 && imp[0].payMethod === 'เงินสด' && imp[0].date === '2026-11-06');
check('เตือนวันที่', imp[1].error === 'วันที่ไม่ถูกต้อง');
check('เตือนหมวด', imp[2].error === 'ไม่รู้จักหมวด');
check('เตือนยอด', imp[3].error === 'ยอดเงินไม่ถูกต้อง');

const ledger = buildLedger([bill('a', '2026-11-01T01:00:00Z', 100), bill('v', '2026-11-03T01:00:00Z', 9, 'void')], [{ date: '2026-11-02', source: 'เดลิเวอรี', amount: 50 }], [{ date: '2026-11-01', vendor: 'ตลาด', category: 'ซื้อสินค้า', amount: 30 }]);
check('สมุดรับ-จ่ายเรียงวัน ไม่รวมวันที่มีแต่บิลยกเลิก', ledger.length === 3 && ledger[0].income === 100 && ledger[1].expense === 30 && ledger[2].income === 50);

check('รวมรายการย่อย', itemsTotal([{ name: 'ไข่', qty: 3, unit_price: 4.5 }, { name: 'ผัก', qty: 1, unit_price: 20 }]) === 33.5);
check('ไม่มีรายการย่อย = 0', itemsTotal([]) === 0);

console.log(`ผลรวม: ผ่าน ${pass} / ล้มเหลว ${fail}`);
if (fail) process.exit(1);
