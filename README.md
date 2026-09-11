# ก๋วยเตี๋ยวไก่มะระ — POS ร้านค้า

เว็บบนมือถือสำหรับคนขาย ใช้ Username/Password ของร้าน ไม่ต้องใช้บัญชี ChatGPT ไม่มีหน้าลูกค้าสั่งอาหาร

## สิทธิ์
- Admin1: ขาย ยกเลิกบิล ดูยอดรายวัน เพิ่ม/แก้เมนู สร้างบัญชีพนักงาน เปลี่ยนรหัสผ่าน และปิดบัญชีพนักงาน
- P01 และบัญชี staff: ขาย ยกเลิกบิล ดูยอดและประวัติร้าน แก้เมนูหรือบัญชีไม่ได้
- ทุกบัญชีใช้ข้อมูลร้านเดียวกัน ไม่มีการสมัครเอง บุคคลทั่วไปเห็นได้เฉพาะหน้าล็อกอิน
- รหัสผ่านไม่ได้อยู่ใน repository; เก็บ salted PBKDF2 hash ใน D1 และค่า bootstrap เป็น secret ของโฮสติ้ง

## ใช้งาน
1. เปิดลิงก์และกรอกบัญชีร้าน เมนูตามภาพจะถูกเตรียมให้เมื่อเข้าสู่ระบบครั้งแรก
2. เลือกเมนู ขนาด เส้น และหมายเหตุ แล้วเพิ่มลงบิล
3. รับชำระเงินสด/โอน เงินสดระบุยอดรับเพื่อคำนวณเงินทอน เงินโอนให้ตรวจเงินเข้าเอง
4. กดยืนยันว่าจ่ายแล้ว หากเชื่อมต่อผิดพลาดให้ตรวจสอบบิลเดิมซ้ำ ไม่เริ่มคิดเงินใหม่
5. หน้าบิลใช้ตรวจรายละเอียดและยกเลิกพร้อมเหตุผล หน้ายอดขายไม่นับบิลยกเลิก
6. แอดมินเข้าหน้าจัดการเพื่อแก้เมนูและสร้างบัญชีพนักงานเพิ่มเติม
7. กดออกเมื่อเลิกใช้เครื่องร่วมกัน เซสชันหมดอายุใน 12 ชั่วโมง การปิดบัญชีหรือเปลี่ยนรหัสผ่านยกเลิกเซสชันเดิมทั้งหมด

## เมนู
ก๋วยเตี๋ยวหมูน้ำใส/ต้มยำ และก๋วยเตี๋ยวไก่/ไก่น้ำต้มยำ ธรรมดา 35 พิเศษ 45 บาท เกาเหลาไก่/หมู 50 บาท
เส้น: บะหมี่ เส้นเล็ก วุ้นเส้น เส้นหมี่ เส้นมาม่า

## เทคโนโลยี
TypeScript, React 19, Vinext/Next.js App Router API, Vite, Tailwind, Radix/Shadcn, Cloudflare Workers + D1, Drizzle migrations, Zod.

## พัฒนาต่อ
Node.js >=22.13 และ npm. ติดตั้งด้วย `npm ci`.
ตั้งค่า `POS_BOOTSTRAP_USERS` ใน `.dev.vars` สำหรับ local และเป็น secret ใน Sites สำหรับ production รูปแบบดู `.env.example` ห้าม commit `.dev.vars` หรือ hash ของบัญชีจริง
Hash format: `pbkdf2:100000:<random salt hex>:<derived key hex>` ใช้ SHA-256, salt เป็น UTF-8 ของค่า hex, 100000 iterations, 32-byte output. ใช้ salt แบบสุ่มแยกต่อบัญชี

```sh
npm run build
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_black_tinkerer.sql
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0001_needy_kingpin.sql
npm run dev
```

ใช้ URL ที่ dev server แสดง ปัจจุบัน http://localhost:5173/ . ใช้ migration เฉพาะที่ยังไม่เคยรัน ฐานข้อมูล local แยกจากจริง

```sh
npx tsc --noEmit
node tests/integration.mjs
```
ตั้ง `TEST_ADMIN_PASSWORD` และ `TEST_STAFF_PASSWORD` ใน environment ก่อนรัน test โดยไม่ใส่รหัสจริงลงไฟล์โค้ด Tests ติดต่อเฉพาะ localhost ใช้ Admin1/P01 สร้างสินค้าและบัญชีทดสอบ แล้วปิดบัญชี/สินค้าและยกเลิกบิลทดสอบ รันถี่อาจติด rate limit

## โครงสร้าง
- `app/pos.tsx`: ขาย บิล รายงาน เมนู
- `app/login.tsx`, `app/staff-accounts.tsx`: ล็อกอินและจัดการบัญชี
- `lib/auth.ts`: password hashing, session lookup, bootstrap, rate limit
- `app/api/auth/route.ts`, `app/api/users/route.ts`: บัญชีและเซสชัน
- `app/api/pos/route.ts`: ตรวจสิทธิ์และบันทึกธุรกรรม
- `db/schema.ts`, `drizzle/`: schema และ migration แบบ append-only

## ความปลอดภัยและการตรวจสอบ
ทุก API ตรวจเซสชันบนเซิร์ฟเวอร์ เมนู/บัญชีตรวจ role แอดมิน Cookies: HttpOnly, SameSite=Strict, Secure บน HTTPS. เซิร์ฟเวอร์เก็บ hash ของ token. จำกัดการลองล็อกอิน 5 ครั้งต่อชื่อผู้ใช้ต่อ 15 นาที และ 30 ครั้งต่อ IP ต่อ 15 นาที การสำเร็จรีเซ็ตตัวนับชื่อผู้ใช้ บัญชีไม่พบ/รหัสผิดตอบข้อความเดียวกัน
ทดสอบ auth, role, shared data, cash/transfer, duplicate concurrent submit, validation, price snapshot, cancellation, user creation/disabling, forged/revoked sessions, login rate limiting

## ขอบเขต
ส่งสรุปรายวันไป Google Sheets จากหน้ายอดขายได้เฉพาะแอดมิน หลังตั้งค่าตาม `integrations/google-sheets/README.md` เลือกวันที่แล้วกดส่งด้วยตนเอง วันที่เดิมอัปเดตแถวเดิม หากยกเลิกบิลย้อนหลังให้ส่งวันนั้นใหม่ รายละเอียดบิลยังเก็บใน D1 ไม่มีการสมัครบริการเสียเงินหรือเปิด billing เพิ่ม

ต้องใช้อินเทอร์เน็ต ไม่มีสต็อก QR ตรวจโอนอัตโนมัติ หรือใบกำกับภาษี ข้อมูลจริงอยู่บน D1. บิลร่างในแท็บอยู่ใน sessionStorage และอาจหายเมื่อปิดแท็บ ส่งออก JSON สำรองได้ ยังไม่มีหน้ากู้คืนไฟล์ โหลดประวัติทั้งหมด ยังไม่มี pagination สำหรับจำนวนบิลมหาศาล
เว็บต้องเปิด audience เป็น public เพื่อให้เข้าหน้าล็อกอินได้ แต่ข้อมูลร้านต้องผ่านบัญชีร้านเสมอ ไม่มีการพึ่ง identity headers ของ ChatGPT สำหรับสิทธิ์ POS อีกต่อไป
