const db = require("../config/db");


exports.getQuantity = async (connection, itemName) => {
  const [rows] = await connection.query(
    "SELECT quantity FROM stock WHERE item_name = ?",
    [itemName],
  );
  return rows.length > 0 ? rows[0].quantity : 0;
};

exports.findAll = async () => {
  const [rows] = await db.query("SELECT * FROM stock");
  return rows;
};
