const express = require("express");
const router = express.Router();
const {
  getAllVouchers,
  getVoucherByCode,
  saveVoucher,
  deleteVoucher,
  seedDefaultVouchers,
  TABLE_VOUCHERS,
} = require("../utils/dynamoService");
const { recordHistory } = require("../utils/historyService");
const { verifyToken } = require("../middlewares/authMiddleware");

// Middleware xác thực quyền Quản trị viên (Admin)
function requireAdmin(req, res, next) {
  if (req.user && req.user.role === "admin") {
    return next();
  }
  return res.status(403).json({
    success: false,
    message: "Bạn không có quyền quản trị viên để thực hiện thao tác này.",
  });
}

/**
 * GET /api/admin/vouchers
 * Lấy toàn bộ danh sách mã ưu đãi từ Amazon DynamoDB
 */
router.get("/", verifyToken, requireAdmin, async (req, res) => {
  try {
    const vouchers = await getAllVouchers();
    return res.json({
      success: true,
      source: "Amazon DynamoDB (NoSQL)",
      tableName: TABLE_VOUCHERS,
      total: vouchers.length,
      vouchers,
    });
  } catch (err) {
    console.error("GET /api/admin/vouchers error:", err);
    return res.status(500).json({
      success: false,
      message: err.message || "Lỗi nạp danh sách mã ưu đãi từ DynamoDB",
    });
  }
});

/**
 * GET /api/admin/vouchers/:code
 * Xem chi tiết 1 mã ưu đãi
 */
router.get("/:code", verifyToken, requireAdmin, async (req, res) => {
  try {
    const { code } = req.params;
    const voucher = await getVoucherByCode(code);

    if (!voucher) {
      return res.status(404).json({
        success: false,
        message: `Không tìm thấy mã ưu đãi "${code}"`,
      });
    }

    return res.json({
      success: true,
      voucher,
    });
  } catch (err) {
    console.error("GET /api/admin/vouchers/:code error:", err);
    return res.status(500).json({
      success: false,
      message: err.message || "Lỗi xem chi tiết voucher",
    });
  }
});

/**
 * POST /api/admin/vouchers
 * Tạo mã ưu đãi mới và lưu vào Amazon DynamoDB
 */
router.post("/", verifyToken, requireAdmin, async (req, res) => {
  try {
    const {
      code,
      description,
      discountType,
      discountValue,
      maxDiscount,
      minOrderAmount,
      isActive,
      expiresAt,
    } = req.body || {};

    if (!code || !String(code).trim()) {
      return res.status(400).json({
        success: false,
        message: "Mã ưu đãi không được để trống",
      });
    }

    const cleanCode = String(code).trim().toUpperCase();

    // Kiểm tra xem mã đã tồn tại chưa
    const existing = await getVoucherByCode(cleanCode);
    if (existing) {
      return res.status(400).json({
        success: false,
        message: `Mã ưu đãi "${cleanCode}" đã tồn tại. Vui lòng chọn mã khác hoặc sửa mã cũ.`,
      });
    }

    const newVoucher = await saveVoucher({
      code: cleanCode,
      description,
      discountType,
      discountValue: Number(discountValue) || 0,
      maxDiscount: Number(maxDiscount) || 0,
      minOrderAmount: Number(minOrderAmount) || 0,
      isActive: isActive !== false,
      expiresAt: expiresAt || null,
    });

    return res.status(201).json({
      success: true,
      message: `Tạo mã ưu đãi "${cleanCode}" thành công vào DynamoDB!`,
      voucher: newVoucher,
    });
  } catch (err) {
    console.error("POST /api/admin/vouchers error:", err);
    return res.status(500).json({
      success: false,
      message: err.message || "Lỗi tạo mã ưu đãi trên DynamoDB",
    });
  }
});

/**
 * PUT /api/admin/vouchers/:code
 * Sửa/Cập nhật mã ưu đãi trên Amazon DynamoDB
 */
router.put("/:code", verifyToken, requireAdmin, async (req, res) => {
  try {
    const { code } = req.params;
    const cleanCode = String(code).trim().toUpperCase();

    const existing = await getVoucherByCode(cleanCode);
    if (!existing) {
      return res.status(404).json({
        success: false,
        message: `Không tìm thấy mã ưu đãi "${cleanCode}" để cập nhật`,
      });
    }

    const {
      description,
      discountType,
      discountValue,
      maxDiscount,
      minOrderAmount,
      isActive,
      expiresAt,
    } = req.body || {};

    const updated = await saveVoucher({
      code: cleanCode,
      description: description !== undefined ? description : existing.description,
      discountType: discountType !== undefined ? discountType : existing.discountType,
      discountValue: discountValue !== undefined ? Number(discountValue) : existing.discountValue,
      maxDiscount: maxDiscount !== undefined ? Number(maxDiscount) : existing.maxDiscount,
      minOrderAmount: minOrderAmount !== undefined ? Number(minOrderAmount) : existing.minOrderAmount,
      isActive: isActive !== undefined ? Boolean(isActive) : existing.isActive,
      expiresAt: expiresAt !== undefined ? expiresAt : existing.expiresAt,
    });

    await recordHistory({
      actionType: "UPDATE",
      entityType: "voucher",
      title: `Cập nhật mã ưu đãi: ${cleanCode}`,
      description: `Mã "${cleanCode}": Giảm ${updated.discountValue}${updated.discountType === "percent" ? "%" : "đ"} cho đơn từ ${Number(updated.minOrderAmount || 0).toLocaleString("vi-VN")}đ`,
      snapshotData: [{
        code: cleanCode,
        previous: existing,
        updated,
      }],
      itemCount: 1,
      createdBy: req.user?.name || req.user?.email || "Admin",
    });

    return res.json({
      success: true,
      message: `Cập nhật mã ưu đãi "${cleanCode}" thành công!`,
      voucher: updated,
    });
  } catch (err) {
    console.error("PUT /api/admin/vouchers/:code error:", err);
    return res.status(500).json({
      success: false,
      message: err.message || "Lỗi cập nhật mã ưu đãi",
    });
  }
});

/**
 * DELETE /api/admin/vouchers/:code
 * Xóa mã ưu đãi khỏi Amazon DynamoDB
 */
router.delete("/:code", verifyToken, requireAdmin, async (req, res) => {
  try {
    const { code } = req.params;
    const cleanCode = String(code).trim().toUpperCase();

    const existing = await getVoucherByCode(cleanCode);
    if (!existing) {
      return res.status(404).json({
        success: false,
        message: `Không tìm thấy mã "${cleanCode}" để xóa`,
      });
    }

    // Ghi lại snapshot vào DataHistory trước khi xóa
    await recordHistory({
      actionType: "DELETE",
      entityType: "voucher",
      title: `Xóa mã ưu đãi "${cleanCode}"`,
      description: `Xóa mã ưu đãi ${cleanCode} (${existing.description || existing.discountType || "Ưu đãi"})`,
      snapshotData: [existing],
      itemCount: 1,
      createdBy: req.user?.name || req.user?.email || "Admin",
    });

    await deleteVoucher(cleanCode);

    return res.json({
      success: true,
      message: `Đã xóa mã ưu đãi "${cleanCode}" khỏi DynamoDB!`,
    });
  } catch (err) {
    console.error("DELETE /api/admin/vouchers/:code error:", err);
    return res.status(500).json({
      success: false,
      message: err.message || "Lỗi xóa mã ưu đãi",
    });
  }
});

/**
 * POST /api/admin/vouchers/batch-delete
 * Xóa nhiều mã ưu đãi cùng lúc khỏi Amazon DynamoDB
 */
router.post("/batch-delete", verifyToken, requireAdmin, async (req, res) => {
  try {
    const { codes } = req.body;
    if (!Array.isArray(codes) || codes.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Vui lòng chọn ít nhất một mã ưu đãi để xóa.",
      });
    }

    const cleanCodes = codes.map((c) => String(c).trim().toUpperCase());

    // Thu thập snapshot các mã ưu đãi trước khi xóa
    const snapshots = [];
    for (const c of cleanCodes) {
      const v = await getVoucherByCode(c);
      if (v) snapshots.push(v);
    }

    if (snapshots.length > 0) {
      const preview = cleanCodes.slice(0, 4).join(", ") + (cleanCodes.length > 4 ? `, +${cleanCodes.length - 4} mã khác` : "");
      await recordHistory({
        actionType: "BATCH_DELETE",
        entityType: "voucher",
        title: `Xóa ${snapshots.length} mã ưu đãi`,
        description: `Xóa ${snapshots.length} mã ưu đãi: ${preview}`,
        snapshotData: snapshots,
        itemCount: snapshots.length,
        createdBy: req.user?.name || req.user?.email || "Admin",
      });
    }

    await Promise.all(cleanCodes.map((c) => deleteVoucher(c)));

    return res.json({
      success: true,
      message: `Đã xóa thành công ${cleanCodes.length} mã ưu đãi khỏi DynamoDB!`,
    });
  } catch (err) {
    console.error("POST /api/admin/vouchers/batch-delete error:", err);
    return res.status(500).json({
      success: false,
      message: err.message || "Lỗi xóa danh sách mã ưu đãi",
    });
  }
});

/**
 * POST /api/admin/vouchers/seed
 * Khôi phục / nạp lại các mã ưu đãi mặc định
 */
router.post("/seed", verifyToken, requireAdmin, async (req, res) => {
  try {
    await seedDefaultVouchers();
    const vouchers = await getAllVouchers();
    return res.json({
      success: true,
      message: "Đã nạp lại các mã ưu đãi mặc định vào Amazon DynamoDB!",
      vouchers,
    });
  } catch (err) {
    console.error("POST /api/admin/vouchers/seed error:", err);
    return res.status(500).json({
      success: false,
      message: err.message || "Lỗi nạp mã mặc định",
    });
  }
});

module.exports = router;

