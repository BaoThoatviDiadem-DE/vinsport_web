const { sql, poolPromise } = require("../db");
const { uploadOrderToS3 } = require("../utils/s3Service");

function normalizePaymentMethod(value) {
  const method = String(value || "").toLowerCase();
  if (method === "bank") return "banking";
  if (method === "cod") return "cod";
  if (method === "momo") return "momo";
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
        SELECT TOP 1 order_id
        FROM Orders
        WHERE order_id = @orderId
      `);

    if (orderCheck.recordset.length === 0) {
      await transaction.rollback();
      return res.status(404).json({ message: "Không tìm thấy đơn hàng" });
    }

    await new sql.Request(transaction)
      .input("orderId", sql.Int, orderId)
      .input("status", sql.NVarChar(50), toDbOrderStatus(normalizedOrderStatus))
      .query(`
        UPDATE Orders
        SET status = @status
        WHERE order_id = @orderId
      `);

    const paymentCheck = await new sql.Request(transaction)
      .input("orderId", sql.Int, orderId)
      .query(`
        SELECT TOP 1 payment_id
        FROM Payments
        WHERE order_id = @orderId
        ORDER BY payment_id DESC
      `);

    if (paymentCheck.recordset.length > 0) {
      const paymentId = paymentCheck.recordset[0].payment_id;

      await new sql.Request(transaction)
        .input("paymentId", sql.Int, paymentId)
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

    uploadOrderToS3(orderId);

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
        SELECT TOP 1 order_id
        FROM Orders
        WHERE order_id = @orderId
      `);

    if (existed.recordset.length === 0) {
      return res.status(404).json({ message: "Không tìm thấy đơn hàng" });
    }

    await pool
      .request()
      .input("orderId", sql.Int, orderId)
      .input("status", sql.NVarChar(50), toDbOrderStatus(normalizedStatus))
      .query(`
        UPDATE Orders
        SET status = @status
        WHERE order_id = @orderId
      `);

    uploadOrderToS3(orderId);

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
        SELECT TOP 1 payment_id
        FROM Payments
        WHERE order_id = @orderId
        ORDER BY payment_id DESC
      `);

    if (existed.recordset.length > 0) {
      const paymentId = existed.recordset[0].payment_id;

      await pool
        .request()
        .input("paymentId", sql.Int, paymentId)
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

    uploadOrderToS3(orderId);

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

module.exports = {
  getAdminOrders,
  updateAdminOrder,
  updateAdminOrderStatus,
  updateAdminPaymentStatus,
};