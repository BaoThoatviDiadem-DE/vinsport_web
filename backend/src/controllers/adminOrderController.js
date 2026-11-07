const { sql, poolPromise } = require("../db");
const { uploadOrderToS3 } = require("../utils/s3Service");
const { sendOrderEmail } = require("../utils/emailService");
const { sendOrderToQueue } = require("../utils/sqsService");
const { recordHistory } = require("../utils/historyService");

function normalizePaymentMethod(value) {
  const method = String(value || "").toLowerCase();
  if (method === "bank") return "banking";
  if (method === "cod") return "cod";
  return method || "cod";
}

function normalizePaymentStatus(value) {
  const status = String(value || "").toLowerCase();
  if (["pending", "paid", "failed"].includes(status)) {
    return status;
  }
  return "pending";
}

function normalizeOrderStatus(value) {
  const status = String(value || "").toLowerCase();
  if (["pending", "confirmed", "shipping", "completed", "cancelled"].includes(status)) {
    return status;
  }
  return "pending";
}

function toDbOrderStatus(value) {
  const status = normalizeOrderStatus(value);
  if (status === "pending") return "Pending";
  if (status === "confirmed") return "Confirmed";
  if (status === "shipping") return "Shipping";
  if (status === "completed") return "Completed";
  if (status === "cancelled") return "Cancelled";
  return "Pending";
}

function toDbPaymentStatus(value) {
  const status = normalizePaymentStatus(value);
  if (status === "pending") return "Pending";
  if (status === "paid") return "Paid";
  if (status === "failed") return "Failed";
  return "Pending";
}

function toDbPaymentMethod(value) {
  const method = String(value || "").toLowerCase();
  if (method === "banking" || method === "bank") return "Bank";
  return "COD";
}

const getAdminOrders = async (req, res) => {
  try {
    const pool = await poolPromise;

    const result = await pool.request().query(`
      SELECT
        o.order_id,
        o.order_date,
        o.status AS order_status,
        o.total_amount,
        u.name AS customer_name,
        u.phone AS customer_phone,
        ship.address AS shipping_address,
        pay.method AS payment_method,
        pay.status AS payment_status
      FROM Orders o
      INNER JOIN Users u ON o.user_id = u.user_id
      OUTER APPLY (
        SELECT TOP 1 address, status
        FROM Shipping
        WHERE order_id = o.order_id
        ORDER BY shipping_id DESC
      ) ship
      OUTER APPLY (
        SELECT TOP 1 method, status
        FROM Payments
        WHERE order_id = o.order_id
        ORDER BY payment_id DESC
      ) pay
      ORDER BY o.order_id DESC
    `);

    const orders = result.recordset.map((row) => ({
      id: String(row.order_id),
      order_id: row.order_id,
      customerName: row.customer_name || "Khách hàng",
      phone: row.customer_phone || "",
      address: row.shipping_address || "",
      totalAmount: Number(row.total_amount) || 0,
      paymentMethod: normalizePaymentMethod(row.payment_method),
      paymentStatus: normalizePaymentStatus(row.payment_status),
      orderStatus: normalizeOrderStatus(row.order_status),
      createdAt: row.order_date,
    }));

    return res.json(orders);
  } catch (error) {
    console.error("GET /api/admin/orders error:", error);
    return res.status(500).json({
      message:
        error?.originalError?.info?.message ||
        error.message ||
        "Không thể lấy danh sách đơn hàng",
    });
  }
};

const orderStatusLabelMap = {
  pending: "Chờ xử lý",
  confirmed: "Đã xác nhận",
  shipping: "Đang giao",
  completed: "Hoàn thành",
  cancelled: "Đã hủy",
};

const paymentStatusLabelMap = {
  pending: "Chờ xác nhận",
  paid: "Đã thanh toán",
  failed: "Thất bại",
};

const updateAdminOrder = async (req, res) => {
  const pool = await poolPromise;
  const transaction = new sql.Transaction(pool);
  let started = false;

  try {
    const orderId = Number(req.params.id);
    const {
      paymentStatus = "pending",
      orderStatus = "pending",
      paymentMethod = "cod",
    } = req.body || {};

    if (!orderId) {
      return res.status(400).json({ message: "ID đơn hàng không hợp lệ" });
    }

    const normalizedOrderStatus = normalizeOrderStatus(orderStatus);
    const normalizedPaymentStatus = normalizePaymentStatus(paymentStatus);

    await transaction.begin();
    started = true;

    const orderCheck = await new sql.Request(transaction)
      .input("orderId", sql.Int, orderId)
      .query(`
        SELECT TOP 1
          o.order_id,
          o.status AS order_status,
          o.total_amount,
          u.name AS customer_name,
          pay.payment_id,
          pay.status AS payment_status,
          pay.method AS payment_method
        FROM Orders o
        LEFT JOIN Users u ON o.user_id = u.user_id
        OUTER APPLY (
          SELECT TOP 1 payment_id, method, status
          FROM Payments
          WHERE order_id = o.order_id
          ORDER BY payment_id DESC
        ) pay
        WHERE o.order_id = @orderId
      `);

    if (orderCheck.recordset.length === 0) {
      await transaction.rollback();
      return res.status(404).json({ message: "Không tìm thấy đơn hàng" });
    }

    const currentOrder = orderCheck.recordset[0];
    const oldOrderStatus = normalizeOrderStatus(currentOrder.order_status);
    const oldPaymentStatus = normalizePaymentStatus(currentOrder.payment_status);
    const oldPaymentMethod = normalizePaymentMethod(currentOrder.payment_method);

    const hasOrderStatusChanged = oldOrderStatus !== normalizedOrderStatus;
    const hasPaymentStatusChanged = oldPaymentStatus !== normalizedPaymentStatus;
    const hasPaymentMethodChanged = oldPaymentMethod !== normalizePaymentMethod(paymentMethod);

    await new sql.Request(transaction)
      .input("orderId", sql.Int, orderId)
      .input("status", sql.NVarChar(50), toDbOrderStatus(normalizedOrderStatus))
      .query(`
        UPDATE Orders
        SET status = @status
        WHERE order_id = @orderId
      `);

    if (currentOrder.payment_id) {
      await new sql.Request(transaction)
        .input("paymentId", sql.Int, currentOrder.payment_id)
        .input("status", sql.NVarChar(50), toDbPaymentStatus(normalizedPaymentStatus))
        .query(`
          UPDATE Payments
          SET status = @status
          WHERE payment_id = @paymentId
        `);
    } else {
      await new sql.Request(transaction)
        .input("orderId", sql.Int, orderId)
        .input("method", sql.NVarChar(50), toDbPaymentMethod(paymentMethod))
        .input("status", sql.NVarChar(50), toDbPaymentStatus(normalizedPaymentStatus))
        .query(`
          INSERT INTO Payments (order_id, method, status)
          VALUES (@orderId, @method, @status)
        `);
    }

    await transaction.commit();
    started = false;

    // Ghi lại lịch sử thay đổi nếu có cập nhật trạng thái đơn hàng hoặc thanh toán
    if (hasOrderStatusChanged || hasPaymentStatusChanged || hasPaymentMethodChanged) {
      const changes = [];
      if (hasOrderStatusChanged) {
        changes.push(`TT đơn: ${orderStatusLabelMap[oldOrderStatus] || oldOrderStatus} ➔ ${orderStatusLabelMap[normalizedOrderStatus] || normalizedOrderStatus}`);
      }
      if (hasPaymentStatusChanged) {
        changes.push(`TT thanh toán: ${paymentStatusLabelMap[oldPaymentStatus] || oldPaymentStatus} ➔ ${paymentStatusLabelMap[normalizedPaymentStatus] || normalizedPaymentStatus}`);
      }
      if (hasPaymentMethodChanged) {
        changes.push(`Hình thức: ${oldPaymentMethod} ➔ ${normalizePaymentMethod(paymentMethod)}`);
      }

      const custName = currentOrder.customer_name || "Khách hàng";
      const title = `Cập nhật đơn hàng #${orderId} (${custName})`;
      const description = `Đơn #${orderId} (${custName}) - Tổng tiền: ${Number(currentOrder.total_amount || 0).toLocaleString("vi-VN")}đ. Thay đổi: ${changes.join(", ")}`;

      const snapshotData = [{
        order_id: orderId,
        customer_name: custName,
        total_amount: currentOrder.total_amount,
        previous: {
          order_status: toDbOrderStatus(oldOrderStatus),
          payment_status: toDbPaymentStatus(oldPaymentStatus),
          payment_method: toDbPaymentMethod(oldPaymentMethod),
        },
        updated: {
          order_status: toDbOrderStatus(normalizedOrderStatus),
          payment_status: toDbPaymentStatus(normalizedPaymentStatus),
          payment_method: toDbPaymentMethod(paymentMethod),
        },
        changes,
      }];

      await recordHistory({
        actionType: "UPDATE",
        entityType: "order",
        title,
        description,
        snapshotData,
        itemCount: 1,
        createdBy: req.user?.name || req.user?.email || "Admin",
      });
    }

    sendOrderToQueue(orderId, "STATUS_UPDATED");

    return res.json({
      message: "Cập nhật đơn hàng thành công",
      id: String(orderId),
      paymentStatus: normalizedPaymentStatus,
      orderStatus: normalizedOrderStatus,
    });
  } catch (error) {
    if (started) {
      try {
        await transaction.rollback();
      } catch {}
    }

    console.error("PUT /api/admin/orders/:id error:", error);
    return res.status(500).json({
      message:
        error?.originalError?.info?.message ||
        error.message ||
        "Không cập nhật được đơn hàng",
    });
  }
};

const updateAdminOrderStatus = async (req, res) => {
  try {
    const orderId = Number(req.params.id);
    const { status } = req.body || {};

    if (!orderId) {
      return res.status(400).json({ message: "ID đơn hàng không hợp lệ" });
    }

    const normalizedStatus = normalizeOrderStatus(status);
    const pool = await poolPromise;

    const existed = await pool
      .request()
      .input("orderId", sql.Int, orderId)
      .query(`
        SELECT TOP 1
          o.order_id,
          o.status AS order_status,
          o.total_amount,
          u.name AS customer_name,
          pay.payment_id,
          pay.status AS payment_status,
          pay.method AS payment_method
        FROM Orders o
        LEFT JOIN Users u ON o.user_id = u.user_id
        OUTER APPLY (
          SELECT TOP 1 payment_id, method, status
          FROM Payments
          WHERE order_id = o.order_id
          ORDER BY payment_id DESC
        ) pay
        WHERE o.order_id = @orderId
      `);

    if (existed.recordset.length === 0) {
      return res.status(404).json({ message: "Không tìm thấy đơn hàng" });
    }

    const currentOrder = existed.recordset[0];
    const oldOrderStatus = normalizeOrderStatus(currentOrder.order_status);
    const hasOrderStatusChanged = oldOrderStatus !== normalizedStatus;

    await pool
      .request()
      .input("orderId", sql.Int, orderId)
      .input("status", sql.NVarChar(50), toDbOrderStatus(normalizedStatus))
      .query(`
        UPDATE Orders
        SET status = @status
        WHERE order_id = @orderId
      `);

    if (hasOrderStatusChanged) {
      const custName = currentOrder.customer_name || "Khách hàng";
      const oldLabel = orderStatusLabelMap[oldOrderStatus] || oldOrderStatus;
      const newLabel = orderStatusLabelMap[normalizedStatus] || normalizedStatus;
      const title = `Cập nhật TT đơn hàng #${orderId} (${custName})`;
      const description = `Đơn #${orderId} (${custName}): TT đơn hàng đổi từ "${oldLabel}" ➔ "${newLabel}"`;

      const snapshotData = [{
        order_id: orderId,
        customer_name: custName,
        total_amount: currentOrder.total_amount,
        previous: {
          order_status: toDbOrderStatus(oldOrderStatus),
        },
        updated: {
          order_status: toDbOrderStatus(normalizedStatus),
        },
      }];

      await recordHistory({
        actionType: "UPDATE",
        entityType: "order",
        title,
        description,
        snapshotData,
        itemCount: 1,
        createdBy: req.user?.name || req.user?.email || "Admin",
      });
    }

    sendOrderToQueue(orderId, "STATUS_UPDATED");

    return res.json({
      message: "Cập nhật trạng thái đơn hàng thành công",
      id: String(orderId),
      status: normalizedStatus,
    });
  } catch (error) {
    console.error("PUT /api/admin/orders/:id/status error:", error);
    return res.status(500).json({
      message:
        error?.originalError?.info?.message ||
        error.message ||
        "Không cập nhật được trạng thái đơn hàng",
    });
  }
};

const updateAdminPaymentStatus = async (req, res) => {
  try {
    const orderId = Number(req.params.id);
    const { status, paymentMethod = "cod" } = req.body || {};

    if (!orderId) {
      return res.status(400).json({ message: "ID đơn hàng không hợp lệ" });
    }

    const normalizedStatus = normalizePaymentStatus(status);
    const pool = await poolPromise;

    const existed = await pool
      .request()
      .input("orderId", sql.Int, orderId)
      .query(`
        SELECT TOP 1
          o.order_id,
          o.status AS order_status,
          o.total_amount,
          u.name AS customer_name,
          pay.payment_id,
          pay.status AS payment_status,
          pay.method AS payment_method
        FROM Orders o
        LEFT JOIN Users u ON o.user_id = u.user_id
        OUTER APPLY (
          SELECT TOP 1 payment_id, method, status
          FROM Payments
          WHERE order_id = o.order_id
          ORDER BY payment_id DESC
        ) pay
        WHERE o.order_id = @orderId
      `);

    if (existed.recordset.length === 0) {
      return res.status(404).json({ message: "Không tìm thấy đơn hàng" });
    }

    const currentOrder = existed.recordset[0];
    const oldPaymentStatus = normalizePaymentStatus(currentOrder.payment_status);
    const hasPaymentStatusChanged = oldPaymentStatus !== normalizedStatus;

    if (currentOrder.payment_id) {
      await pool
        .request()
        .input("paymentId", sql.Int, currentOrder.payment_id)
        .input("status", sql.NVarChar(50), toDbPaymentStatus(normalizedStatus))
        .query(`
          UPDATE Payments
          SET status = @status
          WHERE payment_id = @paymentId
        `);
    } else {
      await pool
        .request()
        .input("orderId", sql.Int, orderId)
        .input("method", sql.NVarChar(50), toDbPaymentMethod(paymentMethod))
        .input("status", sql.NVarChar(50), toDbPaymentStatus(normalizedStatus))
        .query(`
          INSERT INTO Payments (order_id, method, status)
          VALUES (@orderId, @method, @status)
        `);
    }

    if (hasPaymentStatusChanged) {
      const custName = currentOrder.customer_name || "Khách hàng";
      const oldLabel = paymentStatusLabelMap[oldPaymentStatus] || oldPaymentStatus;
      const newLabel = paymentStatusLabelMap[normalizedStatus] || normalizedStatus;
      const title = `Cập nhật TT thanh toán đơn #${orderId} (${custName})`;
      const description = `Đơn #${orderId} (${custName}): TT thanh toán đổi từ "${oldLabel}" ➔ "${newLabel}"`;

      const snapshotData = [{
        order_id: orderId,
        customer_name: custName,
        total_amount: currentOrder.total_amount,
        previous: {
          payment_status: toDbPaymentStatus(oldPaymentStatus),
        },
        updated: {
          payment_status: toDbPaymentStatus(normalizedStatus),
        },
      }];

      await recordHistory({
        actionType: "UPDATE",
        entityType: "order",
        title,
        description,
        snapshotData,
        itemCount: 1,
        createdBy: req.user?.name || req.user?.email || "Admin",
      });
    }

    sendOrderToQueue(orderId, "STATUS_UPDATED");

    return res.json({
      message: "Cập nhật trạng thái thanh toán thành công",
      id: String(orderId),
      status: normalizedStatus,
    });
  } catch (error) {
    console.error("PUT /api/admin/orders/:id/payment-status error:", error);
    return res.status(500).json({
      message:
        error?.originalError?.info?.message ||
        error.message ||
        "Không cập nhật được trạng thái thanh toán",
    });
  }
};

const deleteAdminOrder = async (req, res) => {
  try {
    const orderId = Number(req.params.id);
    if (!orderId) {
      return res.status(400).json({ message: "ID đơn hàng không hợp lệ" });
    }

    const pool = await poolPromise;

    // Lưu snapshot đơn hàng trước khi xóa để có thể khôi phục
    const orderRes = await pool.request().input("oid", sql.Int, orderId).query(`
      SELECT o.*, u.name AS customer_name, u.phone AS customer_phone, u.email AS customer_email
      FROM Orders o
      LEFT JOIN Users u ON o.user_id = u.user_id
      WHERE o.order_id = @oid
    `);

    if (orderRes.recordset.length > 0) {
      const order = orderRes.recordset[0];
      const detailsRes = await pool.request().input("oid", sql.Int, orderId).query("SELECT * FROM OrderDetails WHERE order_id = @oid");
      const paymentsRes = await pool.request().input("oid", sql.Int, orderId).query("SELECT * FROM Payments WHERE order_id = @oid");
      const shippingRes = await pool.request().input("oid", sql.Int, orderId).query("SELECT * FROM Shipping WHERE order_id = @oid");

      const snapshot = [{
        order,
        details: detailsRes.recordset,
        payments: paymentsRes.recordset,
        shipping: shippingRes.recordset,
        customerName: order.customer_name,
      }];

      await recordHistory({
        actionType: "DELETE",
        entityType: "order",
        title: `Xóa đơn hàng #${orderId}`,
        description: `Xóa đơn hàng #${orderId} của khách hàng ${order.customer_name || "Khách"} (${Number(order.total_amount || 0).toLocaleString("vi-VN")} đ)`,
        snapshotData: snapshot,
        itemCount: 1,
        createdBy: req.user?.name || req.user?.email || "Admin",
      });
    }

    await pool.request().input("oid", sql.Int, orderId).query(`
      DELETE FROM Payments WHERE order_id = @oid;
      DELETE FROM Shipping WHERE order_id = @oid;
      DELETE FROM OrderDetails WHERE order_id = @oid;
      DELETE FROM Orders WHERE order_id = @oid;
    `);

    return res.json({ success: true, message: "Đã xóa đơn hàng thành công" });
  } catch (error) {
    console.error("DELETE ADMIN ORDER ERROR:", error);
    return res.status(500).json({ message: error.message || "Không thể xóa đơn hàng" });
  }
};

const deleteAdminOrdersBatch = async (req, res) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ message: "Danh sách đơn hàng cần xóa không hợp lệ" });
    }

    const pool = await poolPromise;
    const cleanIds = ids.map(Number).filter((id) => !isNaN(id) && id > 0);

    // Thu thập snapshot các đơn hàng trước khi xóa
    const snapshots = [];
    const orderCodes = [];

    for (const oid of cleanIds) {
      const orderRes = await pool.request().input("oid", sql.Int, oid).query(`
        SELECT o.*, u.name AS customer_name, u.phone AS customer_phone, u.email AS customer_email
        FROM Orders o
        LEFT JOIN Users u ON o.user_id = u.user_id
        WHERE o.order_id = @oid
      `);

      if (orderRes.recordset.length > 0) {
        const order = orderRes.recordset[0];
        orderCodes.push(`#${oid} (${order.customer_name || "Khách"})`);
        const detailsRes = await pool.request().input("oid", sql.Int, oid).query("SELECT * FROM OrderDetails WHERE order_id = @oid");
        const paymentsRes = await pool.request().input("oid", sql.Int, oid).query("SELECT * FROM Payments WHERE order_id = @oid");
        const shippingRes = await pool.request().input("oid", sql.Int, oid).query("SELECT * FROM Shipping WHERE order_id = @oid");

        snapshots.push({
          order,
          details: detailsRes.recordset,
          payments: paymentsRes.recordset,
          shipping: shippingRes.recordset,
          customerName: order.customer_name,
        });
      }
    }

    if (snapshots.length > 0) {
      const preview = orderCodes.slice(0, 3).join(", ") + (orderCodes.length > 3 ? `, +${orderCodes.length - 3} đơn khác` : "");
      await recordHistory({
        actionType: "BATCH_DELETE",
        entityType: "order",
        title: `Xóa ${snapshots.length} đơn hàng`,
        description: `Xóa ${snapshots.length} đơn hàng: ${preview}`,
        snapshotData: snapshots,
        itemCount: snapshots.length,
        createdBy: req.user?.name || req.user?.email || "Admin",
      });
    }

    for (const oid of cleanIds) {
      await pool.request().input("oid", sql.Int, oid).query(`
        DELETE FROM Payments WHERE order_id = @oid;
        DELETE FROM Shipping WHERE order_id = @oid;
        DELETE FROM OrderDetails WHERE order_id = @oid;
        DELETE FROM Orders WHERE order_id = @oid;
      `);
    }

    return res.json({ success: true, message: `Đã xóa thành công ${cleanIds.length} đơn hàng!` });
  } catch (error) {
    console.error("BATCH DELETE ADMIN ORDERS ERROR:", error);
    return res.status(500).json({ message: error.message || "Không thể xóa danh sách đơn hàng" });
  }
};

module.exports = {
  getAdminOrders,
  updateAdminOrder,
  updateAdminOrderStatus,
  updateAdminPaymentStatus,
  deleteAdminOrder,
  deleteAdminOrdersBatch,
};