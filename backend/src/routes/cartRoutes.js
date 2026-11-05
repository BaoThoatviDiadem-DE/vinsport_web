const express = require("express");
const router = express.Router();
const { saveCart, getCart, clearCart } = require("../utils/dynamoService");

function resolveUserId(req) {
  let uid = null;
  if (req.user && req.user.id) uid = String(req.user.id);
  else if (req.query.userId) uid = String(req.query.userId).trim();
  else if (req.body && req.body.userId) uid = String(req.body.userId).trim();

  if (uid) {
    if (uid.startsWith("user_") || uid.startsWith("guest_")) return uid;
    return `user_${uid}`;
  }

  const visitor = req.headers["x-visitor-id"] || req.headers["x-guest-id"];
  if (visitor) return `guest_${visitor}`;
  return "guest_anonymous";
}

// GET /api/cart: Lấy giỏ hàng từ Amazon DynamoDB
router.get("/cart", async (req, res) => {
  try {
    const userId = resolveUserId(req);
    const items = await getCart(userId);
    res.json({
      success: true,
      source: "Amazon DynamoDB (NoSQL)",
      userId,
      items,
    });
  } catch (err) {
    console.error("GET /api/cart error:", err.message);
    res.status(500).json({ message: "Lỗi tải giỏ hàng từ DynamoDB" });
  }
});

// PUT /api/cart: Đồng bộ giỏ hàng lên Amazon DynamoDB
router.put("/cart", async (req, res) => {
  try {
    const userId = resolveUserId(req);
    const { items = [] } = req.body || {};

    await saveCart(userId, items);
    res.json({
      success: true,
      source: "Amazon DynamoDB (NoSQL)",
      message: "Đã đồng bộ giỏ hàng lên DynamoDB thành công",
    });
  } catch (err) {
    console.error("PUT /api/cart error:", err.message);
    res.status(500).json({ message: "Lỗi đồng bộ giỏ hàng lên DynamoDB" });
  }
});

// DELETE /api/cart: Xóa giỏ hàng trên DynamoDB
router.delete("/cart", async (req, res) => {
  try {
    const userId = resolveUserId(req);
    await clearCart(userId);
    res.json({
      success: true,
      message: "Đã làm trống giỏ hàng trên DynamoDB",
    });
  } catch (err) {
    console.error("DELETE /api/cart error:", err.message);
    res.status(500).json({ message: "Lỗi xóa giỏ hàng trên DynamoDB" });
  }
});

module.exports = router;

