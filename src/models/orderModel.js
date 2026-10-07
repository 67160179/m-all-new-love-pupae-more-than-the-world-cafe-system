const db = require("../config/db");

const TOTALS_SQL = `
  SELECT o.order_id, o.branch_id, o.employee_id, o.queue_number, o.payment_method,
         o.status, o.discount_code, o.discount_percent, o.created_at,
         COALESCE(SUM(oi.quantity * oi.unit_price), 0) AS subtotal_amount,
         ROUND(COALESCE(SUM(oi.quantity * oi.unit_price), 0) * o.discount_percent / 100, 2)
           AS discount_amount,
         ROUND(COALESCE(SUM(oi.quantity * oi.unit_price), 0) * (1 - o.discount_percent / 100), 2)
           AS total_amount
    FROM orders o
    LEFT JOIN order_item oi ON oi.order_id = o.order_id`;

// นับออเดอร์ทั้งหมด (ใช้สร้างหมายเลขคิวอย่างง่าย)
exports.countAll = async (connection) => {
  const [rows] = await connection.query("SELECT COUNT(*) AS total FROM orders");
  return rows[0].total;
};

// สร้างหัวออเดอร์ คืน order_id ที่เพิ่งสร้าง
exports.create = async (connection, order) => {
  const {
    branchId,
    employeeId,
    queueNumber,
    paymentMethod,
    discountCode = null,
    discountPercent = 0,
  } = order;

  const [result] = await connection.query(
    `INSERT INTO orders
      (branch_id, employee_id, queue_number, payment_method, discount_code, discount_percent)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [branchId, employeeId, queueNumber, paymentMethod, discountCode, discountPercent],
  );

  return result.insertId;
};

// เพิ่มรายการสินค้า 1 รายการ (unitPrice = snapshot ราคา ณ เวลาที่สั่ง)
exports.addItem = async (connection, orderId, item) => {
  await connection.query(
    `INSERT INTO order_item (order_id, menu_id, quantity, unit_price)
     VALUES (?, ?, ?, ?)`,
    [orderId, item.menuId, item.quantity, item.unitPrice],
  );
};

// ออเดอร์ทั้งหมดพร้อมยอดที่คำนวณสด
exports.findAll = async () => {
  const [rows] = await db.query(
    `${TOTALS_SQL} GROUP BY o.order_id ORDER BY o.created_at DESC`,
  );
  return rows;
};

// ออเดอร์เดียวพร้อมรายการสินค้า (ไม่พบ = null)
exports.findById = async (orderId) => {
  const [orders] = await db.query(
    `${TOTALS_SQL} WHERE o.order_id = ? GROUP BY o.order_id`,
    [orderId],
  );
  if (orders.length === 0) return null;

  const [items] = await db.query(
    `SELECT oi.order_item_id, oi.order_id, oi.menu_id, m.name,
            oi.quantity, oi.unit_price, oi.quantity * oi.unit_price AS subtotal
       FROM order_item oi
       JOIN menu_item m ON m.menu_id = oi.menu_id
      WHERE oi.order_id = ?`,
    [orderId],
  );

  return { ...orders[0], items };
};