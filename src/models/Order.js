// src/models/Order.js
//
// Business entity classes สำหรับ wk06 (Encapsulation ตามหัวข้อ 1.1)
// หมายเหตุ: คนละชั้นกับ orderModel.js — Order/OrderItem แทน business logic
// (คำนวณราคา/ส่วนลด) ส่วน orderModel.js ยังคงทำหน้าที่ data access (INSERT/SELECT)
// เหมือนเดิมทุกจุดตาม wk06.md หัวข้อ 3.3

class OrderItem {
  constructor(item, quantity) {
    this.name = item.name;
    this.unitPrice = item.price; // snapshot ราคา ณ เวลาสั่ง (ดู wk06.md หัวข้อ 3.2)
    this.quantity = quantity;
  }

  getSubtotal() {
    return this.unitPrice * this.quantity;
  }
}

class Order {
  constructor(paymentMethod, queueNumber) {
    this.orderId = null;
    this.queueNumber = queueNumber;
    this.paymentMethod = paymentMethod;
    this.discountCode = null;
    this.discountPercent = 0;
    this.items = [];
    this.createdAt = new Date();
  }

  // Composition: Order เป็นผู้สร้าง OrderItem เอง (new OrderItem(...))
  // และเก็บไว้ใน this.items ของตัวเอง — ไม่มีทาง OrderItem ตัวเดียวกัน
  // ไปอยู่ใน Order อื่นได้ (exclusive ownership)
  addItem(item, quantity) {
    this.items.push(new OrderItem(item, quantity));
  }

  applyDiscount(discountRow) {
    this.discountCode = discountRow.code;
    this.discountPercent = discountRow.percent_off;
  }

  calculateSubtotal() {
    return this.items.reduce((sum, item) => sum + item.getSubtotal(), 0);
  }

  calculateDiscountAmount() {
    const subtotal = this.calculateSubtotal();
    return +((subtotal * this.discountPercent) / 100).toFixed(2);
  }

  calculateTotal() {
    const subtotal = this.calculateSubtotal();
    const discount = this.calculateDiscountAmount();
    return +(subtotal - discount).toFixed(2);
  }

  submit() {
    if (this.items.length === 0) return false;
    return true;
  }
}

module.exports = { Order, OrderItem };
