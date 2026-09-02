const db = require("../config/db");


exports.countAll = async (connection) => {
  const [rows] = await connection.query("SELECT COUNT(*) AS total FROM orders");
  return rows[0].total;
};

exports.create = async (connection, order) => {
  const {
    queueNumber,
    paymentMethod,
    discountCode,
    subtotalAmount,
    discountAmount,
    totalAmount,
  } = order;

  const [result] = await connection.query(
    `INSERT INTO orders
      (queue_number, payment_method, discount_code, subtotal_amount, discount_amount, total_amount)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      queueNumber,
      paymentMethod,
      discountCode,
      subtotalAmount,
      discountAmount,
      totalAmount,
    ],
  );

  return result.insertId;
};

exports.addItem = async (connection, orderId, item) => {
  await connection.query(
    `INSERT INTO order_items (order_id, name, price, quantity)
     VALUES (?, ?, ?, ?)`,
    [orderId, item.name, item.price, item.quantity],
  );
};

exports.findAll = async () => {
  const [rows] = await db.query("SELECT * FROM orders ORDER BY created_at DESC");
  return rows;
};
