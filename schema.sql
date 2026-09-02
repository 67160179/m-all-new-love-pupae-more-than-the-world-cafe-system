CREATE DATABASE IF NOT EXISTS cafe_pos_db;
USE cafe_pos_db;

-- ตารางออเดอร์ (หัว/summary ของออเดอร์)
CREATE TABLE IF NOT EXISTS orders (
  id INT AUTO_INCREMENT PRIMARY KEY,
  queue_number INT NOT NULL,
  payment_method VARCHAR(50) NOT NULL,
  discount_code VARCHAR(50) DEFAULT NULL,
  subtotal_amount DECIMAL(10, 2) NOT NULL,
  discount_amount DECIMAL(10, 2) NOT NULL DEFAULT 0,
  total_amount DECIMAL(10, 2) NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'รอชำระเงิน',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ตารางรายการสินค้าในแต่ละออเดอร์ (แยกเก็บทีละชิ้น ไม่รวมเป็นยอดเดียว
CREATE TABLE IF NOT EXISTS order_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  order_id INT NOT NULL,
  name VARCHAR(255) NOT NULL,
  price DECIMAL(10, 2) NOT NULL,
  quantity INT NOT NULL,
  FOREIGN KEY (order_id) REFERENCES orders(id)
);

-- ตารางสต็อกวัตถุดิบแบบง่าย ผูกกับชื่อสินค้าโดยตรง (ยังไม่มีตาราง products จริง)
-- ใช้เช็คก่อนเพิ่มสินค้าในออเดอร์ตาม US-03
CREATE TABLE IF NOT EXISTS stock (
  item_name VARCHAR(255) PRIMARY KEY,
  quantity INT NOT NULL DEFAULT 0
);

-- ตารางรหัสส่วนลด ใช้ตรวจสอบตาม US-02
CREATE TABLE IF NOT EXISTS discount_codes (
  code VARCHAR(50) PRIMARY KEY,
  percent_off DECIMAL(5, 2) NOT NULL,
  expires_at DATETIME DEFAULT NULL
);

-- ข้อมูลตัวอย่างสำหรับทดสอบ (ลบ/แก้ไขได้ตามต้องการ)
INSERT IGNORE INTO stock (item_name, quantity) VALUES
  ('อเมริกาโน่', 50),
  ('ลาเต้เย็น', 0);

INSERT IGNORE INTO discount_codes (code, percent_off, expires_at) VALUES
  ('WELCOME10', 10.00, NULL);
