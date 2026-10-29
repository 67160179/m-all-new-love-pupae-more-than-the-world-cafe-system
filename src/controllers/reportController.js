const reportModel = require("../models/reportModel");

const isPositiveInt = (v) => Number.isInteger(v) && v > 0;

// query string มาเป็น string เสมอ จึงแปลงเป็นตัวเลขก่อนใช้
const toInt = (v) => (v === undefined || v === "" ? NaN : Number(v));

/**
 * GET /api/reports/sales?branchId=1
 * ยอดขายรวมต่อเมนูของสาขาที่เลือก (wk13 หัวข้อ 2.3)
 * response: [{ menuId, name, totalQuantity, totalSales }] — camelCase และเป็น number ทุกฟิลด์ตัวเลข
 * totalSales = SUM(quantity * unit_price) คือยอดก่อนหักส่วนลด (ส่วนลดคิดระดับออเดอร์ ไม่ใช่ระดับเมนู)
 */
exports.getSalesReport = async (req, res) => {
  const branchId = toInt(req.query.branchId);
  if (!isPositiveInt(branchId)) {
    return res.status(400).json({ error: "ต้องระบุ branchId เป็นตัวเลข" });
  }
  try {
    const rows = await reportModel.salesByMenu(branchId);
    // SUM() ใน MySQL ได้ชนิด DECIMAL ซึ่ง mysql2 ส่งกลับมาเป็น string (เช่น "2025.00")
    // ตกลงใน API contract ว่าแปลงเป็น number ที่ฝั่ง backend ก่อนส่งออก
    res.json(
      rows.map((r) => ({
        menuId: r.menu_id,
        name: r.name,
        totalQuantity: Number(r.total_quantity),
        totalSales: Number(r.total_sales),
      })),
    );
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "เกิดข้อผิดพลาดในการดึงรายงานยอดขาย" });
  }
};
