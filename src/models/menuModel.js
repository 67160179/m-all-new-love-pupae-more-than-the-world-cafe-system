const db = require("../config/db");

const COLUMNS = "menu_id, branch_id, category_id, name, price, stock_quantity";

// ค้นหาเมนูตาม id
exports.findById = async (connection, menuId) => {
  const [rows] = await connection.query(
    `SELECT ${COLUMNS} FROM menu_item WHERE menu_id = ?`,
    [menuId],
  );
  return rows.length > 0 ? rows[0] : null;
};

// ค้นหาเมนูตามชื่อภายในสาขา (เมนูชื่อเดียวกันมีแถวแยกต่อสาขา)
exports.findByName = async (connection, branchId, name) => {
  const [rows] = await connection.query(
    `SELECT ${COLUMNS} FROM menu_item WHERE branch_id = ? AND name = ?`,
    [branchId, name],
  );
  return rows.length > 0 ? rows[0] : null;
};

// ดึงเมนูทั้งหมด (กรองตามสาขาได้ถ้าส่ง branchId)
exports.findAll = async (branchId) => {
  if (branchId !== undefined && branchId !== null) {
    const [rows] = await db.query(
      `SELECT ${COLUMNS} FROM menu_item WHERE branch_id = ? ORDER BY category_id, name`,
      [branchId],
    );
    return rows;
  }
  const [rows] = await db.query(
    `SELECT ${COLUMNS} FROM menu_item ORDER BY branch_id, category_id, name`,
  );
  return rows;
};

// จำนวนสต็อกคงเหลือ (ไม่พบเมนู = 0)
exports.getStockQuantity = async (connection, menuId) => {
  const [rows] = await connection.query(
    "SELECT stock_quantity FROM menu_item WHERE menu_id = ?",
    [menuId],
  );
  return rows.length > 0 ? rows[0].stock_quantity : 0;
};

exports.adjustStock = async (connection, menuId, quantityChange) => {
  const [result] = await connection.query(
    `UPDATE menu_item
        SET stock_quantity = stock_quantity + ?
      WHERE menu_id = ? AND stock_quantity + ? >= 0`,
    [quantityChange, menuId, quantityChange],
  );
  if (result.affectedRows === 0) return false;

  await connection.query(
    "INSERT INTO stock_movement (menu_id, quantity_change) VALUES (?, ?)",
    [menuId, quantityChange],
  );
  return true;
};