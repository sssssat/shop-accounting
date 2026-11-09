-- รายจ่ายแบบบิล: เลขที่/ชื่อบิล + รายการย่อยในบิล (ไม่บังคับทั้งคู่)
-- ยอดของรายจ่าย (acct_expenses.amount) ยังเป็นยอดรวมของบิลเหมือนเดิม
-- รันซ้ำได้

alter table public.acct_expenses add column if not exists bill_ref text;

create table if not exists public.acct_expense_items (
  id uuid primary key default gen_random_uuid(),
  expense_id uuid not null references public.acct_expenses (id) on delete cascade,
  name text not null,
  qty numeric not null default 1 check (qty > 0),
  unit_price numeric not null check (unit_price >= 0),
  sort int not null default 0
);
create index if not exists acct_expense_items_expense_idx on public.acct_expense_items (expense_id);

alter table public.acct_expense_items enable row level security;
drop policy if exists acct_expense_items_owner on public.acct_expense_items;
create policy acct_expense_items_owner on public.acct_expense_items for all to authenticated
  using (public.is_owner()) with check (public.is_owner());
