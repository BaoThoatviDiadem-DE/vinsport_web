const express = require("express");
const router = express.Router();
const { recordProductView, getRecentlyViewed, clearRecentlyViewed } = require("../utils/dynamoService");

// Helper lấy userId từ token hoặc từ header/body (hỗ trợ cả khách vãng lai Guest)
function resolveUserId(req) {
  if (req.user && req.user.id) return `user_${req.user.id}`;
  if (req.query.userId) return String(req.query.userId).trim();
  if (req.body && req.body.userId) return String(req.body.userId).trim();
  const visitorHeader = req.headers["x-visitor-id"] || req.headers["x-guest-id"];
  if (visitorHeader) return `guest_${visitorHeader}`;
  return "guest_anonymous";
}

// GET /api/recently-viewed: Lấy danh sách sản phẩm vừa xem từ Amazon DynamoDB
router.get("/", async (req, res) => {
  try {
    const userId = resolveUserId(req);
    const products = await getRecentlyViewed(userId);
    res.json({
      success: true,
      source: "Amazon DynamoDB (NoSQL)",
      userId,
      products,
    });
  } catch (err) {
    console.error("GET /api/recently-viewed error:", err.message);
    res.status(500).json({ message: "Lỗi đọc dữ liệu từ DynamoDB" });
  }
});

// POST /api/recently-viewed: Ghi nhận 1 lượt xem sản phẩm vào DynamoDB
router.post("/", async (req, res) => {
  try {
    const userId = resolveUserId(req);
    const { product } = req.body || {};

    if (!product || !product.id) {
      return res.status(400).json({ message: "Thiếu thông tin sản phẩm" });
    }

    await recordProductView(userId, product);
    res.json({
      success: true,
      message: "Đã lưu lượt xem vào DynamoDB",
    });
  } catch (err) {
    console.error("POST /api/recently-viewed error:", err.message);
    res.status(500).json({ message: "Lỗi ghi dữ liệu vào DynamoDB" });
  }
});

// DELETE /api/recently-viewed: Xóa lịch sử đã xem
router.delete("/", async (req, res) => {
  try {
    const userId = resolveUserId(req);
    await clearRecentlyViewed(userId);
    res.json({
      success: true,
      message: "Đã xóa lịch sử vừa xem trên DynamoDB",
    });
  } catch (err) {
    console.error("DELETE /api/recently-viewed error:", err.message);
    res.status(500).json({ message: "Lỗi xóa dữ liệu trên DynamoDB" });
  }
});

module.exports = router;

