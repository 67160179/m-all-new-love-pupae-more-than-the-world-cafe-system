const menuModel = require("../models/menuModel");

const isPositiveInt = (v) => Number.isInteger(v) && v > 0;
const isNonNegInt = (v) => Number.isInteger(v) && v >= 0;

// query string มาเป็น string เสมอ จึงแปลงเป็นตัวเลขก่อนใช้
const toInt = (v) => (v === undefined || v === "" ? NaN : Number(v));

// wk13 หัวข้อ 1.3: DB เป็น snake_case แต่ JSON response ต้องเป็น camelCase ตามข้อตกลงทีม
// price เป็น DECIMAL ซึ่ง mysql2 ส่งมาเป็น string จึงแปลงเป็น number ที่นี่ด้วย
const toMenuJson = (row) => ({
  menuId: row.menu_id,
  branchId: row.branch_id,
  categoryId: row.category_id,
  name: row.name,
  price: Number(row.price),
  stockQuantity: row.stock_quantity,
});

exports.listMenu = async (req, res) => {
  const branchId = toInt(req.query.branchId);
  if (!isPositiveInt(branchId)) {
    return res.status(400).json({ error: "ต้องระบุ branchId เป็นตัวเลข" });
  }
  try {
    const rows = await menuModel.findAllByBranch(branchId);
    res.json(rows.map(toMenuJson));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "เกิดข้อผิดพลาดในการดึงข้อมูลเมนู" });
  }
};

exports.getMenuById = async (req, res) => {
  const branchId = toInt(req.query.branchId);
  const menuId = toInt(req.params.id);
  if (!isPositiveInt(branchId) || !isPositiveInt(menuId)) {
    return res.status(400).json({ error: "ต้องระบุ branchId และ id เป็นตัวเลข" });
  }
  try {
    const menu = await menuModel.findByIdAndBranch(menuId, branchId);
    if (!menu) {
      return res.status(404).json({ error: `ไม่พบเมนู id ${menuId} ในสาขานี้` });
    }
    res.json(toMenuJson(menu));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "เกิดข้อผิดพลาดในการดึงข้อมูลเมนู" });
  }
};

exports.createMenu = async (req, res) => {
  const { branchId, categoryId, name, price, stockQuantity } = req.body;
  if (!isPositiveInt(branchId) || !isPositiveInt(categoryId)) {
    return res.status(400).json({ error: "ต้องระบุ branchId และ categoryId เป็นตัวเลข" });
  }
  if (typeof name !== "string" || name.trim() === "") {
    return res.status(400).json({ error: "ต้องระบุชื่อเมนู" });
  }
  if (!Number.isFinite(price) || price <= 0) {
    return res.status(400).json({ error: "price ต้องเป็นตัวเลขมากกว่า 0" });
  }
  if (stockQuantity !== undefined && !isNonNegInt(stockQuantity)) {
    return res.status(400).json({ error: "stockQuantity ต้องเป็นจำนวนเต็มตั้งแต่ 0 ขึ้นไป" });
  }
  try {
    const menuId = await menuModel.create(branchId, categoryId, name.trim(), price, stockQuantity);
    res.status(201).json({ menuId });
  } catch (err) {
    // FK ไม่ผ่าน = branchId/categoryId ที่ส่งมาไม่มีอยู่จริง
    if (err.code === "ER_NO_REFERENCED_ROW_2") {
      return res.status(400).json({ error: "ไม่พบ branchId หรือ categoryId ที่ระบุ" });
    }
    console.error(err);
    res.status(500).json({ error: "เกิดข้อผิดพลาดในการเพิ่มเมนู" });
  }
};

// รองรับ partial update (ส่งเฉพาะฟิลด์ที่ต้องการแก้) — ผูกกับทั้ง PUT และ PATCH
exports.updateMenu = async (req, res) => {
  const { branchId, name, price, stockQuantity } = req.body;
  const menuId = toInt(req.params.id);
  if (!isPositiveInt(branchId) || !isPositiveInt(menuId)) {
    return res.status(400).json({ error: "ต้องระบุ branchId และ id เป็นตัวเลข" });
  }
  if (name !== undefined && (typeof name !== "string" || name.trim() === "")) {
    return res.status(400).json({ error: "ชื่อเมนูต้องไม่ว่าง" });
  }
  if (price !== undefined && (!Number.isFinite(price) || price <= 0)) {
    return res.status(400).json({ error: "price ต้องเป็นตัวเลขมากกว่า 0" });
  }
  if (stockQuantity !== undefined && !isNonNegInt(stockQuantity)) {
    return res.status(400).json({ error: "stockQuantity ต้องเป็นจำนวนเต็มตั้งแต่ 0 ขึ้นไป" });
  }
  try {
    const affected = await menuModel.updateFields(menuId, branchId, {
      name: name?.trim(),
      price,
      stockQuantity,
    });
    if (affected === 0) {
      // ไม่แยกว่า "ไม่มีเมนู" กับ "เป็นของสาขาอื่น" เพื่อไม่เปิดเผยข้อมูลข้ามสาขา
      return res.status(404).json({ error: `ไม่พบเมนู id ${menuId} ในสาขานี้` });
    }
    res.json({ updated: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "เกิดข้อผิดพลาดในการแก้ไขเมนู" });
  }
};

exports.deleteMenu = async (req, res) => {
  const branchId = toInt(req.query.branchId);
  const menuId = toInt(req.params.id);
  if (!isPositiveInt(branchId) || !isPositiveInt(menuId)) {
    return res.status(400).json({ error: "ต้องระบุ branchId และ id เป็นตัวเลข" });
  }
  try {
    const affected = await menuModel.remove(menuId, branchId);
    if (affected === 0) {
      return res.status(404).json({ error: `ไม่พบเมนู id ${menuId} ในสาขานี้` });
    }
    res.json({ deleted: true });
  } catch (err) {
    // เมนูที่เคยถูกสั่งแล้วมี order_item/stock_movement อ้างอิงอยู่ ลบไม่ได้
    if (err.code === "ER_ROW_IS_REFERENCED_2") {
      return res.status(409).json({ error: "ลบไม่ได้ เพราะเมนูนี้มีประวัติการสั่งซื้อหรือสต็อกอ้างอิงอยู่" });
    }
    console.error(err);
    res.status(500).json({ error: "เกิดข้อผิดพลาดในการลบเมนู" });
  }
};
