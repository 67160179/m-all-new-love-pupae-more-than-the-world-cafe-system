# wk14-quality-review.md — รายงานผลการตรวจสอบคุณภาพและความปลอดภัยของโค้ด

ระบบ: POS และจัดการสต็อกร้านกาแฟ (Express + mysql2) | ตรวจเทียบ Code Review Checklist 5 ข้อ (wk14 หัวข้อ 1.2)
ขอบเขตที่ตรวจ: `src/app.js`, `src/routes/*`, `src/controllers/*`, `src/models/*`, `src/config/db.js`, `index.html` (ส่วนที่เรนเดอร์ข้อมูลจาก API), `package.json`/`package-lock.json`, `wk07-schema.sql`

**สรุปสั้น:** โค้ดฐานดีกว่าที่คาด — ใช้ parameterized query ทุกจุด, กรอง `branch_id` ทุก query ที่แก้/ลบตาม id, และ `createOrder` ครอบ transaction + `SELECT ... FOR UPDATE` ไว้แล้ว (ผ่านข้อ 5 เรื่องสต็อก) แต่พบความเสี่ยง 10 จุด (High 1, Medium 5, Low 4) แก้จริงแล้ว 3 จุด ที่เหลือบันทึกเป็นแผนในหัวข้อ 4

---

## 1. รายการ endpoint ที่ตรวจสอบ

เกณฑ์: ✅ ผ่าน | ⚠️ ผ่านบางส่วน | ❌ ไม่ผ่าน | – ไม่เกี่ยวข้อง

| # | Endpoint | ข้อ 1 Input validation | ข้อ 2 IDOR (กรอง branch_id) | ข้อ 3 SQL Injection | ข้อ 4 Error handling | ข้อ 5 Race condition |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `GET /api/menu?branchId=` | ✅ | ✅ | ✅ | ✅ | – |
| 2 | `GET /api/menu/:id?branchId=` | ✅ | ✅ | ✅ | ✅ | – |
| 3 | `POST /api/menu` | ⚠️ ไม่จำกัดความยาว/ช่วงค่า (R7) | – | ✅ | ✅ | – |
| 4 | `PUT /api/menu/:id` | ⚠️ (R7) | ✅ | ✅ | ✅ | – (แต่ดู R9) |
| 5 | `PATCH /api/menu/:id` | ⚠️ (R7) | ✅ | ✅ | ✅ | – (แต่ดู R9) |
| 6 | `DELETE /api/menu/:id?branchId=` | ✅ | ✅ | ✅ | ✅ (จัดการ FK 409) | – |
| 7 | `POST /api/orders` | ❌ `discountCode` ไม่ตรวจชนิด (R2) | ✅ (เมนู + พนักงานต้องอยู่สาขาเดียวกัน) | ✅ | ❌ `getConnection` อยู่นอก try (R4) | ⚠️ สต็อก ✅ แต่เลขคิว ❌ (R3) และลำดับล็อก ❌ (R5) |
| 8 | `GET /api/orders?branchId=` | ✅ | ✅ | ✅ | ✅ | – |
| 9 | `GET /api/reports/sales?branchId=` | ✅ | ✅ | ✅ | ✅ | – |

ข้อสังเกตที่ผ่านด้วยดี: (ก) ทุก query ใช้ `?` ไม่มีการต่อ string SQL กับค่าจาก client (ตรวจทุกไฟล์ใน `models/`; `updateFields` ต่อ string เฉพาะชื่อคอลัมน์ที่ hardcode ไว้เอง ไม่ใช่ค่าจาก client) (ข) `adjustStock` มี guard `stock_quantity + ? >= 0` เป็นชั้นป้องกันที่สอง (ค) ราคาดึงจากฐานข้อมูลเสมอ ไม่เชื่อราคาจาก client (ง) `index.html` ใช้ `esc()` ก่อน `innerHTML` สม่ำเสมอ จึงไม่พบ XSS จากชื่อเมนู/รหัสส่วนลด (จ) `.env` อยู่ใน `.gitignore`

---

## 2. จุดที่พบความเสี่ยง

| รหัส | จุดที่พบ | สถานการณ์ที่จะเกิดปัญหาจริง | ความรุนแรง | สถานะ |
| --- | --- | --- | --- | --- |
| R1 | **ไม่มี authentication/authorization** — `branchId` และ `employeeId` มาจาก query/body ที่ client กำหนดเอง | การกรอง `branch_id` ผ่าน checklist ข้อ 2 ตามนิยามของวิชา แต่ค่าที่ใช้กรองมาจากผู้เรียกเอง ใครก็ตามที่เรียก API ได้เพียงเปลี่ยน `?branchId=2` ก็อ่าน/แก้/ลบเมนูและยอดขายของสาขา 2 ได้ (IDOR ระดับ design) | **High** | ยังไม่แก้ |
| R2 | `POST /api/orders`: `discountCode` ไม่ตรวจชนิดข้อมูล | ส่ง `"discountCode": 0` (ตัวเลข) แล้ว query กลายเป็น `WHERE code = 0` ตามกฎเทียบ string กับตัวเลขของ MySQL (แปลงข้อความเป็นตัวเลขก่อนเทียบ, `'WELCOME10'` → 0) อาจตรงกับรหัสส่วนลดทุกรหัส ได้ส่วนลดโดยไม่ต้องรู้รหัส; ส่ง array จะเกิด SQL syntax error → ตอบ 500 แทน 400 | **Medium** (เป็น High หากยืนยันบนฐานข้อมูลจริงว่าข้ามรหัสได้) | **แก้แล้ว** |
| R3 | เลขคิว `countAll() + 1` | (ก) สองออเดอร์เข้าพร้อมกัน (แม้คนละสาขา) อ่าน `COUNT(*)` ค่าเดียวกันเพราะเป็น non-locking read จึงได้เลขคิวซ้ำ (ข) นับออเดอร์ของ **ทุกสาขา** รวมกัน เลขคิวของสาขา 2 จึงไปต่อจากสาขา 1 และไม่เริ่มใหม่รายวัน; schema ไม่มี UNIQUE จึงไม่มีอะไรกันเลขซ้ำ | **Medium** | ยังไม่แก้ |
| R4 | `createOrder`: `await pool.getConnection()` อยู่นอก `try` | ฐานข้อมูลล่ม/pool เต็มแล้ว timeout → promise reject ใน async handler ของ Express 4 ไม่มีใครจับ → request ค้าง และบน Node ≥ 15 กระบวนการทั้งเซิร์ฟเวอร์ล้ม (ทดสอบด้วย mock แล้ว: เวอร์ชันเดิมจบด้วย uncaught error) ทุกสาขาใช้งานไม่ได้ | **Medium** | **แก้แล้ว** |
| R5 | `createOrder`: ล็อกแถวเมนู (`FOR UPDATE`) ตามลำดับที่ client ส่งมา | ออเดอร์ A สั่งเมนู [1, 2] และออเดอร์ B สั่ง [2, 1] พร้อมกัน → A ล็อก 1 รอ 2, B ล็อก 2 รอ 1 → deadlock, MySQL ยกเลิกหนึ่งฝั่งเป็น `ER_LOCK_DEADLOCK` → ลูกค้าได้ 500 ทั้งที่สต็อกพอ | **Medium** | **แก้แล้ว** |
| R6 | Dependency มีช่องโหว่ (`npm audit`: 3 รายการ) | `body-parser < 1.20.9` (high: DoS จาก compressed body ซึ่ง `express.json()` ใช้อยู่), `proxy-addr` (critical แต่กระทบเมื่อเปิด `trust proxy` ซึ่งโปรเจกต์ยังไม่ได้เปิด), `qs` (moderate: DoS) | **Medium** | ยังไม่แก้ (ดูแผน) |
| R7 | `POST/PUT/PATCH /api/menu`: ไม่จำกัดความยาว `name` และช่วงค่า `price`/`stockQuantity` | ส่ง `name` ยาวเกิน 100 ตัวอักษร, `price` เกิน DECIMAL(10,2) หรือ `stockQuantity` เกิน INT → ฐานข้อมูลปฏิเสธ → ตอบ 500 "เกิดข้อผิดพลาด..." แทนที่จะเป็น 400 ที่บอกสาเหตุ (ไม่รั่วข้อมูลภายใน แต่ UX/การ debug ไม่ดี) | Low | ยังไม่แก้ |
| R8 | `PUT /api/menu/:id` ผูกกับ handler เดียวกับ `PATCH` (partial update) | พฤติกรรมไม่ตรงความหมาย REST ของ PUT (ควรบังคับส่งครบทุก field) — ไม่กระทบความปลอดภัย (ตรงกับกรณีหัวข้อ 1.4) | Low | ยังไม่แก้ |
| R9 | `updateMenu` ตั้งค่า `stock_quantity` ตรง ๆ โดยไม่เขียน `stock_movement` | การปรับสต็อกผ่านหน้าจัดการเมนูไม่มีประวัติ ทำให้ผลรวม `stock_movement` ไม่ตรงกับสต็อกจริง ตรวจสอบย้อนหลัง/หาสต็อกหายไม่ได้ | Low | ยังไม่แก้ |
| R10 | `db.js` fallback เป็น user `root` รหัสผ่านว่างเมื่อไม่มี `.env`; ไม่มี rate limiting/security headers (helmet) | ถ้า deploy โดยลืมตั้ง `.env` จะเชื่อมต่อด้วย root ไม่มีรหัสผ่านโดยเงียบ ๆ | Low | ยังไม่แก้ |

**หมายเหตุเรื่องความแน่นอนของ R2:** ผมยืนยันได้ว่า `discountCode: 0` ถูกส่งเข้า query เป็น `code = 0` จริง (ตรวจจาก `mysql2.format`) แต่ไม่ได้รันบน MySQL จริงในเซสชันนี้ ผลที่ว่า "ตรงกับทุกรหัส" อ้างอิงกฎการเทียบชนิดของ MySQL กลุ่มควรทดสอบซ้ำบนฐานข้อมูลของตัวเองก่อนสรุประดับความรุนแรง

---

## 3. การแก้ไขที่ทำจริง

แก้ใน `src/controllers/orderController.js` (ไฟล์เดียว, พฤติกรรมปกติและ API contract ตาม wk13 ไม่เปลี่ยน) 3 จุด:

### 3.1 R2 — ตรวจชนิดของ `discountCode`

```javascript
// เพิ่มต่อจากการตรวจ paymentMethod
if (
  discountCode !== undefined &&
  discountCode !== null &&
  (typeof discountCode !== "string" || discountCode.length > 50)
) {
  return res.status(400).json({ error: "รหัสส่วนลดไม่ถูกต้องหรือหมดอายุ" });
}
```

ข้อความ error ใช้ตัวเดียวกับกรณีรหัสผิดเดิม (TC-13-10) จึงไม่ต้องแก้ test case เดิม

### 3.2 R5 — ล็อกแถวเมนูตามลำดับ `menuId` เสมอ

```javascript
// ก่อนแก้
const quantities = new Map();
for (const { menuId, quantity } of items) {
  quantities.set(menuId, (quantities.get(menuId) || 0) + quantity);
}

// หลังแก้: รวมรายการซ้ำเหมือนเดิม แล้วเรียงตาม menuId ก่อนเข้าลูป FOR UPDATE
const merged = new Map();
for (const { menuId, quantity } of items) {
  merged.set(menuId, (merged.get(menuId) || 0) + quantity);
}
const quantities = new Map([...merged.entries()].sort((a, b) => a[0] - b[0]));
```

### 3.3 R4 — ย้าย `getConnection` เข้า `try` และทำให้ `catch`/`finally` ปลอดภัยเมื่อยังไม่มี connection

```javascript
// ก่อนแก้
const connection = await pool.getConnection();
try {
  await connection.beginTransaction();
  ...
} catch (error) {
  await connection.rollback();
  ...
} finally {
  connection.release();
}

// หลังแก้
let connection;
try {
  connection = await pool.getConnection();
  await connection.beginTransaction();
  ...
} catch (error) {
  if (connection) {
    try { await connection.rollback(); }
    catch (rollbackError) { console.error("createOrder rollback error:", rollbackError); }
  }
  ...
} finally {
  if (connection) connection.release();
}
```

### การทดสอบหลังแก้

ทดสอบด้วย mock pool (ไม่มี MySQL ในเครื่องที่ตรวจ) เรียก `createOrder` ตรง ๆ เทียบไฟล์เดิมกับไฟล์ที่แก้:

| กรณีทดสอบ | ก่อนแก้ | หลังแก้ |
| --- | --- | --- |
| ออเดอร์ปกติ (ไม่มีส่วนลด) | 201 | 201 (พฤติกรรมเดิม) |
| `discountCode: "NOPE"` | 400 | 400 (พฤติกรรมเดิม) |
| `discountCode: 0 / false / ["a","b"]` | ผ่านด่านตรวจเข้าไปถึง query | 400 ที่ด่านตรวจ ก่อนแตะฐานข้อมูล |
| ลำดับล็อกเมื่อสั่ง `[menu 2, menu 1]` | 2 → 1 | 1 → 2 |
| ฐานข้อมูลล่ม (`getConnection` throw) | uncaught error ทำให้ process จบ | ตอบ 500 |

**สิ่งที่ยังไม่ได้ทดสอบ:** ยังไม่ได้รันชุด test case ของ wk13 (TC-13-xx) และการยิงสองออเดอร์พร้อมกันบน MySQL จริง กลุ่มควรรัน TC-13-09/10 ซ้ำเพื่อยืนยันว่าไม่มี regression

---

## 4. แผนการแก้ไขที่เหลือ

| รหัส | ความรุนแรง | เหตุผลที่ยังไม่แก้ | แนวทางที่ควรทำต่อ |
| --- | --- | --- | --- |
| R1 | High | ต้องออกแบบระบบ login/session ซึ่งเกินขอบเขตของสัปดาห์นี้และกระทบ frontend ทั้งหมด | เพิ่ม login ให้พนักงาน (เก็บ `employee_id` ใน session/JWT) แล้วอ่าน `branchId`/`employeeId` จาก token ฝั่ง server แทนการรับจาก client; จนกว่าจะทำ ให้ระบุในเอกสารส่งมอบว่า API นี้ใช้ได้เฉพาะในเครือข่ายร้านที่เชื่อถือได้ |
| R3 | Medium | ต้องแก้ schema/พฤติกรรมเลขคิว (เริ่มใหม่รายวัน/ต่อสาขา) ซึ่งกระทบ API contract และ test case | เก็บตัวนับต่อสาขาต่อวัน (ล็อกแถวสาขาด้วย `SELECT ... FOR UPDATE` ใน transaction เดียวกับการสร้างออเดอร์) และเพิ่ม `UNIQUE (branch_id, queue_date, queue_number)` เป็นด่านสุดท้าย |
| R6 | Medium | `npm audit fix` แก้ lockfile และควรทดสอบระบบหลังอัปเดต | รัน `npm audit fix` แล้วรัน test ซ้ำ; ตั้ง Dependabot ใน GitHub |
| R7 | Low | ไม่กระทบความปลอดภัย | เพิ่มการตรวจ `name.length <= 100`, `price <= 99999999.99`, `stockQuantity <= 2147483647` ใน `menuController` ให้ตอบ 400 |
| R8 | Low | ไม่กระทบความปลอดภัย | แยก handler: PUT บังคับส่งครบทุก field, PATCH รับบางส่วน |
| R9 | Low | ต้องตัดสินใจนโยบายร่วมกับทีมว่าการปรับสต็อกด้วยมือเป็น movement ประเภทใด | ทำการปรับสต็อกใน transaction เดียว: `UPDATE` แล้ว `INSERT INTO stock_movement` ด้วยส่วนต่าง |
| R10 | Low | ไม่กระทบโค้ดที่ทำงานตามปกติ | ลบค่า fallback ของ `DB_USER/DB_PASSWORD` ให้ error ชัดเจนถ้าไม่มี `.env`; เพิ่ม `helmet` และ `express-rate-limit` |

---

## 5. สิ่งที่ checklist ข้อ 2 และข้อ 5 ใน wk14 ไม่ได้ครอบคลุม (ข้อสังเกตจากการตรวจจริง)

- **ข้อ 2 (IDOR):** การ "กรอง `branch_id` ใน query" จำเป็นแต่ไม่พอ ถ้าค่า `branch_id` มาจาก client เอง (R1) การกรองนั้นป้องกันได้เฉพาะความผิดพลาด ไม่ใช่การโจมตี
- **ข้อ 5 (Race condition):** นอกจากสต็อก ยังมี race ที่ไม่ใช่ "ตัดสต็อกเกิน" อีกสองแบบคือเลขคิวซ้ำ (R3) และ deadlock จากลำดับล็อก (R5) ซึ่งการมี `FOR UPDATE` อย่างเดียวไม่ได้ป้องกัน
