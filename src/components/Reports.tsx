'use client';

import { useEffect, useState } from 'react';
import { baht, billNet, monthRange, thaiMonth, thisMonth, today } from '@/lib/accounting';
import { fetchBills, listExpenses, listOtherIncome } from '@/lib/data';
import { exportPeriod } from '@/lib/exportExcel';
import type { Notify } from './App';
import { Button, Card, Checkbox, Chip, Field, Modal, PageHead } from './ui';

interface Row {
  month: string;
  income: number;
  expense: number;
}

const errText = (e: unknown) => (e instanceof Error ? e.message : 'ทำรายการไม่สำเร็จ');

export function Reports({ notify }: { notify: Notify }) {
  const [year, setYear] = useState(Number(thisMonth().slice(0, 4)));
  const [rows, setRows] = useState<Row[] | null>(null);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [exportOpen, setExportOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    setRows(null);
    setPicked(new Set());
    const from = `${year}-01-01`;
    const to = `${year}-12-31`;
    Promise.all([fetchBills(from, to), listOtherIncome(from, to), listExpenses(from, to)])
      .then(([bills, other, expenses]) => {
        if (!alive) return;
        const map = new Map<string, Row>();
        const row = (month: string) => {
          const r = map.get(month) ?? { month, income: 0, expense: 0 };
          map.set(month, r);
          return r;
        };
        bills.forEach((b) => {
          row(new Date(b.createdAt).toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' }).slice(0, 7)).income += billNet(b);
        });
        other.forEach((o) => {
          row(o.date.slice(0, 7)).income += o.amount;
        });
        expenses.forEach((e) => {
          row(e.date.slice(0, 7)).expense += e.amount;
        });
        setRows([...map.values()].sort((a, b) => a.month.localeCompare(b.month)));
      })
      .catch((e) => notify(e.message, true));
    return () => {
      alive = false;
    };
  }, [year, notify]);

  const list = rows ?? [];
  const allChecked = list.length > 0 && picked.size === list.length;

  async function downloadPicked() {
    setBusy(true);
    try {
      // ไฟล์แยกตามเดือน
      for (const r of list.filter((x) => picked.has(x.month))) {
        const { from, to } = monthRange(r.month);
        await exportPeriod(thaiMonth(r.month), from, to);
      }
      setPicked(new Set());
    } catch (e) {
      notify(errText(e), true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHead title={`รายงาน ปี ${year + 543}`}>
        <div className="flex gap-2">
          <Button variant="ghost" className="flex-1" aria-label="ปีก่อนหน้า" onClick={() => setYear(year - 1)}>
            ‹
          </Button>
          <Button variant="ghost" className="flex-1" aria-label="ปีถัดไป" onClick={() => setYear(year + 1)}>
            ›
          </Button>
        </div>
        <Button onClick={() => setExportOpen(true)}>ส่งออก Excel</Button>
      </PageHead>
      {picked.size > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#FDBA74] bg-primary-soft px-5 py-3">
          <b className="font-semibold">เลือกแล้ว {picked.size} เดือน</b>
          <Button disabled={busy} onClick={downloadPicked}>
            {busy ? 'กำลังสร้างไฟล์…' : 'ดาวน์โหลดที่เลือก'}
          </Button>
        </div>
      )}
      {!rows ? (
        <div className="py-12 text-center text-dim">กำลังโหลด…</div>
      ) : list.length === 0 ? (
        <div className="py-12 text-center text-dim">ปีนี้ยังไม่มีข้อมูล</div>
      ) : (
        <Card className="overflow-x-auto px-7 py-3">
          <div className="grid min-h-[52px] min-w-[640px] grid-cols-[44px_1.4fr_1fr_1fr_1fr] items-center gap-x-6 text-sm font-semibold text-dim">
            <Checkbox label="เลือกทุกเดือน" checked={allChecked} onChange={() => setPicked(allChecked ? new Set() : new Set(list.map((r) => r.month)))} />
            <span>เดือน</span>
            <span className="text-right">รายรับ</span>
            <span className="text-right">รายจ่าย</span>
            <span className="text-right">คงเหลือ</span>
          </div>
          {list.map((r) => (
            <div key={r.month} className="grid min-h-[68px] min-w-[640px] grid-cols-[44px_1.4fr_1fr_1fr_1fr] items-center gap-x-6 border-t border-line">
              <Checkbox
                label={`เลือก ${thaiMonth(r.month)}`}
                checked={picked.has(r.month)}
                onChange={() => {
                  const next = new Set(picked);
                  if (next.has(r.month)) next.delete(r.month);
                  else next.add(r.month);
                  setPicked(next);
                }}
              />
              <span>{thaiMonth(r.month)}</span>
              <span className="text-right">{baht(r.income)}</span>
              <span className="text-right">{baht(r.expense)}</span>
              <b className="text-right font-semibold">{baht(r.income - r.expense)}</b>
            </div>
          ))}
        </Card>
      )}
      {exportOpen && <ExportDialog notify={notify} onClose={() => setExportOpen(false)} />}
    </>
  );
}

function ExportDialog({ notify, onClose }: { notify: Notify; onClose: () => void }) {
  const [mode, setMode] = useState<'month' | 'range'>('month');
  const [month, setMonth] = useState(thisMonth());
  const [from, setFrom] = useState(`${thisMonth()}-01`);
  const [to, setTo] = useState(today());
  const [busy, setBusy] = useState(false);

  async function run() {
    if (mode === 'range' && (!from || !to || from > to)) return notify('วันที่เริ่มต้องไม่เกินวันที่สิ้นสุด', true);
    setBusy(true);
    try {
      if (mode === 'month') {
        const r = monthRange(month);
        await exportPeriod(thaiMonth(month), r.from, r.to);
      } else {
        await exportPeriod(`${from} ถึง ${to}`, from, to);
      }
      onClose();
    } catch (e) {
      notify(errText(e), true);
      setBusy(false);
    }
  }

  return (
    <Modal title="ส่งออก Excel" onClose={onClose}>
      <div className="flex flex-col gap-3">
        <div className="grid grid-cols-2 gap-2">
          <Chip active={mode === 'month'} onClick={() => setMode('month')}>
            เลือกเดือน
          </Chip>
          <Chip active={mode === 'range'} onClick={() => setMode('range')}>
            ช่วงวันที่
          </Chip>
        </div>
        {mode === 'month' ? (
          <Field label="เดือน" type="month" value={month} onChange={(e) => e.target.value && setMonth(e.target.value)} />
        ) : (
          <div className="grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-2.5">
            <Field label="ตั้งแต่วันที่" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            <Field label="ถึงวันที่" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
        )}
        <Button disabled={busy} onClick={run}>
          {busy ? 'กำลังสร้างไฟล์…' : 'ดาวน์โหลด'}
        </Button>
      </div>
    </Modal>
  );
}
