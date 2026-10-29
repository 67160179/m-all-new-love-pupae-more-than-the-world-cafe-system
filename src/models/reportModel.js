const db = require("../config/db");

// ยอดขายรวมต่อเมนูภายในสาขา (กรอง branch_id ที่ orders เพื่อไม่ให้ยอดข้ามสาขาปะปนกัน)
// GROUP BY menu_id (primary key) — เมนูชื่อซ้ำแต่คนละ menu_id จะแยกแถวกันถูกต้อง
exports.salesByMenu = async (branchId) => {
  const [rows] = await db.query(
    `SELECT m.menu_id, m.name,
            SUM(oi.quantity) AS total_quantity,
            SUM(oi.quantity * oi.unit_price) AS total_sales
       FROM order_item oi
       JOIN orders o    ON oi.order_id = o.order_id
       JOIN menu_item m ON oi.menu_id = m.menu_id
      WHERE o.branch_id = ?
      GROUP BY m.menu_id, m.name
      ORDER BY total_sales DESC`,
    [branchId],
  );
  return rows;
};
