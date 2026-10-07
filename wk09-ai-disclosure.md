# wk09 AI Disclosure (Coding Sprint 2)

**กลุ่ม:** 15
**สมาชิก:**
- 67160006 นายวโรดม บ่อสุข
- 67160036 นางสาวปาณิสรา เกิดผล
- 67160179 นางสาวชานันท์พร มีศรี
- 67160199 นายวัชระพงษ์ คำนึงการ
- 67160393 นายชยณัฐ ตันอึ๊ง

---

## เครื่องมือ AI ที่ใช้

- Claude (Anthropic) ผ่าน Claude Code

## ส่วนที่ทำตามตัวอย่างของอาจารย์ (wk09.md) ไม่ได้ใช้ AI คิดขึ้นใหม่

- **โครงสร้างโค้ด CRUD เมนู** ตามหัวข้อ 3.2: `menuModel.js` (`findAllByBranch`, `findByIdAndBranch`, `create`, `updateFields`, `remove`), `menuController.js` และ `menuRoutes.js` ใช้ตามตัวอย่างของอาจารย์ รวมถึงหลักการกัน IDOR ที่กรอง `branch_id` คู่กับ `menu_id` ทุก query และ partial update ด้วย `COALESCE`
- **ลำดับขั้นตอน `createOrder`** ตามหัวข้อ 3.1: validate input, รวมจำนวนเมนูเดียวกันด้วย `quantityByMenuId`, ดึงราคาและสต็อกจาก DB ไม่รับราคาจาก client, เช็คสต็อก, บันทึกออเดอร์, ตัดสต็อกใน loop, คำนวณ `lowStockMenuIds` (< 10) และตอบ 201
- **Sequence Diagram และ Flowchart** ใช้โครงตามตัวอย่างหัวข้อ 1.2, 1.6 และ 2.3 (participant, alt, loop และ business rule 3 ข้อ)
- **Model แยกจาก Controller** ตามหัวข้อ 1.6 และ `wk07.md` หัวข้อ 4
- **ตารางจับคู่โค้ดกับ Diagram** ตามแนวทางหัวข้อ 4.2

## ส่วนที่ใช้ AI ช่วย (เฉพาะส่วนที่เกินจากตัวอย่างของอาจารย์)

- **ปรับโค้ดเดิมของกลุ่มให้ตรงกับ schema wk07** ซึ่งเป็นส่วนที่ต่างจากตัวอย่างอาจารย์:
  - แก้ `discountModel.js` ให้ใช้ตาราง `discount_code`
  - ลบ `stockModel.js` ที่อ้างตาราง `stock` ซึ่งไม่มีใน schema
  - ส่ง `branchId` และ `employeeId` เข้า `orderModel.create` ที่ controller เดิมไม่ได้ส่ง
- **เพิ่ม database transaction** (`BEGIN` / `SELECT ... FOR UPDATE` / `COMMIT` / `ROLLBACK`) และให้ `UPDATE` ตัดสต็อกมีเงื่อนไข `stock_quantity - ? >= 0` เพื่อกัน race condition ตามที่อาจารย์ระบุเป็นความเสี่ยงไว้ในหัวข้อ 1.3 และคำถามท้ายบทข้อ 6 (ตัวอย่างของอาจารย์ไม่ได้ทำส่วนนี้)
- **ผสานฟีเจอร์ที่กลุ่มมีอยู่แล้ว** เข้ากับโค้ดใหม่: ส่วนลด WELCOME10, class `Order` (wk06), `stock_movement` และหมายเลขคิว แล้วปรับ Sequence Diagram ให้ตรงกับโค้ดส่วนนี้ (เพิ่ม opt ส่วนลดและข้อความ transaction)
- **Validation เพิ่มเติม** จับ error foreign key (branchId, employeeId, categoryId ที่ไม่มีจริง) และตอบ 409 เมื่อลบเมนูที่มีประวัติสั่งซื้อ
- **เรนเดอร์ diagram เป็นไฟล์ PNG** (`wk09-sequence-diagram.png`, `wk09-flowchart.png`) และเขียนไฟล์ `wk09-process-design.md`
- **ทดสอบ endpoint** ด้วยฐานข้อมูลจำลอง (MariaDB) ทั้งกรณีปกติ สต็อกไม่พอ เมนูซ้ำหลายบรรทัด ส่วนลด สั่งพร้อมกัน และ IDOR

## ส่วนที่ทำเอง (ไม่ใช้ AI)

- งานสัปดาห์ก่อนหน้าทั้งหมดที่เป็นฐานของโค้ดนี้ (wk01–wk07: เอกสาร, use case, class diagram, ER diagram, `wk07-schema.sql`, `Order.js`)
- การนำโค้ดไปรันและทดสอบบนเครื่องของกลุ่มเอง และ commit/push
- งานเดี่ยว `wk09-quiz.md` สมาชิกแต่ละคนทำเอง

## หมายเหตุ

สมาชิกทุกคนอ่านและทำความเข้าใจโค้ดและ diagram ก่อนส่ง โดยเฉพาะส่วนที่ AI ช่วยเพิ่มจากตัวอย่างของอาจารย์ (transaction, การผสานส่วนลดและ `stock_movement`)
