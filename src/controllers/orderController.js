const pool = require("../config/db");
const orderModel = require("../models/orderModel");
const stockModel = require("../models/stockModel");
const discountModel = require("../models/discountModel");
const menuModel = require("../models/menuModel");
const { Order } = require("../models/Order");

const VALID_PAYMENT_METHODS = ["cash", "qr"];

const isPositiveInt = (v) => Number.isInteger(v) && v > 0;

// ส่ง error กลับแบบมี status (ใช้ throw ภายใน transaction แล้วไปจับที่ catch เพื่อ rollback ที่เดียว)
class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

/**
 * POST /api/orders
 * body: { branchId, employeeId, paymentMethod, discountCode?, items: [{ menuId, quantity }] }
 * ราคาและชื่อเมนูดึงจากฐานข้อมูลเสมอ (ไม่เชื่อราคาที่ client ส่งมา)
 */
exports.createOrder = async (req, res) => {
  const { items, paymentMethod, discountCode, branchId, employeeId } = req.body;

  // ---- US-01 validation พื้นฐาน ----
  if (!isPositiveInt(branchId)) {
    return res.status(400).json({ error: "ต้องระบุ branchId เป็นตัวเลข" });
  }
  if (!isPositiveInt(employeeId)) {
    return res.status(400).json({ error: "ต้องระบุรหัสพนักงานเป็นตัวเลข" });
  }
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: "ต้องมีรายการสินค้าอย่างน้อย 1 รายการ" });
  }
  if (items.some((item) => !item || !isPositiveInt(item.menuId))) {
    return res.status(400).json({ error: "ต้องระบุเมนูให้ครบทุกรายการ" });
  }
  if (items.some((item) => !isPositiveInt(item.quantity))) {
    return res.status(400).json({ error: "จำนวนสินค้าต้องเป็นจำนวนเต็มมากกว่า 0" });
  }
  if (!VALID_PAYMENT_METHODS.includes(paymentMethod)) {
    return res.status(400).json({ error: "paymentMethod ไม่ถูกต้อง" });
  }

  // รวมเมนูเดียวกันที่ส่งมาซ้ำให้เป็นรายการเดียว
  const quantities = new Map();
  for (const { menuId, quantity } of items) {
    quantities.set(menuId, (quantities.get(menuId) || 0) + quantity);
  }

  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    // ---- พนักงานต้องมีอยู่จริงและอยู่สาขานี้ ----
    const [empRows] = await connection.query(
      "SELECT branch_id FROM employee WHERE employee_id = ?",
      [employeeId],
    );
    if (empRows.length === 0) {
      throw new HttpError(400, `ไม่พบพนักงานรหัส ${employeeId}`);
    }
    if (empRows[0].branch_id !== branchId) {
      throw new HttpError(400, `พนักงานรหัส ${employeeId} ไม่ได้อยู่สาขานี้`);
    }

    // ---- US-03: เช็คเมนูและสต็อกทุกรายการก่อนสร้างออเดอร์ (Exception 2a) ----
    // ใช้ FOR UPDATE ล็อกแถวเมนูไว้ กันสองออเดอร์ตัดสต็อกชิ้นสุดท้ายพร้อมกัน
    const menus = [];
    for (const [menuId, quantity] of quantities) {
      const menu = await stockModel.findMenuForUpdate(connection, menuId, branchId);
      if (!menu) {
        throw new HttpError(400, `ไม่พบเมนู id ${menuId} ในสาขานี้`);
      }
      // Business Rule ข้อ 1: สต็อกไม่พอ → 400 ตาม API contract (wk09/wk13)
      if (menu.stock_quantity < quantity) {
        throw new HttpError(
          400,
          `สินค้า "${menu.name}" ไม่พร้อมจำหน่าย (สต็อกเหลือ ${menu.stock_quantity})`,
        );
      }
      menus.push({ menu, quantity });
    }

    // ---- หมายเลขคิว: ใช้จำนวนออเดอร์ที่มีอยู่ + 1 อย่างง่ายสำหรับ sprint นี้ ----
    const currentOrderCount = await orderModel.countAll(connection);
    const queueNumber = currentOrderCount + 1;

    // ---- wk06: ใช้ class Order/OrderItem คำนวณยอด (Encapsulation) ----
    const order = new Order(paymentMethod, queueNumber);
    for (const { menu, quantity } of menus) {
      order.addItem(
        { menuId: menu.menu_id, name: menu.name, price: Number(menu.price) },
        quantity,
      );
    }

    // ---- US-02: ตรวจสอบและคำนวณส่วนลด (ถ้ามีการส่งรหัสมา) ----
    if (discountCode !== undefined && discountCode !== null && discountCode !== "") {
      const discountRow = await discountModel.findByCode(connection, discountCode);
      if (!discountRow || discountModel.isExpired(discountRow)) {
        throw new HttpError(400, "รหัสส่วนลดไม่ถูกต้องหรือหมดอายุ");
      }
      order.applyDiscount(discountRow);
    }

    const orderId = await orderModel.create(connection, {
      branchId,
      employeeId,
      queueNumber,
      paymentMethod,
      discountCode: order.discountCode,
      discountPercent: order.discountPercent,
    });

    // ---- บันทึกรายการ + ตัดสต็อก (บันทึก stock_movement ด้วย) ----
    const lowStockMenuIds = [];
    for (const item of order.items) {
      await orderModel.addItem(connection, orderId, item);
      const ok = await menuModel.adjustStock(connection, item.menuId, -item.quantity);
      if (!ok) {
        throw new HttpError(400, `สินค้า "${item.name}" สต็อกไม่เพียงพอ`);
      }
      const remaining = menus.find((m) => m.menu.menu_id === item.menuId).menu.stock_quantity
        - item.quantity;
      if (menuModel.isLowStock(remaining)) lowStockMenuIds.push(item.menuId);
    }
    if (lowStockMenuIds.length > 0) {
      console.warn(`สาขา ${branchId} สต็อกต่ำ เมนู id: ${lowStockMenuIds.join(", ")}`);
    }

    await connection.commit();

    // ---- US-01: ตอบกลับหมายเลขคิวและยอดรวมที่คำนวณได้ ----
    return res.status(201).json({
      orderId,
      queueNumber,
      subtotalAmount: order.calculateSubtotal(),
      discountAmount: order.calculateDiscountAmount(),
      totalAmount: order.calculateTotal(),
      lowStockMenuIds,
    });
  } catch (error) {
    await connection.rollback();
    if (error instanceof HttpError) {
      return res.status(error.status).json({ error: error.message });
    }
    // ---- Exception Flow 5a: ระบบขัดข้องระหว่างสร้างออเดอร์ ----
    console.error("createOrder error:", error);
    return res
      .status(500)
      .json({ error: "เกิดข้อผิดพลาดระหว่างบันทึกออเดอร์ กรุณาลองใหม่อีกครั้ง" });
  } finally {
    connection.release();
  }
};

// แปลงแถวออเดอร์ (snake_case) เป็น JSON camelCase ตามข้อตกลงทีม (wk13 หัวข้อ 1.3)
// ยอดเงินเป็น DECIMAL ซึ่ง mysql2 ส่งมาเป็น string จึงแปลงเป็น number ที่ backend
const toOrderJson = (row) => ({
  orderId: row.order_id,
  branchId: row.branch_id,
  employeeId: row.employee_id,
  queueNumber: row.queue_number,
  paymentMethod: row.payment_method,
  status: row.status,
  discountCode: row.discount_code,
  discountPercent: Number(row.discount_percent),
  createdAt: row.created_at,
  subtotalAmount: Number(row.subtotal_amount),
  discountAmount: Number(row.discount_amount),
  totalAmount: Number(row.total_amount),
});

/**
 * GET /api/orders?branchId=1
 * ดึงออเดอร์ของสาขาพร้อมยอดรวม (หน้า "รายงานยอดขาย" ใช้)
 * Business Rule ข้อ 5: กรอง branch_id ที่ฝั่ง server เสมอ ไม่ส่งออเดอร์ทุกสาขาให้ frontend กรองเอง
 */
exports.getAllOrders = async (req, res) => {
  const branchId = req.query.branchId === undefined || req.query.branchId === ""
    ? NaN
    : Number(req.query.branchId);
  if (!isPositiveInt(branchId)) {
    return res.status(400).json({ error: "ต้องระบุ branchId เป็นตัวเลข" });
  }
  try {
    const orders = await orderModel.findAllByBranch(branchId);
    return res.json(orders.map(toOrderJson));
  } catch (error) {
    console.error("getAllOrders error:", error);
    return res.status(500).json({ error: "ไม่สามารถดึงข้อมูลออเดอร์ได้" });
  }
};
