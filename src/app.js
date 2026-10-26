require("dotenv").config();
const path = require("path");
const express = require("express");
const orderRoutes = require("./routes/orderRoutes");
const menuRoutes = require("./routes/menuRoutes");

const app = express();
app.use(express.json());

// ให้อ่านไฟล์ static จากโฟลเดอร์ public (สำหรับไฟล์ css/รูปภาพ ถ้ามี)
app.use(express.static("public"));

// ให้ส่ง index.html จากโฟลเดอร์ root เมื่อเข้า http://localhost:3000/
app.get("/", (req, res) => {
  res.sendFile(path.join(process.cwd(), "index.html"));
});

app.use("/api", orderRoutes);
app.use("/api/menu", menuRoutes);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});