const express = require("express");
const router = express.Router();

const {
  getAdminHistory,
  restoreAdminHistoryItem,
  deleteAdminHistoryItem,
  deleteAdminHistoryBatch,
} = require("../controllers/adminHistoryController");

const { verifyToken, requireAdmin } = require("../middlewares/authMiddleware");

// Lấy danh sách lịch sử dữ liệu
router.get("/", verifyToken, requireAdmin, getAdminHistory);

// Khôi phục bản ghi từ snapshot
router.post("/:id/restore", verifyToken, requireAdmin, restoreAdminHistoryItem);

// Xóa vĩnh viễn nhiều bản ghi khỏi lịch sử
router.post("/batch-delete", verifyToken, requireAdmin, deleteAdminHistoryBatch);

// Xóa vĩnh viễn 1 bản ghi khỏi lịch sử
router.delete("/:id", verifyToken, requireAdmin, deleteAdminHistoryItem);

module.exports = router;

