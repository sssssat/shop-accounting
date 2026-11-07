'use client';

import { useEffect, useState } from 'react';
import { baht, billNet, monthRange, thaiMonth, thisMonth } from '@/lib/accounting';
import { fetchBills, listExpenses, listOtherIncome, type Expense } from '@/lib/data';
import type { Notify } from './App';
import { Button, Card, MonthInput, PageHead, Stat } from './ui';

export function Overview({ notify, onAdd, onMissing }: { notify: Notify; onAdd: () => void; onMissing: () => void }) {
  const [month, setMonth] = useState(thisMonth());
  const [income, setIncome] = useState(0);
  const [expenses, setExpenses] = useState<Expense[] | null>(null);

  useEffect(() => {
    let alive = true;
    const { from, to } = monthRange(month);
    setExpenses(null);
    Promise.all([fetchBills(from, to), listOtherIncome(from, to), listExpenses(from, to)])
      .then(([bills, other, ex]) => {
        if (!alive) return;
        setIncome(bills.reduce((s, b) => s + billNet(b), 0) + other.reduce((s, o) => s + o.amount, 0));
        setExpenses(ex);
      })
      .catch((e) => notify(e.message, true));
    return () => {
      alive = false;
    };
  }, [month, notify]);

  const list = expenses ?? [];
  const total = list.reduce((s, e) => s + e.amount, 0);
  const missing = list.filter((e) => !e.receipt_path).length;
  const byCat = [...new Set(list.map((e) => e.category))]
    .map((name) => ({ name, sum: list.filter((e) => e.category === name).reduce((s, e) => s + e.amount, 0) }))
    .sort((a, b) => b.sum - a.sum);

  return (
    <>
      <PageHead title={`ภาพรวม ${thaiMonth(month)}`}>
        <MonthInput value={month} onChange={setMonth} />
        <Button onClick={onAdd}>เพิ่มรายจ่าย</Button>
      </PageHead>
      {!expenses ? (
        <div className="py-12 text-center text-dim">กำลังโหลด…</div>
      ) : (
        <>
          <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-3.5">
            <Stat label="รายรับ" value={baht(income)} />
            <Stat label="รายจ่าย" value={baht(total)} />
            <Stat label="คงเหลือก่อนภาษี" value={baht(income - total)} accent />
          </div>
          {missing > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#FDBA74] bg-[#FFF7ED] px-[18px] py-3.5">
              <span>
                <b className="font-semibold">มี {missing} รายการยังไม่มีรูปใบเสร็จ</b> ควรแนบเพราะหักค่าใช้จ่ายตามจริง
              </span>
              <Button variant="ghost" onClick={onMissing}>
                ดูรายการ
              </Button>
            </div>
          )}
          <Card className="p-5">
            <h2 className="mb-3.5 text-[17px] font-semibold">รายจ่ายตามหมวด</h2>
            {byCat.length === 0 && <p className="text-dim">เดือนนี้ยังไม่มีรายจ่าย</p>}
            {byCat.map((c) => (
              <div key={c.name} className="mb-3.5">
                <div className="flex justify-between gap-2 text-sm">
                  <span>{c.name}</span>
                  <b className="font-semibold">{baht(c.sum)}</b>
                </div>
                <div className="mt-1.5 h-2 rounded bg-line">
                  <div className="h-2 rounded bg-accent" style={{ width: `${(c.sum / total) * 100}%` }} />
                </div>
              </div>
            ))}
          </Card>
        </>
      )}
    </>
  );
}
