// seed-menu.js : เพิ่มเมนูตัวอย่างให้ทุกสาขา (ไม่ลบข้อมูลเดิม, เมนูที่มีชื่อซ้ำในสาขาเดียวกันจะข้าม)
// วิธีใช้: node seed-menu.js   (รันในโฟลเดอร์โปรเจกต์ ใช้ค่าเชื่อมต่อจาก .env)
require("dotenv").config();
const mysql = require("mysql2/promise");

// category_id ตาม wk07-schema.sql: 1 = กาแฟ, 2 = ชา, 3 = เบเกอรี่
const MENU = [
  // กาแฟ
  [1, "เอสเปรสโซ่", 50],
  [1, "อเมริกาโน่", 60],
  [1, "อเมริกาโน่เย็น", 65],
  [1, "ลาเต้ร้อน", 65],
  [1, "ลาเต้เย็น", 70],
  [1, "คาปูชิโน่", 65],
  [1, "มอคค่าเย็น", 75],
  [1, "คาราเมลมัคคิอาโต้", 80],
  [1, "แฟลตไวท์", 70],
  [1, "กาแฟส้ม", 80],
  [1, "โคลด์บรูว์", 85],
  [1, "เอสเพรสโซ่มะพร้าว", 85],
  // ชา
  [2, "ชาไทยเย็น", 55],
  [2, "ชาเขียวมัทฉะลาเต้", 75],
  [2, "ชามะนาว", 50],
  [2, "ชาพีชเย็น", 60],
  [2, "ชาดำเย็น", 45],
  [2, "โกโก้เย็น", 60],
  [2, "นมสดคาราเมล", 55],
  // เบเกอรี่
  [3, "ครัวซองต์เนยสด", 55],
  [3, "ครัวซองต์อัลมอนด์", 75],
  [3, "บราวนี่", 60],
  [3, "ชีสเค้กบลูเบอร์รี่", 95],
  [3, "เค้กช็อกโกแลตหน้านิ่ม", 85],
  [3, "บานอฟฟี่", 90],
  [3, "คุกกี้ช็อกชิพ", 35],
  [3, "แซนด์วิชแฮมชีส", 65],
  [3, "โทสต์เนยน้ำผึ้ง", 70],
];

(async () => {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || "localhost",
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "",
    database: process.env.DB_NAME || "cafe_pos_db",
    charset: "utf8mb4",
  });

  const [branches] = await conn.query("SELECT branch_id FROM branch ORDER BY branch_id");
  let added = 0;
  for (const { branch_id } of branches) {
    for (const [categoryId, name, price] of MENU) {
      const stock = 20 + Math.floor(Math.random() * 31); // สต็อกสุ่ม 20-50 ชิ้น
      const [result] = await conn.query(
        `INSERT INTO menu_item (branch_id, category_id, name, price, stock_quantity)
         SELECT ?, ?, ?, ?, ? FROM DUAL
          WHERE NOT EXISTS (SELECT 1 FROM menu_item WHERE branch_id = ? AND name = ?)`,
        [branch_id, categoryId, name, price, stock, branch_id, name],
      );
      added += result.affectedRows;
    }
  }
  const [rows] = await conn.query("SELECT COUNT(*) AS n FROM menu_item");
  console.log(`เพิ่มเมนูใหม่ ${added} รายการ ตอนนี้มีเมนูทั้งหมด ${rows[0].n} รายการ (${branches.length} สาขา)`);
  await conn.end();
})().catch((err) => {
  console.error("เพิ่มเมนูไม่สำเร็จ:", err.code, err.message);
  process.exit(1);
});
