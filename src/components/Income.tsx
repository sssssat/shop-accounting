'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { baht, billNet, groupBillsByDay, monthRange, thaiDate, thaiMonth, thisMonth, today, type Bill } from '@/lib/accounting';
import { addOtherIncome, deleteOtherIncome, fetchBillItems, fetchBills, listOtherIncome, type BillItem, type OtherIncome } from '@/lib/data';
import type { Notify } from './App';
import { Button, Card, Field, Modal, MonthInput, PageHead, Stat } from './ui';

const time = (at: string) => new Date(at).toLocaleTimeString('th-TH', { timeZone: 'Asia/Bangkok', hour: '2-digit', minute: '2-digit' });
const methodLabel = (m: string) => (m === 'qr' ? 'QR' : 'เงินสด');

export function Income({ notify }: { notify: Notify }) {
  const [month, setMonth] = useState(thisMonth());
  const [bills, setBills] = useState<Bill[] | null>(null);
  const [other, setOther] = useState<OtherIncome[]>([]);
  const [day, setDay] = useState<string | null>(null);
  const [bill, setBill] = useState<Bill | null>(null);
  const [adding, setAdding] = useState(false);

  const load = useCallback(() => {
    const { from, to } = monthRange(month);
    return Promise.all([fetchBills(from, to), listOtherIncome(from, to)])
      .then(([b, o]) => {
        setBills(b);
        setOther(o);
      })
      .catch((e) => notify(e.message, true));
  }, [month, notify]);

  useEffect(() => {
    setBills(null);
    setDay(null);
    load();
  }, [load]);

  const days = useMemo(() => groupBillsByDay(bills ?? []), [bills]);
  const selected = days.find((d) => d.date === day) ?? days[0];
  const pos = (bills ?? []).reduce((s, b) => s + billNet(b), 0);
  const otherTotal = other.reduce((s, o) => s + o.amount, 0);

  return (
    <>
      <PageHead title={`รายรับ ${thaiMonth(month)}`} sub="ยอด POS ดึงอัตโนมัติ หักบิลยกเลิกและการคืนสินค้าแล้ว">
        <MonthInput value={month} onChange={setMonth} />
        <Button onClick={() => setAdding(true)}>
          เพิ่มรายรับ
        </Button>
      </PageHead>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-3.5">
        <Stat label="จาก POS" value={baht(pos)} />
        <Stat label="นอก POS" value={baht(otherTotal)} />
        <Stat label="รวม" value={baht(pos + otherTotal)} accent />
      </div>

      {!bills ? (
        <div className="py-12 text-center text-dim">กำลังโหลด…</div>
      ) : (
        <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-3">
          <Card className="flex flex-col gap-2 p-4">
            <h2 className="mb-1 text-[17px] font-semibold">ยอดรายวัน</h2>
            {days.length === 0 && <p className="text-dim">เดือนนี้ยังไม่มีบิล</p>}
            {days.map((d) => (
              <button
                key={d.date}
                type="button"
                onClick={() => setDay(d.date)}
                className={`flex min-h-[62px] items-center justify-between gap-2.5 rounded-[10px] border px-3 py-2 text-left font-medium ${selected?.date === d.date ? 'border-primary bg-primary-soft' : 'border-border bg-surface'}`}
              >
                <span>
                  {thaiDate(d.date)} <span className="text-[13px] font-normal text-dim">{d.bills.length} บิล</span>
                </span>
                <b className="font-semibold">{baht(d.net)}</b>
              </button>
            ))}
          </Card>
          <Card className="min-w-0 px-5 py-4 lg:col-span-2">
            <h2 className="mb-2 text-[17px] font-semibold">{selected ? `บิลวันที่ ${thaiDate(selected.date)}` : 'บิล'}</h2>
            {!selected && <p className="text-dim">ยังไม่มีบิลให้แสดง</p>}
            <div className="overflow-x-auto">
              {selected?.bills.map((b) => (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => setBill(b)}
                  className="grid min-h-[58px] w-full min-w-[480px] grid-cols-[100px_70px_1fr_80px_90px] items-center gap-2 border-t border-line px-1.5 text-left text-sm"
                >
                  <b className="font-semibold">บิล #{b.no}</b>
                  <span className="text-dim">{time(b.createdAt)}</span>
                  <span className="text-dim">{methodLabel(b.method)}</span>
                  <span className={b.status === 'void' ? 'text-danger' : 'text-success'}>{b.status === 'void' ? 'ยกเลิก' : 'ชำระแล้ว'}</span>
                  <b className="text-right font-semibold">{baht(billNet(b))}</b>
                </button>
              ))}
            </div>
          </Card>
        </div>
      )}

      {other.length > 0 && (
        <Card className="px-5 py-4">
          <h2 className="mb-2 text-[17px] font-semibold">รายรับนอก POS</h2>
          {other.map((o) => (
            <div key={o.id} className="flex min-h-[58px] flex-wrap items-center justify-between gap-3 border-t border-line">
              <span>
                <span className="text-dim">{thaiDate(o.date)}</span> <b className="ml-3 font-medium">{o.source}</b>
              </span>
              <span className="flex items-center gap-3">
                <b className="font-semibold">{baht(o.amount)}</b>
                <button
                  type="button"
                  className="min-h-11 px-2 text-sm font-semibold text-danger"
                  onClick={async () => {
                    if (!window.confirm(`ลบรายรับ "${o.source}" ${baht(o.amount)}?`)) return;
                    try {
                      await deleteOtherIncome(o.id);
                      await load();
                    } catch (e) {
                      notify(e instanceof Error ? e.message : 'ลบไม่สำเร็จ', true);
                    }
                  }}
                >
                  ลบ
                </button>
              </span>
            </div>
          ))}
        </Card>
      )}

      {bill && <BillDetail bill={bill} notify={notify} onClose={() => setBill(null)} />}
      {adding && (
        <AddOther
          notify={notify}
          onClose={() => setAdding(false)}
          onSaved={async () => {
            setAdding(false);
            await load();
            notify('บันทึกรายรับนอก POS แล้ว');
          }}
        />
      )}
    </>
  );
}

function BillDetail({ bill, notify, onClose }: { bill: Bill; notify: Notify; onClose: () => void }) {
  const [items, setItems] = useState<BillItem[] | null>(null);

  useEffect(() => {
    fetchBillItems(bill.id)
      .then(setItems)
      .catch((e) => notify(e.message, true));
  }, [bill.id, notify]);

  return (
    <Modal title={`บิล #${bill.no}`} onClose={onClose}>
      <div className="print-area">
        <div className="text-sm text-dim">
          {thaiDate(new Date(bill.createdAt).toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' }))} • {time(bill.createdAt)} • {methodLabel(bill.method)} • {bill.status === 'void' ? 'ยกเลิก' : 'ชำระแล้ว'}
        </div>
        <div className="mt-3">
          {!items && <p className="py-3 text-dim">กำลังโหลด…</p>}
          {items?.map((it) => (
            <div key={it.id} className="flex justify-between gap-3 border-t border-line py-2.5">
              <span>
                {it.name} × {it.qty}
                {Number(it.returned_qty) > 0 && <span className="text-sm text-dim"> (คืน {it.returned_qty})</span>}
              </span>
              <span>{baht(Number(it.price) * Number(it.qty))}</span>
            </div>
          ))}
        </div>
        {bill.refunded > 0 && (
          <div className="flex justify-between gap-3 border-t border-line py-2.5 text-danger">
            <span>คืนสินค้า</span>
            <span>-{baht(bill.refunded)}</span>
          </div>
        )}
        <div className="flex justify-between gap-3 border-t border-[#D1D5DB] py-3.5 text-[17px] font-semibold">
          <span>ยอดนับเป็นรายรับ</span>
          <span>{baht(billNet(bill))}</span>
        </div>
      </div>
      <div className="rounded-[10px] bg-[#F3F4F6] px-3 py-2.5 text-[13px] text-[#3F4652]">อ่านอย่างเดียว การยกเลิกหรือคืนสินค้าต้องทำใน POS</div>
      <Button className="mt-3.5 w-full" onClick={() => window.print()}>
        พิมพ์ / บันทึก PDF
      </Button>
    </Modal>
  );
}

function AddOther({ notify, onClose, onSaved }: { notify: Notify; onClose: () => void; onSaved: () => void }) {
  const [date, setDate] = useState(today());
  const [source, setSource] = useState('');
  const [amount, setAmount] = useState('');
  const [busy, setBusy] = useState(false);

  async function save() {
    const n = parseFloat(amount);
    if (!date || !source.trim() || !(n > 0)) return notify('กรุณาใส่วันที่ ที่มา และยอดเงิน', true);
    setBusy(true);
    try {
      await addOtherIncome({ date, source: source.trim(), amount: n });
      onSaved();
    } catch (e) {
      notify(e instanceof Error ? e.message : 'บันทึกไม่สำเร็จ', true);
      setBusy(false);
    }
  }

  return (
    <Modal title="เพิ่มรายรับนอก POS" onClose={onClose}>
      <div className="flex flex-col gap-3">
        <Field label="วันที่" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        <Field label="ที่มา" placeholder="เช่น เดลิเวอรี" value={source} onChange={(e) => setSource(e.target.value)} />
        <Field label="ยอดเงิน (บาท)" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
        <Button disabled={busy} onClick={save}>
          {busy ? 'กำลังบันทึก…' : 'บันทึก'}
        </Button>
      </div>
    </Modal>
  );
}
