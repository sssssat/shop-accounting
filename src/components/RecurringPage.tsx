'use client';

import { useCallback, useEffect, useState } from 'react';
import { baht, CATEGORIES, PAY_METHODS, recurringDate, thaiDate, thaiMonth, thisMonth } from '@/lib/accounting';
import { addRecurring, confirmRecurring, listRecurring, recurringDoneIds, stopRecurring, type Recurring } from '@/lib/data';
import type { Notify } from './App';
import { Button, Card, Field, Modal, MonthInput, PageHead, Select } from './ui';

const errText = (e: unknown, fallback: string) => (e instanceof Error ? e.message : fallback);

export function RecurringPage({ notify }: { notify: Notify }) {
  const [month, setMonth] = useState(thisMonth());
  const [rows, setRows] = useState<Recurring[] | null>(null);
  const [done, setDone] = useState<Set<string>>(new Set());
  const [adding, setAdding] = useState(false);
  const [confirming, setConfirming] = useState<Recurring | null>(null);

  const load = useCallback(() => {
    return Promise.all([listRecurring(), recurringDoneIds(month)])
      .then(([r, d]) => {
        setRows(r);
        setDone(d);
      })
      .catch((e) => notify(e.message, true));
  }, [month, notify]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <>
      <PageHead title="รายจ่ายประจำ" sub={`กดยืนยันเมื่อจ่ายจริงของเดือน ${thaiMonth(month)} แก้ยอดได้ก่อนบันทึก`}>
        <MonthInput value={month} onChange={setMonth} />
        <Button onClick={() => setAdding(true)}>เพิ่มรายการ</Button>
      </PageHead>
      {!rows ? (
        <div className="py-12 text-center text-dim">กำลังโหลด…</div>
      ) : rows.length === 0 ? (
        <div className="py-12 text-center text-dim">ยังไม่มีรายจ่ายประจำ</div>
      ) : (
        <Card className="px-7 py-3">
          {rows.map((r) => (
            <div key={r.id} className="flex min-h-[72px] flex-wrap items-center justify-between gap-2.5 border-t border-line py-2 first:border-t-0">
              <div>
                <b className="font-semibold">{r.vendor}</b>
                <div className="text-[13px] text-dim">
                  {r.category} • ทุกวันที่ {r.day} • {baht(r.amount)}
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="ghost" disabled={done.has(r.id)} onClick={() => setConfirming(r)}>
                  {done.has(r.id) ? 'บันทึกเดือนนี้แล้ว' : 'ยืนยันเดือนนี้'}
                </Button>
                <Button
                  variant="danger"
                  onClick={async () => {
                    if (!window.confirm(`เลิกรายจ่ายประจำ "${r.vendor}"? รายจ่ายที่บันทึกแล้วยังอยู่`)) return;
                    try {
                      await stopRecurring(r.id);
                      await load();
                    } catch (e) {
                      notify(errText(e, 'ทำรายการไม่สำเร็จ'), true);
                    }
                  }}
                >
                  เลิก
                </Button>
              </div>
            </div>
          ))}
        </Card>
      )}
      {adding && (
        <AddRecurring
          notify={notify}
          onClose={() => setAdding(false)}
          onSaved={async () => {
            setAdding(false);
            await load();
            notify('เพิ่มรายจ่ายประจำแล้ว');
          }}
        />
      )}
      {confirming && (
        <ConfirmRecurring
          row={confirming}
          month={month}
          notify={notify}
          onClose={() => setConfirming(null)}
          onSaved={async () => {
            setConfirming(null);
            await load();
            notify('เพิ่มเข้ารายจ่ายแล้ว อย่าลืมแนบรูปใบเสร็จ');
          }}
        />
      )}
    </>
  );
}

function ConfirmRecurring({ row, month, notify, onClose, onSaved }: { row: Recurring; month: string; notify: Notify; onClose: () => void; onSaved: () => void }) {
  const [amount, setAmount] = useState(String(row.amount));
  const [busy, setBusy] = useState(false);

  async function save() {
    const n = parseFloat(amount);
    if (!(n > 0)) return notify('กรุณาใส่ยอดเงิน', true);
    setBusy(true);
    try {
      await confirmRecurring(row, month, n);
      onSaved();
    } catch (e) {
      notify(errText(e, 'บันทึกไม่สำเร็จ'), true);
      setBusy(false);
    }
  }

  return (
    <Modal title={`ยืนยัน ${row.vendor}`} onClose={onClose}>
      <p className="mb-3 text-dim">บันทึกเป็นรายจ่ายวันที่ {thaiDate(recurringDate(month, row.day))}</p>
      <Field label="ยอดเงินเดือนนี้ (บาท)" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
      <Button className="mt-3.5 w-full" disabled={busy} onClick={save}>
        {busy ? 'กำลังบันทึก…' : 'บันทึก'}
      </Button>
    </Modal>
  );
}

function AddRecurring({ notify, onClose, onSaved }: { notify: Notify; onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState({ vendor: '', category: CATEGORIES[CATEGORIES.length - 1], pay_method: PAY_METHODS[0], amount: '', day: '1' });
  const [busy, setBusy] = useState(false);

  async function save() {
    const amount = parseFloat(f.amount);
    const day = parseInt(f.day, 10);
    if (!f.vendor.trim() || !(amount > 0) || !(day >= 1 && day <= 31)) return notify('กรุณาใส่ชื่อ ยอดเงิน และวันที่ 1-31', true);
    setBusy(true);
    try {
      await addRecurring([{ vendor: f.vendor.trim(), category: f.category, pay_method: f.pay_method, amount, day }]);
      onSaved();
    } catch (e) {
      notify(errText(e, 'บันทึกไม่สำเร็จ'), true);
      setBusy(false);
    }
  }

  return (
    <Modal title="เพิ่มรายจ่ายประจำ" onClose={onClose}>
      <div className="flex flex-col gap-3">
        <Field label="ชื่อรายการ / ผู้ขาย" value={f.vendor} onChange={(e) => setF({ ...f, vendor: e.target.value })} />
        <Select label="หมวด" options={CATEGORIES} value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })} />
        <Select label="วิธีจ่าย" options={PAY_METHODS} value={f.pay_method} onChange={(e) => setF({ ...f, pay_method: e.target.value })} />
        <div className="grid grid-cols-2 gap-2.5">
          <Field label="ยอดเงิน" inputMode="decimal" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} />
          <Field label="ทุกวันที่" inputMode="numeric" value={f.day} onChange={(e) => setF({ ...f, day: e.target.value })} />
        </div>
        <Button disabled={busy} onClick={save}>
          {busy ? 'กำลังบันทึก…' : 'บันทึก'}
        </Button>
      </div>
    </Modal>
  );
}
