'use client';

import { createClient } from '@supabase/supabase-js';
import { recurringDate, type Bill, type LineItem } from './accounting';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
export const supabase = url && key ? createClient(url, key, { auth: { persistSession: true, autoRefreshToken: true } }) : null;

function db() {
  if (!supabase) throw new Error('ยังไม่ได้ตั้งค่า Supabase');
  return supabase;
}

const BUCKET = 'expense-receipts';
// โดเมนอีเมลเดียวกับที่ POS ใช้สร้างบัญชี
export const usernameToEmail = (u: string) => `${u.trim().toLowerCase()}@mama-pos.local`;

function must<T>(res: { data: T; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message);
  return res.data;
}

/** เวลาเริ่มต้นวันตามเวลาไทย */
const dayStartIso = (date: string) => new Date(`${date}T00:00:00+07:00`).toISOString();
function nextDay(date: string) {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

// ---------- บิลจาก POS (อ่านอย่างเดียว) ----------
export async function fetchBills(from: string, to: string): Promise<Bill[]> {
  const out: Bill[] = [];
  for (let start = 0; ; start += 1000) {
    const rows =
      must(
        await db()
          .from('sales')
          .select('id, no, total, refunded, method, status, created_at')
          .gte('created_at', dayStartIso(from))
          .lt('created_at', dayStartIso(nextDay(to)))
          .order('created_at')
          .range(start, start + 999)
      ) ?? [];
    rows.forEach((r) =>
      out.push({ id: r.id, no: Number(r.no), total: Number(r.total), refunded: Number(r.refunded), method: r.method, status: r.status, createdAt: r.created_at })
    );
    if (rows.length < 1000) return out;
  }
}

export interface BillItem {
  id: string;
  name: string;
  price: number;
  qty: number;
  returned_qty: number;
}

export async function fetchBillItems(saleId: string): Promise<BillItem[]> {
  return must(await db().from('sale_items').select('id, name, price, qty, returned_qty').eq('sale_id', saleId)) as BillItem[];
}

// ---------- รายจ่าย ----------
export interface Expense {
  id: string;
  date: string;
  vendor: string;
  category: string;
  pay_method: string;
  amount: number;
  receipt_path: string | null;
  recurring_id: string | null;
  recurring_month: string | null;
  bill_ref: string | null;
  items: LineItem[];
}

type ExpenseRow = Omit<Expense, 'items'> & { acct_expense_items?: (LineItem & { sort: number })[] };
const toExpense = ({ acct_expense_items, ...r }: ExpenseRow): Expense => ({
  ...r,
  amount: Number(r.amount),
  items: [...(acct_expense_items ?? [])]
    .sort((a, b) => a.sort - b.sort)
    .map((it) => ({ name: it.name, qty: Number(it.qty), unit_price: Number(it.unit_price) })),
});

export async function listExpenses(from: string, to: string): Promise<Expense[]> {
  const rows = must(
    await db().from('acct_expenses').select('*, acct_expense_items(name, qty, unit_price, sort)').gte('date', from).lte('date', to).order('date', { ascending: false }).order('created_at', { ascending: false }).limit(5000)
  ) as ExpenseRow[];
  return rows.map(toExpense);
}

export type NewExpense = Pick<Expense, 'date' | 'vendor' | 'category' | 'pay_method' | 'amount'> & {
  recurring_id?: string;
  recurring_month?: string;
  bill_ref?: string | null;
};

/** อัปโหลดรูปก่อน แล้วบันทึกบิลและรายการย่อย ถ้าไม่สำเร็จจะลบสิ่งที่บันทึกไปแล้วทิ้ง */
export async function addExpense(e: NewExpense, receipt?: Blob | null, items: LineItem[] = []): Promise<void> {
  const path = receipt ? await uploadReceipt(receipt) : null;
  const { data, error } = await db().from('acct_expenses').insert({ ...e, receipt_path: path }).select('id').single();
  if (error || !data) {
    if (path) await db().storage.from(BUCKET).remove([path]);
    throw new Error(error?.message ?? 'บันทึกไม่สำเร็จ');
  }
  if (!items.length) return;
  const res = await db()
    .from('acct_expense_items')
    .insert(items.map((it, i) => ({ ...it, expense_id: data.id, sort: i })));
  if (res.error) {
    await db().from('acct_expenses').delete().eq('id', data.id);
    if (path) await db().storage.from(BUCKET).remove([path]);
    throw new Error('บันทึกรายการย่อยไม่สำเร็จ: ' + res.error.message);
  }
}

export async function addExpenses(rows: NewExpense[]): Promise<void> {
  must(await db().from('acct_expenses').insert(rows));
}

export async function attachReceipt(expenseId: string, receipt: Blob): Promise<void> {
  const path = await uploadReceipt(receipt);
  const { error } = await db().from('acct_expenses').update({ receipt_path: path }).eq('id', expenseId);
  if (error) {
    await db().storage.from(BUCKET).remove([path]);
    throw new Error(error.message);
  }
}

export async function deleteExpense(e: Expense): Promise<void> {
  must(await db().from('acct_expenses').delete().eq('id', e.id));
  if (e.receipt_path) await db().storage.from(BUCKET).remove([e.receipt_path]);
}

async function uploadReceipt(blob: Blob): Promise<string> {
  const path = `${crypto.randomUUID()}.jpg`;
  const { error } = await db().storage.from(BUCKET).upload(path, blob, { contentType: 'image/jpeg' });
  if (error) throw new Error('อัปโหลดรูปไม่สำเร็จ: ' + error.message);
  return path;
}

export async function receiptUrl(path: string): Promise<string> {
  const { data, error } = await db().storage.from(BUCKET).createSignedUrl(path, 300);
  if (error) throw new Error(error.message);
  return data.signedUrl;
}

/** ผู้ขายที่ใช้บ่อย พร้อมหมวดล่าสุด จาก 300 รายการล่าสุด */
export async function frequentVendors(limit = 6): Promise<{ vendor: string; category: string; pay_method: string }[]> {
  const rows = must(await db().from('acct_expenses').select('vendor, category, pay_method').order('created_at', { ascending: false }).limit(300)) as {
    vendor: string;
    category: string;
    pay_method: string;
  }[];
  const map = new Map<string, { vendor: string; category: string; pay_method: string; n: number }>();
  rows.forEach((r) => {
    const cur = map.get(r.vendor);
    if (cur) cur.n++;
    else map.set(r.vendor, { ...r, n: 1 });
  });
  return [...map.values()].sort((a, b) => b.n - a.n).slice(0, limit);
}

// ---------- รายจ่ายประจำ ----------
export interface Recurring {
  id: string;
  vendor: string;
  category: string;
  pay_method: string;
  amount: number;
  day: number;
}

export async function listRecurring(): Promise<Recurring[]> {
  const rows = must(await db().from('acct_recurring').select('id, vendor, category, pay_method, amount, day').eq('active', true).order('day').order('created_at')) as Recurring[];
  return rows.map((r) => ({ ...r, amount: Number(r.amount) }));
}

export async function addRecurring(rows: Omit<Recurring, 'id'>[]): Promise<void> {
  must(await db().from('acct_recurring').insert(rows));
}

export async function stopRecurring(id: string): Promise<void> {
  must(await db().from('acct_recurring').update({ active: false }).eq('id', id));
}

export async function confirmRecurring(r: Recurring, month: string, amount: number): Promise<void> {
  const { error } = await db()
    .from('acct_expenses')
    .insert({ date: recurringDate(month, r.day), vendor: r.vendor, category: r.category, pay_method: r.pay_method, amount, recurring_id: r.id, recurring_month: month });
  if (error) throw new Error(error.code === '23505' ? 'เดือนนี้ยืนยันรายการนี้ไปแล้ว' : error.message);
}

export async function recurringDoneIds(month: string): Promise<Set<string>> {
  const rows = must(await db().from('acct_expenses').select('recurring_id').eq('recurring_month', month).not('recurring_id', 'is', null)) as { recurring_id: string }[];
  return new Set(rows.map((r) => r.recurring_id));
}

// ---------- รายรับนอก POS ----------
export interface OtherIncome {
  id: string;
  date: string;
  source: string;
  amount: number;
}

export async function listOtherIncome(from: string, to: string): Promise<OtherIncome[]> {
  const rows = must(await db().from('acct_other_income').select('id, date, source, amount').gte('date', from).lte('date', to).order('date', { ascending: false }).limit(5000)) as OtherIncome[];
  return rows.map((r) => ({ ...r, amount: Number(r.amount) }));
}

export async function addOtherIncome(o: Omit<OtherIncome, 'id'>): Promise<void> {
  must(await db().from('acct_other_income').insert(o));
}

export async function deleteOtherIncome(id: string): Promise<void> {
  must(await db().from('acct_other_income').delete().eq('id', id));
}
