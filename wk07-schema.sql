-- wk07-schema.sql : ฐานข้อมูลระบบ POS และจัดการสต็อกร้านกาแฟ 3-5 สาขา
-- แปลงจาก ER Diagram (wk07-er-diagram.mermaid) ผ่านการ normalize ถึง 3NF
-- import: mysql -u root -p < wk07-schema.sql

CREATE DATABASE IF NOT EXISTS cafe_pos_db
  DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE cafe_pos_db;

-- ลบตารางเดิม (ลำดับ: ตารางลูกก่อนตารางแม่) เพื่อให้ import ซ้ำได้
DROP TABLE IF EXISTS stock_movement;
DROP TABLE IF EXISTS order_item;
DROP TABLE IF EXISTS orders;
DROP TABLE IF EXISTS menu_item;
DROP TABLE IF EXISTS employee;
DROP TABLE IF EXISTS discount_code;
DROP TABLE IF EXISTS category;
DROP TABLE IF EXISTS branch;

-- สาขา
CREATE TABLE branch (
  branch_id INT AUTO_INCREMENT PRIMARY KEY,
  name      VARCHAR(100) NOT NULL,
  address   VARCHAR(255)
);

-- หมวดหมู่เมนู (แยกจาก menu_item เพื่อผ่าน 3NF)
CREATE TABLE category (
  category_id INT AUTO_INCREMENT PRIMARY KEY,
  name        VARCHAR(50) NOT NULL
);

-- พนักงาน (single-table inheritance: Cashier/Barista/Manager แยกด้วย role)
CREATE TABLE employee (
  employee_id INT AUTO_INCREMENT PRIMARY KEY,
  branch_id   INT NOT NULL,
  name        VARCHAR(100) NOT NULL,
  role        VARCHAR(20) NOT NULL,
  CONSTRAINT chk_employee_role CHECK (role IN ('cashier', 'barista', 'manager')),
  FOREIGN KEY (branch_id) REFERENCES branch(branch_id)
);

-- เมนู (stock_quantity อยู่ในตารางนี้ จึงมีแถวเมนูแยกต่อสาขา)
CREATE TABLE menu_item (
  menu_id        INT AUTO_INCREMENT PRIMARY KEY,
  branch_id      INT NOT NULL,
  category_id    INT NOT NULL,
  name           VARCHAR(100) NOT NULL,
  price          DECIMAL(10,2) NOT NULL,   -- ราคาปัจจุบัน
  stock_quantity INT NOT NULL DEFAULT 0,
  FOREIGN KEY (branch_id)   REFERENCES branch(branch_id),
  FOREIGN KEY (category_id) REFERENCES category(category_id)
);

-- รหัสส่วนลด (US-02)
CREATE TABLE discount_code (
  code        VARCHAR(50) PRIMARY KEY,
  percent_off DECIMAL(5,2) NOT NULL,
  expires_at  DATETIME DEFAULT NULL
);

-- ออเดอร์ (ไม่เก็บ total_amount เพราะคำนวณได้จาก SUM(quantity * unit_price) แล้วหักส่วนลด)
CREATE TABLE orders (
  order_id         INT AUTO_INCREMENT PRIMARY KEY,
  branch_id        INT NOT NULL,
  employee_id      INT NOT NULL,
  queue_number     INT NOT NULL,
  payment_method   VARCHAR(20) NOT NULL,
  status           VARCHAR(30) NOT NULL DEFAULT 'รอชำระเงิน',
  discount_code    VARCHAR(50) DEFAULT NULL,
  discount_percent DECIMAL(5,2) NOT NULL DEFAULT 0,  -- snapshot ณ เวลาที่สั่ง เหมือน unit_price
  created_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (branch_id)     REFERENCES branch(branch_id),
  FOREIGN KEY (employee_id)   REFERENCES employee(employee_id),
  FOREIGN KEY (discount_code) REFERENCES discount_code(code)
);

-- รายการสินค้าในออเดอร์ (associative entity ของ M:N ระหว่าง orders กับ menu_item)
CREATE TABLE order_item (
  order_item_id INT AUTO_INCREMENT PRIMARY KEY,
  order_id      INT NOT NULL,
  menu_id       INT NOT NULL,
  quantity      INT NOT NULL,
  unit_price    DECIMAL(10,2) NOT NULL,   -- snapshot ราคา ณ เวลาที่สั่ง
  FOREIGN KEY (order_id) REFERENCES orders(order_id),
  FOREIGN KEY (menu_id)  REFERENCES menu_item(menu_id)
);

-- ประวัติการเคลื่อนไหวสต็อก (ติดลบ = ตัดสต็อก, บวก = เติมสต็อก)
CREATE TABLE stock_movement (
  movement_id     INT AUTO_INCREMENT PRIMARY KEY,
  menu_id         INT NOT NULL,
  quantity_change INT NOT NULL,
  moved_at        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (menu_id) REFERENCES menu_item(menu_id)
);

-- ข้อมูลตัวอย่างสำหรับทดสอบ
INSERT INTO branch (name, address) VALUES ('สาขา 1', 'พัทยา'), ('สาขา 2', 'ศรีราชา');
INSERT INTO category (name) VALUES ('กาแฟ'), ('ชา'), ('เบเกอรี่');
INSERT INTO employee (branch_id, name, role) VALUES
  (1, 'สมชาย', 'cashier'), (1, 'สมหญิง', 'barista'), (2, 'ธนา', 'cashier');
INSERT INTO menu_item (branch_id, category_id, name, price, stock_quantity) VALUES
  (1, 1, 'อเมริกาโน่', 60.00, 50),
  (1, 1, 'ลาเต้เย็น',  70.00, 0),
  (2, 1, 'อเมริกาโน่', 60.00, 30);
INSERT INTO discount_code (code, percent_off, expires_at) VALUES ('WELCOME10', 10.00, NULL);