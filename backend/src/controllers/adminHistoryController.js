const {
  getHistoryList,
  restoreHistory,
  deleteHistoryPermanently,
  deleteHistoryBatch,
} = require("../utils/historyService");

/**
 * GET /api/admin/history
 * Lấy danh sách lịch sử dữ liệu với bộ lọc, phân trang và thống kê
 */
const getAdminHistory = async (req, res) => {
  try {
    const { search, entityType, status, page, limit } = req.query;
    const result = await getHistoryList({
      search,
      entityType,
      status,
      page,
      limit,
    });
    return res.json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error("GET /api/admin/history ERROR:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Không thể tải danh sách lịch sử dữ liệu",
    });
  }
};

/**
 * POST /api/admin/history/:id/restore
 * Khôi phục bản ghi từ snapshot trong DataHistory vào Database
 */
const restoreAdminHistoryItem = async (req, res) => {
  try {
    const { id } = req.params;
    const adminName = req.user?.name || req.user?.email || "Admin";

    const result = await restoreHistory(id, adminName);
    return res.json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error("POST /api/admin/history/:id/restore ERROR:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Không thể khôi phục dữ liệu từ lịch sử",
    });
  }
};

/**
 * DELETE /api/admin/history/:id
 * Xóa vĩnh viễn một bản ghi khỏi lịch sử
 */
const deleteAdminHistoryItem = async (req, res) => {
  try {
    const { id } = req.params;
    await deleteHistoryPermanently(id);
    return res.json({
      success: true,
      message: "Đã xóa vĩnh viễn bản ghi khỏi lịch sử",
    });
  } catch (error) {
    console.error("DELETE /api/admin/history/:id ERROR:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Không thể xóa bản ghi lịch sử",
    });
  }
};

/**
 * POST /api/admin/history/batch-delete
 * Xóa vĩnh viễn nhiều bản ghi khỏi lịch sử
 */
const deleteAdminHistoryBatch = async (req, res) => {
  try {
    const { ids } = req.body;
    const count = await deleteHistoryBatch(ids);
    return res.json({
      success: true,
      message: `Đã xóa vĩnh viễn ${count} bản ghi khỏi lịch sử`,
    });
  } catch (error) {
    console.error("POST /api/admin/history/batch-delete ERROR:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Không thể xóa các bản ghi lịch sử đã chọn",
    });
  }
};

module.exports = {
  getAdminHistory,
  restoreAdminHistoryItem,
  deleteAdminHistoryItem,
  deleteAdminHistoryBatch,
};

