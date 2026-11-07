'use client';

import { useCallback, useEffect, useState } from 'react';
import { supabase, usernameToEmail } from '@/lib/data';
import { Button, Field } from './ui';
import { Overview } from './Overview';
import { Income } from './Income';
import { Expenses } from './Expenses';
import { RecurringPage } from './RecurringPage';
import { Reports } from './Reports';

export type Page = 'overview' | 'income' | 'expenses' | 'recurring' | 'reports';
export type Notify = (message: string, error?: boolean) => void;

const NAV: [Page, string][] = [
  ['overview', 'ภาพรวม'],
  ['income', 'รายรับ'],
  ['expenses', 'รายจ่าย'],
  ['recurring', 'รายจ่ายประจำ'],
  ['reports', 'รายงาน'],
];

/** เข้าได้เฉพาะบัญชีเจ้าของร้าน (ฐานข้อมูลก็ตรวจซ้ำด้วย RLS) */
async function isOwner(userId: string): Promise<boolean> {
  const { data } = await supabase!.from('profiles').select('role').eq('id', userId).single();
  return data?.role === 'owner';
}

export function App() {
  const [status, setStatus] = useState<'loading' | 'out' | 'in'>('loading');
  const [page, setPage] = useState<Page>('overview');
  const [expenseFilter, setExpenseFilter] = useState<'all' | 'missing'>('all');
  const [toast, setToast] = useState<{ message: string; error: boolean } | null>(null);

  const notify = useCallback<Notify>((message, error = false) => {
    setToast({ message, error });
    window.setTimeout(() => setToast((t) => (t?.message === message ? null : t)), 5000);
  }, []);

  useEffect(() => {
    if (!supabase) return setStatus('out');
    supabase.auth.getSession().then(async ({ data }) => {
      const uid = data.session?.user.id;
      setStatus(uid && (await isOwner(uid)) ? 'in' : 'out');
    });
  }, []);

  async function logout() {
    await supabase?.auth.signOut();
    setStatus('out');
    setPage('overview');
  }

  const toastEl = toast && (
    <div role="status" className={`fixed bottom-4 left-1/2 z-30 w-[calc(100%-32px)] max-w-md -translate-x-1/2 rounded-[10px] px-4 py-3 font-medium text-white ${toast.error ? 'bg-danger' : 'bg-success'}`}>
      {toast.message}
    </div>
  );

  if (status === 'loading') return <div className="flex min-h-screen items-center justify-center text-dim">กำลังโหลด…</div>;
  if (status === 'out')
    return (
      <>
        <Login onDone={() => setStatus('in')} notify={notify} />
        {toastEl}
      </>
    );

  return (
    <div className="flex min-h-screen flex-wrap">
      <nav className="flex flex-[1_1_220px] flex-col gap-1.5 border-r border-border bg-surface p-3.5 pt-5 lg:max-w-[240px]">
        <div className="px-3 pb-3.5 text-lg font-semibold">บัญชีร้าน</div>
        {NAV.map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => {
              setPage(id);
              if (id === 'expenses') setExpenseFilter('all');
            }}
            aria-current={page === id ? 'page' : undefined}
            className={`min-h-12 rounded-[10px] px-3 text-left ${page === id ? 'bg-primary-soft font-semibold text-primary-dark' : 'text-[#3F4652]'}`}
          >
            {label}
          </button>
        ))}
        <button type="button" onClick={logout} className="mt-3 min-h-12 rounded-[10px] border border-border px-3 text-left text-[#3F4652]">
          ออกจากระบบ
        </button>
      </nav>
      <main className="flex min-w-0 flex-[999_1_560px] flex-col gap-6 p-5 sm:px-10 sm:py-9">
        {page === 'overview' && (
          <Overview
            notify={notify}
            onAdd={() => setPage('expenses')}
            onMissing={() => {
              setExpenseFilter('missing');
              setPage('expenses');
            }}
          />
        )}
        {page === 'income' && <Income notify={notify} />}
        {page === 'expenses' && <Expenses notify={notify} initialFilter={expenseFilter} />}
        {page === 'recurring' && <RecurringPage notify={notify} />}
        {page === 'reports' && <Reports notify={notify} />}
      </main>
      {toastEl}
    </div>
  );
}

function Login({ onDone, notify }: { onDone: () => void; notify: Notify }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!supabase) return notify('ยังไม่ได้ตั้งค่า Supabase', true);
    setBusy(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email: usernameToEmail(username), password });
      if (error || !data.user) return notify('ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง', true);
      if (!(await isOwner(data.user.id))) {
        await supabase.auth.signOut();
        return notify('หน้านี้สำหรับเจ้าของร้านเท่านั้น', true);
      }
      onDone();
    } catch {
      notify('เชื่อมต่อเซิร์ฟเวอร์ไม่ได้', true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-5">
      <form onSubmit={submit} className="flex w-full max-w-[400px] flex-col gap-3 rounded-2xl border border-border bg-surface p-7">
        <div>
          <h1 className="text-2xl font-semibold">บัญชีร้าน</h1>
          <p className="mt-1 text-sm text-dim">เข้าสู่ระบบด้วยบัญชีเจ้าของร้านเดียวกับ POS</p>
        </div>
        <Field label="ชื่อผู้ใช้" autoComplete="username" value={username} onChange={(e) => setUsername(e.target.value)} />
        <Field label="รหัสผ่าน" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
        <Button type="submit" disabled={busy} className="mt-2 min-h-[50px]">
          {busy ? 'กำลังเข้าสู่ระบบ…' : 'เข้าสู่ระบบ'}
        </Button>
      </form>
    </div>
  );
}
