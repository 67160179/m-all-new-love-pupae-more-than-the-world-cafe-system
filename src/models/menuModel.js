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

// ---- ฟังก์ชันที่ menuController เรียกใช้ (CRUD ผูกกับสาขา) ----

// เมนูทั้งหมดของสาขา
exports.findAllByBranch = async (branchId) => exports.findAll(branchId);

// เมนู 1 รายการ โดยต้องเป็นของสาขานั้นเท่านั้น (ไม่พบ = null)
exports.findByIdAndBranch = async (menuId, branchId) => {
  const [rows] = await db.query(
    `SELECT ${COLUMNS} FROM menu_item WHERE menu_id = ? AND branch_id = ?`,
    [menuId, branchId],
  );
  return rows.length > 0 ? rows[0] : null;
};

// เพิ่มเมนู คืน menu_id ที่สร้างใหม่ (stock ไม่ส่งมา = 0)
exports.create = async (branchId, categoryId, name, price, stockQuantity = 0) => {
  const [result] = await db.query(
    `INSERT INTO menu_item (branch_id, category_id, name, price, stock_quantity)
     VALUES (?, ?, ?, ?, ?)`,
    [branchId, categoryId, name, price, stockQuantity],
  );
  return result.insertId;
};

// แก้เฉพาะฟิลด์ที่ส่งมา (partial update) คืนจำนวนแถวที่ตรงเงื่อนไข (0 = ไม่พบในสาขานี้)
exports.updateFields = async (menuId, branchId, { name, price, stockQuantity }) => {
  const sets = [];
  const params = [];
  if (name !== undefined) { sets.push("name = ?"); params.push(name); }
  if (price !== undefined) { sets.push("price = ?"); params.push(price); }
  if (stockQuantity !== undefined) { sets.push("stock_quantity = ?"); params.push(stockQuantity); }

  // ไม่มีฟิลด์ให้แก้ → เช็คแค่ว่าเมนูมีอยู่ในสาขานี้
  if (sets.length === 0) {
    const found = await exports.findByIdAndBranch(menuId, branchId);
    return found ? 1 : 0;
  }

  const [result] = await db.query(
    `UPDATE menu_item SET ${sets.join(", ")} WHERE menu_id = ? AND branch_id = ?`,
    [...params, menuId, branchId],
  );
  return result.affectedRows;
};

// ลบเมนู คืนจำนวนแถวที่ลบ (ถ้ามี order_item/stock_movement อ้างอิง MySQL จะโยน ER_ROW_IS_REFERENCED_2)
exports.remove = async (menuId, branchId) => {
  const [result] = await db.query(
    "DELETE FROM menu_item WHERE menu_id = ? AND branch_id = ?",
    [menuId, branchId],
  );
  return result.affectedRows;
};