const db = require("../config/db");

// wk07: สต็อกเก็บใน menu_item.stock_quantity (ไม่มีตาราง stock แยกแล้ว)

// ดึงเมนูของสาขาพร้อมล็อกแถว (FOR UPDATE) ใช้ภายใน transaction ตอนสร้างออเดอร์
// ไม่พบ หรือเป็นเมนูของสาขาอื่น = null
exports.findMenuForUpdate = async (connection, menuId, branchId) => {
  const [rows] = await connection.query(
    `SELECT menu_id, name, price, stock_quantity
       FROM menu_item
      WHERE menu_id = ? AND branch_id = ?
      FOR UPDATE`,
    [menuId, branchId],
  );
  return rows.length > 0 ? rows[0] : null;
};

// สต็อกทั้งหมดของสาขา
exports.findAllByBranch = async (branchId) => {
  const [rows] = await db.query(
    "SELECT menu_id, name, stock_quantity FROM menu_item WHERE branch_id = ? ORDER BY name",
    [branchId],
  );
  return rows;
};
