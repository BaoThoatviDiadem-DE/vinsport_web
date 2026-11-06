const express = require("express");
const router = express.Router();
const {
  calculatePromotion,
  processOrderServerless,
  getSmartRecommendations,
  checkLambdaHealth,
  LAMBDA_FUNCTION_NAME,
} = require("../utils/lambdaService");

/**
 * POST /api/lambda/promotion
 * Tính toán voucher và giảm giá thông minh qua AWS Lambda Serverless
 */
router.post("/promotion", async (req, res) => {
  try {
    const { voucherCode, subtotal, items, userId } = req.body || {};

    const result = await calculatePromotion({
      voucherCode,
      subtotal,
      items,
      userId,
    });

    return res.json(result);
  } catch (error) {
    console.error("POST /api/lambda/promotion error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Lỗi xử lý khuyến mãi qua Serverless Lambda",
    });
  }
});

/**
 * POST /api/lambda/process-order
 * Xác thực & kiểm tra chống gian lận đơn hàng qua AWS Lambda Serverless
 */
router.post("/process-order", async (req, res) => {
  try {
    const { orderData } = req.body || {};
    if (!orderData) {
      return res.status(400).json({
        success: false,
        message: "Thiếu dữ liệu đơn hàng (orderData)",
      });
    }

    const result = await processOrderServerless(orderData);
    return res.json(result);
  } catch (error) {
    console.error("POST /api/lambda/process-order error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Lỗi xử lý đơn hàng qua Serverless Lambda",
    });
  }
});

/**
 * POST /api/lambda/recommendations
 * Gợi ý phụ kiện & sản phẩm liên quan theo ngữ cảnh qua Serverless
 */
router.post("/recommendations", async (req, res) => {
  try {
    const { category, brand, currentProductId } = req.body || {};
    const result = await getSmartRecommendations({
      category,
      brand,
      currentProductId,
    });

    return res.json(result);
  } catch (error) {
    console.error("POST /api/lambda/recommendations error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Lỗi gợi ý sản phẩm qua Serverless Lambda",
    });
  }
});

/**
 * GET /api/lambda/status
 * Kiểm tra kết nối AWS Lambda và xem danh sách các hàm
 */
router.get("/status", async (req, res) => {
  try {
    const status = await checkLambdaHealth();
    return res.json({
      success: true,
      service: "AWS Lambda Serverless Integration",
      targetFunction: LAMBDA_FUNCTION_NAME,
      ...status,
    });
  } catch (error) {
    console.error("GET /api/lambda/status error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Lỗi kiểm tra trạng thái AWS Lambda",
    });
  }
});

module.exports = router;

