'use client';

import { useCallback, useEffect, useState } from 'react';
import { baht, CATEGORIES, itemsTotal, monthRange, parseImport, PAY_METHODS, thaiDate, thaiMonth, thisMonth, today, type ImportRow } from '@/lib/accounting';
import {
  addExpense,
  addExpenses,
  addRecurring,
  attachReceipt,
  deleteExpense,
  frequentVendors,
  listExpenses,
  listRecurring,
  receiptUrl,
  type Expense,
} from '@/lib/data';
import type { Notify } from './App';
import { Button, Card, Checkbox, Chip, Field, Modal, MonthInput, PageHead, ReceiptPicker, Select } from './ui';

const errText = (e: unknown, fallback: string) => (e instanceof Error ? e.message : fallback);
const recurringKey = (r: { vendor: string; category: string }) => `${r.vendor}|${r.category}`;

export function Expenses({ notify, initialFilter }: { notify: Notify; initialFilter: 'all' | 'missing' }) {
  const [month, setMonth] = useState(thisMonth());
  const [filter, setFilter] = useState(initialFilter);
  const [rows, setRows] = useState<Expense[] | null>(null);
  const [recurringKeys, setRecurringKeys] = useState<Set<string>>(new Set());
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [mode, setMode] = useState<'list' | 'add' | 'import'>('list');
  const [busy, setBusy] = useState(false);
  const [viewing, setViewing] = useState<Expense | null>(null);

  const load = useCallback(() => {
    const { from, to } = monthRange(month);
    return Promise.all([listExpenses(from, to), listRecurring()])
      .then(([ex, rec]) => {
        setRows(ex);
        setRecurringKeys(new Set(rec.map(recurringKey)));
      })
      .catch((e) => notify(e.message, true));
  }, [month, notify]);

  useEffect(() => {
    setRows(null);
    setPicked(new Set());
    load();
  }, [load]);

  const all = rows ?? [];
  const missing = all.filter((e) => !e.receipt_path);
  const shown = filter === 'missing' ? missing : all;
  const total = shown.reduce((s, e) => s + e.amount, 0);
  const isRecurring = (e: Expense) => recurringKeys.has(recurringKey(e));
  const pickedRows = all.filter((e) => picked.has(e.id) && !isRecurring(e));

  async function makeRecurring() {
    // รายการซ้ำกันในเดือนเดียว (ผู้ขาย+หมวดเดียวกัน) ตั้งเป็นรายการประจำเพียงรายการเดียว
    const unique = [...new Map(pickedRows.map((e) => [recurringKey(e), e])).values()];
    setBusy(true);
    try {
      await addRecurring(unique.map((e) => ({ vendor: e.vendor, category: e.category, pay_method: e.pay_method, amount: e.amount, day: Number(e.date.slice(-2)) })));
      setPicked(new Set());
      await load();
      notify(`ตั้ง ${unique.length} รายการเป็นรายจ่ายประจำแล้ว แก้วันที่ได้โดยลบแล้วเพิ่มใหม่ในหน้ารายจ่ายประจำ`);
    } catch (e) {
      notify(errText(e, 'ตั้งไม่สำเร็จ'), true);
    } finally {
      setBusy(false);
    }
  }

  async function openReceipt(path: string) {
    // เปิดแท็บก่อน await ไม่งั้นเบราว์เซอร์บล็อก pop-up
    const tab = window.open('', '_blank');
    try {
      const url = await receiptUrl(path);
      if (tab) tab.location.href = url;
    } catch (e) {
      tab?.close();
      notify(errText(e, 'เปิดรูปไม่สำเร็จ'), true);
    }
  }

  async function remove(e: Expense) {
    if (!window.confirm(`ลบรายจ่าย "${e.vendor}" ${baht(e.amount)}${e.receipt_path ? ' และรูปใบเสร็จ' : ''}?`)) return;
    try {
      await deleteExpense(e);
      await load();
    } catch (err) {
      notify(errText(err, 'ลบไม่สำเร็จ'), true);
    }
  }

  if (mode === 'add')
    return (
      <AddExpense
        notify={notify}
        onDone={async () => {
          setMode('list');
          await load();
        }}
      />
    );
  if (mode === 'import')
    return (
      <ImportExpenses
        notify={notify}
        onDone={async () => {
          setMode('list');
          await load();
        }}
      />
    );

  return (
    <>
      <PageHead title={`รายจ่าย ${thaiMonth(month)}`} sub={`รวม ${baht(total)}`}>
        <MonthInput value={month} onChange={setMonth} />
        <Button onClick={() => setMode('import')}>
          นำเข้า Sheet
        </Button>
        <Button onClick={() => setMode('add')}>เพิ่มรายจ่าย</Button>
      </PageHead>
      <div className="flex flex-wrap gap-2">
        <Chip active={filter === 'all'} onClick={() => setFilter('all')}>
          ทั้งหมด
        </Chip>
        <Chip active={filter === 'missing'} onClick={() => setFilter('missing')}>
          ยังไม่มีหลักฐาน ({missing.length})
        </Chip>
      </div>
      {pickedRows.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#FDBA74] bg-primary-soft px-5 py-3">
          <b className="font-semibold">เลือกแล้ว {pickedRows.length} รายการ</b>
          <Button disabled={busy} onClick={makeRecurring}>
            ตั้งเป็นรายจ่ายประจำ
          </Button>
        </div>
      )}
      {!rows ? (
        <div className="py-12 text-center text-dim">กำลังโหลด…</div>
      ) : shown.length === 0 ? (
        <div className="py-12 text-center text-dim">{filter === 'missing' ? 'ไม่มีรายการที่ขาดหลักฐาน' : 'เดือนนี้ยังไม่มีรายจ่าย'}</div>
      ) : (
        <Card className="overflow-x-auto px-7 py-3">
          <div className="grid min-h-12 min-w-[920px] grid-cols-[44px_80px_1.5fr_1fr_90px_120px_110px_50px] items-center gap-x-5 text-sm font-semibold text-dim">
            <span />
            <span>วันที่</span>
            <span>ผู้ขาย</span>
            <span>หมวด</span>
            <span>วิธีจ่าย</span>
            <span>หลักฐาน</span>
            <span className="text-right">ยอดเงิน</span>
            <span />
          </div>
          {shown.map((e) => (
            <div key={e.id} className="grid min-h-[72px] min-w-[920px] grid-cols-[44px_80px_1.5fr_1fr_90px_120px_110px_50px] items-center gap-x-5 border-t border-line">
              <Checkbox
                label={`เลือก ${e.vendor}`}
                disabled={isRecurring(e)}
                checked={picked.has(e.id)}
                onChange={() => {
                  const next = new Set(picked);
                  if (next.has(e.id)) next.delete(e.id);
                  else next.add(e.id);
                  setPicked(next);
                }}
              />
              <span className="text-dim">{thaiDate(e.date)}</span>
              <span className="min-w-0">
                <span className="flex flex-wrap items-center gap-2">
                  <b className="font-medium">{e.vendor}</b>
                  {isRecurring(e) && <span className="rounded-xl bg-[#F3F4F6] px-2.5 py-0.5 text-xs font-medium text-[#3F4652]">ประจำ</span>}
                </span>
                {(e.bill_ref || e.items.length > 0) && (
                  <span className="flex flex-wrap items-center gap-x-3 text-[13px] text-dim">
                    {e.bill_ref && <span>บิล {e.bill_ref}</span>}
                    {e.items.length > 0 && (
                      <button type="button" onClick={() => setViewing(e)} className="min-h-8 font-medium text-primary underline">
                        {e.items.length} รายการ
                      </button>
                    )}
                  </span>
                )}
              </span>
              <span className="text-dim">{e.category}</span>
              <span className="text-dim">{e.pay_method}</span>
              {e.receipt_path ? (
                <button type="button" onClick={() => openReceipt(e.receipt_path!)} className="min-h-11 text-left font-medium text-success underline">
                  ดูรูป
                </button>
              ) : (
                <ReceiptPicker
                  onError={(m) => notify(m, true)}
                  onPick={async (blob) => {
                    try {
                      await attachReceipt(e.id, blob);
                      await load();
                      notify('แนบรูปแล้ว');
                    } catch (err) {
                      notify(errText(err, 'แนบรูปไม่สำเร็จ'), true);
                    }
                  }}
                  render={(open) => (
                    <button type="button" onClick={open} className="min-h-11 w-24 rounded-[10px] border border-danger text-sm font-semibold text-danger">
                      แนบรูป
                    </button>
                  )}
                />
              )}
              <b className="text-right font-semibold">{baht(e.amount)}</b>
              <button type="button" aria-label={`ลบ ${e.vendor}`} onClick={() => remove(e)} className="min-h-11 text-sm font-semibold text-danger">
                ลบ
              </button>
            </div>
          ))}
        </Card>
      )}
      {viewing && (
        <Modal title={`${viewing.vendor}${viewing.bill_ref ? ` • บิล ${viewing.bill_ref}` : ''}`} onClose={() => setViewing(null)}>
          <div className="text-sm text-dim">
            {thaiDate(viewing.date)} • {viewing.category} • {viewing.pay_method}
          </div>
          <div className="mt-3">
            {viewing.items.map((it, i) => (
              <div key={i} className="flex justify-between gap-3 border-t border-line py-2.5">
                <span>
                  {it.name} <span className="text-dim">× {it.qty} @ {baht(it.unit_price)}</span>
                </span>
                <span>{baht(it.qty * it.unit_price)}</span>
              </div>
            ))}
          </div>
          <div className="flex justify-between gap-3 border-t border-[#D1D5DB] py-3 text-[17px] font-semibold">
            <span>รวม</span>
            <span>{baht(viewing.amount)}</span>
          </div>
        </Modal>
      )}
    </>
  );
}

interface ItemDraft {
  name: string;
  qty: string;
  price: string;
}
const blankItem = (): ItemDraft => ({ name: '', qty: '1', price: '' });

function AddExpense({ notify, onDone }: { notify: Notify; onDone: () => void }) {
  const blank = { date: today(), vendor: '', bill_ref: '', amount: '', category: CATEGORIES[0], pay_method: PAY_METHODS[0] };
  const [form, setForm] = useState(blank);
  const [items, setItems] = useState<ItemDraft[]>([]);
  const parsedItems = items.map((it) => ({ name: it.name.trim(), qty: Number(it.qty), unit_price: Number(it.price) }));
  const itemsSum = itemsTotal(parsedItems.filter((it) => it.qty > 0 && it.unit_price >= 0));
  const setItem = (i: number, patch: Partial<ItemDraft>) => setItems(items.map((it, j) => (j === i ? { ...it, ...patch } : it)));
  const [receipt, setReceipt] = useState<Blob | null>(null);
  const [vendors, setVendors] = useState<{ vendor: string; category: string; pay_method: string }[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    frequentVendors().then(setVendors).catch(() => {});
  }, []);

  async function save(next: boolean) {
    // มีรายการย่อย: ยอดบิล = ผลรวมรายการ
    if (parsedItems.some((it) => !it.name || !(it.qty > 0) || !(it.unit_price >= 0)))
      return notify('รายการย่อยต้องมีชื่อ จำนวนมากกว่า 0 และราคา', true);
    const amount = items.length ? itemsSum : parseFloat(form.amount);
    if (!form.date || !form.vendor.trim() || !(amount > 0)) return notify('กรุณาใส่วันที่ ผู้ขาย และยอดเงิน', true);
    setBusy(true);
    try {
      await addExpense(
        { date: form.date, vendor: form.vendor.trim(), bill_ref: form.bill_ref.trim() || null, category: form.category, pay_method: form.pay_method, amount },
        receipt,
        parsedItems
      );
      notify(next ? 'บันทึกแล้ว เพิ่มรายการต่อได้เลย' : 'บันทึกรายจ่ายแล้ว');
      if (next) {
        // วันที่มักเป็นวันเดียวกันเมื่อกรอกหลายใบ จึงคงไว้
        setForm({ ...blank, date: form.date });
        setItems([]);
        setReceipt(null);
      } else onDone();
    } catch (e) {
      notify(errText(e, 'บันทึกไม่สำเร็จ'), true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHead title="เพิ่มรายจ่าย">
        <Button variant="ghost" onClick={onDone}>
          กลับ
        </Button>
      </PageHead>
      <Card className="flex w-full max-w-[520px] flex-col gap-3.5 p-5">
        {vendors.length > 0 && (
          <div>
            <div className="mb-1.5 font-medium">ผู้ขายที่ใช้บ่อย</div>
            <div className="flex flex-wrap gap-2">
              {vendors.map((v) => (
                <Chip key={v.vendor} active={form.vendor === v.vendor} onClick={() => setForm({ ...form, vendor: v.vendor, category: v.category, pay_method: v.pay_method })}>
                  {v.vendor}
                </Chip>
              ))}
            </div>
          </div>
        )}
        <Field label="ผู้ขาย" value={form.vendor} onChange={(e) => setForm({ ...form, vendor: e.target.value })} />
        <Field label="เลขที่ / ชื่อบิล (ไม่บังคับ)" placeholder="เช่น INV-0123" value={form.bill_ref} onChange={(e) => setForm({ ...form, bill_ref: e.target.value })} />
        <div>
          <div className="mb-1.5 flex items-center justify-between gap-2">
            <span className="font-medium">รายการในบิล (ไม่บังคับ)</span>
            <button type="button" onClick={() => setItems([...items, blankItem()])} className="min-h-11 px-2 font-semibold text-primary">
              + เพิ่มรายการ
            </button>
          </div>
          {items.length > 0 && (
            <div className="flex flex-col gap-2">
              <div className="grid grid-cols-[1fr_64px_96px_44px] gap-2 text-[13px] text-dim">
                <span>ชื่อสินค้า / รายการ</span>
                <span>จำนวน</span>
                <span>ราคาต่อหน่วย</span>
                <span />
              </div>
              {items.map((it, i) => (
                <div key={i} className="grid grid-cols-[1fr_64px_96px_44px] items-center gap-2">
                  <input aria-label={`ชื่อรายการ ${i + 1}`} value={it.name} onChange={(e) => setItem(i, { name: e.target.value })} className="h-11 min-w-0 rounded-[10px] border border-[#D1D5DB] px-2.5 outline-none focus:border-primary" />
                  <input aria-label={`จำนวน ${i + 1}`} inputMode="decimal" value={it.qty} onChange={(e) => setItem(i, { qty: e.target.value })} className="h-11 min-w-0 rounded-[10px] border border-[#D1D5DB] px-2 text-right outline-none focus:border-primary" />
                  <input aria-label={`ราคาต่อหน่วย ${i + 1}`} inputMode="decimal" placeholder="0" value={it.price} onChange={(e) => setItem(i, { price: e.target.value })} className="h-11 min-w-0 rounded-[10px] border border-[#D1D5DB] px-2 text-right outline-none focus:border-primary" />
                  <button type="button" aria-label={`ลบรายการ ${i + 1}`} onClick={() => setItems(items.filter((_, j) => j !== i))} className="h-11 rounded-[10px] text-lg text-danger">
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
        {items.length > 0 ? (
          <div className="flex items-center justify-between rounded-[10px] bg-[#F3F4F6] px-4 py-3">
            <span className="font-medium">ยอดเงิน (รวมจากรายการ)</span>
            <b className="text-[26px] font-semibold">{baht(itemsSum)}</b>
          </div>
        ) : (
          <Field label="ยอดเงิน (บาท)" inputMode="decimal" placeholder="0" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} className="!h-[58px] text-right text-[26px] font-semibold" />
        )}
        <div className="grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-2.5">
          <Field label="วันที่" type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
          <Select label="หมวด" options={CATEGORIES} value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} />
          <Select label="วิธีจ่าย" options={PAY_METHODS} value={form.pay_method} onChange={(e) => setForm({ ...form, pay_method: e.target.value })} />
        </div>
        <ReceiptPicker
          onPick={setReceipt}
          onError={(m) => notify(m, true)}
          render={(open) => (
            <button type="button" onClick={open} className={`h-[110px] rounded-xl border-[1.5px] border-dashed font-medium ${receipt ? 'border-success bg-[#DCFCE7]' : 'border-[#6B7280] bg-[#F9FAFB]'}`}>
              {receipt ? 'แนบรูปแล้ว (กดเพื่อเปลี่ยน)' : 'ถ่ายรูป / เลือกรูปใบเสร็จ'}
            </button>
          )}
        />
        <Button disabled={busy} className="min-h-[52px]" onClick={() => save(false)}>
          {busy ? 'กำลังบันทึก…' : 'บันทึก'}
        </Button>
        <Button variant="ghost" disabled={busy} onClick={() => save(true)}>
          บันทึกแล้วเพิ่มรายการต่อ
        </Button>
      </Card>
    </>
  );
}

function ImportExpenses({ notify, onDone }: { notify: Notify; onDone: () => void }) {
  const [text, setText] = useState('');
  const [rows, setRows] = useState<ImportRow[] | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const valid = (rows ?? []).filter((r) => !r.error);

  async function run() {
    setBusy(true);
    try {
      await addExpenses(valid.map((r) => ({ date: r.date, vendor: r.vendor, category: r.category, pay_method: r.payMethod, amount: r.amount })));
      notify(`นำเข้า ${valid.length} รายการแล้ว`);
      onDone();
    } catch (e) {
      notify(errText(e, 'นำเข้าไม่สำเร็จ'), true);
      setBusy(false);
    }
  }

  return (
    <>
      <PageHead title="นำเข้าจาก Google Sheet" sub="คัดลอกแถวจาก Sheet แล้ววางด้านล่าง เรียงคอลัมน์: วันที่, ผู้ขาย, หมวด, ยอดเงิน, วิธีจ่าย (ไม่บังคับ)">
        <Button variant="ghost" onClick={onDone}>
          กลับ
        </Button>
      </PageHead>
      <Card className="p-5">
        <label className="mb-1.5 block font-medium" htmlFor="paste">
          วางข้อมูล
        </label>
        <textarea
          id="paste"
          rows={6}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setRows(null);
          }}
          className="w-full rounded-[10px] border border-[#D1D5DB] p-3 font-mono text-sm outline-none focus:border-primary"
        />
        <Button className="mt-3" variant="ghost" disabled={!text.trim()} onClick={() => setRows(parseImport(text))}>
          ตรวจข้อมูล
        </Button>
      </Card>
      {rows && (
        <>
          <Card className="overflow-x-auto px-7 py-3">
            {rows.map((r) => (
              <div key={r.line} className="grid min-h-[54px] min-w-[620px] grid-cols-[100px_1.4fr_1fr_90px_130px] items-center gap-x-4 border-t border-line text-sm">
                <span>{r.date}</span>
                <span>{r.vendor}</span>
                <span>{r.category}</span>
                <span className="text-right">{baht(r.amount)}</span>
                <span className={`font-medium ${r.error ? 'text-danger' : 'text-success'}`}>{r.error ?? 'พร้อมนำเข้า'}</span>
              </div>
            ))}
            {rows.length === 0 && <p className="py-3 text-dim">ไม่พบข้อมูล</p>}
          </Card>
          <div>
            <Button disabled={!valid.length} onClick={() => setConfirming(true)}>
              นำเข้า {valid.length} รายการ
            </Button>
          </div>
        </>
      )}
      {confirming && (
        <Modal title="ยืนยันการนำเข้า" onClose={() => setConfirming(false)}>
          <p className="mb-4">
            นำเข้า {valid.length} รายการ รวม {baht(valid.reduce((s, r) => s + r.amount, 0))} ระบบไม่ตรวจรายการซ้ำ ถ้าเคยนำเข้าชุดนี้แล้วให้ยกเลิก
          </p>
          <Button className="w-full" disabled={busy} onClick={run}>
            {busy ? 'กำลังนำเข้า…' : 'ยืนยันนำเข้า'}
          </Button>
        </Modal>
      )}
    </>
  );
}
