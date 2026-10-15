const express = require("express");
const router = express.Router();
const { verifyToken, requireAdmin } = require("../middlewares/authMiddleware");
const { getAnalyticsData } = require("../controllers/adminAnalyticsController");

// Tuyến đường lấy số liệu phân tích & trực quan hóa - Bảo vệ bằng Token và quyền Admin
router.get("/", verifyToken, requireAdmin, getAnalyticsData);

module.exports = router;
