require("dotenv").config();
const mysql = require("mysql2/promise");

// ใช้ connection pool แทนการเปิด connection ใหม่ทุก request
// เพราะการเปิด/ปิด connection ใหม่ทุกครั้งมี overhead สูง (TCP handshake + auth)
// pool จะเปิด connection ไว้ล่วงหน้าจำนวนหนึ่งแล้วนำกลับมาใช้ซ้ำ
const pool = mysql.createPool({
  host: process.env.DB_HOST || "localhost",
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "cafe_pos_db",
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

module.exports = pool;
