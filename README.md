# บัญชีร้าน

เว็บบัญชีสำหรับเจ้าของร้าน ใช้ Supabase เดียวกับแอป POS: อ่านบิลจาก POS, บันทึกรายจ่ายและรูปใบเสร็จ, รายจ่ายประจำ, นำเข้าจาก Google Sheet และส่งออก Excel

## ติดตั้ง

1. รัน `supabase/migrations/001_accounting.sql` ใน Supabase SQL Editor
2. คัดลอก `.env.example` เป็น `.env.local` แล้วใส่ค่าเดียวกับ POS
3. `npm install` แล้ว `npm run dev` (เปิดที่ http://localhost:3001)

ตั้ง env ชุดเดียวกันใน Vercel เมื่อ deploy

## คำสั่ง

- `npm test` ทดสอบตรรกะการคำนวณ
- `npm run build` build สำหรับ production

## ข้อจำกัด

- การสำรองทุกคืนของ POS ยังไม่รวมตาราง `acct_*` และรูปใบเสร็จ
- รายงานรับ-จ่ายรายวันยังไม่ได้เทียบกับแบบรายงานที่สรรพากรกำหนด
- ยังไม่มีหน้าเตรียมยื่นภาษี
