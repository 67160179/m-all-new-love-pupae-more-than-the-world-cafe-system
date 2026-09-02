const db = require("../config/db");


exports.findByCode = async (connection, code) => {
  const [rows] = await connection.query(
    "SELECT code, percent_off, expires_at FROM discount_codes WHERE code = ?",
    [code],
  );
  return rows.length > 0 ? rows[0] : null;
};

exports.isExpired = (discountRow) => {
  if (!discountRow.expires_at) return false;
  return new Date(discountRow.expires_at) < new Date();
};

exports.findAll = async () => {
  const [rows] = await db.query("SELECT * FROM discount_codes");
  return rows;
};
