const pool = require("../config/db");
const orderModel = require("../models/orderModel");
const stockModel = require("../models/stockModel");
const discountModel = require("../models/discountModel");
const { Order } = require("../models/Order");

const VALID_PAYMENT_METHODS = ["cash", "qr"];

exports.createOrder = async (req, res) => {
  const { items, paymentMethod, discountCode } = req.body;

  // ---- US-01 validation พื้นฐาน: ต้องมีรายการสินค้าอย่างน้อย 1 รายการ ----
  if (!Array.isArray(items) || items.length === 0) {
    return res
      .status(400)
      .json({ error: "ต้องมีรายการสินค้าอย่างน้อย 1 รายการ" });
  }

  // ---- ต้องระบุชื่อสินค้าให้ครบทุกรายการ ----
  const hasInvalidName = items.some(
    (item) => typeof item.name !== "string" || item.name.trim() === "",
  );
  if (hasInvalidName) {
    return res
      .status(400)
      .json({ error: "ต้องระบุชื่อสินค้าให้ครบทุกรายการ" });
  }

  // ---- ราคาต้องมากกว่า 0 ----
  const hasInvalidPrice = items.some(
    (item) => !Number.isFinite(item.price) || item.price <= 0,
  );
  if (hasInvalidPrice) {
    return res.status(400).json({ error: "ราคาสินค้าต้องมากกว่า 0" });
  }

  // ---- จำนวนต้องมากกว่า 0 ----
  const hasInvalidQuantity = items.some(
    (item) => !Number.isInteger(item.quantity) || item.quantity <= 0,
  );
  if (hasInvalidQuantity) {
    return res.status(400).json({ error: "จำนวนสินค้าต้องมากกว่า 0" });
  }

  // ---- paymentMethod ต้องถูกต้อง ----
  if (!VALID_PAYMENT_METHODS.includes(paymentMethod)) {
    return res.status(400).json({ error: "paymentMethod ไม่ถูกต้อง" });
  }

  const connection = await pool.getConnection();

  try {
    // ---- US-03: เช็คสต็อกทุกรายการก่อนอนุญาตให้เพิ่มลงออเดอร์ (Exception 2a) ----
    for (const item of items) {
      const availableQty = await stockModel.getQuantity(connection, item.name);

      if (availableQty < item.quantity) {
        return res.status(409).json({
          error: `สินค้า "${item.name}" ไม่พร้อมจำหน่าย (สต็อกไม่เพียงพอ)`,
        });
      }
    }

    // ---- หมายเลขคิว: ใช้จำนวนออเดอร์ที่มีอยู่ + 1 อย่างง่ายสำหรับ sprint นี้ ----
    const currentOrderCount = await orderModel.countAll(connection);
    const queueNumber = currentOrderCount + 1;

    // ---- wk06: ใช้ class Order/OrderItem แทนการคำนวณ inline (Encapsulation) ----
    const order = new Order(paymentMethod, queueNumber);
    items.forEach((item) => order.addItem(item, item.quantity));

    // ---- US-02: ตรวจสอบและคำนวณส่วนลด (ถ้ามีการส่งรหัสมา) ----
    let appliedDiscountCode = null;

    if (discountCode !== undefined && discountCode !== null && discountCode !== "") {
      const discountRow = await discountModel.findByCode(connection, discountCode);

      if (!discountRow || discountModel.isExpired(discountRow)) {
        return res
          .status(400)
          .json({ error: "รหัสส่วนลดไม่ถูกต้องหรือหมดอายุ" });
      }

      order.applyDiscount(discountRow);
      appliedDiscountCode = discountRow.code;
    }

    // ---- US-01: คำนวณยอดรวมผ่าน method ของ class Order แทน reduce เดิม ----
    const subtotalAmount = order.calculateSubtotal();
    const discountAmount = order.calculateDiscountAmount();
    const totalAmount = order.calculateTotal();

    await connection.beginTransaction();

    const orderId = await orderModel.create(connection, {
      queueNumber,
      paymentMethod,
      discountCode: appliedDiscountCode,
      subtotalAmount,
      discountAmount,
      totalAmount,
    });

    for (const item of items) {
      await orderModel.addItem(connection, orderId, item);
    }

    await connection.commit();

    // ---- US-01: ตอบกลับหมายเลขคิวและยอดรวมที่คำนวณได้ ----
    return res.status(201).json({
      orderId,
      queueNumber,
      subtotalAmount,
      discountAmount,
      totalAmount,
    });
  } catch (error) {
    await connection.rollback();
    // ---- Exception Flow 5a: ระบบขัดข้องระหว่างสร้างออเดอร์ ----
    console.error("createOrder error:", error);
    return res
      .status(500)
      .json({ error: "เกิดข้อผิดพลาดระหว่างบันทึกออเดอร์ กรุณาลองใหม่อีกครั้ง" });
  } finally {
    connection.release();
  }
};

/**
 * GET /api/orders
 * ตัวอย่างเสริมสำหรับดึงข้อมูลมาตรวจสอบผลการทดสอบเท่านั้น (ไม่ใช่ use case บังคับของ sprint นี้)
 */
exports.getAllOrders = async (req, res) => {
  try {
    const orders = await orderModel.findAll();
    return res.json(orders);
  } catch (error) {
    console.error("getAllOrders error:", error);
    return res.status(500).json({ error: "ไม่สามารถดึงข้อมูลออเดอร์ได้" });
  }
};
