const pool = require("../db/db");

const VALID_PAYMENT_METHODS = ["cash", "qr"];

/**
 * POST /api/orders
 * UC-01 "รับออเดอร์และคำนวณราคา"
 *   - US-01: คำนวณราคารวม, สร้างออเดอร์ + เลขคิว
 *   - US-02: ตรวจสอบและคำนวณส่วนลดจากรหัสส่วนลด (Alternative Flow 4a)
 *   - US-03: เช็คสต็อกก่อนอนุญาตให้เพิ่มสินค้าในออเดอร์ (Exception Flow 2a)
 */
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
    (item) => typeof item.price !== "number" || item.price <= 0,
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
      const [stockRows] = await connection.query(
        "SELECT quantity FROM stock WHERE item_name = ?",
        [item.name],
      );

      // ถ้าไม่มีเมนูนี้ในตาราง stock เลย ถือว่าไม่พร้อมจำหน่ายเช่นกัน
      const availableQty = stockRows.length > 0 ? stockRows[0].quantity : 0;

      if (availableQty < item.quantity) {
        return res.status(409).json({
          error: `สินค้า "${item.name}" ไม่พร้อมจำหน่าย (สต็อกไม่เพียงพอ)`,
        });
      }
    }

    // ---- US-01: คำนวณยอดรวมก่อนหักส่วนลด ----
    const subtotalAmount = items.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0,
    );

    // ---- US-02: ตรวจสอบและคำนวณส่วนลด (ถ้ามีการส่งรหัสมา) ----
    let discountAmount = 0;
    let appliedDiscountCode = null;

    if (discountCode !== undefined && discountCode !== null && discountCode !== "") {
      const [codeRows] = await connection.query(
        "SELECT code, percent_off, expires_at FROM discount_codes WHERE code = ?",
        [discountCode],
      );

      const isExpired = (row) =>
        row.expires_at !== null && new Date(row.expires_at) < new Date();

      if (codeRows.length === 0 || isExpired(codeRows[0])) {
        return res
          .status(400)
          .json({ error: "รหัสส่วนลดไม่ถูกต้องหรือหมดอายุ" });
      }

      appliedDiscountCode = codeRows[0].code;
      discountAmount = +(
        (subtotalAmount * codeRows[0].percent_off) /
        100
      ).toFixed(2);
    }

    const totalAmount = +(subtotalAmount - discountAmount).toFixed(2);

    // ---- หมายเลขคิว: ใช้จำนวนออเดอร์ที่มีอยู่ + 1 อย่างง่ายสำหรับ sprint นี้ ----
    const [countRows] = await connection.query(
      "SELECT COUNT(*) AS total FROM orders",
    );
    const queueNumber = countRows[0].total + 1;

    await connection.beginTransaction();

    const [orderResult] = await connection.query(
      `INSERT INTO orders
        (queue_number, payment_method, discount_code, subtotal_amount, discount_amount, total_amount)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        queueNumber,
        paymentMethod,
        appliedDiscountCode,
        subtotalAmount,
        discountAmount,
        totalAmount,
      ],
    );

    const orderId = orderResult.insertId;

    for (const item of items) {
      await connection.query(
        `INSERT INTO order_items (order_id, name, price, quantity)
         VALUES (?, ?, ?, ?)`,
        [orderId, item.name, item.price, item.quantity],
      );
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
    const [orders] = await pool.query(
      "SELECT * FROM orders ORDER BY created_at DESC",
    );
    return res.json(orders);
  } catch (error) {
    console.error("getAllOrders error:", error);
    return res.status(500).json({ error: "ไม่สามารถดึงข้อมูลออเดอร์ได้" });
  }
};
