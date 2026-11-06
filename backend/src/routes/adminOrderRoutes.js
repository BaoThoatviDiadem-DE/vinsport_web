const express = require("express");
const router = express.Router();

const { verifyToken, requireAdmin } = require("../middlewares/authMiddleware");
const {
  getAdminOrders,
  updateAdminOrder,
  updateAdminOrderStatus,
  updateAdminPaymentStatus,
  deleteAdminOrder,
  deleteAdminOrdersBatch,
} = require("../controllers/adminOrderController");

router.get("/", verifyToken, requireAdmin, getAdminOrders);

// cập nhật cả TT thanh toán + TT đơn hàng bằng 1 nút
router.put("/:id", verifyToken, requireAdmin, updateAdminOrder);

// xóa đơn hàng
router.delete("/:id", verifyToken, requireAdmin, deleteAdminOrder);
router.post("/batch-delete", verifyToken, requireAdmin, deleteAdminOrdersBatch);

// vẫn giữ 2 endpoint riêng
router.put("/:id/status", verifyToken, requireAdmin, updateAdminOrderStatus);
router.put("/:id/payment-status", verifyToken, requireAdmin, updateAdminPaymentStatus);

module.exports = router;