/**
 * AWS Lambda Function: VinSport Serverless Core Engine
 * Runtime: Node.js 20.x
 * Handler: index.handler
 * 
 * Các chức năng Serverless:
 * 1. CALCULATE_PROMOTION: Tính toán voucher, giảm giá bậc thang và miễn phí vận chuyển
 * 2. PROCESS_ORDER: Kiểm tra tính toàn vẹn đơn hàng, chống gian lận (Fraud check), định dạng hóa đơn
 * 3. SMART_RECOMMENDATIONS: Đề xuất phụ kiện & sản phẩm liên quan dựa trên danh mục/thương hiệu
 * 4. SYSTEM_PING: Kiểm tra sức khỏe hệ thống Lambda
 */

const VOUCHER_DATABASE = {
  VINSPORT10: {
    code: "VINSPORT10",
    description: "Giảm 10% tổng đơn hàng (Tối đa 100.000đ)",
    discountType: "PERCENT",
    discountValue: 10,
    maxDiscount: 100000,
    minOrderAmount: 200000,
  },
  LAMBDA50K: {
    code: "LAMBDA50K",
    description: "Ưu đãi công nghệ AWS Lambda: Giảm thẳng 50.000đ",
    discountType: "FIXED",
    discountValue: 50000,
    maxDiscount: 50000,
    minOrderAmount: 300000,
  },
  FREESHIP: {
    code: "FREESHIP",
    description: "Miễn phí vận chuyển toàn quốc (Giảm 30.000đ phí ship)",
    discountType: "SHIPPING",
    discountValue: 30000,
    maxDiscount: 30000,
    minOrderAmount: 150000,
  },
  VIPSPORT: {
    code: "VIPSPORT",
    description: "Đặc quyền thành viên VIP: Giảm 15% cho đơn từ 500.000đ",
    discountType: "PERCENT",
    discountValue: 15,
    maxDiscount: 200000,
    minOrderAmount: 500000,
  },
};

exports.handler = async (event, context) => {
  const startTime = Date.now();
  console.log("[AWS Lambda] Received event:", JSON.stringify(event));

  // Hỗ trợ cả Direct SDK Invoke hoặc API Gateway HTTP Request
  let body = event;
  if (event.body) {
    try {
      body = typeof event.body === "string" ? JSON.parse(event.body) : event.body;
    } catch (_) {
      body = event;
    }
  }

  const action = body.action || "SYSTEM_PING";
  let result = {};

  try {
    switch (action) {
      case "CALCULATE_PROMOTION": {
        const { voucherCode, subtotal = 0, items = [], userId } = body;
        const normalizedSubtotal = Number(subtotal) || 0;
        let discountAmount = 0;
        let shippingFee = normalizedSubtotal >= 500000 ? 0 : 30000;
        let appliedVoucher = null;
        let message = "Không áp dụng voucher";

        // Tự động áp dụng chính sách bậc thang (Tiered discount) của VinSport
        let tierDiscount = 0;
        if (normalizedSubtotal >= 1000000) {
          tierDiscount = 50000; // Tặng 50k cho đơn từ 1 triệu
        } else if (normalizedSubtotal >= 500000) {
          tierDiscount = 20000; // Tặng 20k cho đơn từ 500k
        }

        // Kiểm tra Voucher nếu người dùng nhập
        if (voucherCode) {
          const cleanCode = String(voucherCode).trim().toUpperCase();
          const voucher = body.dynamicVoucher || VOUCHER_DATABASE[cleanCode];

          if (!voucher || voucher.isActive === false) {
            return formatResponse(400, {
              success: false,
              message: `Mã giảm giá "${cleanCode}" không tồn tại hoặc đã hết hạn.`,
            });
          }

          if (normalizedSubtotal < voucher.minOrderAmount) {
            return formatResponse(400, {
              success: false,
              message: `Mã "${cleanCode}" chỉ áp dụng cho đơn hàng từ ${voucher.minOrderAmount.toLocaleString("vi-VN")}đ trở lên.`,
            });
          }

          if (voucher.discountType === "PERCENT") {
            const rawDiscount = (normalizedSubtotal * voucher.discountValue) / 100;
            discountAmount = Math.min(rawDiscount, voucher.maxDiscount);
          } else if (voucher.discountType === "FIXED") {
            discountAmount = voucher.discountValue;
          } else if (voucher.discountType === "SHIPPING") {
            discountAmount = Math.min(shippingFee, voucher.discountValue);
            shippingFee = Math.max(0, shippingFee - discountAmount);
          }

          appliedVoucher = {
            code: voucher.code,
            description: voucher.description,
            discountAmount,
          };
          message = `Áp dụng thành công mã ${voucher.code}: -${discountAmount.toLocaleString("vi-VN")}đ`;
        }

        const totalDiscount = discountAmount + tierDiscount;
        const finalAmount = Math.max(0, normalizedSubtotal + shippingFee - totalDiscount);

        result = {
          success: true,
          action: "CALCULATE_PROMOTION",
          subtotal: normalizedSubtotal,
          shippingFee,
          voucherDiscount: discountAmount,
          tierDiscount,
          totalDiscount,
          finalAmount,
          appliedVoucher,
          message,
          serverlessEngine: "AWS Lambda (Node.js 20.x)",
        };
        break;
      }

      case "PROCESS_ORDER": {
        const { orderData } = body;
        if (!orderData) {
          return formatResponse(400, { success: false, message: "Thiếu dữ liệu đơn hàng" });
        }

        const items = Array.isArray(orderData.items) ? orderData.items : [];
        const totalItemsCount = items.reduce((sum, it) => sum + (Number(it.quantity) || 1), 0);
        const calculatedTotal = items.reduce((sum, it) => sum + (Number(it.price) || 0) * (Number(it.quantity) || 1), 0);

        // Đánh giá rủi ro đơn hàng (Fraud detection score 0 - 100)
        let fraudScore = 5; // Mặc định an toàn
        if (!orderData.customer?.phone || String(orderData.customer.phone).length < 9) {
          fraudScore += 30;
        }
        if (calculatedTotal > 10000000 && orderData.paymentMethod === "COD") {
          fraudScore += 25; // Đơn COD lớn cần xác nhận
        }

        result = {
          success: true,
          action: "PROCESS_ORDER",
          orderVerification: {
            status: fraudScore > 50 ? "REQUIRES_REVIEW" : "PASSED",
            fraudRiskScore: fraudScore,
            totalItemsCount,
            calculatedTotal,
            isPriceValid: Math.abs(calculatedTotal - (Number(orderData.totalAmount) || 0)) < 1000,
          },
          invoiceSummary: {
            invoiceNumber: `INV-LAMBDA-${Date.now().toString().slice(-6)}`,
            currency: "VND",
            issuedAt: new Date().toISOString(),
          },
          serverlessEngine: "AWS Lambda (Node.js 20.x)",
        };
        break;
      }

      case "SMART_RECOMMENDATIONS": {
        const { category = "", brand = "", currentProductId } = body;

        // Thuật toán gợi ý phụ kiện thể thao đi kèm thông minh
        const accessoryMap = {
          "Áo": ["Quần short thể thao", "Băng đô thể thao", "Vớ dệt kim thoáng khí"],
          "Quần": ["Áo thun thể thao Dri-Fit", "Tất thể thao cổ trung", "Bình nước giữ nhiệt"],
          "Giày": ["Tất thể thao chống trơn", "Túi đựng giày đa năng", "Xịt khử mùi thể thao"],
        };

        const suggestedAccessories = accessoryMap[category] || [
          "Bình nước thể thao VinSport",
          "Tất thể thao dệt kim",
          "Băng quấn bảo vệ cổ tay",
        ];

        result = {
          success: true,
          action: "SMART_RECOMMENDATIONS",
          category,
          brand,
          suggestedAccessories,
          affinityScore: 94.5,
          serverlessEngine: "AWS Lambda (Node.js 20.x)",
        };
        break;
      }

      case "SYSTEM_PING":
      default: {
        result = {
          success: true,
          status: "HEALTHY",
          service: "VinSport Serverless Cloud Engine",
          region: process.env.AWS_REGION || "ap-southeast-1",
          nodeVersion: process.version,
          timestamp: new Date().toISOString(),
          supportedActions: [
            "CALCULATE_PROMOTION",
            "PROCESS_ORDER",
            "SMART_RECOMMENDATIONS",
            "SYSTEM_PING",
          ],
        };
        break;
      }
    }

    const executionTimeMs = Date.now() - startTime;
    result.executionTimeMs = executionTimeMs;

    return formatResponse(200, result);
  } catch (error) {
    console.error("[AWS Lambda Handler Error]:", error);
    return formatResponse(500, {
      success: false,
      error: error.message,
      executionTimeMs: Date.now() - startTime,
    });
  }
};

function formatResponse(statusCode, data) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "X-Serverless-Powered-By": "VinSport-AWS-Lambda",
    },
    body: JSON.stringify(data),
  };
}

