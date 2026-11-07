-- ตารางบัญชีร้าน: ใช้ Supabase เดียวกับ POS แต่ไม่แก้ตารางเดิมของ POS
-- เฉพาะเจ้าของร้าน (public.is_owner จาก POS) เท่านั้นที่อ่าน/เขียนได้
-- รันซ้ำได้

create table if not exists public.acct_recurring (
  id uuid primary key default gen_random_uuid(),
  vendor text not null,
  category text not null,
  pay_method text not null default 'โอนเงิน',
  amount numeric not null check (amount > 0),
  day int not null check (day between 1 and 31),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.acct_expenses (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  vendor text not null,
  category text not null,
  pay_method text not null default 'โอนเงิน',
  amount numeric not null check (amount > 0),
  receipt_path text,
  recurring_id uuid references public.acct_recurring (id) on delete set null,
  recurring_month text, -- 'YYYY-MM' กันยืนยันรายจ่ายประจำซ้ำในเดือนเดียว
  created_at timestamptz not null default now()
);
create index if not exists acct_expenses_date_idx on public.acct_expenses (date desc);
create unique index if not exists acct_expenses_recurring_month_key
  on public.acct_expenses (recurring_id, recurring_month)
  where recurring_id is not null;

create table if not exists public.acct_other_income (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  source text not null,
  amount numeric not null check (amount > 0),
  created_at timestamptz not null default now()
);
create index if not exists acct_other_income_date_idx on public.acct_other_income (date desc);

do $$
declare t text;
begin
  foreach t in array array['acct_recurring', 'acct_expenses', 'acct_other_income']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists %I_owner on public.%I', t, t);
    execute format('create policy %I_owner on public.%I for all to authenticated using (public.is_owner()) with check (public.is_owner())', t, t);
  end loop;
end $$;

-- รูปใบเสร็จ: bucket ส่วนตัว เปิดผ่าน signed URL เท่านั้น
insert into storage.buckets (id, name, public)
values ('expense-receipts', 'expense-receipts', false)
on conflict (id) do nothing;

drop policy if exists expense_receipts_owner on storage.objects;
create policy expense_receipts_owner on storage.objects for all to authenticated
  using (bucket_id = 'expense-receipts' and public.is_owner())
  with check (bucket_id = 'expense-receipts' and public.is_owner());
