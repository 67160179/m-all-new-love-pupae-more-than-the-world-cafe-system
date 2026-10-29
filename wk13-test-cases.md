# wk13: Integration และ End-to-End Test Cases (Coding Sprint 3)

Flow หลัก: **order → payment → report** ทุกเคสระบุสาขา (`branch_id`) เสมอ

## 1. ข้อมูลตั้งต้น (Precondition กลาง)

1. import `wk07-schema.sql` ใหม่ (`mysql -u root -p < wk07-schema.sql`) จะได้
   - สาขา 1: อเมริกาโน่ (id 1) สต็อก 50, ลาเต้เย็น (id 2) สต็อก **0**, พนักงาน 1 (สมชาย), 2
   - สาขา 2: อเมริกาโน่ (id 3) สต็อก 30, พนักงาน 3 (ธนา)
   - รหัสส่วนลด `WELCOME10` (10%)
2. ที่หน้า "จัดการเมนู" เพิ่มเมนู (หมวดกาแฟ)
   - สาขา 1: "ลาเต้" ราคา 70 สต็อก 20, "เอสเพรสโซ" ราคา 50 สต็อก 1
   - สาขา 2: "ลาเต้" ราคา 70 สต็อก 15

## 2. ที่มาของ Test Case (wk13 หัวข้อ 2.2)

| TC | Use Case / Include-Extend | FR | Acceptance Criteria | Business Rule (wk09) | Alt fragment |
|---|---|---|---|---|---|
| TC-13-01, 02 | UC-01 รับออเดอร์ (base), UC-03 ชำระเงิน | FR-01, FR-02, FR-03 | US-01 ข้อ 1-2 | ข้อ 4 (ราคาจาก DB) | กิ่ง "สต็อกเพียงพอ" |
| TC-13-03 | UC-03 **include** UC-04 ตัดสต็อก (ต้อง assert สต็อกด้วย) | FR-06 | US-04 ข้อ 1 | ข้อ 2 | กิ่ง "สต็อกเพียงพอ" |
| TC-13-04 | UC-07 ดูรายงานยอดขาย | FR-09, FR-12 | US-07 ข้อ 1 | ข้อ 5 | – |
| TC-13-05 | UC-01 Exception 2a | FR-06 | US-03 ข้อ 1 | ข้อ 1, 6 | กิ่ง "สต็อกไม่เพียงพอ" |
| TC-13-06 | UC-01 + UC-07 สาขาที่ 2 | FR-08, FR-12 | US-07 ข้อ 1 | ข้อ 5 | – |
| TC-13-07 | UC-01 Exception 2a (edge case สต็อก = 0) | FR-11 | US-03 ข้อ 1-2 | ข้อ 1 | กิ่ง "สต็อกไม่เพียงพอ" |
| TC-13-08 | UC-01 | FR-08 | – | ข้อ 5 | alt "ข้อมูลนำเข้าไม่ถูกต้อง" |
| TC-13-09 | UC-01 Alternative 4a (ส่วนลด), แจ้งสต็อกต่ำ | FR-02 | US-02 ข้อ 1, US-07 ข้อ 2 | ข้อ 3 | opt "มีรหัสส่วนลด" |
| TC-13-10 | UC-01 Alternative 4a | FR-02 | US-02 ข้อ 2 | ข้อ 6 | alt "รหัสส่วนลดไม่ถูกต้อง" |
| TC-13-11, 12 | UC-07 | FR-12 | – | ข้อ 5 | – |

## 3. Test Cases

| TC ID | Precondition | ขั้นตอนทดสอบ | ผลลัพธ์ที่คาดหวัง | ผลลัพธ์จริง | Pass/Fail |
|---|---|---|---|---|---|
| TC-13-01 | ข้อมูลตั้งต้นข้อ 1-2 | 1. เปิดหน้า POS เลือกสาขา 1<br>2. กด "+ เพิ่ม" ลาเต้ 2 ครั้ง และอเมริกาโน่ 1 ครั้ง | ตะกร้ามี 2 รายการ, ยอดก่อนลด/รวม = 200.00 | _กรอกตอนทดสอบจริง_ | _กรอกตอนทดสอบจริง_ |
| TC-13-02 | ต่อจาก TC-13-01 | 1. เลือกวิธีชำระเงิน "เงินสด" รหัสพนักงาน 1<br>2. กดยืนยันออเดอร์ | แสดงใบเสร็จมีหมายเลขคิว, ยอด 200.00, แถวใหม่ใน `orders` ที่ `branch_id = 1` | _กรอกตอนทดสอบจริง_ | _กรอกตอนทดสอบจริง_ |
| TC-13-03 | ต่อจาก TC-13-02 | 1. ดูการ์ดเมนูหน้า POS สาขา 1<br>2. สลับไปสาขา 2 | สาขา 1: ลาเต้ "เหลือ 18", อเมริกาโน่ "เหลือ 49" / สาขา 2: ลาเต้ยัง "เหลือ 15" (ไม่ถูกกระทบ) | _กรอกตอนทดสอบจริง_ | _กรอกตอนทดสอบจริง_ |
| TC-13-04 | ต่อจาก TC-13-03 | 1. เลือกสาขา 1<br>2. เปิดหน้ารายงานยอดขาย | ตาราง "ยอดขายตามเมนู": ลาเต้ 2 / 140.00, อเมริกาโน่ 1 / 60.00; ยอดขายรวม 200.00, ออเดอร์ 1 รายการ | _กรอกตอนทดสอบจริง_ | _กรอกตอนทดสอบจริง_ |
| TC-13-05 | สาขา 1 "เอสเพรสโซ" สต็อก 1 | 1. ส่ง `POST /api/orders` (Postman/curl) `{branchId:1, employeeId:1, paymentMethod:"cash", items:[{menuId:<เอสเพรสโซ>, quantity:5}]}`<br>2. ตรวจตาราง `orders` และสต็อก | status **400** ข้อความ `สินค้า "เอสเพรสโซ" ไม่พร้อมจำหน่าย (สต็อกเหลือ 1)`; ไม่มีแถวใหม่ใน `orders`; สต็อกยังเป็น 1 | _กรอกตอนทดสอบจริง_ | _กรอกตอนทดสอบจริง_ |
| TC-13-06 | สาขา 2 "ลาเต้" สต็อก 15, ทำ TC-13-02 แล้ว | 1. เลือกสาขา 2 เพิ่มลาเต้ 3 แก้ว<br>2. เงินสด รหัสพนักงาน 3 กดยืนยัน<br>3. เปิดรายงานสาขา 2 แล้วสลับไปสาขา 1 | สาขา 2: ลาเต้เหลือ 12, รายงานมีเฉพาะลาเต้ 3 / 210.00 / สาขา 1: สต็อกลาเต้ 18 และรายงานเหมือน TC-13-04 ทุกตัวเลข | _กรอกตอนทดสอบจริง_ | _กรอกตอนทดสอบจริง_ |
| TC-13-07 | สาขา 1 "ลาเต้เย็น" สต็อก 0 | 1. ดูการ์ด "ลาเต้เย็น" หน้า POS<br>2. ส่ง `POST /api/orders` ลาเต้เย็น (id 2) จำนวน 1 ตรงผ่าน Postman | การ์ดแสดง "หมด" และปุ่ม "+ เพิ่ม" กดไม่ได้ (FR-11); API ตอบ 400 | _กรอกตอนทดสอบจริง_ | _กรอกตอนทดสอบจริง_ |
| TC-13-08 | พนักงาน 3 อยู่สาขา 2 | 1. เลือกสาขา 1 เพิ่มลาเต้ 1<br>2. ใส่รหัสพนักงาน 3 กดยืนยัน | แจ้ง "พนักงานรหัส 3 ไม่ได้อยู่สาขานี้" ไม่บันทึกออเดอร์ | _กรอกตอนทดสอบจริง_ | _กรอกตอนทดสอบจริง_ |
| TC-13-09 | สาขา 1 ลาเต้สต็อก 18 | 1. เพิ่มลาเต้ 9 แก้ว (630.00)<br>2. รหัสส่วนลด `WELCOME10` ชำระ QR กดยืนยัน | ใบเสร็จ ส่วนลด 63.00 รวมสุทธิ 567.00; ข้อความแจ้ง "⚠ สต็อกต่ำ" (เหลือ 9 < 10); การ์ดลาเต้แสดง "⚠ เหลือ 9" | _กรอกตอนทดสอบจริง_ | _กรอกตอนทดสอบจริง_ |
| TC-13-10 | อเมริกาโน่สาขา 1 สต็อกที่ทราบค่า | 1. เพิ่มอเมริกาโน่ 1<br>2. รหัสส่วนลด `NOPE` กดยืนยัน | แจ้ง "รหัสส่วนลดไม่ถูกต้องหรือหมดอายุ"; สต็อกไม่ลด (rollback) | _กรอกตอนทดสอบจริง_ | _กรอกตอนทดสอบจริง_ |
| TC-13-11 | – | เรียก `GET /api/reports/sales`, `GET /api/reports/sales?branchId=abc`, `GET /api/orders` (ไม่มี branchId) | ตอบ 400 ทั้ง 3 กรณี | _กรอกตอนทดสอบจริง_ | _กรอกตอนทดสอบจริง_ |
| TC-13-12 | สาขาที่ยังไม่มีออเดอร์ | เรียก `GET /api/reports/sales?branchId=<สาขาที่ไม่มียอด>` | 200 และ `[]`; หน้ารายงานแสดง "ยังไม่มียอดขายในสาขานี้" | _กรอกตอนทดสอบจริง_ | _กรอกตอนทดสอบจริง_ |

## 4. ผลรันอัตโนมัติระดับ API (29 ตุลาคม 2569)

รันสคริปต์ทดสอบกับฐานข้อมูลชั่วคราว (สร้างจาก `wk07-schema.sql` แล้วลบทิ้งหลังรัน) MySQL 8.0, Node 24 — ยิง HTTP จริงเข้า server ตามขั้นตอนของ TC ด้านบน ตรวจทั้ง response และค่าในฐานข้อมูล

**ผล: 23/23 ผ่าน** ครอบคลุม TC-13-02 ถึง TC-13-12 และการตรวจ API contract (CT-01 menu response เป็น camelCase/price เป็น number, CT-02 menu กรองตามสาขา) — TC-13-01 และส่วน UI ของ TC-13-07, 09 ต้องทดสอบผ่านหน้าจอจริง

## 5. Bug ที่พบระหว่าง Integration และการแก้ไข (wk13 หัวข้อ 3.1)

| # | Reproduce | Isolate | Fix and Verify |
|---|---|---|---|
| B1 | `GET /api/menu?branchId=1` | response เป็น `menu_id`, `stock_quantity`, `price: "60.00"` (snake_case + string) ขัดกับข้อตกลง JSON camelCase ที่ใช้ใน `POST /api/orders` (`menuId`) — frontend อ่านได้เพราะเขียนตาม snake_case แบบเดียวกัน จึงไม่เห็น error แต่ contract สองฝั่งไม่ตรงกัน | `menuController.js` เพิ่ม `toMenuJson()` แปลงเป็น camelCase + `Number(price)`, แก้ `index.html` ให้อ่าน `menuId`/`stockQuantity` — ตรวจด้วย CT-01 และหน้า POS |
| B2 | ส่งออเดอร์เกินสต็อก | ได้ **409** แต่ Business Rule ข้อ 1 และ sequence diagram wk09 กำหนด **400** (diagram-code drift) | `orderController.js` เปลี่ยนเป็น 400 — ตรวจด้วย TC-13-05, 07 |
| B3 | สั่งจนสต็อกเหลือ 7-9 | backend ใช้เกณฑ์ `<= 5` แต่ Business Rule ข้อ 3 และหน้าจอ POS ใช้ `< 10` → หน้าจอแสดง ⚠ แต่ backend ไม่ส่ง `lowStockMenuIds` | refactor เป็น `isLowStock()` ใน `menuModel.js` (เกณฑ์ 10 จุดเดียว) + `console.warn` ตาม BR ข้อ 3 — ตรวจด้วย TC-13-09 |
| B4 | เปิด Network tab ที่หน้ารายงานสาขา 1 | `GET /api/orders` ส่งออเดอร์ทุกสาขา แล้ว frontend `filter` เอง — ขัด Business Rule ข้อ 5 | `GET /api/orders` บังคับ `branchId` และกรองที่ SQL, response เป็น camelCase/number; เพิ่ม `GET /api/reports/sales` — ตรวจด้วย TC-13-06, 11 |

## 6. API Contract ที่ตกลงหลัง Integration

| Endpoint | Request | Response สำเร็จ | Error |
|---|---|---|---|
| `GET /api/menu?branchId=` | query `branchId` (int) | 200 `[{ menuId, branchId, categoryId, name, price:number, stockQuantity }]` | 400 `{ error }` |
| `POST /api/orders` | `{ branchId, employeeId, paymentMethod: "cash"\|"qr", discountCode?, items:[{ menuId, quantity }] }` | 201 `{ orderId, queueNumber, subtotalAmount, discountAmount, totalAmount, lowStockMenuIds }` | 400 `{ error }` (รวมสต็อกไม่พอ), 500 |
| `GET /api/orders?branchId=` | query `branchId` (int) | 200 `[{ orderId, branchId, queueNumber, paymentMethod, status, discountCode, discountPercent, createdAt, subtotalAmount, discountAmount, totalAmount }]` | 400 `{ error }` |
| `GET /api/reports/sales?branchId=` | query `branchId` (int) | 200 `[{ menuId, name, totalQuantity:number, totalSales:number }]` (ยอดก่อนหักส่วนลด) | 400 `{ error }`, 500 |

ข้อตกลงชนิดข้อมูล: ค่า DECIMAL / ผลของ `SUM()` แปลงเป็น `number` ที่ฝั่ง **backend** ก่อนส่งออกทุก endpoint
