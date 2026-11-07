'use client';

import { useRef, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes } from 'react';
import { thaiMonthShort } from '@/lib/accounting';
import { compressReceipt } from '@/lib/image';

type Variant = 'primary' | 'ghost' | 'danger';
const VARIANT: Record<Variant, string> = {
  primary: 'border-0 bg-primary font-semibold text-white hover:bg-primary-dark',
  ghost: 'border border-[#D1D5DB] bg-surface font-medium text-ink hover:bg-bg',
  danger: 'border border-danger bg-surface font-semibold text-danger',
};

export function Button({ variant = 'primary', className = '', ...p }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return <button type="button" {...p} className={`min-h-[46px] rounded-[10px] px-[18px] ${VARIANT[variant]} ${className}`} />;
}

export function Chip({ active, className = '', ...p }: ButtonHTMLAttributes<HTMLButtonElement> & { active: boolean }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      {...p}
      className={`min-h-11 rounded-full border px-4 text-sm font-medium ${active ? 'border-primary bg-primary-soft' : 'border-[#D1D5DB] bg-surface'} ${className}`}
    />
  );
}

export function Card({ className = '', children }: { className?: string; children: ReactNode }) {
  return <section className={`rounded-[14px] border border-border bg-surface ${className}`}>{children}</section>;
}

export function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <Card className="p-5">
      <div className="text-sm text-dim">{label}</div>
      <div className={`mt-2 text-[28px] font-semibold ${accent ? 'text-primary' : ''}`}>{value}</div>
    </Card>
  );
}

const CONTROL = 'h-[46px] w-full rounded-[10px] border border-[#D1D5DB] bg-surface px-3 outline-none focus:border-primary';

export function Field({ label, ...p }: InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return (
    <label className="block">
      <span className="mb-1.5 block font-medium">{label}</span>
      <input {...p} className={`${CONTROL} ${p.className ?? ''}`} />
    </label>
  );
}

export function Select({ label, options, ...p }: SelectHTMLAttributes<HTMLSelectElement> & { label: string; options: string[] }) {
  return (
    <label className="block">
      <span className="mb-1.5 block font-medium">{label}</span>
      <select {...p} className={CONTROL}>
        {options.map((o) => (
          <option key={o}>{o}</option>
        ))}
      </select>
    </label>
  );
}

export function Checkbox({ label, ...p }: InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return (
    <label className="flex h-11 w-11 items-center justify-center">
      <input type="checkbox" aria-label={label} {...p} className="h-[22px] w-[22px] accent-primary" />
    </label>
  );
}

export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="fixed inset-0 z-20 flex items-start justify-center overflow-y-auto bg-black/45 px-4 py-12">
      <div role="dialog" aria-label={title} className="w-full max-w-[460px] rounded-2xl bg-surface p-6">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-xl font-semibold">{title}</h2>
          <button type="button" onClick={onClose} aria-label="ปิด" className="h-11 w-11 rounded-full bg-[#F3F4F6] text-lg">
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function PageHead({ title, sub, children }: { title: string; sub?: string; children?: ReactNode }) {
  return (
    <div className="flex min-h-[68px] flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="text-[26px] font-semibold">{title}</h1>
        {sub && <div className="mt-1 text-sm text-dim">{sub}</div>}
      </div>
      {children && <div className="grid w-full grid-cols-1 gap-2 sm:w-auto sm:auto-cols-[140px] sm:grid-flow-col [&>*]:h-[46px] [&>*]:whitespace-nowrap">{children}</div>}
    </div>
  );
}

export function MonthInput({ value, onChange }: { value: string; onChange: (m: string) => void }) {
  return (
    <label className="relative flex h-[46px] cursor-pointer items-center justify-center rounded-[10px] border border-[#D1D5DB] bg-surface px-[18px] font-medium focus-within:border-primary">
      {thaiMonthShort(value)}
      <input
        type="month"
        aria-label="เลือกเดือน"
        value={value}
        onChange={(e) => e.target.value && onChange(e.target.value)}
        onClick={(e) => e.currentTarget.showPicker?.()}
        className="absolute inset-0 cursor-pointer opacity-0"
      />
    </label>
  );
}

/** ปุ่มเลือก/ถ่ายรูป คืนรูปที่บีบแล้ว */
export function ReceiptPicker({ onPick, onError, render }: { onPick: (b: Blob) => void; onError: (m: string) => void; render: (open: () => void) => ReactNode }) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <>
      <input
        ref={ref}
        type="file"
        accept="image/*"
        hidden
        onChange={async (e) => {
          const file = e.target.files?.[0];
          e.target.value = '';
          if (!file) return;
          try {
            onPick(await compressReceipt(file));
          } catch (err) {
            onError(err instanceof Error ? err.message : 'เปิดรูปไม่สำเร็จ');
          }
        }}
      />
      {render(() => ref.current?.click())}
    </>
  );
}
