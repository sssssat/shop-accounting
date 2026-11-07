-- ลบเฉพาะข้อมูลทดสอบ: รายการที่มีป้าย [ทดสอบ] และบิลเลข 900001 ขึ้นไป
-- รูปที่แนบกับรายการทดสอบ: ให้กดลบรายการในเว็บก่อน ไม่อย่างนั้นไฟล์รูปจะค้างใน bucket
-- รายการที่กรอกเองโดยไม่มีป้ายจะไม่ถูกลบ

begin;

delete from public.acct_expenses where vendor like '[ทดสอบ]%';
delete from public.acct_recurring where vendor like '[ทดสอบ]%';
delete from public.acct_other_income where source like '[ทดสอบ]%';
delete from public.sales where no >= 900001 and cashier_name = 'ทดสอบ'; -- sale_items ถูกลบตามอัตโนมัติ

commit;

-- ตรวจผล: ต้องได้ 0 ทุกช่อง
select
  (select count(*) from public.acct_expenses where vendor like '[ทดสอบ]%') as expenses,
  (select count(*) from public.acct_recurring where vendor like '[ทดสอบ]%') as recurring,
  (select count(*) from public.acct_other_income where source like '[ทดสอบ]%') as other_income,
  (select count(*) from public.sales where no >= 900001 and cashier_name = 'ทดสอบ') as sales;
